-- Store the onboarding path selected during Meta Embedded Signup.
-- Existing connections are classified as API-only by default because their historical
-- onboarding mode cannot be safely inferred from the current connection record.
alter table public.whatsapp_connections
  add column if not exists onboarding_mode text not null default 'api_only';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_connections_onboarding_mode_check'
      and conrelid = 'public.whatsapp_connections'::regclass
  ) then
    alter table public.whatsapp_connections
      add constraint whatsapp_connections_onboarding_mode_check
      check (onboarding_mode in ('coexistence', 'api_only'));
  end if;
end $$;

comment on column public.whatsapp_connections.onboarding_mode is
  'Meta Embedded Signup path: coexistence (Business App + Cloud API) or api_only (Cloud API only).';
