-- WhatsApp multi-tenant schema and private token storage.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now()
);
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('owner','admin','agent','client')),
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);
create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_number_id text not null unique,
  waba_id text not null,
  display_phone_number text,
  verified_name text,
  connection_status text not null default 'pending' check (connection_status in ('pending','connected','disconnected','error')),
  token_ciphertext text,
  token_key_version integer,
  last_webhook_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  wa_id text not null,
  name text,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id,wa_id)
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.whatsapp_connections(id) on delete set null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'open' check (status in ('open','pending','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id,contact_id,connection_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  meta_message_id text unique,
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null default 'text',
  body text,
  delivery_status text not null default 'received' check (delivery_status in ('queued','sent','delivered','read','failed','received')),
  error_code text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  payload jsonb not null,
  processing_status text not null default 'pending' check (processing_status in ('pending','processed','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists org_members_user_idx on public.organization_members(user_id);
create index if not exists connections_org_idx on public.whatsapp_connections(organization_id);
create index if not exists contacts_org_idx on public.contacts(organization_id);
create index if not exists conversations_org_status_idx on public.conversations(organization_id,status,last_message_at desc);
create index if not exists messages_conversation_time_idx on public.messages(conversation_id,occurred_at desc);
create index if not exists webhook_events_status_received_idx on public.webhook_events(processing_status,received_at);

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.organization_members m
  where m.organization_id = target_org and m.user_id = (select auth.uid())
) $$;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.whatsapp_connections enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.webhook_events enable row level security;

drop policy if exists "Members read their organizations" on public.organizations;
create policy "Members read their organizations" on public.organizations for select to authenticated using (public.is_org_member(id));
drop policy if exists "Members read memberships in their organizations" on public.organization_members;
create policy "Members read memberships in their organizations" on public.organization_members for select to authenticated using (user_id = (select auth.uid()) or public.is_org_member(organization_id));
drop policy if exists "Members read connections" on public.whatsapp_connections;
create policy "Members read connections" on public.whatsapp_connections for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "Members read contacts" on public.contacts;
create policy "Members read contacts" on public.contacts for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "Members read conversations" on public.conversations;
create policy "Members read conversations" on public.conversations for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "Members read messages" on public.messages;
create policy "Members read messages" on public.messages for select to authenticated using (public.is_org_member(organization_id));

-- Access tokens are stored separately from public-schema tables.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.whatsapp_connection_secrets (
  connection_id uuid primary key references public.whatsapp_connections(id) on delete cascade,
  token_ciphertext text not null,
  token_key_version integer not null default 1,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
revoke all on table private.whatsapp_connection_secrets from public, anon, authenticated;
grant select, insert, update, delete on table private.whatsapp_connection_secrets to service_role;
