import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";

type Membership = { role: string; organizations: { name: string; status: string; slug: string } | null };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20continue");
  const { data } = await supabase.from("organization_members").select("role, organizations(name,status,slug)").eq("user_id", user.id);
  const orgs = (data ?? []) as unknown as Membership[];
  return <main className="dashboard-wrap"><header className="dash-nav"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><div className="dash-user"><span>{user.email}</span><SignOutButton /></div></header><section className="dash-welcome"><span className="eyebrow">CLIENT WORKSPACE</span><h1>Welcome back</h1><p className="sub">Your workspace is ready for setup. Connect your official WhatsApp Business Platform account after Meta integration is configured.</p></section><section className="dash-grid"><article className="dash-tile"><span className="tile-icon">◉</span><h2>WhatsApp connection</h2><p className="sub">No active number is shown until the official Meta onboarding flow is implemented and completed.</p><span className="status-pill">Not connected</span></article><article className="dash-tile"><span className="tile-icon">☷</span><h2>Conversations</h2><p className="sub">Your team inbox will appear here once webhook ingestion and message sync are implemented.</p><span className="status-pill">Setup pending</span></article><article className="dash-tile"><span className="tile-icon">⌘</span><h2>Automation</h2><p className="sub">Workflow builder is planned; no automations are running in this scaffold.</p><span className="status-pill">Setup pending</span></article></section><section className="dash-tile org-panel"><h2>Your organizations</h2>{orgs.length ? <ul>{orgs.map((item,i)=><li key={i}><strong>{item.organizations?.name ?? "Workspace"}</strong><span className="sub">Role: {item.role} · Status: {item.organizations?.status ?? "pending"}</span></li>)}</ul> : <p className="sub">No workspace membership was found yet. If you just confirmed your email, sign in and complete onboarding or contact the administrator.</p>}</section><p className="dash-note">This is an early implementation. Live WhatsApp messaging, admin controls and automation features are not enabled yet.</p></main>;
}
