import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (!code) return NextResponse.redirect(new URL("/login?message=Email%20confirmation%20link%20is%20missing", origin));

  const response = NextResponse.redirect(new URL(safeNext, origin));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.redirect(new URL("/login?message=Supabase%20is%20not%20configured", origin));

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => values.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    }
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?message=Email%20confirmation%20failed.%20Please%20try%20again.", origin));

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { count } = await supabase.from("organization_members").select("organization_id", { count: "exact", head: true }).eq("user_id", user.id);
    if (!count) {
      const company = String(user.user_metadata?.organization_name ?? "").trim();
      if (company.length >= 2) {
        const slug = slugify(company) || `workspace-${user.id.slice(0, 8)}`;
        const { error: onboardingError } = await supabase.rpc("create_my_organization", { org_name: company, org_slug: slug });
        if (onboardingError) return NextResponse.redirect(new URL("/login?message=Email%20confirmed.%20Workspace%20setup%20needs%20attention.%20Please%20contact%20support.", origin));
      }
    }
  }
  return response;
}
