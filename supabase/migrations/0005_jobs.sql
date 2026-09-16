-- Jobs, attempts, events, verification reports. Database is authoritative per
-- docs/ARCHITECTURE.md "Job reliability and media correctness": versioned state, lease/fencing
-- for attempts, idempotency key, and a job stays non-successful until a verification report
-- exists. All writes are server-controlled (service role via apps/api / apps/worker only).

create type public.job_status as enum (
  'created', 'queued', 'processing', 'verifying', 'succeeded', 'failed', 'cancelled', 'expired'
);

create type public.job_recipe as enum ('inspect', 'remux', 'compat_encode');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  media_asset_id uuid not null references public.media_assets (id),
  created_by uuid not null references auth.users (id),
  recipe public.job_recipe not null,
  recipe_version integer not null default 1,
  idempotency_key uuid not null unique default gen_random_uuid(),
  status public.job_status not null default 'created',
  state_version integer not null default 1,
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  output_object_key text,
  output_size_bytes bigint,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function _hasheemstudio_meta.set_updated_at();

create index jobs_workspace_idx on public.jobs (workspace_id, created_at desc);
create index jobs_dispatch_idx on public.jobs (status, created_at) where status = 'queued';
create index jobs_lease_idx on public.jobs (status, lease_expires_at) where status = 'processing';

alter table public.jobs enable row level security;

create policy jobs_select_member on public.jobs
  for select using (public.is_workspace_member (workspace_id));

create table public.job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  attempt_number integer not null,
  worker_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text,
  error_message text,
  unique (job_id, attempt_number)
);

alter table public.job_attempts enable row level security;

create policy job_attempts_select_member on public.job_attempts
  for select using (
    exists (select 1 from public.jobs j where j.id = job_attempts.job_id and public.is_workspace_member (j.workspace_id))
  );

create table public.job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index job_events_job_idx on public.job_events (job_id, created_at);

alter table public.job_events enable row level security;

create policy job_events_select_member on public.job_events
  for select using (
    exists (select 1 from public.jobs j where j.id = job_events.job_id and public.is_workspace_member (j.workspace_id))
  );

create table public.verification_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  verification_level text not null,
  frames_re_encoded boolean not null,
  checks jsonb not null default '{}'::jsonb,
  input_checksum_sha256 text,
  output_checksum_sha256 text,
  tool_versions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index verification_reports_job_idx on public.verification_reports (job_id);

alter table public.verification_reports enable row level security;

create policy verification_reports_select_member on public.verification_reports
  for select using (
    exists (select 1 from public.jobs j where j.id = verification_reports.job_id and public.is_workspace_member (j.workspace_id))
  );
