# Studio authentication emails

[IMPLEMENTED] The owner-authorized Hasheem Gaming template design was adapted into
`supabase/auth-email-templates/build.mjs`; no Gaming secrets, customer data, project IDs or
endpoints were imported. Studio owns its charcoal/pink-orange masthead asset. Regenerate with
`node supabase/auth-email-templates/build.mjs` and copy generated HTML into
`apps/web/public/auth-email-templates/` before building web. Templates are public design assets,
not rendered messages. Six templates previewed at 320px in light/dark; evidence in
`docs/evidence/email-templates/`. Preview codes are synthetic.

Confirmation, recovery and email-change templates use `{{ .Token }}` only. No clickable
confirmation URL is rendered. Signup calls `verifyOtp(type: signup)`; recovery calls
`verifyOtp(type: recovery)` before the password form. GoTrue enforces expiry and one-use codes.
Actual GoTrue tests cover wrong, expired and reused codes, signup sessions, recovery sessions
and password update. They generate codes through the admin API in memory; **not inbox proof**.

Live configuration inspected: Resend SMTP, sender `no-reply@hasheemstudio.com`, sender name
Hasheem Studio, confirmation required. Template deployment and readback are recorded in STATUS.
Protected environment keys `MAILER_TEMPLATES_*` map into GoTrue; six digits, ten-minute expiry.
Approved production redirect allowlist: `https://hasheemstudio.com/auth/callback` and
`https://hasheemstudio.com/reset-password`. Google provider callback remains unchanged.

[BLOCKED] Owner-approved inbox required for actual signup and recovery mail delivery. The
`support@hasheemstudio.com` template address follows Studio branding but mailbox receipt/routing
is not verified; operator must confirm it before declaring support contact complete. Privacy
and terms pages describe current implementation; expanded operator policy remains pending.
Email-change/invite/passwordless/reauthentication UI are not enabled by these template files.
No invitation or magic-link feature is claimed. SMTP acceptance is not inbox receipt.
