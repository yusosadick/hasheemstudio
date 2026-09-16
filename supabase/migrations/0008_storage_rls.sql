-- Storage RLS policies enabling real direct-to-storage resumable (TUS) uploads authenticated as
-- the end user (not service-role), per docs/PRD.md "resumable uploads; interruption recovery" and
-- docs/ARCHITECTURE.md "upload media directly to the media/storage path, not through the frontend
-- server." Object keys are always workspace-id-prefixed ("<workspace_id>/uploads/...",
-- "<workspace_id>/outputs/..."), so membership can be checked from the first path segment using
-- the same public.is_workspace_member() helper already used elsewhere — never trusting the path
-- alone without that membership check.

create policy media_objects_insert_workspace_member on storage.objects
  for insert
  with check (
    bucket_id = 'media'
    and array_length(path_tokens, 1) > 1
    and public.is_workspace_member (path_tokens[1]::uuid)
  );

create policy media_objects_update_workspace_member on storage.objects
  for update
  using (
    bucket_id = 'media'
    and array_length(path_tokens, 1) > 1
    and public.is_workspace_member (path_tokens[1]::uuid)
  );

create policy media_objects_select_workspace_member on storage.objects
  for select
  using (
    bucket_id = 'media'
    and array_length(path_tokens, 1) > 1
    and public.is_workspace_member (path_tokens[1]::uuid)
  );

-- Outputs are written by the worker using the service-role key, which bypasses RLS entirely —
-- these policies only govern the authenticated-user-driven upload path.
