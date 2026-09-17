-- Follow-up to 0011: a systematic query of every FK referencing auth.users (pg_constraint where
-- confrelid = 'auth.users'::regclass) found three more rows missing ON DELETE CASCADE
-- (jobs.created_by, media_assets.created_by, upload_sessions.created_by — each also cascades via
-- workspace_id already, but Postgres independently requires every FK referencing the deleted row
-- to resolve, not just one path) and two "audit trail" references that should NOT cascade-delete
-- their row, just lose the back-reference: platform_admins.granted_by and
-- workspace_entitlements.assigned_by — deleting the person who granted/assigned something should
-- not revoke or destroy someone else's still-valid grant/entitlement.

alter table public.jobs
  drop constraint jobs_created_by_fkey,
  add constraint jobs_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete cascade;

alter table public.media_assets
  drop constraint media_assets_created_by_fkey,
  add constraint media_assets_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete cascade;

alter table public.upload_sessions
  drop constraint upload_sessions_created_by_fkey,
  add constraint upload_sessions_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete cascade;

alter table public.platform_admins
  drop constraint platform_admins_granted_by_fkey,
  add constraint platform_admins_granted_by_fkey
    foreign key (granted_by) references auth.users (id) on delete set null;

alter table public.workspace_entitlements
  drop constraint workspace_entitlements_assigned_by_fkey,
  add constraint workspace_entitlements_assigned_by_fkey
    foreign key (assigned_by) references auth.users (id) on delete set null;
