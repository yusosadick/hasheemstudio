export const AUTH_RETURN_KEY = 'hasheemstudio-auth-return';
export function safeReturnPath(candidate: string | null | undefined): string {
  if (candidate === '/app/upload' || candidate === '/') return candidate;
  if (candidate && /^\/app\/jobs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)) return candidate;
  // The homepage card keeps the finished video in the URL (?job=…) so signing in returns straight to it.
  if (candidate && /^\/\?job=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)) return candidate;
  return '/';
}
export function authReturnPath(): string {
  try { return safeReturnPath(localStorage.getItem(AUTH_RETURN_KEY)); } catch { return '/'; }
}
