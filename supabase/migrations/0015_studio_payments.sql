-- Studio-only payment ledger. No pricing seed; owner approval remains required.
create table public.payment_intents (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade,
 provider text not null default 'snippe' check(provider='snippe'),
 provider_reference text unique,
 amount_tzs integer not null check(amount_tzs>=500),
 currency text not null default 'TZS' check(currency='TZS'),
 plan_name text not null,
 duration_seconds integer not null check(duration_seconds>0),
 downloads_per_day integer not null check(downloads_per_day>0),
 payment_method text not null check(payment_method in ('mobile','card')),
 status text not null default 'created' check(status in ('created','pending','unknown','completed','failed','voided','expired')),
 idempotency_key text not null unique check(length(idempotency_key)<=30),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index one_open_studio_payment on public.payment_intents(user_id,job_id) where status in ('created','pending','unknown');
create index studio_payment_user_time on public.payment_intents(user_id,created_at);
create table public.payment_events (
 webhook_event_id text primary key,
 payment_intent_id uuid not null references public.payment_intents(id) on delete cascade,
 event_type text not null check(event_type in ('completed','failed','voided','expired')),
 provider_reference text not null,
 amount_tzs integer not null,
 currency text not null check(currency='TZS'),
 payload_digest text not null,
 created_at timestamptz not null default now()
);
create table public.paid_entitlements (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 payment_intent_id uuid not null unique references public.payment_intents(id) on delete cascade,
 downloads_per_day integer not null check(downloads_per_day>0),
 starts_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(expires_at>starts_at)
);
alter table public.payment_intents enable row level security;
alter table public.payment_events enable row level security;
alter table public.paid_entitlements enable row level security;
revoke all on public.payment_intents, public.payment_events, public.paid_entitlements from anon, authenticated;
grant select on public.payment_intents, public.paid_entitlements to authenticated;
create policy payment_intents_read_own on public.payment_intents for select to authenticated using(user_id=auth.uid());
create policy paid_entitlements_read_own on public.paid_entitlements for select to authenticated using(user_id=auth.uid());
-- Events are backend-only; API status never returns correlation/provider secrets or raw payload.
