// Duplicated subset of apps/api/src/storage.ts — see docs/STATUS.md "known gaps".
import { requireEnv } from "./env.js";

const BUCKET = "media";

function base(): string {
  const host = process.env.WORKER_STORAGE_HOST ?? "127.0.0.1";
  const port = process.env.WORKER_STORAGE_PORT ?? requireEnv("API_GW_HTTP_PORT");
  return `http://${host}:${port}`;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = requireEnv("SERVICE_ROLE_KEY");
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
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
