-- Server-only administrative membership. Per docs/MASTER-PLAN-ORIGINAL.md §16: "no automatic
-- promotion of the first registered user"; per docs/ARCHITECTURE.md: "platform_admins: server-only
-- administrative membership with controlled promotion." Deliberately has NO RLS policies at all —
-- RLS is enabled with zero policies, which means PostgREST (anon/authenticated roles) can never
-- read or write this table under any circumstance; only the service-role key (which bypasses RLS)
-- or a direct database connection can touch it. There is intentionally no self-service promotion
-- path here.

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin ()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin () from public;
grant execute on function public.is_platform_admin () to authenticated;
