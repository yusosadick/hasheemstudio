-- Core tenancy: profiles, workspaces, workspace_members, and atomic registration workspace
-- creation. Per docs/ARCHITECTURE.md "Data model and RLS": membership is checked server-side via
-- a SECURITY DEFINER helper (avoids recursive RLS), role/admin fields are never client-writable.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function _hasheemstudio_meta.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_personal boolean not null default false,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function _hasheemstudio_meta.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

-- SECURITY DEFINER, fixed search_path, and a narrow signature: avoids both the recursive-RLS
-- trap (a policy on workspace_members that queries workspace_members) and unsafe search_path
-- hijacking. Execute is revoked from public and granted only to the authenticated role.
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_workspace_member (uuid) from public;
grant execute on function public.is_workspace_member (uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy workspaces_select_member on public.workspaces
  for select using (public.is_workspace_member (id));

create policy workspace_members_select_member on public.workspace_members
  for select using (public.is_workspace_member (workspace_id));

-- Registration creates profile + personal workspace + owner membership atomically, in one
-- transaction driven by the auth.users insert itself — per docs/PRD.md "Personal workspace
-- created atomically on registration."
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'Personal workspace', true, new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
