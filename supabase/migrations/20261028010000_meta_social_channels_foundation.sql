-- Additive foundation for Meta Messenger and Instagram messaging.
-- This migration does not alter or migrate existing WhatsApp data.

create table if not exists public.social_channel_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('instagram','messenger')),
  external_account_id text not null,
  display_name text,
  username text,
  connection_status text not null default 'pending'
    check (connection_status in ('pending','connected','disconnected','error')),
  metadata jsonb not null default '{}'::jsonb,
  last_webhook_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_account_id)
);

create table if not exists public.social_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('instagram','messenger')),
  external_user_id text not null,
  display_name text,
  username text,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, provider, external_user_id)
);

create table if not exists public.social_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.social_channel_connections(id) on delete cascade,
  contact_id uuid not null references public.social_contacts(id) on delete cascade,
  status text not null default 'open' check (status in ('open','pending','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, connection_id, contact_id)
);

create table if not exists public.social_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.social_conversations(id) on delete cascade,
  external_message_id text not null unique,
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null default 'text',
  body text,
  delivery_status text not null default 'received'
    check (delivery_status in ('queued','sent','delivered','read','failed','received')),
  error_code text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists social_connections_org_idx
  on public.social_channel_connections(organization_id, provider, connection_status);
create index if not exists social_contacts_org_idx
  on public.social_contacts(organization_id, provider);
create index if not exists social_conversations_org_status_idx
  on public.social_conversations(organization_id, status, last_message_at desc);
create index if not exists social_messages_conversation_time_idx
  on public.social_messages(conversation_id, occurred_at desc);

alter table public.social_channel_connections enable row level security;
alter table public.social_contacts enable row level security;
alter table public.social_conversations enable row level security;
alter table public.social_messages enable row level security;

drop policy if exists "Members read social channel connections" on public.social_channel_connections;
create policy "Members read social channel connections"
  on public.social_channel_connections for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Members read social contacts" on public.social_contacts;
create policy "Members read social contacts"
  on public.social_contacts for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Members read social conversations" on public.social_conversations;
create policy "Members read social conversations"
  on public.social_conversations for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Members read social messages" on public.social_messages;
create policy "Members read social messages"
  on public.social_messages for select to authenticated
  using (public.is_org_member(organization_id));

grant select on public.social_channel_connections, public.social_contacts,
  public.social_conversations, public.social_messages to authenticated;

-- Keep long-lived Meta access tokens out of the client-readable public schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.social_channel_secrets (
  connection_id uuid primary key references public.social_channel_connections(id) on delete cascade,
  token_ciphertext text not null,
  token_key_version integer not null default 1,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
revoke all on table private.social_channel_secrets from public, anon, authenticated;
grant select, insert, update, delete on table private.social_channel_secrets to service_role;
