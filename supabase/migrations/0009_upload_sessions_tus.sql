-- Real resumable uploads use TUS (RFC-ish protocol Supabase Storage implements natively).
-- upload_sessions needs to remember the TUS resource path returned at creation time so the client
-- can resume against the same resource after a reload/reconnect.

alter table public.upload_sessions
  add column tus_upload_path text;
