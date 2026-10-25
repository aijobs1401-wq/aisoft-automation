-- Create one workspace for a newly authenticated user through a narrow RPC.
create or replace function public.create_my_organization(org_name text, org_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_org_id uuid;
  current_user_id uuid := auth.uid();
  safe_name text := trim(org_name);
  safe_slug text := lower(trim(org_slug));
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if safe_name is null or length(safe_name) < 2 or length(safe_name) > 100 then
    raise exception 'Business name must be between 2 and 100 characters';
  end if;
  if safe_slug is null or safe_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(safe_slug) > 50 then
    raise exception 'Invalid workspace slug';
  end if;
  if exists (select 1 from public.organization_members where user_id = current_user_id) then
    raise exception 'This account already has a workspace';
  end if;
  insert into public.organizations(name,slug,status)
  values (safe_name,safe_slug,'pending')
  returning id into new_org_id;
  insert into public.organization_members(organization_id,user_id,role)
  values (new_org_id,current_user_id,'owner');
  return new_org_id;
end;
$$;
revoke all on function public.create_my_organization(text,text) from public;
grant execute on function public.create_my_organization(text,text) to authenticated;
