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

export async function createSignedUploadUrl(objectKey: string): Promise<{ url: string; token: string }> {
  const res = await fetch(`${base()}/storage/v1/object/upload/sign/${BUCKET}/${objectKey}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: "{}",
  });
  if (!res.ok) throw new Error(`createSignedUploadUrl failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { url: string };
  const url = new URL(body.url, base() + "/storage/v1");
  const token = url.searchParams.get("token") ?? "";
  return { url: `${base()}/storage/v1${body.url}`, token };
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
