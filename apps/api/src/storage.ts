// Thin client for the dedicated Supabase Storage instance (private object storage for media),
// using the service-role key. Per ADR-0003, Supabase Storage (file backend) is the pragmatic P0
// choice for this vertical slice — revisit before scaling storage beyond a single host.
import { requireEnv } from "./env.js";

const BUCKET = "media";

function base(): string {
  return `http://127.0.0.1:${requireEnv("API_GW_HTTP_PORT")}`;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = requireEnv("SERVICE_ROLE_KEY");
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

export async function ensureBucket(): Promise<void> {
  const res = await fetch(`${base()}/storage/v1/bucket`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
  if (res.ok || res.status === 400) return; // 400 = already exists, treated as idempotent
  throw new Error(`ensureBucket failed: ${res.status} ${await res.text()}`);
}

// Real resumable uploads (TUS), per docs/PRD.md "resumable uploads; interruption recovery" — the
// server creates the resource (service-role, so it can set the exact objectKey/bucket regardless
// of storage RLS), then hands the resulting path to the client, which PATCHes chunks directly to
// storage using its own authenticated session (storage.objects RLS policies in
// supabase/migrations/0008 scope that to the caller's own workspace prefix).
export async function createResumableUpload(objectKey: string, sizeBytes: number, contentType: string): Promise<string> {
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
  const res = await fetch(`${base()}/storage/v1/upload/resumable`, {
    method: "POST",
    headers: headers({
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(sizeBytes),
      "Upload-Metadata": `bucketName ${b64(BUCKET)},objectName ${b64(objectKey)},contentType ${b64(contentType)}`,
    }),
  });
  if (!res.ok) throw new Error(`createResumableUpload failed: ${res.status} ${await res.text()}`);
  const location = res.headers.get("location");
  if (!location) throw new Error("createResumableUpload: missing Location header in response");
  // Return only the path — the API doesn't know or care what public hostname the client will use
  // to reach the gateway (docs/DECISIONS.md item 1, DNS still pending).
  return new URL(location).pathname;
}

export async function createSignedDownloadUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
  const res = await fetch(`${base()}/storage/v1/object/sign/${BUCKET}/${objectKey}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) throw new Error(`createSignedDownloadUrl failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { signedURL: string };
  return `${base()}/storage/v1${body.signedURL}`;
}

export async function objectInfo(objectKey: string): Promise<{ exists: boolean; sizeBytes?: number }> {
  const dir = objectKey.split("/").slice(0, -1).join("/");
  const name = objectKey.split("/").pop()!;
  const res = await fetch(`${base()}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefix: dir ? `${dir}/` : "", search: name, limit: 1 }),
  });
  if (!res.ok) throw new Error(`objectInfo failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ name: string; metadata?: { size?: number } }>;
  const match = rows.find((r) => r.name === name);
  if (!match) return { exists: false };
  return { exists: true, sizeBytes: match.metadata?.size };
}

export async function downloadObject(objectKey: string): Promise<Buffer> {
  const res = await fetch(`${base()}/storage/v1/object/authenticated/${BUCKET}/${objectKey}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`downloadObject failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function uploadObject(objectKey: string, data: Buffer, contentType: string): Promise<void> {
  const res = await fetch(`${base()}/storage/v1/object/${BUCKET}/${objectKey}`, {
    method: "POST",
    headers: headers({ "Content-Type": contentType, "x-upsert": "true" }),
    body: data,
  });
  if (!res.ok) throw new Error(`uploadObject failed: ${res.status} ${await res.text()}`);
}
