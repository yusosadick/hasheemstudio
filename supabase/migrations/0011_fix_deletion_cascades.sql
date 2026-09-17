-- Fixes a real bug found while cleaning up test data: deleting a user via the GoTrue admin API
-- (the only account-deletion mechanism that exists today — docs/PRD.md "Delete individual
-- files/jobs or request account deletion" is a P0 requirement) failed for EVERY user, because
-- workspaces.created_by referenced auth.users(id) without ON DELETE CASCADE. Since every user gets
-- a personal workspace atomically at registration, this meant account deletion was broken for
-- 100% of accounts, not an edge case. Postgres reported it honestly (a real 23503 foreign-key
-- violation), it just meant we were only ever "succeeding" in test cleanup because most calling
-- code never checked the response status — worth calling out, since more than one test script's
-- cleanup step silently failed as a result and needs revisiting.
--
-- usage_reservations.job_id had the same gap: once workspaces.created_by cascades and deletes the
-- workspace's jobs (jobs.workspace_id already cascades correctly), the reservation row pointing at
-- that now-cascading job needs its own cascade too, or the same class of failure recurs one level
-- deeper.

alter table public.workspaces
  drop constraint workspaces_created_by_fkey,
  add constraint workspaces_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete cascade;

alter table public.usage_reservations
  drop constraint usage_reservations_job_id_fkey,
  add constraint usage_reservations_job_id_fkey
    foreign key (job_id) references public.jobs (id) on delete cascade;
