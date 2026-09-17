-- Retention bookkeeping for the sweeper (scripts/ops/retention-sweep.mjs). Per docs/PRD.md
-- "Deletion and privacy" and the user's explicit instruction: never delete an active job's
-- files, never touch another tenant's files.

alter table public.jobs
  add column output_retain_until timestamptz,
  add column output_deleted_at timestamptz;

-- Index for the sweeper's three queries: abandoned upload sessions, expired media assets with no
-- active job referencing them, and expired job outputs.
create index jobs_output_retention_idx on public.jobs (output_retain_until)
  where output_object_key is not null and output_deleted_at is null;

create index media_assets_active_by_workspace_idx on public.media_assets (id, workspace_id)
  where lifecycle_state = 'active';
