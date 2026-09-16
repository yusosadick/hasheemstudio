-- Real plans/entitlements + atomic usage reservations, replacing the hardcoded constants in
-- apps/api Phase 4 code (docs/STATUS.md "Plan limits are hardcoded"). Per docs/PRD.md §6 and
-- docs/ARCHITECTURE.md "Data model and RLS": plans are versioned/immutable definitions, usage is
-- reserved before dispatch and settled/released exactly once.

create table public.plans (
  id text primary key,
  name text not null,
  max_upload_bytes bigint not null,
  max_duration_seconds integer not null,
  max_jobs_per_day integer not null,
  max_active_jobs integer not null,
  allowed_recipes text[] not null,
  created_at timestamptz not null default now()
);

-- Built-in immutable rows per docs/PRD.md §6. Not client-writable (no RLS insert/update policy
-- granted to anon/authenticated at all — only readable).
insert into public.plans (id, name, max_upload_bytes, max_duration_seconds, max_jobs_per_day, max_active_jobs, allowed_recipes) values
  ('verified_free', 'Verified Free', 100 * 1024 * 1024, 120, 3, 1, array['inspect', 'remux', 'compat_encode']),
  ('pro_beta', 'Pro Beta', 500 * 1024 * 1024, 600, 20, 2, array['inspect', 'remux', 'compat_encode']);

alter table public.plans enable row level security;

create policy plans_select_all on public.plans
  for select using (true);

create table public.workspace_entitlements (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  plan_id text not null references public.plans (id),
  assigned_by uuid references auth.users (id),
  assigned_at timestamptz not null default now()
);

alter table public.workspace_entitlements enable row level security;

create policy workspace_entitlements_select_member on public.workspace_entitlements
  for select using (public.is_workspace_member (workspace_id));

-- Every existing workspace (from Phase 3/4 testing) gets the default plan so the join in
-- apps/api never has to special-case a missing entitlement row.
insert into public.workspace_entitlements (workspace_id, plan_id)
select id, 'verified_free' from public.workspaces
on conflict (workspace_id) do nothing;

-- Assign the default plan atomically alongside the personal workspace at registration.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'Personal workspace', true, new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into public.workspace_entitlements (workspace_id, plan_id)
  values (new_workspace_id, 'verified_free');

  return new;
end;
$$;

-- Atomic usage reservations: one row per admitted job. 'reserved' on creation, 'released' if
-- cancelled before/while queued (refunds the daily-quota slot), 'settled' once the worker reaches
-- a terminal outcome (success or failure — both still count as a real attempt against the day's
-- quota, per docs/PRD.md "Meter ... job attempts"). Concurrency correctness comes from locking the
-- workspace row in apps/api before counting, not from this table alone — see
-- apps/api/src/routes/jobs.ts.
create table public.usage_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid unique references public.jobs (id),
  kind text not null default 'job_slot',
  status text not null default 'reserved' check (status in ('reserved', 'released', 'settled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index usage_reservations_workspace_daily_idx on public.usage_reservations (workspace_id, created_at);

alter table public.usage_reservations enable row level security;

create policy usage_reservations_select_member on public.usage_reservations
  for select using (public.is_workspace_member (workspace_id));
