-- Move token storage behind a locked-down public-schema table so the server can
-- access it through the Supabase Data API without exposing it to client roles.
drop table if exists private.whatsapp_connection_secrets;
drop schema if exists private;

create table if not exists public.whatsapp_connection_secrets (
  connection_id uuid primary key references public.whatsapp_connections(id) on delete cascade,
  token_ciphertext text not null,
  token_key_version integer not null default 1,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_connection_secrets enable row level security;
revoke all on table public.whatsapp_connection_secrets from public, anon, authenticated;
grant select, insert, update, delete on table public.whatsapp_connection_secrets to service_role;
