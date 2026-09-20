# Zahoro authentication source attribution

Source: https://github.com/yusosadick/zahorozanzibar
Imported revision: `2fd32cf9a35017a8be256e3a4ff53708864eb596`
License: Apache-2.0; full original license included in this directory.
Owner expressly authorized reuse on 2026-09-20.

Copied and adapted: src/pages/auth/{LoginPage,RegisterPage,ForgotPasswordPage,
ResetPasswordPage,VerifyEmailPage,AuthCallbackPage}.tsx; components/ui/{button,card}.tsx;
components/auth/AuthBrandLink.tsx; lib/authHero.ts; hooks/useAuth.ts auth operations;
supabase/migrations/00061_email_exists_lookup.sql (Hasheem migration 0014);
public/images/auth/{login,register}.webp.

Changes: Hasheem branding and product copy, local design tokens, dedicated Supabase configuration,
strict internal video-return destinations, actual verification instead of assuming URL success,
serialized email lookup throttling, no booking/profile/admin store dependencies, and protected
processed-file ownership retained through login. useAuth and AuthCallbackPage were adapted to
Hasheem's session model. The source's images and progressive form layout are retained.
No credentials, auth users, booking data, or infrastructure from the source project are imported.
