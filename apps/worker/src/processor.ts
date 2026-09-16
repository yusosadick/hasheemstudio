// The actual job execution: claim (lease) -> download -> probe -> recipe -> verify -> publish.
// A job stays non-successful until a real playable output exists and a verification report is
// recorded, per docs/ARCHITECTURE.md "Job reliability and media correctness". Cancellation is
// re-checked before publishing so a cancelled job can never later report success.
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { getPool } from "./db.js";
import { downloadObject, uploadObject } from "./storage.js";
import { probe, remux, compatEncode, decodeCheck } from "./ffmpeg.js";

const SCRATCH_ROOT = process.env.WORKER_SCRATCH_DIR ?? "/tmp/hasheemstudio-scratch";
const LEASE_MS = 10 * 60_000;
const WORKER_ID = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function claim(jobId: string): Promise<{ id: string; workspaceId: string; recipe: string; inputObjectKey: string; attemptCount: number; maxAttempts: number } | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const res = await client.query(
      `select j.id, j.workspace_id, j.recipe, j.attempt_count, j.max_attempts, ma.object_key as input_object_key
       from jobs j join media_assets ma on ma.id = j.media_asset_id
       where j.id = $1 and j.status = 'queued'
       for update of j`,
      [jobId],
    );
    if (res.rows.length === 0) {
      await client.query("rollback");
      return null;
    }
    const row = res.rows[0];
    const leaseToken = randomUUID();
    await client.query(
      `update jobs set status = 'processing', lease_token = $2, lease_expires_at = now() + interval '${LEASE_MS} milliseconds', state_version = state_version + 1 where id = $1`,
      [jobId, leaseToken],
    );
    const attemptNumber = row.attempt_count + 1;
    await client.query(
      `insert into job_attempts (job_id, attempt_number, worker_id) values ($1, $2, $3)`,
      [jobId, attemptNumber, WORKER_ID],
    );
    await client.query(`update jobs set attempt_count = $2 where id = $1`, [jobId, attemptNumber]);
    await client.query(
      `insert into job_events (job_id, event_type, payload) values ($1, 'job.processing_started', jsonb_build_object('worker_id', $2::text, 'attempt', $3::int))`,
      [jobId, WORKER_ID, attemptNumber],
    );
    await client.query("commit");
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      recipe: row.recipe,
      inputObjectKey: row.input_object_key,
      attemptCount: attemptNumber,
      maxAttempts: row.max_attempts,
    };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function isStillActive(jobId: string): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(`select status from jobs where id = $1`, [jobId]);
  return res.rows[0]?.status === "processing";
}

async function markFailed(jobId: string, message: string): Promise<void> {
  const pool = getPool();
  await pool.query(`update jobs set status = 'failed', error_message = $2 where id = $1`, [jobId, message]);
  // A failure still counts as a real attempt against the day's quota (docs/PRD.md "Meter ... job
  // attempts") — settle, don't release, the reservation.
  await pool.query(
    `update usage_reservations set status = 'settled', resolved_at = now() where job_id = $1 and status = 'reserved'`,
    [jobId],
  );
  await pool.query(
    `insert into job_events (job_id, event_type, payload) values ($1, 'job.failed', jsonb_build_object('message', $2::text))`,
    [jobId, message],
  );
}

async function requeueForRetry(jobId: string, message: string): Promise<void> {
  const pool = getPool();
  await pool.query(`update jobs set status = 'queued', error_message = $2 where id = $1`, [jobId, message]);
  await pool.query(
    `insert into job_events (job_id, event_type, payload) values ($1, 'job.retry_scheduled', jsonb_build_object('message', $2::text))`,
    [jobId, message],
  );
}

export async function processJob(jobId: string): Promise<void> {
  const claimed = await claim(jobId);
  if (!claimed) {
    console.log(`job ${jobId} was not in 'queued' state at claim time — skipping (already handled or cancelled)`);
    return;
  }

  // Test-only injection point: widens the "processing" window so integration tests (e.g.
  // worker-crash-recovery) can deterministically kill the process mid-flight. No-op (0ms) unless
  // explicitly set; never enabled in a real deployment env file.
  const testDelayMs = Number(process.env.WORKER_TEST_ARTIFICIAL_DELAY_MS ?? 0);
  if (testDelayMs > 0) {
    console.log(`job ${claimed.id}: WORKER_TEST_ARTIFICIAL_DELAY_MS=${testDelayMs}, sleeping before processing`);
    await new Promise((resolve) => setTimeout(resolve, testDelayMs));
  }

  const scratchDir = join(SCRATCH_ROOT, claimed.id);
  await mkdir(scratchDir, { recursive: true });

  try {
    const inputPath = join(scratchDir, "input");
    const inputBuffer = await downloadObject(claimed.inputObjectKey);
    await writeFile(inputPath, inputBuffer);
    const inputChecksum = sha256(inputBuffer);

    const metadata = await probe(inputPath);
    const pool = getPool();
    await pool.query(
      `update media_assets set duration_seconds = $2, width = $3, height = $4, video_codec = $5, audio_codec = $6, container = $7, frame_rate = $8, is_vfr = $9, rotation_degrees = $10, checksum_sha256 = $11
       where object_key = $1`,
      [
        claimed.inputObjectKey, metadata.durationSeconds, metadata.width, metadata.height,
        metadata.videoCodec, metadata.audioCodec, metadata.container, metadata.frameRate,
        metadata.isVfr, metadata.rotationDegrees, inputChecksum,
      ],
    );

    if (!(await isStillActive(claimed.id))) {
      console.log(`job ${claimed.id} was cancelled during probe — aborting before any output is published`);
      return;
    }

    let outputObjectKey: string | null = null;
    let outputSizeBytes: number | null = null;
    let outputChecksum: string | null = null;
    let verificationLevel: string;
    let framesReEncoded: boolean;
    let checks: Record<string, unknown>;

    if (claimed.recipe === "inspect") {
      verificationLevel = "metadata_probe_only";
      framesReEncoded = false;
      checks = { probed: metadata };
    } else if (claimed.recipe === "remux") {
      const outputPath = join(scratchDir, "output.mp4");
      await remux(inputPath, outputPath);
      const decode = await decodeCheck(outputPath);
      const outputBuffer = await readFile(outputPath);
      const outputMetadata = await probe(outputPath);

      const durationDelta = metadata.durationSeconds && outputMetadata.durationSeconds
        ? Math.abs(metadata.durationSeconds - outputMetadata.durationSeconds)
        : null;
      const durationOk = durationDelta === null || durationDelta < 1.0;

      verificationLevel = "remux_stream_copy_plus_full_decode_check";
      framesReEncoded = false;
      checks = {
        decodeCheck: decode,
        durationDelta,
        durationOk,
        inputStreams: { video: metadata.videoCodec, audio: metadata.audioCodec },
        outputStreams: { video: outputMetadata.videoCodec, audio: outputMetadata.audioCodec },
        streamsUnchanged: metadata.videoCodec === outputMetadata.videoCodec && metadata.audioCodec === outputMetadata.audioCodec,
      };

      if (!decode.ok || !durationOk) {
        throw new Error(`Output verification failed: decodeOk=${decode.ok} durationOk=${durationOk}`);
      }

      outputChecksum = sha256(outputBuffer);
      outputObjectKey = `${claimed.workspaceId}/outputs/${claimed.id}.mp4`;
      outputSizeBytes = outputBuffer.length;

      if (!(await isStillActive(claimed.id))) {
        console.log(`job ${claimed.id} was cancelled after processing, before publish — not uploading output`);
        return;
      }

      await uploadObject(outputObjectKey, outputBuffer, "video/mp4");
    } else if (claimed.recipe === "compat_encode") {
      const outputPath = join(scratchDir, "output.mp4");
      await compatEncode(inputPath, outputPath);
      const decode = await decodeCheck(outputPath);
      const outputBuffer = await readFile(outputPath);
      const outputMetadata = await probe(outputPath);

      const durationDelta = metadata.durationSeconds && outputMetadata.durationSeconds
        ? Math.abs(metadata.durationSeconds - outputMetadata.durationSeconds)
        : null;
      // Re-encoding shifts keyframe/GOP boundaries slightly more than a stream copy; a wider
      // tolerance than remux's is expected and still verified, not assumed.
      const durationOk = durationDelta === null || durationDelta < 1.5;
      const isH264 = outputMetadata.videoCodec === "h264";
      const isAac = metadata.audioCodec === null || outputMetadata.audioCodec === "aac";
      const dimensionsPreserved = !metadata.width || !metadata.height
        || (outputMetadata.width! <= metadata.width && outputMetadata.height! <= metadata.height);

      verificationLevel = "compat_encode_full_decode_check";
      framesReEncoded = true;
      checks = {
        decodeCheck: decode,
        durationDelta,
        durationOk,
        inputStreams: { video: metadata.videoCodec, audio: metadata.audioCodec },
        outputStreams: { video: outputMetadata.videoCodec, audio: outputMetadata.audioCodec },
        outputIsH264: isH264,
        outputIsAac: isAac,
        dimensionsPreserved,
        // Honest per docs/ARCHITECTURE.md "no universal quality score fabricated from bitrate" —
        // SSIM/VMAF comparison is not implemented yet (Phase 5+ follow-up), so this field says so
        // explicitly rather than omitting it or inventing a number.
        qualityMetric: "not_computed",
      };

      if (!decode.ok || !durationOk || !isH264 || !isAac || !dimensionsPreserved) {
        throw new Error(
          `Output verification failed: decodeOk=${decode.ok} durationOk=${durationOk} isH264=${isH264} isAac=${isAac} dimensionsPreserved=${dimensionsPreserved}`,
        );
      }

      outputChecksum = sha256(outputBuffer);
      outputObjectKey = `${claimed.workspaceId}/outputs/${claimed.id}.mp4`;
      outputSizeBytes = outputBuffer.length;

      if (!(await isStillActive(claimed.id))) {
        console.log(`job ${claimed.id} was cancelled after processing, before publish — not uploading output`);
        return;
      }

      await uploadObject(outputObjectKey, outputBuffer, "video/mp4");
    } else {
      throw new Error(`Unsupported recipe '${claimed.recipe}' reached the worker`);
    }

    const commitClient = await pool.connect();
    let published = false;
    try {
      await commitClient.query("begin");
      // Conditional on status = 'processing' in the same statement that publishes success — closes
      // the TOCTOU gap an earlier separate isStillActive() read-then-write would leave open. If a
      // cancellation landed in that gap, this UPDATE affects 0 rows and we correctly skip publishing.
      const updateRes = await commitClient.query(
        `update jobs set status = 'succeeded', output_object_key = $2, output_size_bytes = $3, error_message = null
         where id = $1 and status = 'processing'`,
        [claimed.id, outputObjectKey, outputSizeBytes],
      );
      published = (updateRes.rowCount ?? 0) > 0;
      if (published) {
        await commitClient.query(
          `insert into verification_reports (job_id, verification_level, frames_re_encoded, checks, input_checksum_sha256, output_checksum_sha256, tool_versions)
           values ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb)`,
          [
            claimed.id, verificationLevel, framesReEncoded, JSON.stringify(checks),
            inputChecksum, outputChecksum, JSON.stringify({ ffmpeg: "system", worker: WORKER_ID }),
          ],
        );
        await commitClient.query(
          `update job_attempts set finished_at = now(), outcome = 'succeeded' where job_id = $1 and attempt_number = $2`,
          [claimed.id, claimed.attemptCount],
        );
        await commitClient.query(
          `update usage_reservations set status = 'settled', resolved_at = now() where job_id = $1 and status = 'reserved'`,
          [claimed.id],
        );
        await commitClient.query(
          `insert into job_events (job_id, event_type, payload) values ($1, 'job.succeeded', '{}'::jsonb)`,
          [claimed.id],
        );
      }
      await commitClient.query("commit");
    } catch (err) {
      await commitClient.query("rollback").catch(() => {});
      throw err;
    } finally {
      commitClient.release();
    }

    if (!published) {
      console.log(`job ${claimed.id} was cancelled just before commit — not marking succeeded`);
      return;
    }
    console.log(`job ${claimed.id} succeeded (recipe=${claimed.recipe})`);
  } catch (err: any) {
    const message = String(err.message ?? err).slice(0, 2000);
    console.error(`job ${claimed.id} attempt ${claimed.attemptCount} failed:`, message);
    const pool = getPool();
    await pool.query(
      `update job_attempts set finished_at = now(), outcome = 'failed', error_message = $3 where job_id = $1 and attempt_number = $2`,
      [claimed.id, claimed.attemptCount, message],
    );
    if (claimed.attemptCount >= claimed.maxAttempts) {
      await markFailed(claimed.id, message);
    } else {
      await requeueForRetry(claimed.id, message);
      throw err; // let BullMQ's own attempts/backoff drive the retry
    }
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
}
