// Adapted from yusosadick/zahorozanzibar @ 2fd32cf (Apache-2.0).
// Modified for Hasheem Studio branding, sessions, redirect safety, and verification.
// See third_party/zahorozanzibar/README.md and LICENSE.
import { safeReturnPath } from '@/lib/authReturn'
import { Navigate, useSearchParams } from 'react-router-dom'

/**
 * Legacy /register entry point. The progressive `/login` page now handles
 * both sign-in and sign-up in a single email-first flow, so this route
 * simply forwards the `?next=` query string and bounces the user there.
 * Kept as a thin redirect (rather than deleted) so external links,
 * bookmarks, and old marketing CTAs don't 404.
 */
export default function RegisterPage() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const safeNext = next ? safeReturnPath(next) : null
  const to = safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : '/login'
  return <Navigate to={to} replace />
}
