-- Fix the search path for security-definer functions to avoid object shadowing.
alter function public.create_my_organization(text,text) set search_path = '';
alter function public.is_org_member(uuid) set search_path = '';
