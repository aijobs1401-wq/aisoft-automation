import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import SignOutButton from "../dashboard/sign-out-button";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!user.email || !allowed.includes(user.email.toLowerCase())) redirect("/dashboard");

  let organizationCount: number | null = null;
  let connectionCount: number | null = null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    const service = createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const [organizations, connections] = await Promise.all([
      service.from("organizations").select("*", { count: "exact", head: true }),
      service.from("whatsapp_connections").select("*", { count: "exact", head: true })
    ]);
    organizationCount = organizations.count;
    connectionCount = connections.count;
  }

  return <main className="dashboard-wrap"><header className="dash-nav"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><div className="dash-user"><span>Platform admin · {user.email}</span><SignOutButton /></div></header><section className="dash-welcome"><span className="eyebrow">PLATFORM CONTROL</span><h1>Admin overview</h1><p className="sub">This route is restricted to email addresses listed in the server-only ADMIN_EMAILS environment variable.</p></section><section className="dash-grid"><article className="dash-tile"><span className="tile-icon">◈</span><h2>Organizations</h2><p className="sub">Total workspaces currently stored in Supabase.</p><strong style={{fontSize:32}}>{organizationCount ?? "Configure service role key"}</strong></article><article className="dash-tile"><span className="tile-icon">◎</span><h2>WhatsApp connections</h2><p className="sub">Connection records; live Meta onboarding is not yet implemented.</p><strong style={{fontSize:32}}>{connectionCount ?? "Configure service role key"}</strong></article><article className="dash-tile"><span className="tile-icon">⛨</span><h2>Access control</h2><p className="sub">Admin access is allowlisted by email on the server. Do not expose service-role credentials.</p><span className="status-pill">Email allowlist active</span></article></section><p className="dash-note">Client management actions, Meta onboarding, billing, webhook processing and message sending are not implemented yet.</p></main>;
}
