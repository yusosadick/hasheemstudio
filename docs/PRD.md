# Hasheem Studio — Product Requirements Document

> Split from `docs/MASTER-PLAN-ORIGINAL.md` Part I. That file remains the retained original if this
> split ever needs reconciling. Status of each requirement against current implementation is
> tracked in `docs/STATUS.md`, not here — this document states *what is required*, not what exists.

**Owner:** Yusufu Sadiki Rajabu / Bisso Technologies Ltd
**Product:** Hasheem Studio
**Purchased domain:** https://hasheemstudio.com
**Repository:** https://github.com/yusosadick/hasheemstudio.git

## 1. Product strategy

**Positioning:** Your video's best upload starts here.

**Value proposition:** Inspect a video, understand what needs changing, create a platform-appropriate output, and verify what changed before publishing.

**Trust principle:** Explain every transformation. Distinguish metadata/remux-only processing from re-encoding and AI-generated enhancement. Never imply remuxing adds detail that the source did not contain.

**Primary users**

- Independent short-form creators working from phones or laptops.
- Gaming creators whose footage includes high frame rates and fast motion.
- Social-media managers processing batches for customers.
- Editors needing reliable delivery formats and technical proof.
- Later: agencies and API integrations.

**Business differentiators**

- Honest output verification and intelligible technical reports.
- Reliable uploads on unstable networks.
- International-ready, mobile-first, accessible interface.
- Fast paths for files that do not need expensive conversion.
- Privacy-by-default retention and visible deletion controls.
- Predictable quotas and transparent processing costs.

## 2. Product scope and release boundaries

### Public beta / P0: must genuinely work

- Responsive landing page, product tour, pricing/limits, documentation, privacy and terms.
- Email/password registration, verification, login, reset, logout, account deletion request.
- Self-hosted Supabase Auth with real Resend SMTP delivery.
- Personal workspace created atomically on registration; tenant-aware data model from day one.
- Upload wizard with drag/drop and accessible file picker; supported MP4/MOV initially.
- Server-side media validation; browser metadata is advisory only.
- Resumable uploads; interruption recovery where the browser still has access to the same file.
- Inspector: duration, dimensions, rotation, codec, frame rate, VFR/CFR, audio, colour/HDR metadata when detectable.
- Transparent recipe selection: inspect-only, compatible MP4 remux, H.264/AAC compatibility encode, versioned platform presets.
- Asynchronous jobs with real stages, cancellation, bounded retries and recoverable failures.
- Side-by-side original/output playback, technical differences and verification report.
- Private signed downloads, history, deletion, retention countdown.
- Server-enforced limits, fair scheduling, usage ledger, operator-controlled beta entitlements.
- Admin operational console with audited role changes and resource controls.
- Resend transactional events, retry and bounce handling.
- Monitoring, tested backups, migration workflow, rollback, runbooks and security tests.

### P1: after stable beta

- Bounded batch jobs and asynchronously generated ZIP downloads.
- User-saved presets; sensible Instagram Reels / YouTube Shorts / TikTok preparation profiles.
- 9:16 cropping, manually adjustable crop, blur background, safe-area overlays and preview.
- Agency workspace invitations, member roles and pooled allowances.
- Honest upload-readiness checklist with explained scoring, not a hidden quality guarantee.
- Optional Google OAuth and Telegram/Discord sign-in after provider configuration and account-linking security review.
- Billing adapter connected to an owner-approved processor; international cards and regional payments based on actual business availability.

### P2: independently funded/validated extensions

- GPU denoising, upscaling and interpolation with clear cost and synthetic-frame disclosures.
- Captions/transcription with consent, language accuracy tests and model licensing review.
- Documented API keys, per-key limits and client webhooks with SSRF controls.
- Affiliate programme with fraud checks, reconciliation and approved payouts.
- Post-publication analytics only via permitted APIs or authorised user connections.
- Direct publishing only after platform API approval; do not scrape protected content or promise unavailable scopes.

**Explicit exclusions from P0:** a full timeline editor, guaranteed platform compression avoidance, permanent cloud video library, unlimited file sizes, unbounded anonymous processing, unconfigured paid checkout, autonomous purchases, unlicensed AI models, copied competitor code or branding.

## 3. User journey and acceptance criteria

### A. Discovery and registration

Visitor sees a clear product explanation, factual demos, supported formats and visible beta limits. No invented testimonials or fabricated counters. Register → receive verification → verify → land in workspace. Reset links use exact allowed redirects. Expired links have recovery states. Real inbox verification is a launch gate, not merely an HTTP 200 from Resend.

### B. Upload and inspection

1. Select a local file; disclose limits, retention and estimated operation type.
2. API verifies a signed-in account or a private guest capability, workspace, and processing admission capacity. Download allowances are checked separately at download time.
3. Create a private scoped upload session; upload media directly to the media/storage path, not through the frontend server.
4. Persist resumable upload identity. After reload, request file re-selection if the browser cannot recover the file handle. Never promise impossible automatic file access.
5. Finalisation verifies server-side object existence, size, ownership and expected session state.
6. Probe in a sandbox before processing. Show accurate findings and recommended action.

Acceptance: interrupted network resumes without duplicate billing; unauthorised users cannot upload into another workspace; forged MIME/dimensions/size do not bypass validation; abandoned multipart sessions are cleaned up.

### C. Processing and results

User confirms a recipe → reserved job is dispatched → worker verifies recipe/version → output generated → report validated → object committed → job succeeds → sign in if needed → server checks daily download allowance → private download available. Checkout must be configured before payment can unlock more downloads.

Show real stages: uploading, inspecting, queued, processing, verifying, ready. Show indeterminate activity where progress cannot be measured. No fake percentages or fake ETA. Job stays non-successful until playable output and verification exist.

Acceptance: a killed worker leads to bounded retry/recovery, not endless processing; cancellation prevents a later success publication; repeated requests do not consume allowance twice; result shows whether frames were re-encoded.

### D. Deletion and privacy

Delete individual files/jobs or request account deletion. Immediately revoke new download grants, track physical deletion, explain any short-lived signed URLs and backup retention. Avoid private-media CDN caching; previously downloaded files cannot be revoked. Deletion UI must not imply that copies on the user's device can be removed.

Acceptance: retention sweeper deletes input/output/thumbnail/multipart remnants; retries failed deletions; legal retention exceptions apply only where needed and are documented.

## 4. Screens and information architecture

Public: `/`, `/features`, `/pricing`, `/how-it-works`, `/tools/video-inspector`, `/privacy`, `/terms`, `/status`.

Identity: `/login`, `/signup`, `/verify`, `/forgot-password`, `/reset-password`.

Workspace: `/app`, `/app/upload`, `/app/jobs/:id`, `/app/history`, `/app/presets`, `/app/settings/profile`, `/app/settings/security`, `/app/settings/usage`, `/app/settings/workspace`.

Admin: `/admin/overview`, `/admin/jobs`, `/admin/users`, `/admin/limits`, `/admin/audit`. Separate administrative permission checks; hiding navigation is not authorisation.

Each screen needs loading, empty, validation, unauthorised, rate-limited, offline, expired-session and server-error states. Preserve completed uploads across UI retries. Keyset pagination for history. No infinite uncontrolled query polling.

## 5. Design system

See `docs/DESIGN-SYSTEM.md` for exact tokens and visual direction (kept separate since it has its own approval gate in Phase 1).

## 6. Plans, quotas and commercial model

Start with a beta entitlement model, not unintegrated payment buttons. Suggested initial limits are configurable hypotheses, not final pricing:

- Verified Free (owner update 2026-09-20): 100 MB/file, 2-minute duration, 1080p/60, one distinct video download/day (UTC), one active processing job. The separate three-processing-attempts/day abuse cap does not replace the download allowance. Guests may upload/process before account creation; login claims their private workspace on the first successful download. Repeat downloads of an unlocked video do not consume another allowance.
- Pro Beta: up to 500 MB/file and 10 minutes, selected 4K recipes only after benchmark, two active processing jobs, monthly compute budget.
- Agency: negotiated storage/compute/bandwidth budget; bounded batch size and team membership.

All plans have hard resource caps. Meter input bytes, output bytes, retained bytes, processing seconds by recipe, downloads and job attempts. Reserve before dispatch; settle once; release reservations for documented eligible failures. Prevent concurrent requests from exceeding quota. Plan changes are audited. No money or credit represented by imprecise floating-point arithmetic.

Pricing must follow measured compute, storage, bandwidth, Resend, monitoring and support costs. Do not sell unlimited transcoding. Checkout remains disabled until a real processor is selected, configured and tested with verified webhook signatures and reconciliation.

## 7. International and accessibility requirements

- English launch; localisation architecture and Swahili-ready keys, no concatenated translation strings.
- UTC stored timestamps, user-local display; explicit units and currencies.
- Unicode names, international email and timezone handling consistent with provider support.
- WCAG 2.2 AA target with automated and manual keyboard checks.
- Chrome, Safari and Firefox on desktop; Android Chrome and iOS Safari upload/download tests.
- Document data location, subprocessors, retention, account export and deletion.
- Terms for user-owned/licensed uploads, copyright complaints, support contact and acceptable use. Owner/legal review before public launch; do not claim automatic worldwide legal compliance.

## 8. Success metrics and service objectives

Targets to validate, not claimed measurements:

- At least 10,000 registered users in the supported data/capacity model.
- 500 concurrent lightweight dashboard/API sessions in staged synthetic load tests.
- API p95 under 300 ms for normal indexed metadata reads at the approved test load, excluding auth providers, uploads and media work; error rate below 1%.
- Mobile public-page LCP target below 2.5 s, CLS below 0.1 and INP below 200 ms, measured under documented conditions.
- Valid supported-media job completion rate at least 99%, excluding explicitly cancelled jobs; report unsupported inputs separately.
- Queue wait SLO defined by recipe, input duration and admitted load after actual benchmark.
- 99.5% beta availability target with honest single-host limitations; consider 99.9% only after redundant infrastructure and recovery tests.
- Database RPO target 15 minutes with tested WAL/offsite backup configuration; RTO target 2 hours after restore rehearsal. Nightly dumps alone do not meet that RPO.
- Report activation (first successful output), repeat use, recipe cost, failures, abandonment and support burden; aggregate analytics without logging media contents or credentials.
