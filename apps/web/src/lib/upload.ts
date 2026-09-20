// Real resumable upload client (TUS 1.0.0) against the dedicated Supabase Storage instance.
// Per docs/PRD.md "resumable uploads; interruption recovery": the server's reported offset is
// always the source of truth (never a locally-cached assumption) — a reload, a previous partial
// attempt, or another tab could have changed it since we last looked.
import { getValidSession } from "./auth";
import { guestHeaders } from "./guest";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const CHUNK_SIZE = 256 * 1024;

const PENDING_KEY = "hasheemstudio-pending-upload";

export interface PendingUpload {
  sessionId: string;
  tusUploadPath: string;
  fileName: string;
  fileSize: number;
  fileModified?: number;
  mediaAssetId?: string;
  idempotencyKey?: string;
}

export function savePendingUpload(p: PendingUpload): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable — resume-after-reload just won't be offered; the upload itself is
    // unaffected since progress is tracked server-side regardless.
  }
}

export function loadPendingUpload(): PendingUpload | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingUpload) : null;
  } catch {
    return null;
  }
}

export function clearPendingUpload(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

export async function uploadFileResumable(
  file: File,
  tusUploadPath: string,
  opts: { onProgress?: (sent: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  const proxy = tusUploadPath.startsWith("/v1/uploads/sessions/");
  const url = `${proxy ? import.meta.env.VITE_API_URL : SUPABASE_URL}${tusUploadPath}`;
  async function headers(): Promise<Record<string,string>> {
    const session = await getValidSession();
    if (!session && !proxy) throw new Error("Your session expired. Sign in to resume this upload.");
    return { "Tus-Resumable":"1.0.0", ...(proxy ? guestHeaders() : {apikey:ANON_KEY}), ...(session ? {Authorization:`Bearer ${session.access_token}`} : {}) };
  }
  const head = await fetch(url, {method:"HEAD", headers:await headers(), signal:opts.signal});
  if (!head.ok) throw new Error(`Could not resume upload (${head.status}).`);
  let offset = Number(head.headers.get("upload-offset"));
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > file.size) throw new Error("Invalid upload progress returned by storage.");
  opts.onProgress?.(offset, file.size);

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        ...await headers(),
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      body: chunk,
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`Upload chunk failed: ${res.status} ${await res.text()}`);
    const newOffset = Number(res.headers.get("upload-offset"));
    if (!Number.isSafeInteger(newOffset) || newOffset <= offset || newOffset > file.size) throw new Error("Storage did not report an upload offset");
    offset = newOffset;
    opts.onProgress?.(offset, file.size);
  }
}
