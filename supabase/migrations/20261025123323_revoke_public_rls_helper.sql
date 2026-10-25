-- This maintenance helper must never be callable through the public REST API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
