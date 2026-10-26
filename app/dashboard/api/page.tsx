import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, Webhook } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ApiSettingsClient from "./page-client";

export const dynamic = "force-dynamic";

export default async function ApiSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20manage%20API%20settings");
  const { data: memberships } = await supabase.from("organization_members")
    .select("organization_id,role,organizations(name)")
    .eq("user_id", user.id).in("role", ["owner", "admin"])
    .order("created_at", { ascending: true }).limit(1);
  if (!memberships?.length) redirect("/dashboard/workspace/new");
  const organization = memberships[0].organizations as { name?: string } | null;
  return <main className="dashboard-wrap">
    <header className="dash-nav"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><div className="dash-user"><Link href="/dashboard">Back to dashboard</Link></div></header>
    <section className="dash-welcome"><span className="eyebrow">DEVELOPER TOOLS</span><h1>API & Webhooks</h1><p className="sub">Workspace: <strong>{organization?.name ?? "Your workspace"}</strong>. Your API key is generated automatically and your inbound webhook can be configured here.</p></section>
    <ApiSettingsClient />
  </main>;
}
