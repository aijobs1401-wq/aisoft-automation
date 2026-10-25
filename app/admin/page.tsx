import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "../dashboard/sign-out-button";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!user.email || !allowed.includes(user.email.toLowerCase())) redirect("/dashboard");

  const { count: organizationCount } = await supabase.from("organizations").select("*", { count: "exact", head: true });
  const { count: connectionCount } = await supabase.from("whatsapp_connections").select("*", { count: "exact", head: true });
  return <main className="dashboard-wrap"><header className="dash-nav"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><div className="dash-user"><span>Platform admin · {user.email}</span><SignOutButton /></div></header><section className="dash-welcome"><span className="eyebrow">PLATFORM CONTROL</span><h1>Admin overview</h1><p className="sub">This route is restricted to email addresses listed in the server-only ADMIN_EMAILS environment variable.</p></section><section className="dash-grid"><article className="dash-tile"><span className="tile-icon">◈</span><h2>Organizations</h2><p className="sub">Total workspaces currently stored in Supabase.</p><strong style={{fontSize:32}}>{organizationCount ?? "—"}</strong></article><article className="dash-tile"><span className="tile-icon">◎</span><h2>WhatsApp connections</h2><p className="sub">Connection records; live Meta onboarding is not yet implemented.</p><strong style={{fontSize:32}}>{connectionCount ?? "—"}</strong></article><article className="dash-tile"><span className="tile-icon">⛨</span><h2>Access control</h2><p className="sub">Admin access is allowlisted by email on the server. Do not expose service-role credentials.</p><span className="status-pill">Email allowlist active</span></article></section><p className="dash-note">Client management actions, Meta onboarding, billing, webhook processing and message sending are not implemented yet.</p></main>;
}
