-- Guests have private, membership-free workspaces. Only the API can resolve their capability.
alter table public.workspaces alter column created_by drop not null;
alter table public.upload_sessions alter column created_by drop not null;
alter table public.media_assets alter column created_by drop not null;
alter table public.jobs alter column created_by drop not null;

create table public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  token_hash text not null unique,
  network_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index guest_sessions_network_daily_idx on public.guest_sessions(network_hash, created_at);
alter table public.guest_sessions enable row level security;
revoke all on public.guest_sessions from anon, authenticated;

-- Separate processing abuse limits from the number of distinct videos a user may download.
alter table public.plans add column max_downloads_per_day integer not null default 1 check (max_downloads_per_day >= 0);
update public.plans set max_downloads_per_day = 20 where id = 'pro_beta';
create table public.download_grants (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
create index download_grants_user_daily_idx on public.download_grants(user_id, granted_at);
alter table public.download_grants enable row level security;
create policy download_grants_select_own on public.download_grants for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.download_grants from anon, authenticated;

-- Output access MUST go through the API download gate, including for signed-in workspace owners.
-- Restrict client writes to uploads too: a caller cannot replace a verified output.
drop policy media_objects_select_workspace_member on storage.objects;
drop policy media_objects_insert_workspace_member on storage.objects;
drop policy media_objects_update_workspace_member on storage.objects;
create policy media_uploads_select_member on storage.objects for select to authenticated using (
  bucket_id = 'media' and path_tokens[2] = 'uploads'
  and public.is_workspace_member(path_tokens[1]::uuid)
);
create policy media_uploads_insert_member on storage.objects for insert to authenticated with check (
  bucket_id = 'media' and path_tokens[2] = 'uploads'
  and public.is_workspace_member(path_tokens[1]::uuid)
);
create policy media_uploads_update_member on storage.objects for update to authenticated using (
  bucket_id = 'media' and path_tokens[2] = 'uploads'
  and public.is_workspace_member(path_tokens[1]::uuid)
) with check (
  bucket_id = 'media' and path_tokens[2] = 'uploads'
  and public.is_workspace_member(path_tokens[1]::uuid)
);
