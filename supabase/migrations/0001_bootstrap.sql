-- Bootstrap marker + shared helper function, per docs/MIGRATIONS.md and docs/ENVIRONMENTS.md
-- "Supabase database identity marker": lets the migration runner (scripts/db/remote.mjs) confirm
-- it is talking to THIS project's database, not any other Postgres instance on the shared host.

create schema if not exists _hasheemstudio_meta;

create table if not exists _hasheemstudio_meta.bootstrap (
  id boolean primary key default true,
  project text not null,
  created_at timestamptz not null default now(),
  constraint bootstrap_singleton check (id)
);

insert into _hasheemstudio_meta.bootstrap (id, project)
values (true, 'hasheemstudio')
on conflict (id) do nothing;

create or replace function _hasheemstudio_meta.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
