-- Keep the workspace-creation RPC authenticated-only. The membership helper
-- remains callable by authenticated users because row-level policies depend on it.
revoke all on function public.create_my_organization(text,text) from anon, authenticated;
grant execute on function public.create_my_organization(text,text) to authenticated;
revoke all on function public.is_org_member(uuid) from anon;
grant execute on function public.is_org_member(uuid) to authenticated;
