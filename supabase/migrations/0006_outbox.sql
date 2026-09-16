-- Transactional outbox: a job row and its dispatch event are created in the same transaction
-- (see apps/api job creation), so Redis loss can never erase the list of accepted jobs — the
-- worker's dispatcher polls this table and is the only thing that ever enqueues into Redis/BullMQ.
-- Server-only: RLS enabled with zero policies, same pattern as platform_admins.

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz
);

create index outbox_events_undispatched_idx on public.outbox_events (created_at) where dispatched_at is null;

alter table public.outbox_events enable row level security;
