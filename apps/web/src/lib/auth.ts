// Minimal real auth client against the dedicated Supabase Auth (GoTrue) instance, via the Envoy
// gateway. Deliberately hand-rolled rather than pulling in @supabase/supabase-js — this is a
// vertical-slice proof, not a claim that this is the final client abstraction (see
// docs/STATUS.md Phase 5 for that note).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const STORAGE_KEY = "hasheemstudio-session";

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string };
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (session.expires_at * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (private browsing etc.) — session just won't persist across reloads.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function authRequest(path: string, body: unknown): Promise<Session> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description ?? data.msg ?? data.error ?? `Request failed: ${res.status}`);
  }
  return data as Session;
}

export async function signUp(email: string, password: string): Promise<Session> {
  const session = await authRequest("/auth/v1/signup", { email, password });
  saveSession(session);
  return session;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const session = await authRequest("/auth/v1/token?grant_type=password", { email, password });
  saveSession(session);
  return session;
}

export function signOut(): void {
  clearSession();
}
