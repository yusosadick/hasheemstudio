# Hasheem Studio — Master PRD, Engineering Plan & Claude CLI Handoff

> For the implementing agent: execute this specification in reviewable phases, with tests, independent review, and recorded evidence. This document is a planning deliverable, not proof that infrastructure exists.

**Owner:** Yusufu Sadiki Rajabu / Bisso Technologies Ltd  
**Product:** Hasheem Studio  
**Purchased domain:** https://hasheemstudio.com  
**Repository:** https://github.com/yusosadick/hasheemstudio.git  
**Stack constraints:** React.js, TypeScript, Tailwind CSS, self-hosted Supabase, Resend, Docker, Redis; Kubernetes expansion with an explicitly verified deployment path.  
**Goal:** Build a trustworthy international creator workspace that prepares, verifies, and delivers video files for social publishing, with excellent design and safe operations.  
**Architecture:** A stateless React frontend and TypeScript API orchestrate asynchronous, resource-limited media workers. Dedicated self-hosted Supabase stores identities, tenant data, job truth, usage and audit records; private object storage holds temporary media; Redis/BullMQ provides dispatch, not the only durable record of work.

---

## 0. Read this first: status, scope and authority

### What is known

- The owner reports that hasheemstudio.com has been purchased.
- On 2026-09-16, HTTPS and SSH `git ls-remote` requests completed without advertised refs. The repository appears empty. This is read access, NOT verified push permission.
- At inspection time, apex, www and api hostnames did not resolve from the VPS. Recheck authoritative DNS; purchase alone does not configure DNS.
- The inspected server reports 12 logical CPUs, approximately 47 GiB RAM, 21 GiB available RAM, and 259 GiB free root-disk space. These are a snapshot, not reserved resources or media throughput measurements.
- Existing workloads include Hasheem Gaming, self-hosted Supabase, Coolify, monitoring, email-adjacent services, VPN and other applications. Coolify's proxy already binds 80/443. Existing Redis instances are not permission to reuse them.
- Candidate existing VPS: 169.58.72.101, SSH user yuso. Verify host identity, actual routing, access and available capacity before using this address.

### What this deliverable does not claim

No code has been pushed for this task, no domain configured, no service deployed, no migrations run, no email sent, no benchmark passed and no Kubernetes cluster provisioned. The implementation agent must perform and verify those steps.

### Critical boundaries

1. Use a new project, new Supabase stack, separate DB credentials, secrets, Redis, buckets and networks. Never borrow Hasheem Gaming's production tables, keys or auth users.
2. No global Docker pruning, volume deletion, firewall resets, default reverse-proxy replacement, or shared-service upgrades. Do not interrupt VPN, Coolify, Hermes, Hasheem Gaming or other projects.
3. First push the initial repository foundation and documentation; verify remote commit equality BEFORE deployment or production database changes.
4. Do not purchase servers, object storage, paid plans or billable services without owner budget approval.
5. Credentials belong in protected files or a secret manager, never chat, Git, frontend bundles, screenshots, logs or ZIPs.
6. Ask for missing credentials via secure provisioning, not pasted chat. Do all unblocked work meanwhile, and clearly mark blocked acceptance criteria.
7. Do not claim a single VPS is highly available or can handle 10,000 simultaneous video encodes.
8. No promise of TikTok compression bypass, guaranteed quality retention after platform re-encoding, virality or shadow-ban detection.
9. Never silently replace the requested React app with a different product framework or a Supabase Cloud project.
10. Roadmap features are not reasons to delay a complete, verified core upload-to-download product.

---

# PART I — PRODUCT REQUIREMENTS DOCUMENT

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

**Explicit exclusions from P0:** a full timeline editor, guaranteed platform compression avoidance, permanent cloud video library, unlimited file sizes, anonymous heavy processing, unapproved paid checkout, autonomous purchases, unlicensed AI models, copied competitor code or branding.

## 3. User journey and acceptance criteria

### A. Discovery and registration

Visitor sees a clear product explanation, factual demos, supported formats and visible beta limits. No invented testimonials or fabricated counters. Register → receive verification → verify → land in workspace. Reset links use exact allowed redirects. Expired links have recovery states. Real inbox verification is a launch gate, not merely an HTTP 200 from Resend.

### B. Upload and inspection

1. Select a local file; disclose limits, retention and estimated operation type.
2. API verifies identity, workspace, allowance and admission capacity; reserves usage/storage atomically.
3. Create a private scoped upload session; upload media directly to the media/storage path, not through the frontend server.
4. Persist resumable upload identity. After reload, request file re-selection if the browser cannot recover the file handle. Never promise impossible automatic file access.
5. Finalisation verifies server-side object existence, size, ownership and expected session state.
6. Probe in a sandbox before processing. Show accurate findings and recommended action.

Acceptance: interrupted network resumes without duplicate billing; unauthorised users cannot upload into another workspace; forged MIME/dimensions/size do not bypass validation; abandoned multipart sessions are cleaned up.

### C. Processing and results

User confirms a recipe → reserved job is dispatched → worker verifies recipe/version → output generated → report validated → object committed → job succeeds → download available.

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

## 5. Required design system

### Exact brand tokens

| Token | Dark | Light |
|---|---|---|
| Background | `#121212` charcoal | `#FDF8F0` cream |
| Surface 1 | `#1E1E1E` | `#F5F5EC` beige |
| Surface 2 | `#2A2A2A` | derive a tested contrasting neutral |
| Accent | `#E91E63` crimson | same |
| Secondary | `#FFC0CB` bubblegum | same |
| Primary gradient | `linear-gradient(90deg, rgb(255, 0, 110) 0%, rgb(255, 107, 53) 100%)` | same |

Use semantic CSS variables with Tailwind mappings; both themes are first-class. Add accessible foreground, muted, border, focus, success, warning and danger tokens after contrast measurement. Preserving the brand colour does not justify unreadable small text on it. Use dark foreground or an accessible treatment where white-on-accent fails.

### Visual direction

Premium creative workstation, not a generic admin template. Large type hierarchy, calm spacing, deliberate media presentation, restrained gradient calls to action, clear controls. No gradient on every surface. No tiny social-style badges masquerading as icons. Real SVG icons from a licensed set, consistent stroke/size; accessible text labels for key actions.

- Self-host a licensed readable font such as Inter; limit font weights and payload.
- 4/8-point spacing rhythm, generous 24–32 px card padding where width permits.
- At least 16 px base reading text; 44 px comfortable touch targets.
- Strong focus rings, keyboard-only usability, reduced-motion support.
- Skeletons for actual loading, never fake dashboard data.
- Respect OS theme initially; save user preference without flash.
- Mobile navigation and upload controls must work at 360 px width.
- Technical tables collapse to readable cards on phones.
- Show compressed demo assets, lazy load noncritical media, respect data-saving preferences.
- Video comparison must remain usable without colour perception and without autoplay audio.

### Design approval gate

Before full application implementation, build realistic landing, upload wizard and job-result prototypes in both themes. Capture at 390, 768 and 1440 px. Review spacing, line length, contrast, icons and empty/error states. Obtain owner feedback before polishing all screens. Continue independent backend work while waiting; do not mistake code generation for visual approval.

## 6. Plans, quotas and commercial model

Start with a beta entitlement model, not unintegrated payment buttons. Suggested initial limits are configurable hypotheses, not final pricing:

- Verified Free: 100 MB/file, 2-minute duration, 1080p/60, 3 jobs/day, one active processing job.
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

---

# PART II — ENGINEERING ARCHITECTURE

## 9. Stack decisions

- Monorepo: pnpm workspaces, TypeScript strict mode, pinned package-manager version and lockfile.
- Frontend: React.js + Vite + Tailwind CSS, React Router, TanStack Query, Zod and an accessible component foundation. Public marketing prerendering is permitted; application remains React/Vite.
- API: Node.js active LTS selected at implementation time, TypeScript, Fastify, OpenAPI, structured logs and explicit validation.
- Worker: TypeScript/BullMQ orchestrator launching pinned FFmpeg/FFprobe tools via argument arrays, not shell interpolation.
- Database/auth: dedicated official self-hosted Supabase Docker stack, pinned compatible component versions. Supabase Auth, Postgres, PostgREST and Storage are primary; optional components require resource justification.
- Queue: dedicated Redis with ACL/auth, durable volume, AOF, tested memory policy suitable for BullMQ (`noeviction`), explicit memory limits and monitored persistence.
- Media: private Supabase Storage with supported S3-compatible backend or a dedicated object-store integration validated against resumable-upload needs. Choose ONE authoritative media path in ADR-0003; never duplicate ownership metadata across two independent upload systems without reconciliation.
- Email: Resend SMTP for Supabase Auth; Resend API for transactional job/account messages. Shared message-outbox abstraction and idempotency.
- Runtime: Docker/Compose for isolated initial launch; K3s Kubernetes for dedicated-node scale-out application/worker plane. OCI images run under containerd in K3s; do not assume Kubernetes uses the Docker daemon.
- Observability: OpenTelemetry, Prometheus-compatible metrics, Grafana and central structured logs. Reuse authorised monitoring endpoints only via scoped integration, not shared admin credentials.
- CI: GitHub Actions, registry images addressed by immutable digest, security scans and gated deployment.
- Testing: Vitest, React Testing Library, real Postgres/Supabase integration tests, Playwright, k6; FFmpeg fixture corpus.

## 10. Topology and boundaries

```text
Browser / mobile browser
  | HTTPS
Edge proxy + static CDN (public assets only)
  |-- React static frontend
  |-- /API or api.hasheemstudio.com --> stateless API replicas
  |-- supabase.hasheemstudio.com --> dedicated Supabase gateway
  |-- media.hasheemstudio.com --> private upload/download path

API --> Supabase Auth / Postgres (identity, RLS, jobs, usage, outbox)
API --> short-lived scoped upload grants / signed downloads
Postgres outbox --> dispatcher --> Redis/BullMQ
Redis --> separate remux / encode / validation worker pools
Workers --> private media storage + bounded scratch volumes
Workers --> report/output records via narrow service interfaces
Email outbox --> Resend
Metrics/logs --> monitoring; verified offsite backups --> separate failure domain
```

Large files must bypass JSON API buffering and frontend memory. Proxy/protocol/body limits must be tested with a permitted maximum-size file, not guessed from provider advertising. A CDN vendor's upload limits can break this architecture; use a compatible direct media hostname/path where necessary while preserving origin protections.

### Public/private hostnames

- `hasheemstudio.com`: public site and application.
- `www.hasheemstudio.com`: canonical redirect.
- `api.hasheemstudio.com`: application API if not same-origin routed.
- `supabase.hasheemstudio.com`: restricted routes needed for Auth/REST/Storage, not unrestricted Studio/meta administration.
- `media.hasheemstudio.com`: only if chosen upload architecture needs it.
- `status.hasheemstudio.com`: optional externally monitored status page.
- `mail.hasheemstudio.com`: proposed verified Resend sending subdomain, not assumed inbound mailbox.

Postgres, Redis, Docker socket, Supabase Studio/meta, monitoring admin and Kubernetes API must not be publicly exposed. Use SSH/VPN and scoped access. Browser Supabase anon/publishable key is intentionally public; service-role key is not.

## 11. Job reliability and media correctness

### Database is authoritative

State machine: `created → uploading → inspecting → queued → processing → verifying → succeeded`; controlled terminal alternatives: `failed`, `cancelled`, `expired`. Upload sessions have separate completion state. Record attempts separately from logical jobs.

Use versioned transitions/compare-and-swap, leases, heartbeat and fencing tokens. Duplicate queue deliveries are expected; outputs and usage commits must be idempotent. Outbox records are transactionally created with jobs. A reconciler repairs undispatched work and stale leases. Redis loss must not erase the list of accepted jobs.

Worker writes to attempt-specific output paths. Publish canonical result only if it still holds a valid lease and the job is not cancelled/expired. Bound retry count, exponential backoff with jitter, dead-letter inspection and manual redrive. Release quota reservations exactly once with unique ledger constraints. Enforce per-workspace fairness and separate expensive encode work from lightweight remuxing.

### Validation

- Validate magic bytes/container, server-measured size, duration, stream count, resolution, frame count estimates and allowed codec combinations.
- Reject malformed/pathological media safely; cap probe/processing time, threads, output size and scratch disk.
- Restrict FFmpeg protocols to required local inputs; deny remote URLs/playlists/SSRF and arbitrary filesystem traversal.
- Non-root worker, dropped capabilities, no privileged containers, read-only root filesystem, scoped writable scratch, seccomp/AppArmor where available. No host Docker socket.
- Network access only to required queue, object storage and trusted control/data services; no arbitrary internet from the media subprocess.
- Never execute file names as shell fragments. Decode failures are errors, not success with a broken file.

### Recipe semantics

- Inspect: no transformation; report only.
- Remux: copy supported streams into a compatible container, optionally fast-start; explain which metadata changes. Reject or propose conversion when incompatible; never silently re-encode.
- Compatibility encode: explicit H.264/AAC policy, sensible pixel format and supported dimensions; handle VFR deliberately, preserve aspect ratio and orientation.
- HDR: preserve accurately for supported paths or perform an explicit tested tone-map; otherwise refuse unsupported conversion. Never silently wash out colours.
- Optional audio: handle absent audio, multiple tracks and unsupported codecs with explained selection rules.
- Do not upscale or increase FPS by default; never equate higher bitrate with recovered detail.
- Remove sensitive location/device metadata only when requested/default privacy policy allows, without stripping necessary colour/rotation information accidentally.

### Output verification

FFprobe output report, duration/stream consistency checks, decode test, container integrity and browser playback test. For remux, decoded-frame/audio checks over fixtures establish preservation; full checks can be costly. Production reports must accurately distinguish full verification, sampled checks and not-performed checks. An unchanged stream-copy command is not itself proof. For re-encodes, use suitable optional SSIM/VMAF analysis on supported comparable sources and disclose limitations; no universal quality score fabricated from bitrate.

Record input/output checksums for integrity, recipe version, tool version, timestamps and verification level. Maintain licensed/generated fixtures for portrait, landscape, rotated, VFR, silent, multiple audio tracks, SDR/HDR, corrupted and near-limit files.

## 12. Data model and RLS

Proposed tables (SQL migration definitions, constraints and indexes required):

- `profiles`: auth user FK, display name, locale; no client-writable admin flag.
- `workspaces`, `workspace_members`: composite uniqueness, owner/admin/editor/viewer roles.
- `plans`, `entitlements`: versioned immutable definitions and active assignment.
- `upload_sessions`: workspace, object key, expiration, reserved bytes, completion state.
- `media_assets`: workspace, validated metadata, private object key, lifecycle state, checksum.
- `presets`, `preset_versions`: built-in immutable recipes and permitted user overrides.
- `jobs`, `job_attempts`, `job_events`: workspace ownership, unique idempotency key, state version, lease, recipe, input/output references.
- `verification_reports`: verification method, measured results and explicit unverified fields.
- `usage_reservations`, `usage_ledger`: unique operation reference, resource units, settlement status.
- `outbox_events`, `email_deliveries`, `webhook_events`: replay-safe dispatch and provider ID uniqueness.
- `platform_admins`: server-only administrative membership with controlled promotion.
- `audit_events`: append-only actor/action/target records, redacted before/after values.
- `deletion_requests`: scope, deadlines and physical deletion attempts.
- P1: `invitations`, `billing_accounts`, `subscriptions`, `payment_events`.

RLS is enabled on every browser-accessible application table and private storage path. Membership is checked server-side; never trust a submitted workspace ID alone. Role/plan/usage/job-success fields are server-controlled. Membership helpers must avoid recursive RLS and unsafe SECURITY DEFINER search paths; explicitly revoke unwanted function execution privileges.

Index `(workspace_id, created_at DESC, id)` for history and appropriate lease/status/expiry lookups. Avoid indexing JSON blindly. Set statement timeouts, pagination bounds and pool limits. Use a transaction pooler for ordinary API traffic where compatible; use direct or session connections for migrations/locks. Worker credentials must not be freely equivalent to a frontend user's session. Centralise elevated data access into narrow audited functions/interfaces.

## 13. Scale model, capacity and costs

10,000 registered accounts is a data-size objective, not 10,000 encoders. Planning example, NOT measured demand:

- 10,000 registered; 1,000 daily active; 3 jobs/active user/day = 3,000 jobs/day.
- Mean 100 MB input = 300 GB input/day before output, intermediates, replication or backups.
- Hypothetical average 60-second processing time at 60% slot utilisation requires about 3.47 continuously available slots before peak headroom; round provision up only after measurement. A slot is not necessarily one CPU core.
- Encode jobs may take far longer than remux jobs, so separate benchmarks and queues are mandatory.

Formulas to implement in `docs/CAPACITY.md` with an executable calculator:

```
worker_slots >= jobs_per_day * mean_processing_seconds / (86400 * target_utilisation)
storage_bytes >= daily_input_bytes * retention_days * (1 + output_ratio) + peak_scratch + safety_margin
network_egress >= downloads * average_output_bytes + replication_egress
cost_per_success = compute + storage + bandwidth + email + shared_overhead + failed_attempt_cost
```

The current VPS free space is less than one day of the example INPUT volume. Do not launch at that demand using local disk and long retention. Start admitted beta throughput conservatively, use short retention, and obtain a budget-approved separate object-storage/failure domain for scale. Never count unused disk on another project as allocated storage.

Initial worker concurrency should be conservative (for example one encode and one remux, subject to measured isolation). Apply hard CPU/RAM/PID/scratch budgets and reserve headroom for existing services. This is an initial test setting, not an advertised SLA. Reject or queue admission when storage watermark or compute budget is reached; do not crash other apps.

Load tests: 10,000 synthetic accounts in staging only; 500 dashboard sessions; concurrent upload tests starting small; realistic mixed-media queue workloads; measure queue wait, processing time, CPU, memory, disk IOPS and egress. Run sustained and burst tests only in isolated approved infrastructure. Provide p50/p95/p99 and per-recipe breakdown, not one average.

## 14. Docker launch and Kubernetes path

### Stage A — isolated Docker launch on existing VPS

Use Compose project name `hasheemstudio`, project-specific networks/volumes, declarative attachment to the existing edge proxy ONLY for intended ingress services. No new service may claim public 80/443. Configure resource limits, restart policy, healthchecks, graceful shutdown, bounded logs and immutable image digests.

Dedicated Supabase official stack with its own credentials and mounted state; private Studio over SSH only. Pin upstream Compose source revision and record every local override. Do not invent a partial Supabase clone and call it supported.

### Stage B — real Kubernetes rehearsal, then dedicated-node rollout

Deliver `infra/k8s/base` plus staging/production overlays and validate them against a real cluster. Use a disposable local/k3d/kind environment for rehearsal if resources permit; this is NOT proof of production HA. Production K3s belongs on approved dedicated nodes unless a shared-host networking impact plan is specifically approved.

Kubernetes application layer: web/API Deployments, separate worker Deployments or controlled Jobs, resource requests/limits, startup/readiness/liveness probes, graceful draining, topology spread, scoped ServiceAccounts, Pod Security, NetworkPolicies, namespace ResourceQuotas, PodDisruptionBudgets appropriate to replica count, TLS ingress and secret handling. HPA for API; queue-depth scaling via KEDA for workers, with min/max bounds and database connection/storage constraints. Scaling pods does not create hardware; document who supplies new nodes and how.

Keep stateful Supabase/Postgres and object storage on dedicated persistent infrastructure initially. Do not move them into naive single-PVC manifests just to say everything is Kubernetes. ADR must describe connectivity, TLS, backups and future Postgres replication/failover. Redis replicas/sentinel/managed equivalent only with tested client support and failover semantics.

For true HA, plan three control-plane nodes across actual failure domains, at least two application/worker nodes as appropriate, redundant edge, database failover and replicated storage. Three VMs on one physical VPS are not three failure domains. No infrastructure purchasing without approval. If nodes/budget are absent, Stage A may be beta-ready; Kubernetes production scale-out remains explicitly pending, not silently omitted.

K3s defaults can conflict with existing Traefik, ServiceLB, firewall, Pod/Service CIDRs and VPN routes. Discover existing routes before installing. Never disable the host firewall because a quick-start guide suggests it. Cluster management and node traffic are private/allowlisted; no public anonymous control plane.

## 15. Resend and DNS configuration

1. Discover domain registrar/DNS authority and owner-approved access; present required records if secure automation access is unavailable.
2. Add only project-scoped A/AAAA/CNAME records; do not publish IPv6 unless tested end-to-end.
3. Verify domain ownership in Resend for proposed `mail.hasheemstudio.com`.
4. Apply provider-returned SPF/DKIM/return-path records exactly. Never invent DKIM values or add conflicting SPF TXT records.
5. Add appropriate DMARC policy with owner-approved reporting; understand existing mail configuration before tightening policy. Do not overwrite root MX records for an unrelated mailbox.
6. Configure verified sender such as `Hasheem Studio <noreply@mail.hasheemstudio.com>`; reply-to is an owner-confirmed support mailbox, not an assumed mailbox created by Resend.
7. Configure Auth SMTP securely and transactional API key with least scope; preserve TLS verification and production redirect allowlist.
8. Verify signup and reset deliveries to an approved test inbox, header alignment, provider webhook signature validation, deduplicated events, retries and suppression for bounces/complaints.
9. Disable click tracking on security links; never log full reset/verification tokens.
10. If inbox access is absent, report provider delivery evidence separately from inbox verification. Do not mark the complete auth-email flow passed.

## 16. Security and operations

Threat model must cover cross-tenant access, hostile media, SSRF, command injection, upload abuse, role escalation, leaked signing URLs, queue replay, webhook replay, invitation abuse, credential leakage and resource exhaustion.

JWT validation checks signature, issuer, audience and expiration; authorisation uses current membership/entitlements. Admin MFA and recent-auth requirements for critical actions; no automatic promotion of the first registered user. Bootstrap an owner only after owner email is confirmed. Rate-limit by IP and identity with safe reverse-proxy trust configuration. CSP, explicit CORS origins, CSRF protection wherever cookie auth is used, security headers and dependency/image scans.

Secret inventory names (values excluded): Supabase DB/auth signing/encryption secrets, API credentials, Redis ACL credentials, media keys, Resend credentials, backup encryption key, registry/deploy credentials and optional OAuth secrets. Generate with official supported tooling and validate format/compatibility; do not copy sample defaults. Store protected runtime secrets outside repo, e.g. `/etc/hasheemstudio/` owned by appropriate service identities; use credential files or a secret manager. Git ignores are not sufficient: scan history and built frontend bundles.

Backups: encrypted off-host Postgres base backups plus WAL archiving for stated RPO, configs and necessary storage metadata. Temporary media retention may intentionally exclude originals from backups, but state this in UX/privacy and recovery docs. Distinguish media recoverability from DB recoverability. Test a restore into isolated staging and compare critical records; record restore duration and actual RPO. Kubernetes etcd backup is not a Postgres backup.

Monitoring: `/health/live` must be cheap; `/health/ready` tests required dependencies without leaking details; startup probe tolerates startup. Alert on error rate, queue age, stale leases, storage watermarks, Redis persistence/memory, DB connection pressure, backup age, email failures, certificate expiry and host capacity. Redact emails/tokens/filenames where not necessary. Debounce critical alerts; avoid routine recovery spam.

---

# PART III — REPOSITORY & MAC-TO-VPS WORKFLOW

## 17. Required repository structure

```
CLAUDE.md
AGENTS.md
README.md
.env.example
.gitignore
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
apps/web/
apps/api/
apps/worker/
packages/contracts/
packages/ui/
packages/config/
packages/media-recipes/
supabase/config.toml
supabase/migrations/
supabase/seed.sql                 # local/staging test data only
infra/compose/
infra/k8s/base/
infra/k8s/overlays/staging/
infra/k8s/overlays/production/
infra/ansible/                    # idempotent scoped setup if justified
infra/monitoring/
scripts/ops/
scripts/db/
scripts/verify/
tests/unit/
tests/integration/
tests/security/
tests/e2e/
tests/load/
tests/fixtures/media/README.md
.github/workflows/
docs/PRD.md
docs/IMPLEMENTATION-PLAN.md
docs/DESIGN-SYSTEM.md
docs/ARCHITECTURE.md
docs/ENVIRONMENTS.md
docs/MACBOOK-TO-VPS.md
docs/MIGRATIONS.md
docs/CAPACITY.md
docs/SECURITY.md
docs/BACKUP-RESTORE.md
docs/DEPLOYMENT.md
docs/ROLLBACK.md
docs/RUNBOOKS.md
docs/STATUS.md
docs/DECISIONS.md
docs/adr/
docs/evidence/                    # sanitised only
```

The implementing agent must split this handbook into these documents and retain the original. `CLAUDE.md` and `AGENTS.md` must point to them, list working commands and state: no local-only migration success claims; no shared-project secrets; no destructive prod resets; proof before completion. Keep status durable so a Mac agent can resume without chat history.

## 18. Environment record

Commit a NONSECRET environment inventory: environment name, verified SSH alias/host, project root, immutable release SHA, ingress URLs, exact Compose project name or Kubernetes context/namespace, Supabase database identity marker, DB service identifier, migration command, healthcheck commands, secret FILE locations (not contents), backup destination identifier and last restore evidence reference.

Do not commit private keys, full secret DSNs, kubeconfigs or auth tokens. Record whether each value was observed or proposed. Credentials for local, staging and production must differ. Production must not be a developer default.

## 19. MacBook workflow

Mac prerequisites: Git, an approved container runtime such as Docker Desktop or Colima, supported Node, pinned pnpm, SSH, and tools required by the chosen test runner. Apple Silicon support: build Linux production images for the target architecture in CI; do not assume ARM binaries run on an x86 VPS.

Example AFTER repository bootstrap, and after substituting the verified environment alias:

```bash
git clone git@github.com:yusosadick/hasheemstudio.git
cd hasheemstudio
pnpm install --frozen-lockfile
pnpm doctor
pnpm dev:up
pnpm db:local:migrate
pnpm dev
```

The above pnpm tasks are REQUIRED implementation interfaces, not commands that exist today. Their scripts must be implemented and tested from a fresh clone. `doctor` validates tooling, ports and secret-file presence without printing secrets. Local email uses a development inbox, not real customer mail.

SSH configuration example, not an installed key:

```sshconfig
Host hasheemstudio-prod
  HostName 169.58.72.101
  User yuso
  IdentityFile ~/.ssh/hasheemstudio_deploy
  IdentitiesOnly yes
  StrictHostKeyChecking yes
```

Verify host fingerprint through a trusted channel. Prefer a dedicated restricted deploy identity provisioned during setup; if yuso is required for initial bootstrap, transition deployment to least privilege. Never instruct `StrictHostKeyChecking=no`. Remote public Postgres exposure is not required: use SSH and a reviewed remote migration runner.

## 20. Real migrations from Mac through VPS terminal

### Required operational interface

Implement a portable Node CLI at `scripts/db/remote.mjs` with these exact command contracts:

```bash
# Read-only: resolves deployed DB, release and migration ledger
node scripts/db/remote.mjs status --env staging
node scripts/db/remote.mjs plan --env staging --sha <PUSHED_COMMIT_SHA>

# Applies on actual VPS staging database, then verifies live state
node scripts/db/remote.mjs apply --env staging --sha <PUSHED_COMMIT_SHA>
node scripts/db/remote.mjs verify --env staging --sha <PUSHED_COMMIT_SHA>

# Production plan and separately approved write
node scripts/db/remote.mjs plan --env production --sha <PUSHED_COMMIT_SHA>
node scripts/db/remote.mjs apply --env production --sha <PUSHED_COMMIT_SHA> --confirm hasheemstudio-production
node scripts/db/remote.mjs verify --env production --sha <PUSHED_COMMIT_SHA>
```

These are specifications to BUILD and TEST, not a claim that this helper is already available. Reject placeholder SHAs, unpushed commits, dirty migration edits, unexpected DB identity and ambiguous environment. Do not guess deployed container names from another project.

### Runner implementation requirements

1. Resolve exact SSH target from nonsecret inventory and verify connectivity without exposing secrets.
2. Fetch only the approved pushed commit on VPS into a release-specific path; verify SHA equals request. Do not run migration SQL from a mutable working tree or copy arbitrary local SQL directly into production.
3. Verify dedicated Hasheem Studio database marker, current database, role, host/service identity, expected environment and migration ledger. An empty new database needs explicit bootstrap marker creation, not a guessed existing marker.
4. Compute ordered migration checksum manifest; reject modifications to previously applied migrations.
5. Acquire a database-level advisory lock spanning the migration run using a session/direct connection, not a transaction pooler. Avoid separate `psql` invocations that release the lock before execution. Use one authoritative migration runner/ledger; do not combine incompatible histories.
6. Use pinned Supabase CLI custom-DB migration support only after confirming flags, transaction behaviour and self-hosted compatibility against the pinned CLI. Alternatively use a reviewed session-based SQL runner compatible with Supabase migration bookkeeping. Document the chosen implementation and test its ledger semantics.
7. Before production apply, establish backup/PITR health and restore evidence. For destructive operations require a separate explicit owner approval, impact estimate and maintenance plan. Normal bootstrap approval is not approval for dropping future customer data.
8. Use least-privilege dedicated migration role able to own required schema changes. Do not put database passwords in command arguments/logs/process listings. Resolve protected credentials on VPS using appropriate env/file mechanisms.
9. Transaction per compatible migration, `ON_ERROR_STOP` or equivalent, lock/statement timeout, fail-fast. Label nontransactional operations (e.g. concurrent indexes) explicitly with repair/retry procedures.
10. Use expand → migrate/backfill → switch → contract over separate compatible releases. Bounded backfills, not one huge lock-holding update.
11. After applying, read the live ledger, inspect actual tables/columns/indexes/RLS/functions and execute real API/RLS smoke tests with approved test accounts.
12. Return sanitised JSON with target environment, SHA, applied versions, schema digest, verification results, duration and exit status. Never declare success based only on exit code or local schema generation.
13. Retrying a fully applied release is a verified no-op. A failed partial migration must not be marked applied. Add concurrent-run and checksum-drift tests.
14. Production `db reset`, `drop schema`, volume deletion and migration-history repair are forbidden without explicit exceptional approval. Rollback normally means compatible application rollback plus forward SQL fix; a destructive down migration can cause more harm.

### Migration acceptance tests

Fresh local replay; upgrade populated staging; idempotent repeat; two concurrent invocations; wrong-target rejection; missing-backup rejection; modified-history rejection; failed SQL handling; direct live schema readback; RLS cross-tenant denial; old and new application versions working during expansion. Include a documented real SSH-based staging migration from a separate client terminal, not only an in-container test.

## 21. Deployment and GitHub workflow

- Inspect existing repo before writing; empty remote gets an initial main branch, existing repo gets a scoped branch/PR. Never force-push.
- First commit: docs, CLAUDE/AGENTS, workspace scaffold, ignores, env examples and CI foundation. Scan for secrets. Push to `git@github.com:yusosadick/hasheemstudio.git` and compare local HEAD with remote branch SHA. Record proof. If push access fails, stop deployment and resolve repository access.
- Feature branches, required lint/typecheck/tests/security checks and small commits.
- CI builds/tests images, emits SBOM, scans dependencies/images and pushes immutable digests. Never run untrusted pull-request code on the production host runner.
- Staging deployment first; approved DB migrations then compatible application rollout; public health and browser smoke checks; production uses protected approval and release artifact.
- Implement `pnpm deploy:plan -- --env staging`, `pnpm deploy -- --env staging --sha <SHA>` and `pnpm verify:live -- --env staging`, with production equivalents requiring confirmation. These task interfaces must be built, tested and documented.
- No image tagged only `latest`. Store previous image digest, config version and schema compatibility for rollback. Distinguish readiness rollback from data restore.
- Before/after external health probes include Hasheem Studio and approved neighbouring apps to detect collateral impact. Never load-test unrelated apps.

---

# PART IV — PHASED IMPLEMENTATION PLAN

## 22. Delivery method

For each phase: break into small named tasks; add failing tests for testable behaviour; implement; run tests; run integration/browser checks; independently review; commit; update docs/STATUS.md and evidence. Parallelise bounded frontend/backend/infra work using separate worktrees and file ownership. One migration owner and one deployment coordinator prevent conflicts. Do not let parallel agents independently change production.

### Phase 0 — discovery and first GitHub push

Files: `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/*`, `.gitignore`, `.env.example`, workspace scaffold.

Tasks: inventory repo/access, domains, host capacity, existing services and DNS; select runtime versions from current upstream support; threat model and ADRs; create first commit; scan secrets; push and remote-readback. Establish a requirements checklist with P0/P1/P2 status.

Gate: remote SHA evidence exists; no production changes; constraints and remaining credentials identified.

### Phase 1 — design system and interaction prototype

Files: `packages/ui/src/tokens.css`, UI primitives, `apps/web/src/routes`, component stories/tests, `docs/DESIGN-SYSTEM.md`.

Tasks: exact tokens, accessible derived colours, typography/spacing, dual theme, landing/upload/result prototypes, mobile states, screenshot review and owner feedback. Implement keyboard/focus tests and visual baselines.

Gate: three key screens rendered at required widths in both themes; no clipping, fake functionality or unreadable contrast. Visual approval status recorded.

### Phase 2 — isolated infrastructure and environment automation

Files: `infra/compose/*`, `scripts/ops/doctor.*`, setup/config validation scripts, env inventory, ingress and secret templates.

Tasks: independent Supabase stack, Redis, private storage, scoped proxy routes, healthchecks/resources, protected secrets, backup destination and DNS/TLS. Validate dry-run output then deploy staging. Test restart/persistence. Idempotent provisioning must leave healthy unchanged services untouched.

Gate: service health AND real auth/DB/storage connectivity, private-port verification, no shared-app regression. Missing DNS or paid resources remains a specific blocker.

### Phase 3 — schema, auth, tenancy and migration runner

Files: ordered `supabase/migrations/*.sql`, `scripts/db/remote.mjs`, API auth/tenancy modules, `tests/security/rls.*`, `tests/integration/migrations.*`.

Tasks: schema and constraints; registration workspace creation; complete identity flows; RLS negative tests; operational migration interface; staging migration over SSH and live readback.

Gate: user A cannot read/write user B's resources; cannot self-promote; real live migration verified. Generated type definitions reflect migrated schema.

### Phase 4 — upload-to-download vertical slice

Files: API uploads/jobs modules, worker probe/remux modules, storage adapter, frontend upload/results, media fixtures and E2E tests.

Tasks: quota reservation, resumable private upload, finalisation, outbox dispatch, sandbox probe/remux, output verification, playback/download/delete and expiry sweeper.

Gate: a real fixture uploaded through browser, processed on VPS, downloaded and decoded; interrupted upload recovers; access denial and output expiry tested. No mock success in production code.

### Phase 5 — compatibility recipes and reliability

Files: encode recipes, preset versioning, attempt leases/reconciler, fair queue, usage ledger, worker constraints and cancellation.

Tasks: H.264/AAC conversions; rotation/VFR/HDR policies; worker kill/queue duplicate/Redis restart tests; exactly-once settlement semantics; bounded retries and storage admission.

Gate: fixture matrix passes; unsupported cases explained; repeat delivery does not duplicate charges/output; processes cannot escape limits.

### Phase 6 — Resend, administration and compliance UX

Files: `packages/emails` if needed, API outbox/webhooks/admin modules, frontend settings/admin, privacy/terms drafts.

Tasks: secure SMTP/API config, verified DNS, real auth/job emails, replay-safe webhooks, audited admin actions, export/deletion and retention.

Gate: observed delivery plus approved inbox evidence, admin RBAC negative tests, actual object deletion evidence. No live payment UI until billing is approved and tested.

### Phase 7 — performance, resilience and launch gate

Files: `tests/load`, `scripts/verify`, CI workflows, backup/restore and capacity reports.

Tasks: unit/integration/security/E2E suite, browser matrix, image scans, off-host backup and isolated restore, bounded staging load, API/media benchmarks, accessibility, documentation and rollback rehearsal.

Gate: honest measured report versus SLOs, unresolved issues list, working production domain, visible UI and complete user journey. A passing localhost curl is insufficient.

### Phase 8 — Kubernetes expansion

Files: `infra/k8s`, node bootstrap/decommission runbooks, autoscaling configs, network policies and scale-out ADR.

Tasks: real-cluster rehearsal; dedicated-node inventory/approval; production deployment if nodes available; private stateful-service connectivity; scaling/draining; node-failure and backup checks; cutover/rollback.

Gate: render/apply manifests, real rollout status, workload tests, queue scaling evidence and node capacity limits. If only rehearsal hardware exists, label Kubernetes as tested rehearsal and production expansion pending.

### Phase 9 — growth features

Deliver P1 one feature at a time after usage/cost evidence: batch/ZIP, team invitations, saved presets, crop preview, billing and later API access. Re-run quotas, tenant isolation and resource tests for each.

## 23. Definition of done — evidence matrix

| Area | Required evidence |
|---|---|
| GitHub | pushed branch, matching remote SHA, clean secret scan |
| Design | both themes and mobile/desktop screenshots, approval status, accessibility findings |
| DNS/TLS | authoritative records and actual HTTPS browser load |
| Auth | real registration/verification/reset, tested sessions and redirects |
| Migration | SSH target identity, version ledger, live schema/RLS readback |
| Upload | allowed max-size and interrupted/retry test through actual ingress |
| Processing | real input/output, media reports, playback and downloadable file |
| Isolation | tenant A/B negative tests, admin escalation denial, worker constraints |
| Reliability | killed worker, duplicate job, cancellation, Redis restart and reconciler tests |
| Email | Resend event + inbox evidence where available; explicit gaps otherwise |
| Operations | reboot/restart recovery, expiry cleanup, monitoring alert test |
| Recovery | off-host backup and isolated restore with measured timing |
| Capacity | dated environment, recipe corpus, raw metrics and honest limitations |
| Kubernetes | real-cluster validation, rollback and explicit deployed/not-deployed status |
| Mac handoff | fresh-clone instructions and actual remote migration workflow |

Evidence must be sanitised. Never commit test customers' media or credentials. Every report includes failures and unverified items. No declaration of 10,000-user readiness before relevant capacity and isolation gates pass.

## 24. Decisions requiring owner input, without stalling unrelated work

- DNS provider and secure record-management access.
- Resend key/domain access and approved inbox for delivery verification.
- Confirmed platform-owner email for admin bootstrap.
- Approved off-host backup/object-storage provider, region and budget.
- Whether production Kubernetes nodes exist or need budget approval.
- Commercial plan prices, payment provider and legal entity details.
- Final support/reply-to address and policy approval.

Defaults until then: dedicated existing-VPS beta isolation, free/invite beta with hard limits, English/Swahili-ready UI, no paid checkout, no GPU feature, no public production claim when a launch gate is blocked.

---

# PART V — COPY-READY CLAUDE CLI PROMPT

## 25. How to start on the VPS

Save this complete document on the VPS as `HASHEEMSTUDIO-MASTER.md` in a handoff directory outside unrelated projects. Authenticate Claude through its normal CLI, never by pasting credentials into this document. Use an interactive session so infrastructure permissions and missing inputs can be handled safely:

```bash
claude
```

Paste the following prompt, replacing only the file path if you stored it elsewhere. This does not require bypass-permissions mode. Do not use `--dangerously-skip-permissions` on a shared production VPS.

### BEGIN COPY-READY PROMPT

You are the lead product engineer, media-systems engineer and deployment coordinator for Hasheem Studio. Read `/home/yuso/.hermes/plans/2026-09-16_202117-hasheemstudio-master-plan-prd-claude.md` completely before acting. If that path is absent, ask for the actual location of HASHEEMSTUDIO-MASTER.md; do not invent missing requirements.

The owner has purchased hasheemstudio.com. The target repository is exactly https://github.com/yusosadick/hasheemstudio.git. Build with React.js + TypeScript + Vite + Tailwind, a TypeScript API, dedicated self-hosted Supabase, dedicated Redis/BullMQ, secure FFmpeg workers, private temporary media storage, Resend, Docker and a real Kubernetes expansion path. This is a real implementation and deployment assignment, not a request for another plan or a mock UI.

Use the exact charcoal/cream/crimson/bubblegum design tokens and pink-to-orange gradient in the master document. Create an excellent mobile-first interface with both themes, accessible contrast, generous spacing, real icons and honest states. Present early landing/upload/result screenshots for design review; do not call a generic dashboard premium simply because it compiles.

Start with read-only discovery: git remote state and push permissions, working directory, current host resources, Docker/proxy/ports/networks, DNS, existing services and scoped credentials. The known server is shared: preserve Hasheem Gaming, its Supabase, Coolify, VPN, monitoring and every unrelated service. Never reuse their secrets or modify their schema. Do not reinstall Docker, replace the edge proxy, prune volumes or reset firewalls. Use project-specific resources and resource limits.

Create or safely clone `/home/yuso/hasheemstudio`; if it already exists inspect and preserve user changes. Split the master into `docs/PRD.md`, `docs/IMPLEMENTATION-PLAN.md`, `docs/DESIGN-SYSTEM.md`, architecture, operations, security, capacity and Mac-to-VPS documentation. Add durable `CLAUDE.md`, `AGENTS.md` and `docs/STATUS.md` so future agents on macOS can resume with no chat context.

FIRST PUSH REQUIREMENT: create the initial docs/scaffold/CI/ignore/env-example commit, scan it for secrets, push to the exact GitHub repository and verify remote SHA equals local HEAD. Do this before deployment and production migrations. Preserve existing history; never force-push. If GitHub authorisation blocks the push, report the exact safe remediation and do not claim pushed or proceed to deployment.

Then execute the phased plan, using TDD where applicable and independent security/regression review. Parallel agents may own separate files/worktrees, but only one migration owner and one deploy coordinator may modify shared deployment state. Keep evidence and resumable status after each phase; mark partial completion honestly.

Implement the real `scripts/db/remote.mjs` interface specified in the master. A future MacBook agent must be able to plan/apply/verify migrations on the real staging/production VPS via SSH, using a pushed immutable commit, target identity checks, checksum history, advisory lock, backup gate, live schema/RLS readback and explicit production confirmation. No local-only migration claims, no public Postgres, no `db reset` in production, no unapproved destructive migrations and no passwords in CLI arguments or logs. Document the actual tested commands, exact environment and service identifiers, and rollback procedure.

Build the complete first vertical slice: real verified account → quota reservation → private resumable video upload → sandboxed probe → queued remux/explicit compatibility encode → validated output/report → authenticated download → actual lifecycle deletion. Use PostgreSQL outbox/job truth plus Redis delivery, leases/fencing, idempotency, bounded retries, cancellation, fair scheduling and reconciler. A successful job requires a real playable file; never substitute fake progress, mocked media, fabricated metrics or hard-coded successful API responses.

Use official pinned self-hosted Supabase components with separate project credentials and RLS. Protect role/entitlement/usage fields; service-role credentials never enter frontend bundles. Implement real Resend Auth SMTP and transactional email with verified sending domain, signed/deduplicated webhook processing and actual delivery testing. Ask only for secure provisioning of missing account/DNS credentials; do not request secrets in chat or purchase anything without approval. Missing credentials must be recorded as blockers, not replaced with fake services.

Use Docker Compose for safe initial deployment on the shared VPS. Deliver Kubernetes manifests and real-cluster rehearsal, then a dedicated-node K3s rollout when approved nodes and budget exist. Do not install a default K3s ingress or change shared networking blindly. Do not call single-node replicas high availability. Do not pretend manifests alone are running Kubernetes. Report exactly what is deployed and what remains gated.

Design for at least 10,000 registered users; benchmark the documented active-user/workload envelope rather than promising 10,000 simultaneous encodes. Measure media recipes, bandwidth, storage, queue latency and cost. Enforce hard limits and admission control so users cannot exhaust the shared host. Do not run heavy load tests against production or other projects without approval.

Verify both themes, responsive layouts, keyboard accessibility, live DNS/TLS, actual API paths, auth email, tenant isolation, upload interruption, output playback, worker crash recovery, duplicate jobs, cancellation, quotas, retention, backups/restores, rollback and scoped neighbouring-service health. Run the browser journey on the live site and capture sanitised screenshots. A green build, healthy container, or localhost response alone is not completion.

For each phase report: changes, commands actually run, observed results, evidence paths, committed/pushed SHA, deployed digest if applicable, rollback and remaining blockers. Never print secrets. Continue all safe unblocked work rather than stopping after scaffolding; if context runs short, save status and the exact next task before asking to resume. Do not silently drop requirements to fit one session.

Final handoff must include: functioning URLs and tested user journey; repository/commit; setup/deploy/test commands; MacBook-to-VPS migration commands; actual environment inventory; measured capacity and costs; backup/restore evidence; Kubernetes deployed/rehearsal/pending status; design screenshots; known limitations and outstanding owner actions. Keep paid features disabled until their integrations are genuinely approved and verified.

Begin now by reading the master document and performing the safe discovery phase.

### END COPY-READY PROMPT

## 26. Resume prompt for later MacBook or VPS sessions

> Read CLAUDE.md, AGENTS.md, docs/STATUS.md, docs/PRD.md, docs/ENVIRONMENTS.md and the latest evidence. Inspect git status and remote branch before edits. Resume the first incomplete unblocked phase. Preserve exact brand tokens and isolation boundaries. Follow docs/MIGRATIONS.md for actual VPS migrations; do not claim success from local schema changes. Verify every completed requirement with real outputs and update status. Ask only for information or approval that cannot be safely discovered.

## 27. Authoritative implementation references

Verify current supported versions/commands when implementation starts; pin what was tested rather than using floating latest tags.

- Supabase self-hosted Docker: https://supabase.com/docs/guides/self-hosting/docker
- Supabase CLI: https://supabase.com/docs/reference/cli/introduction
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase resumable uploads: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- K3s requirements: https://docs.k3s.io/installation/requirements
- Kubernetes production environment: https://kubernetes.io/docs/setup/production-environment/
- BullMQ: https://docs.bullmq.io/
- Resend domain verification: https://resend.com/docs/dashboard/domains/introduction
- Resend SMTP: https://resend.com/docs/send-with-smtp
- FFmpeg: https://ffmpeg.org/documentation.html
- Claude Code CLI: https://code.claude.com/docs/en/cli-reference

Supabase Docker, K3s requirements and Resend domain documentation were inspected during preparation. Other links are implementation references, not a claim that every linked command was exercised.
