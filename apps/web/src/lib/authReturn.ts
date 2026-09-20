export const AUTH_RETURN_KEY = 'hasheemstudio-auth-return';
export function safeReturnPath(candidate: string | null | undefined): string {
  if (candidate === '/app/upload') return candidate;
  if (candidate && /^\/app\/jobs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)) return candidate;
  return '/app/upload';
}
export function authReturnPath(): string {
  try { return safeReturnPath(localStorage.getItem(AUTH_RETURN_KEY)); } catch { return '/app/upload'; }
}
