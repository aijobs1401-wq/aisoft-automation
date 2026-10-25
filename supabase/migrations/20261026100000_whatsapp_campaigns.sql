create table if not exists public.whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  template_name text not null,
  template_language text not null default 'en',
  status text not null default 'processing' check (status in ('processing','completed','partial','failed')),
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists whatsapp_campaigns_org_created_idx
  on public.whatsapp_campaigns(organization_id, created_at desc);
alter table public.whatsapp_campaigns enable row level security;
drop policy if exists "Members read own workspace campaigns" on public.whatsapp_campaigns;
create policy "Members read own workspace campaigns"
  on public.whatsapp_campaigns for select to authenticated
  using (public.is_org_member(organization_id));
grant select on public.whatsapp_campaigns to authenticated;
revoke insert, update, delete on public.whatsapp_campaigns from anon, authenticated;
