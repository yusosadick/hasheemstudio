-- Upload sessions and media assets. All writes are server-controlled (service role only, via
-- apps/api) — clients never insert/update these directly; RLS grants read-only access scoped to
-- workspace membership. Per docs/ARCHITECTURE.md "Data model and RLS".

create type public.upload_session_state as enum ('pending', 'completed', 'expired', 'aborted');

create table public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  object_key text not null unique,
  declared_filename text not null,
  declared_size_bytes bigint not null check (declared_size_bytes > 0),
  declared_mime_type text,
  state public.upload_session_state not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger upload_sessions_set_updated_at
  before update on public.upload_sessions
  for each row execute function _hasheemstudio_meta.set_updated_at();

create index upload_sessions_workspace_idx on public.upload_sessions (workspace_id, created_at desc);
create index upload_sessions_expiry_idx on public.upload_sessions (state, expires_at) where state = 'pending';

alter table public.upload_sessions enable row level security;

create policy upload_sessions_select_member on public.upload_sessions
  for select using (public.is_workspace_member (workspace_id));

create type public.media_lifecycle_state as enum ('active', 'deleted');

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  upload_session_id uuid not null references public.upload_sessions (id),
  created_by uuid not null references auth.users (id),
  object_key text not null unique,
  size_bytes bigint not null check (size_bytes > 0),
  checksum_sha256 text,
  duration_seconds numeric,
  width integer,
  height integer,
  video_codec text,
  audio_codec text,
  container text,
  frame_rate numeric,
  is_vfr boolean,
  rotation_degrees integer,
  lifecycle_state public.media_lifecycle_state not null default 'active',
  retain_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger media_assets_set_updated_at
  before update on public.media_assets
  for each row execute function _hasheemstudio_meta.set_updated_at();

create index media_assets_workspace_idx on public.media_assets (workspace_id, created_at desc);
create index media_assets_retention_idx on public.media_assets (lifecycle_state, retain_until) where lifecycle_state = 'active';

alter table public.media_assets enable row level security;

create policy media_assets_select_member on public.media_assets
  for select using (public.is_workspace_member (workspace_id));
