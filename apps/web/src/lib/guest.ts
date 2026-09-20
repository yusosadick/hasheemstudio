const KEY = "hasheemstudio-guest";
let token: string | null = null;
let pending: Promise<string> | null = null;
export function getGuestToken(): string | null {
  try {
    const expires = Number(localStorage.getItem(`${KEY}-expires`));
    if (expires && expires < Date.now()) { clearGuest(); return null; }
    return token ?? localStorage.getItem(KEY);
  } catch { return token; }
}
export async function ensureGuest(): Promise<string> {
  if (getGuestToken()) return getGuestToken()!;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/v1/guest-sessions`, {method:"POST"});
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Guest processing is unavailable. Please sign in.");
    token = data.token;
    try { localStorage.setItem(KEY, token!); localStorage.setItem(`${KEY}-expires`,String(Date.now()+24*60*60*1000)); } catch { /* current tab still works */ }
    return token!;
  })().finally(() => { pending = null; });
  return pending;
}
export function guestHeaders(): Record<string,string> {
  const value = getGuestToken();
  return value ? {"X-Guest-Token":value} : {};
}
export function clearGuest(): void {
  token = null;
  try { localStorage.removeItem(KEY); localStorage.removeItem(`${KEY}-expires`); } catch { /* optional storage */ }
}
