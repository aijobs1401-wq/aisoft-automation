create table if not exists public.whatsapp_business_verification (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  business_website text,
  document_path text,
  status text not null default 'submitted' check (status in ('submitted','reviewing','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_business_verification_evidence check (nullif(trim(business_website), '') is not null or nullif(trim(document_path), '') is not null)
);
create index if not exists whatsapp_business_verification_org_created_idx on public.whatsapp_business_verification(organization_id, created_at desc);
alter table public.whatsapp_business_verification enable row level security;
drop policy if exists "workspace members can read business verification submissions" on public.whatsapp_business_verification;
create policy "workspace members can read business verification submissions" on public.whatsapp_business_verification for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = whatsapp_business_verification.organization_id and m.user_id = auth.uid())
);
