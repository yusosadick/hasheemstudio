# Architecture

> Split from `docs/MASTER-PLAN-ORIGINAL.md` Part II §9–14. See `docs/STATUS.md` for what is
> actually deployed versus specified here.

## Stack decisions

- Monorepo: pnpm workspaces, TypeScript strict mode, pinned package-manager version and lockfile.
- Frontend: React.js + Vite + Tailwind CSS, React Router, TanStack Query, Zod and an accessible component foundation. Public marketing prerendering is permitted; application remains React/Vite.
- API: Node.js active LTS selected at implementation time (Node 22 confirmed available on the VPS as of 2026-09-16), TypeScript, Fastify, OpenAPI, structured logs and explicit validation.
- Worker: TypeScript/BullMQ orchestrator launching pinned FFmpeg/FFprobe tools via argument arrays, not shell interpolation.
- Database/auth: dedicated official self-hosted Supabase Docker stack, pinned compatible component versions. Supabase Auth, Postgres, PostgREST and Storage are primary; optional components require resource justification.
- Queue: dedicated Redis with ACL/auth, durable volume, AOF, tested memory policy suitable for BullMQ (`noeviction`), explicit memory limits and monitored persistence.
- Media: private Supabase Storage with supported S3-compatible backend or a dedicated object-store integration validated against resumable-upload needs. Choose ONE authoritative media path in ADR-0003; never duplicate ownership metadata across two independent upload systems without reconciliation.
- Email: Resend SMTP for Supabase Auth; Resend API for transactional job/account messages. Shared message-outbox abstraction and idempotency.
- Runtime: Docker/Compose for isolated initial launch; K3s Kubernetes for dedicated-node scale-out application/worker plane. OCI images run under containerd in K3s; do not assume Kubernetes uses the Docker daemon.
- Observability: OpenTelemetry, Prometheus-compatible metrics, Grafana and central structured logs. Reuse authorised monitoring endpoints only via scoped integration, not shared admin credentials.
- CI: GitHub Actions, registry images addressed by immutable digest, security scans and gated deployment.
- Testing: Vitest, React Testing Library, real Postgres/Supabase integration tests, Playwright, k6; FFmpeg fixture corpus.

## Topology and boundaries

```text
Browser / mobile browser
  | HTTPS
Edge proxy + static CDN (public assets only)
  |-- React static frontend
  |-- /API or api.hasheemstudio.com --> stateless API replicas
  |-- supabase.hasheemstudio.com --> dedicated Supabase gateway
  |-- media.hasheemstudio.com --> private upload/download path

API --> Supabase Auth / Postgres (identity, RLS, jobs, usage, outbox)
API --> short-lived scoped upload grants / signed downloads
Postgres outbox --> dispatcher --> Redis/BullMQ
Redis --> separate remux / encode / validation worker pools
Workers --> private media storage + bounded scratch volumes
Workers --> report/output records via narrow service interfaces
Email outbox --> Resend
Metrics/logs --> monitoring; verified offsite backups --> separate failure domain
```

Large files must bypass JSON API buffering and frontend memory. Proxy/protocol/body limits must be tested with a permitted maximum-size file, not guessed from provider advertising. A CDN vendor's upload limits can break this architecture; use a compatible direct media hostname/path where necessary while preserving origin protections.

### Public/private hostnames

- `hasheemstudio.com`: public site and application.
- `www.hasheemstudio.com`: canonical redirect.
- `api.hasheemstudio.com`: application API if not same-origin routed.
- `supabase.hasheemstudio.com`: restricted routes needed for Auth/REST/Storage, not unrestricted Studio/meta administration.
- `media.hasheemstudio.com`: only if chosen upload architecture needs it.
- `status.hasheemstudio.com`: optional externally monitored status page.
- `mail.hasheemstudio.com`: proposed verified Resend sending subdomain, not assumed inbound mailbox.

Postgres, Redis, Docker socket, Supabase Studio/meta, monitoring admin and Kubernetes API must not be publicly exposed. Use SSH/VPN and scoped access. Browser Supabase anon/publishable key is intentionally public; service-role key is not.

## Job reliability and media correctness

### Database is authoritative

State machine: `created → uploading → inspecting → queued → processing → verifying → succeeded`; controlled terminal alternatives: `failed`, `cancelled`, `expired`. Upload sessions have separate completion state. Record attempts separately from logical jobs.

Use versioned transitions/compare-and-swap, leases, heartbeat and fencing tokens. Duplicate queue deliveries are expected; outputs and usage commits must be idempotent. Outbox records are transactionally created with jobs. A reconciler repairs undispatched work and stale leases. Redis loss must not erase the list of accepted jobs.

Worker writes to attempt-specific output paths. Publish canonical result only if it still holds a valid lease and the job is not cancelled/expired. Bound retry count, exponential backoff with jitter, dead-letter inspection and manual redrive. Release quota reservations exactly once with unique ledger constraints. Enforce per-workspace fairness and separate expensive encode work from lightweight remuxing.

### Validation

- Validate magic bytes/container, server-measured size, duration, stream count, resolution, frame count estimates and allowed codec combinations.
- Reject malformed/pathological media safely; cap probe/processing time, threads, output size and scratch disk.
- Restrict FFmpeg protocols to required local inputs; deny remote URLs/playlists/SSRF and arbitrary filesystem traversal.
- Non-root worker, dropped capabilities, no privileged containers, read-only root filesystem, scoped writable scratch, seccomp/AppArmor where available. No host Docker socket.
- Network access only to required queue, object storage and trusted control/data services; no arbitrary internet from the media subprocess.
- Never execute file names as shell fragments. Decode failures are errors, not success with a broken file.

### Recipe semantics

- Inspect: no transformation; report only.
- Remux: copy supported streams into a compatible container, optionally fast-start; explain which metadata changes. Reject or propose conversion when incompatible; never silently re-encode.
- Compatibility encode: explicit H.264/AAC policy, sensible pixel format and supported dimensions; handle VFR deliberately, preserve aspect ratio and orientation.
- Platform optimize (`platform_optimize`): a re-encode whose bitrate ceiling is planned from the input's display size and frame rate — see "Platform-optimize recipe" below. This recipe is the default on the web UI. Remux keeps the source bitrate; this recipe exists because a 91 Mbps drone clip remuxes to a ~58 MB file that social platforms will recompress on their own terms.
- HDR: preserve accurately for supported paths or perform an explicit tested tone-map; otherwise refuse unsupported conversion. Never silently wash out colours.
- Optional audio: handle absent audio, multiple tracks and unsupported codecs with explained selection rules.
- Do not upscale or increase FPS by default; never equate higher bitrate with recovered detail.
- Remove sensitive location/device metadata only when requested/default privacy policy allows, without stripping necessary colour/rotation information accidentally.

### Platform-optimize recipe (`platform_optimize`, profile v1)

Full data: `docs/evidence/platform-optimize/` (`results.json` summary, `experiments.jsonl` 59 encode runs, `production-runs.jsonl`, `quality-analysis.jsonl`). Code: `apps/worker/src/platformProfile.ts` (pure, unit-tested), `platformOptimize()` in `ffmpeg.ts`, branch in `processor.ts`.

**What platforms publish (fetched from the primary pages, 2026-09-25)**

| Platform | Published | Not published |
|---|---|---|
| TikTok ([ads specs](https://ads.tiktok.com/help/article/video-ads-specifications)) | bitrate >= 516 kbps; <= 500 MB; <= 10 min; mp4/mov/mpeg/3gp/avi | any maximum bitrate, codec, frame rate |
| Instagram Reels ([Meta Graph API](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/)) | HEVC/H.264 progressive, **closed GOP**, 4:2:0; AAC <= 48 kHz, 1-2 ch, 128 kbps; 23-60 fps; <= 1920 px horizontal; **VBR 25 Mbps max**; moov first, **no edit lists**; 300 MB, 15 min (Stories video: 100 MB, 60 s) | a recommended target bitrate |
| WhatsApp ([Cloud API media](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media)) | MP4/3GP <= **16 MB**; **H.264 + AAC only**; one audio stream; **H.264 High + B-frames unsupported on Android clients, use Main without B-frames or Baseline**; faststart | a bitrate |
| YouTube reference ([help](https://support.google.com/youtube/answer/1722171)) | recommended SDR upload: 1080p 8 / 12 Mbps (24-30 / 48-60 fps), 720p 5 / 7.5, 480p 2.5 / 4, 4K 35-45 / 53-68 | — |

**The honest uncertainty:** no platform publishes a bitrate at which it will skip re-encoding, and TikTok/Instagram/WhatsApp publish only minimums, maximums and limits — never a recommended target. Third-party "TikTok wants 6-8.5 Mbps" figures are not TikTok publications and are not used. The ceilings below are engineering choices anchored on the one official per-resolution table (YouTube's), bounded by the published minimum (516 kbps) and maximum (25 Mbps), and validated by measurement. They are not claims about any platform's internals. WhatsApp's 16 MB limit is a byte limit, so whether a file fits depends on duration; the verification report states `whatsappCloudApi16MB` as a fact about the output.

**Plan (`planPlatformProfile`)**: display size after rotation (a 3840x2160 clip with rotation 90 is 2160x3840); never upscale; shrink only past the product ceiling (docs/PRD.md: 1080p60), keeping aspect ratio in either orientation (1920x1080 or 1080x1920); frame rate capped at 60. Ceiling by output short side and frame rate (interpolated between 30 and 60 fps): 1080p 8000-12000 kbps, 720p 5000-7500, 480p 2500-4000, 360p 1000-1500. Never planned above 90% of the source's own video bitrate (so a small source is not inflated), never below 516 kbps.

**Encode**: capped CRF 23 (`-maxrate` = ceiling, `-bufsize` = 1 s, `vbv-init=0.5`), H.264 **Main, no B-frames**, level 4.2, yuv420p, closed GOP with a keyframe every ~2 s, AAC-LC 48 kHz stereo 128 kbps, `+faststart`, `-use_editlist 0`. HDR (PQ/HLG, e.g. iPhone HLG / Dolby Vision base layer, HDR10) sources are shrunk to the output size and then tone-mapped to 8-bit BT.709 with libzimg `zscale` + `tonemap=hable` (the production ffmpeg has both), so they are not washed out (HDR rule above); the output is tagged BT.709. Measured on real HDR10 4K footage: a naive conversion is visibly grey and flat, the tone-mapped frame has proper contrast and colour (`docs/evidence/platform-optimize/hdr-*.jpg`); with an exact-inverse curve the pipeline reproduces an SDR original (HLG VMAF 98.3, PQ 86.7 / SSIM 0.98). Tone-mapping runs in float32 and costs +30-56% encode time, so the time model adds a tone-map term and doubles HDR estimates (observed worst under-prediction 1.98x). Dolby Vision RPU metadata is ignored; the HLG/HDR10 base layer is used.

**Why these choices (measured, not assumed)**
- *Capped CRF, not two-pass* (same ceiling, preset fast): two-pass hit the target (7975/8102/12076/11954 kbps) but inflated easy content — a 4.2 Mbps 1080p60 source became **12 Mbps (~3x its own size)** — and took ~55% longer; capped CRF gave 4590 kbps / VMAF 95.7 on typical 1080p30 vs two-pass 8102 / 98.1. Capped CRF's one weakness, overshooting the ceiling on short hard clips because the VBV buffer starts full (drone 9269 vs 8000), is removed by a 1 s buffer + `vbv-init=0.5` (7998 and 12000 kbps against 8000/12000 ceilings).
- *Main / no B-frames*: costs 0.9-2.7 VMAF (or 7-12% bitrate) versus High + B-frames on the three sources tested — under one JND (6 points) — in exchange for Android WhatsApp compatibility per Meta's documentation.
- *Presets*: `faster` matches `medium` quality (VMAF 94.46 vs 94.6) at ~1.8x the speed; `veryfast` loses 1.5-4.7 VMAF; `superfast`/`ultrafast` are excluded (typical 1080p30: 7.2 Mbps vs 4.4 Mbps, +62%; hard 1080p50 under the cap: VMAF 71.6 / 61.7 vs 80.0). `choosePreset` uses a conservative throughput model (decode 60 MP/s, encode 45 / 80 MP/s for faster / veryfast) measured on a loaded shared host: predictions 28/24/49/32 s vs actual 23.9/17.8/23.1/27.9 s. Per-process timeout for this recipe is 8 minutes (below the 10-minute job lease); a job predicted to overrun even at `veryfast` (e.g. 10 minutes of 4K) is refused up front instead of burning three timed-out attempts.

**Verification** (same gates as the other re-encodes plus recipe-specific): full decode with any stderr = failure; duration within 1.5 s; H.264 output, AAC if the source had audio; output size exactly as planned; frame rate <= plan; profile Main and no B-frames; average bitrate within the VBV bound. The report records the plan, sizes/reduction, `moovBeforeMdat`, `hasEditList`, `whatsappCloudApi16MB`, and predicted vs actual encode seconds. `qualityMetric` stays `not_computed` per job: the production ffmpeg (5.1.9 Debian) has no libvmaf, so VMAF/SSIM are measured offline with `tests/eval/quality-compare.mjs` (VMAF `vmaf_v0.6.1`, frames paired by index with a frame-count guard) and never fabricated per job.

**Measured results (real production jobs, files analysed independently)**

| Source | In | Out | Reduction | Ceiling / achieved | VMAF (min) / SSIM | Clears 93? |
|---|---|---|---|---|---|---|
| 4K drone, 29.97 fps HEVC, portrait | 58,592,373 | 5,138,861 | 91.2% | 8000 / 8001 kbps | 74.2 (58.1) / 0.955 at 1080p; 48.8 vs the 4K reference | no |
| Natural 1080p30 | 31,079,695 | 5,974,735 | 80.8% | 8000 / 4767 kbps | 95.6 (88.2) / 0.997 | **yes** (>= 95) |
| Real 1080p60 (BBB, already 4.2 Mbps) | 7,643,986 | 4,685,920 | 38.7% | 3771 / 3728 kbps | 87.3 (59.0) / 0.993 | no |
| Hard 1080p50 (crowd_run) | 82,758,928 | 10,816,920 | 86.9% | 10667 / 10788 kbps | 75.6 (64.8) / 0.976 | no |

Thresholds (cited): VMAF 93 = "either indistinguishable from original or with noticeable but not annoying distortion" (Rassool, IEEE 2017); VMAF 95 = "on average subjectively indistinguishable" (Kah et al., SPIE 11842-38, 2021) — both as quoted by Fora Soft's quality-target article; 6 VMAF points ~ 1 JND (Netflix, via Ozer 2017). **Only one of four sources clears 93 at its ceiling, and that is stated plainly:** the bitrate for VMAF 93 (interpolated from the CRF sweep) is ~3.4 Mbps for typical natural 1080p30, but ~20 Mbps for the drone clip at 1080p and ~24 Mbps for crowd_run — several times any published or recommended platform bitrate — and the BBB source, already compressed to 4.2 Mbps, cannot be re-encoded smaller at >= 93 (plain CRF 23 gave 92.15 at 4.9 Mbps, larger than the source). The recipe therefore trades quality for a platform-safe, predictable file on hard content; raising ceilings is an owner decision (docs/DECISIONS.md). Test sources: the real drone clip (4K **29.97** fps, not 60), two natural Xiph.org Derf sequences (1080p30, 1080p50) and a real 1080p60 stream (Big Buck Bunny, animation); no natural 60 fps source was available.

### Output verification

FFprobe output report, duration/stream consistency checks, decode test, container integrity and browser playback test. For remux, decoded-frame/audio checks over fixtures establish preservation; full checks can be costly. Production reports must accurately distinguish full verification, sampled checks and not-performed checks. An unchanged stream-copy command is not itself proof. For re-encodes, use suitable optional SSIM/VMAF analysis on supported comparable sources and disclose limitations; no universal quality score fabricated from bitrate.

Record input/output checksums for integrity, recipe version, tool version, timestamps and verification level. Maintain licensed/generated fixtures for portrait, landscape, rotated, VFR, silent, multiple audio tracks, SDR/HDR, corrupted and near-limit files.

## Data model and RLS

Proposed tables (SQL migration definitions, constraints and indexes required — see `supabase/migrations/`):

- `profiles`: auth user FK, display name, locale; no client-writable admin flag.
- `workspaces`, `workspace_members`: composite uniqueness, owner/admin/editor/viewer roles.
- `plans`, `entitlements`: versioned immutable definitions and active assignment.
- `upload_sessions`: workspace, object key, expiration, reserved bytes, completion state.
- `media_assets`: workspace, validated metadata, private object key, lifecycle state, checksum.
- `presets`, `preset_versions`: built-in immutable recipes and permitted user overrides.
- `jobs`, `job_attempts`, `job_events`: workspace ownership, unique idempotency key, state version, lease, recipe, input/output references.
- `verification_reports`: verification method, measured results and explicit unverified fields.
- `usage_reservations`, `usage_ledger`: unique operation reference, resource units, settlement status.
- `outbox_events`, `email_deliveries`, `webhook_events`: replay-safe dispatch and provider ID uniqueness.
- `platform_admins`: server-only administrative membership with controlled promotion.
- `audit_events`: append-only actor/action/target records, redacted before/after values.
- `deletion_requests`: scope, deadlines and physical deletion attempts.
- P1: `invitations`, `billing_accounts`, `subscriptions`, `payment_events`.

RLS is enabled on every browser-accessible application table and private storage path. Membership is checked server-side; never trust a submitted workspace ID alone. Role/plan/usage/job-success fields are server-controlled. Membership helpers must avoid recursive RLS and unsafe SECURITY DEFINER search paths; explicitly revoke unwanted function execution privileges.

Index `(workspace_id, created_at DESC, id)` for history and appropriate lease/status/expiry lookups. Avoid indexing JSON blindly. Set statement timeouts, pagination bounds and pool limits. Use a transaction pooler for ordinary API traffic where compatible; use direct or session connections for migrations/locks. Worker credentials must not be freely equivalent to a frontend user's session. Centralise elevated data access into narrow audited functions/interfaces.

## Docker launch and Kubernetes path

### Stage A — isolated Docker launch on existing VPS

Use Compose project name `hasheemstudio`, project-specific networks/volumes, declarative attachment to the existing edge proxy ONLY for intended ingress services. No new service may claim public 80/443. Configure resource limits, restart policy, healthchecks, graceful shutdown, bounded logs and immutable image digests.

Dedicated Supabase official stack with its own credentials and mounted state; private Studio over SSH only. Pin upstream Compose source revision and record every local override. Do not invent a partial Supabase clone and call it supported.

### Stage B — real Kubernetes rehearsal, then dedicated-node rollout

Deliver `infra/k8s/base` plus staging/production overlays and validate them against a real cluster. Use a disposable local/k3d/kind environment for rehearsal if resources permit; this is NOT proof of production HA. Production K3s belongs on approved dedicated nodes unless a shared-host networking impact plan is specifically approved.

Kubernetes application layer: web/API Deployments, separate worker Deployments or controlled Jobs, resource requests/limits, startup/readiness/liveness probes, graceful draining, topology spread, scoped ServiceAccounts, Pod Security, NetworkPolicies, namespace ResourceQuotas, PodDisruptionBudgets appropriate to replica count, TLS ingress and secret handling. HPA for API; queue-depth scaling via KEDA for workers, with min/max bounds and database connection/storage constraints. Scaling pods does not create hardware; document who supplies new nodes and how.

Keep stateful Supabase/Postgres and object storage on dedicated persistent infrastructure initially. Do not move them into naive single-PVC manifests just to say everything is Kubernetes. ADR must describe connectivity, TLS, backups and future Postgres replication/failover. Redis replicas/sentinel/managed equivalent only with tested client support and failover semantics.

For true HA, plan three control-plane nodes across actual failure domains, at least two application/worker nodes as appropriate, redundant edge, database failover and replicated storage. Three VMs on one physical VPS are not three failure domains. No infrastructure purchasing without approval. If nodes/budget are absent, Stage A may be beta-ready; Kubernetes production scale-out remains explicitly pending, not silently omitted.

K3s defaults can conflict with existing Traefik, ServiceLB, firewall, Pod/Service CIDRs and VPN routes. Discover existing routes before installing. Never disable the host firewall because a quick-start guide suggests it. Cluster management and node traffic are private/allowlisted; no public anonymous control plane.

## Resend and DNS configuration

See `docs/DECISIONS.md` and `docs/STATUS.md` for current DNS/Resend blocker status. Procedure (from the master plan):

1. Discover domain registrar/DNS authority and owner-approved access; present required records if secure automation access is unavailable.
2. Add only project-scoped A/AAAA/CNAME records; do not publish IPv6 unless tested end-to-end.
3. Verify domain ownership in Resend for proposed `mail.hasheemstudio.com`.
4. Apply provider-returned SPF/DKIM/return-path records exactly. Never invent DKIM values or add conflicting SPF TXT records.
5. Add appropriate DMARC policy with owner-approved reporting; understand existing mail configuration before tightening policy. Do not overwrite root MX records for an unrelated mailbox.
6. Configure verified sender such as `Hasheem Studio <noreply@mail.hasheemstudio.com>`; reply-to is an owner-confirmed support mailbox, not an assumed mailbox created by Resend.
7. Configure Auth SMTP securely and transactional API key with least scope; preserve TLS verification and production redirect allowlist.
8. Verify signup and reset deliveries to an approved test inbox, header alignment, provider webhook signature validation, deduplicated events, retries and suppression for bounces/complaints.
9. Disable click tracking on security links; never log full reset/verification tokens.
10. If inbox access is absent, report provider delivery evidence separately from inbox verification. Do not mark the complete auth-email flow passed.

## Security and operations

Threat model must cover cross-tenant access, hostile media, SSRF, command injection, upload abuse, role escalation, leaked signing URLs, queue replay, webhook replay, invitation abuse, credential leakage and resource exhaustion. Full detail in `docs/SECURITY.md`.
