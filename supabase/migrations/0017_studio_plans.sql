-- Account-level paid plans (weekly / monthly) with a total-videos quota. Additive and backward compatible:
-- existing per-job intents keep working; nothing is dropped except the one-open-attempt index, which is
-- replaced by a per-account version (checkout is no longer tied to a single job).
alter table public.payment_intents alter column job_id drop not null;
alter table public.payment_intents add column plan_code text check (plan_code in ('weekly','monthly'));
alter table public.payment_intents add column downloads_total integer check (downloads_total > 0);
drop index public.one_open_studio_payment;
create unique index one_open_studio_payment on public.payment_intents(user_id) where status in ('created','pending','unknown');

alter table public.paid_entitlements add column plan_code text check (plan_code in ('weekly','monthly'));
alter table public.paid_entitlements add column downloads_total integer check (downloads_total > 0);

-- Which paid entitlement (if any) a download was charged to. NULL = the free daily allowance.
alter table public.download_grants add column entitlement_id uuid references public.paid_entitlements(id) on delete set null;
create index download_grants_entitlement_idx on public.download_grants(entitlement_id) where entitlement_id is not null;
