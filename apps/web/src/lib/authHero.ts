// Adapted from yusosadick/zahorozanzibar @ 2fd32cf (Apache-2.0).
// Modified for Hasheem Studio branding, sessions, redirect safety, and verification.
// See third_party/zahorozanzibar/README.md and LICENSE.
/**
 * Hero imagery for auth screens. Files live in `public/images/auth/` and are
 * named after the page: `login.webp`, `register.webp`, etc.
 */
export type AuthHeroPage = 'login' | 'register'

export function authHeroSrc(page: AuthHeroPage): string {
  return `/images/auth/${page}.webp`
}
