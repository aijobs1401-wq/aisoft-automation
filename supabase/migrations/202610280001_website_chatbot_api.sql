-- Website chatbot SaaS tenant config, public-key hashes, and usage meter.
create table if not exists public.website_chatbots (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null unique references public.organizations(id) on delete cascade,
 name text not null default 'Website Assistant',
 system_prompt text not null default 'You are a helpful website support assistant. Do not invent prices or policies.',
 welcome_message text not null default 'Hi! How can I help you today?',
 allowed_origins text[] not null default '{}',
 plan_key text not null default 'starter' check (plan_key in ('starter','growth','pro')),
 monthly_message_limit integer not null default 1000 check (monthly_message_limit > 0),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.website_chatbot_api_keys (
 id uuid primary key default gen_random_uuid(),
 chatbot_id uuid not null references public.website_chatbots(id) on delete cascade,
 key_prefix text not null,
 key_hash text not null unique,
 label text not null default 'Website widget',
 revoked_at timestamptz,
 last_used_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists website_chatbot_keys_bot_idx on public.website_chatbot_api_keys(chatbot_id);
create table if not exists public.website_chatbot_usage (
 chatbot_id uuid not null references public.website_chatbots(id) on delete cascade,
 usage_month date not null,
 messages_count integer not null default 0 check(messages_count >= 0),
 updated_at timestamptz not null default now(),
 primary key(chatbot_id, usage_month)
);
create or replace function public.consume_website_chatbot_message(p_chatbot_id uuid,p_usage_month date,p_monthly_limit integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare new_count integer;
begin
 insert into public.website_chatbot_usage(chatbot_id,usage_month,messages_count)
 values(p_chatbot_id,p_usage_month,1)
 on conflict(chatbot_id,usage_month) do update
 set messages_count=public.website_chatbot_usage.messages_count+1,updated_at=now()
 where public.website_chatbot_usage.messages_count < p_monthly_limit
 returning messages_count into new_count;
 return new_count is not null;
end; $$;
revoke all on function public.consume_website_chatbot_message(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.consume_website_chatbot_message(uuid,date,integer) to service_role;
alter table public.website_chatbots enable row level security;
alter table public.website_chatbot_api_keys enable row level security;
alter table public.website_chatbot_usage enable row level security;
drop policy if exists "workspace members read website chatbot" on public.website_chatbots;
create policy "workspace members read website chatbot" on public.website_chatbots for select to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=website_chatbots.organization_id and m.user_id=auth.uid())
);
drop policy if exists "workspace admins manage website chatbot" on public.website_chatbots;
create policy "workspace admins manage website chatbot" on public.website_chatbots for all to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=website_chatbots.organization_id and m.user_id=auth.uid() and lower(m.role) in ('owner','admin'))
) with check (
 exists(select 1 from public.organization_members m where m.organization_id=website_chatbots.organization_id and m.user_id=auth.uid() and lower(m.role) in ('owner','admin'))
);
-- API-key hashes and usage intentionally have no client-access policies; server routes use service role.
