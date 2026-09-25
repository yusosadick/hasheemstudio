import { getValidSession } from "./auth";
import { ensureGuest, guestHeaders, clearGuest } from "./guest";

const API_URL = import.meta.env.VITE_API_URL as string;

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = await getValidSession();
  if (!session) await ensureGuest();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...guestHeaders(),
      ...(session ? {Authorization: `Bearer ${session.access_token}`} : {}),
      ...(init.headers ?? {}),
    },
  });
}

export interface UploadSession {
  sessionId: string;
  objectKey: string;
  tusUploadPath: string;
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
  if (!res.ok) {
    let detail: any = null;
    try { detail = await res.json(); } catch { /* non-JSON response */ }
    if (res.status === 413 || detail?.error === "file_too_large") {
      const limit = Number(detail?.limitBytes ?? 100 * 1024 * 1024);
      const limitMb = Math.round(limit / (1024 * 1024));
      throw new Error(`This video is too large. The current limit is ${limitMb} MB.`);
    }
    throw new Error(`Failed to create upload session: ${res.status} ${detail?.message ?? "Please check the file and try again."}`);
  }
  return res.json();
}

export async function finalizeUpload(sessionId: string): Promise<{ mediaAssetId: string }> {
  const res = await authedFetch(`/v1/uploads/sessions/${sessionId}/finalize`, { method: "POST" });
  if (!res.ok) throw new Error(`Finalize failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createJob(mediaAssetId: string, recipe: "inspect" | "remux" | "compat_encode" | "platform_optimize", idempotencyKey?: string): Promise<{ jobId: string; status: string }> {
  const res = await authedFetch("/v1/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaAssetId, recipe, idempotencyKey }),
  });
  if (!res.ok) throw new Error(`Job creation failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface JobSummary {
  verified: boolean;
  inputBytes: number | null;
  outputBytes: number | null;
  reductionPercent: number | null;
  format: { container: "MP4"; video: string | null; audio: string | null };
  platformReady: boolean;
  underWhatsAppLimit: boolean | null;
  completedAt: string | null;
}

export interface JobView {
  id: string;
  status: string;
  recipe: string;
  attemptCount: number;
  errorMessage: string | null;
  verificationReport: Record<string, unknown> | null;
  summary: JobSummary | null;
  updatedAt?: string;
  downloadUrl: string | null;
  hasOutput: boolean;
  requiresLogin: boolean;
  outputExpired: boolean;
  outputRetainUntil: string | null;
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

export class DownloadError extends Error {
  constructor(message: string, public code: string, public resetAt?: string) { super(message); }
}
export async function requestDownload(jobId: string, fileName?: string): Promise<string> {
  const res = await authedFetch(`/v1/jobs/${jobId}/download`, {method:"POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(fileName ? {fileName} : {})});
  const data = await res.json();
  if (!res.ok) throw new DownloadError(data.message ?? "Could not unlock this download. Please try again.", data.error, data.resetAt);
  if (data.guestClaimed) clearGuest();
  return data.downloadUrl;
}

export type PlanCode = "weekly" | "monthly";
export interface PlanInfo { code: PlanCode; name: string; amountTzs: number; days: number; videos: number }
export interface PlansCatalogue { available: boolean; currency: "TZS"; free: { videosPerDay: number }; plans: PlanInfo[] }
export interface Entitlement { free: { perDay: number; usedToday: number }; paid: { videosRemaining: number; videosTotal: number; expiresAt: string; planCodes: PlanCode[] } | null }

export async function getPlans(): Promise<PlansCatalogue> {
  const r = await fetch(`${API_URL}/v1/payments/plans`);
  if (!r.ok) throw new Error("Plans are unavailable right now.");
  return r.json();
}
export async function getEntitlement(): Promise<Entitlement> {
  const r = await authedFetch("/v1/payments/entitlement");
  if (!r.ok) throw new Error("Could not load your plan.");
  return r.json();
}
export async function createStudioPayment(body: { planCode: PlanCode; method: "mobile"; phone: string; firstname: string; lastname: string }): Promise<{ id: string; status: string }> {
  const r = await authedFetch("/v1/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(r.status === 503 ? "Checkout is not available yet." : r.status === 429 ? "Too many payment attempts today. Please try again tomorrow." : "Could not start the payment. Please try again.");
  return r.json();
}
export async function getStudioPayment(id: string): Promise<{ status: string }> {
  const r = await authedFetch(`/v1/payments/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error("Could not check payment status.");
  return r.json();
}
