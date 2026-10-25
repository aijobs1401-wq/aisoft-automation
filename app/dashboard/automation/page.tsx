import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AutomationSettingsForm from "./settings-form";

export default async function AutomationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20configure%20automation");
  const { data: memberships } = await supabase.from("organization_members")
    .select("organization_id,organizations(name)").eq("user_id", user.id)
    .order("created_at", { ascending: true }).limit(1);
  const membership = memberships?.[0];
  if (!membership) return <main className="dashboard-wrap"><Link href="/dashboard">← Back to dashboard</Link><h1>Workspace required</h1><p>Create your workspace before configuring AI.</p></main>;
  const organization = membership.organizations as { name?: string } | null;
  return (
    <main className="dashboard-wrap">
      <header className="dash-nav"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><div className="dash-user"><Link href="/dashboard">Back to dashboard</Link></div></header>
      <section className="dash-welcome"><span className="eyebrow">AI AUTOMATION STUDIO</span><h1>AI replies & chatbot</h1><p className="sub">Set your assistant's instructions and choose when it should answer incoming WhatsApp messages.</p></section>
      <div className="dash-grid">
        <section className="dash-tile org-panel">
          <h2><Bot size={20} /> Assistant settings</h2>
          <p className="sub">Workspace: <strong>{organization?.name ?? "Your workspace"}</strong></p>
          <AutomationSettingsForm organizationId={membership.organization_id} />
        </section>
        <aside className="dash-tile org-panel">
          <h2><ShieldCheck size={20} /> Safe launch checklist</h2>
          <ul><li>Connect your WhatsApp Business number and subscribe the Meta app to message webhooks.</li><li>Add OPENAI_API_KEY to Render server environment variables. Never put it in a NEXT_PUBLIC variable.</li><li>Test with your own number before enabling the bot for customers.</li><li>AI replies are sent only after a new inbound message, and the assistant should not invent prices or promises.</li></ul>
          <p className="sub"><Sparkles size={15} /> A human handoff workflow and business knowledge base can be added next.</p>
        </aside>
      </div>
      <p className="auth-foot"><Link href="/dashboard/conversations"><MessageCircle size={14} /> Open customer inbox</Link></p>
    </main>
  );
}
