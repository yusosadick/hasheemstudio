-- Adapted from zahorozanzibar 2fd32cf, Apache-2.0; see third_party/zahorozanzibar.
-- Modified: serialize admission to prevent concurrent rate-limit bypass.
-- 00061_email_exists_lookup.sql
-- Progressive auth flow support: a rate-limited SECURITY DEFINER fn that
-- tells the frontend whether an email already has an account, so /login
-- can show either the password step (existing user) or the signup step
-- (new user) without a separate /register page.
--
-- SECURITY tradeoff: this enables email-enumeration. We accept that per
-- modern industry pattern (Whop / Linear / Vercel / Auth0 / Clerk all do
-- this) and mitigate with two-tier rate limiting on the lookup itself:
--   - per email: max 5 checks per hour
--   - global:    max 100 checks per minute
-- Either limit, when hit, returns FALSE — intentionally indistinguishable
-- from "no account" so an attacker can't tell whether they hit the cap.
-- See docs/security-exceptions.md for the decision record.

create table if not exists public.email_check_log (
  id              bigserial primary key,
  normalized_email text not null,
  at              timestamptz not null default now()
);

alter table public.email_check_log enable row level security;
alter table public.email_check_log force row level security;
revoke all on table public.email_check_log from anon, authenticated, public;

create index if not exists idx_email_check_log_at
  on public.email_check_log(at desc);
create index if not exists idx_email_check_log_email_at
  on public.email_check_log(normalized_email, at desc);

comment on table public.email_check_log is
  'Rate-limit ledger for email_exists() RPC. Service-role-only.';

create or replace function public.email_exists(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email                text;
  v_per_email_per_hour   int;
  v_total_per_min        int;
  v_exists               boolean;
begin
  v_email := lower(trim(coalesce(p_email, '')));

  -- Cheap shape check: bail without consuming budget.
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return false;
  end if;

  perform pg_advisory_xact_lock(7262747272);

  -- Per-email throttle: same address can be checked 5 times / hour.
  select count(*) into v_per_email_per_hour
    from public.email_check_log
   where normalized_email = v_email
     and at > now() - interval '1 hour';
  if v_per_email_per_hour >= 5 then
    return false;  -- indistinguishable from "no account"
  end if;

  -- Global throttle: 100 checks / minute across all emails.
  select count(*) into v_total_per_min
    from public.email_check_log
   where at > now() - interval '1 minute';
  if v_total_per_min >= 100 then
    return false;  -- same
  end if;

  insert into public.email_check_log (normalized_email) values (v_email);

  -- Opportunistic cleanup of rows older than 24h. Cheap; bounds the table.
  delete from public.email_check_log where at < now() - interval '24 hours';

  select exists (
    select 1 from auth.users where lower(email) = v_email and deleted_at is null
  ) into v_exists;
  return v_exists;
end;
$$;

-- Anon callers explicitly allowed: this RPC is the only thing the
-- login page calls before sign-in. The rate limit inside the function
-- is the gate.
revoke execute on function public.email_exists(text) from public;
grant  execute on function public.email_exists(text) to anon, authenticated;

comment on function public.email_exists(text) is
  'Returns true if an account with this email exists (case-insensitive). Rate-limited per-email (5/hr) and globally (100/min). Both limits silently return false when hit.';
