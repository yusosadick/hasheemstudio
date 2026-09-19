-- NOTE: change to your own passwords for production environments
\set pgpass `echo "$POSTGRES_PASSWORD"`

-- The Supabase Postgres image makes these protected roles. Its bootstrap
-- `postgres` role is deliberately not a superuser, while `supabase_admin` is
-- the designated local bootstrap administrator. Init scripts run over the
-- trusted local socket, so switch roles before assigning service passwords.
\connect - supabase_admin

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_functions_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
