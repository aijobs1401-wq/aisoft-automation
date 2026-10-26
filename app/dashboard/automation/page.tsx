import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft, ArrowRight, Bot, BookOpen, CheckCircle2, CircleHelp, MessageCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AutomationSettingsForm from "./settings-form";
import "./automation.css";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20configure%20automation");
  const { data: memberships } = await supabase.from("organization_members")
    .select("organization_id,organizations(name)").eq("user_id", user.id)
    .order("created_at", { ascending: true }).limit(1);
  const membership = memberships?.[0];
  if (!membership) return <main className="automation-page"><header className="automation-top"><Link className="automation-brand" href="/"><span className="automation-logo">AI</span><span>AI SOFT STUDIO<small>WHATSAPP AUTOMATION</small></span></Link><Link className="automation-back" href="/dashboard"><ArrowLeft size={15}/> Dashboard</Link></header><section className="automation-empty"><span className="automation-kicker">ONE QUICK STEP</span><h1>Create your workspace first</h1><p>Your account is signed in, but it does not have a workspace yet. Create one to save AI chatbot settings and connect WhatsApp.</p><Link className="automation-primary" href="/dashboard/workspace/new">Create workspace <ArrowRight size={16}/></Link></section></main>;
  const organization = membership.organizations as { name?: string } | null;
  return <main className="automation-page">
    <header className="automation-top">
      <Link className="automation-brand" href="/"><span className="automation-logo"><Sparkles size={20}/></span><span>AI SOFT STUDIO<small>WHATSAPP AUTOMATION</small></span></Link>
      <div className="automation-top-actions"><span className="automation-secure"><ShieldCheck size={15}/> Workspace secure</span><Link className="automation-back" href="/dashboard"><ArrowLeft size={15}/> Dashboard</Link></div>
    </header>
    <section className="automation-hero">
      <div className="automation-hero-copy"><span className="automation-kicker"><span className="automation-live-dot"/> AI AUTOMATION STUDIO</span><h1>Your AI assistant.<br/><span>Always ready to help.</span></h1><p>Set your assistant’s personality, teach it your business rules, and choose when it can respond to incoming WhatsApp messages.</p>
        <div className="automation-hero-tags"><span><Zap size={14}/> Instant replies</span><span><ShieldCheck size={14}/> Business-safe prompts</span><span><MessageCircle size={14}/> WhatsApp ready</span></div>
      </div>
      <div className="automation-preview"><div className="automation-preview-head"><span className="automation-bot-icon"><Bot size={21}/></span><div><strong>AI Assistant</strong><small>Message preview</small></div><span className="automation-online"><i/> Assistant</span></div><div className="automation-chat-label">EXAMPLE CONVERSATION</div><div className="automation-bubble user-bubble">Hi! Can you help me?</div><div className="automation-bubble bot-bubble"><span className="automation-mini-avatar"><Sparkles size={13}/></span><span>Hello! 👋 I’m here to help. What would you like to know?</span></div><div className="automation-preview-foot"><ShieldCheck size={14}/> Replies follow your saved business instructions</div></div>
    </section>
    <section className="automation-section-head"><div><span className="automation-kicker">WORKSPACE CONFIGURATION</span><h2>Assistant settings</h2><p>Workspace: <strong>{organization?.name ?? "Your workspace"}</strong></p></div><Link className="automation-text-link" href="/dashboard/conversations">Open customer inbox <ArrowRight size={15}/></Link></section>
    <div className="automation-layout">
      <section className="automation-settings-card"><div className="automation-card-heading"><span className="automation-card-icon"><Bot size={22}/></span><div><h3>Configure your assistant</h3><p>Changes apply to new incoming conversations.</p></div></div><AutomationSettingsForm organizationId={membership.organization_id}/></section>
      <aside className="automation-side">
        <section className="automation-status-card"><div className="automation-side-heading"><span className="automation-side-icon"><Activity size={18}/></span><div><h3>Launch readiness</h3><p>Things to verify before going live</p></div></div><div className="automation-check"><span><CheckCircle2 size={17}/></span><div><strong>Workspace selected</strong><small>{organization?.name ?? "Workspace"} is selected for these settings.</small></div></div><div className="automation-check"><span><CircleHelp size={17}/></span><div><strong>WhatsApp webhook</strong><small>Subscribe your Meta app to incoming messages and delivery events.</small><Link href="/dashboard/whatsapp">Review WhatsApp setup <ArrowRight size={13}/></Link></div></div><div className="automation-check"><span><CircleHelp size={17}/></span><div><strong>AI provider key</strong><small>Set OPENAI_API_KEY as a server-only Render environment variable.</small><Link href="https://dashboard.render.com/web/srv-dbeui8rncjis73fgjhpg">Open Render settings <ArrowRight size={13}/></Link></div></div></section>
        <section className="automation-tip-card"><span className="automation-tip-icon"><BookOpen size={19}/></span><h3>Make replies reliable</h3><p>Describe your actual services, approved prices, support hours and when a person should take over. Never add secrets or ask the AI to invent promises.</p><div className="automation-tip-foot"><ShieldCheck size={15}/> You stay in control of the instructions</div></section>
      </aside>
    </div>
    <footer className="automation-footer"><span>© {new Date().getFullYear()} AI SOFT STUDIO</span><span>AI replies can make mistakes. Test with your own number first.</span><Link href="/dashboard">Back to dashboard</Link></footer>
  </main>;
}
