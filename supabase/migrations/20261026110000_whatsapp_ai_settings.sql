create table if not exists public.whatsapp_ai_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  bot_name text not null default 'AI Assistant',
  system_prompt text not null default 'You are a helpful, polite customer support assistant. Reply in the language the customer uses. Keep WhatsApp replies concise and clear. If you do not know an answer, say that a human team member will help. Never invent prices, policies, guarantees, or financial claims.',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_ai_settings enable row level security;
drop policy if exists "Members read own workspace AI settings" on public.whatsapp_ai_settings;
create policy "Members read own workspace AI settings"
  on public.whatsapp_ai_settings for select to authenticated
  using (public.is_org_member(organization_id));
grant select on public.whatsapp_ai_settings to authenticated;
revoke insert, update, delete on public.whatsapp_ai_settings from anon, authenticated;
