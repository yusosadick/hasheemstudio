import { getSession } from "./auth";

const API_URL = import.meta.env.VITE_API_URL as string;

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = getSession();
  if (!session) throw new Error("Not signed in");
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init.headers ?? {}),
    },
  });
}

export interface UploadSession {
  sessionId: string;
  objectKey: string;
  uploadUrl: string;
  expiresAt: string;
}

export async function createUploadSession(file: File): Promise<UploadSession> {
  const res = await authedFetch("/v1/uploads/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      declaredSizeBytes: file.size,
      declaredMimeType: file.type || "application/octet-stream",
    }),
  });
  if (!res.ok) throw new Error(`Failed to create upload session: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function putFileToStorage(uploadUrl: string, file: File, anonKey: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { apikey: anonKey, "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload to storage failed: ${res.status} ${await res.text()}`);
}

export async function finalizeUpload(sessionId: string): Promise<{ mediaAssetId: string }> {
  const res = await authedFetch(`/v1/uploads/sessions/${sessionId}/finalize`, { method: "POST" });
  if (!res.ok) throw new Error(`Finalize failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createJob(mediaAssetId: string, recipe: "inspect" | "remux"): Promise<{ jobId: string; status: string }> {
  const res = await authedFetch("/v1/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaAssetId, recipe }),
  });
  if (!res.ok) throw new Error(`Job creation failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface JobView {
  id: string;
  status: string;
  recipe: string;
  attemptCount: number;
  errorMessage: string | null;
  verificationReport: Record<string, unknown> | null;
  downloadUrl: string | null;
}

export async function getJob(jobId: string): Promise<JobView> {
  const res = await authedFetch(`/v1/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Failed to fetch job: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function cancelJob(jobId: string): Promise<void> {
  const res = await authedFetch(`/v1/jobs/${jobId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to cancel job: ${res.status} ${await res.text()}`);
}
