"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "./sign-out-button";
import {
  ArrowUpRight, Bot, CheckCircle2, ChevronRight, CircleHelp, Command, Send,
  MessageCircle, Plus, Settings2, ShieldCheck, Sparkles, Users, Webhook, Zap
} from "lucide-react";

type Membership = { role: string; organizations: { name: string; status: string; slug: string } | null };

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [orgs, setOrgs] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = "/login?message=Please%20sign%20in%20to%20continue";
          return;
        }
        const { data } = await supabase.from("organization_members")
          .select("role, organizations(name,status,slug)").eq("user_id", user.id);
        if (active) {
          setEmail(user.email ?? "");
          setOrgs((data ?? []) as unknown as Membership[]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadWorkspace();
    return () => { active = false; };
  }, []);

  const workspaceName = orgs[0]?.organizations?.name ?? "Your workspace";
  const setupDone = Boolean(orgs.length && orgs[0]?.organizations?.status === "active");

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <Link className="app-brand" href="/" aria-label="AI SOFT STUDIO home">
          <span className="app-brand-mark"><Sparkles size={20} /></span>
          <span><strong>AI SOFT STUDIO</strong><small>MESSAGING PLATFORM</small></span>
        </Link>
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="app-side-nav" aria-label="Workspace navigation">
          <Link className="app-side-link active" href="/dashboard"><Command size={17} /> Overview</Link>
          <Link className="app-side-link" href="/dashboard/whatsapp"><MessageCircle size={17} /> WhatsApp setup <ArrowUpRight size={14} /></Link>
          <Link className="app-side-link" href="/dashboard/conversations"><Users size={17} /> Conversations</Link>\n          <Link className="app-side-link" href="/dashboard/campaigns"><Send size={17} /> Bulk campaigns <ArrowUpRight size={14} /></Link>
          <Link className="app-side-link" href="/dashboard/automation"><Bot size={17} /> AI replies & chatbot <ArrowUpRight size={14} /></Link>
          <Link className="app-side-link" href="/dashboard/api"><Webhook size={17} /> API & Webhooks <ArrowUpRight size={14} /></Link>
          <Link className="app-side-link" href="/dashboard/admin"><ShieldCheck size={17} /> Admin panel <ArrowUpRight size={14} /></Link>
          <a className="app-side-link muted-link" href="#automation"><Zap size={17} /> Automations <span className="coming-pill">SOON</span></a>
          <a className="app-side-link muted-link" href="#analytics"><Settings2 size={17} /> Analytics <span className="coming-pill">SOON</span></a>
        </nav>
        <div className="sidebar-help">
          <span className="help-icon"><CircleHelp size={17} /></span>
          <strong>Need a hand?</strong>
          <p>Get your workspace ready for WhatsApp messaging.</p>
          <Link href="/dashboard/whatsapp">View setup guide <ArrowUpRight size={13} /></Link>
        </div>
        <div className="sidebar-account">
          <span className="account-avatar">{email ? email.slice(0, 1).toUpperCase() : "A"}</span>
          <span className="account-copy"><strong>{email || "Loading account…"}</strong><small>Workspace account</small></span>
          <SignOutButton />
        </div>
      </aside>

      <section className="app-main">
        <header className="app-topbar">
          <div className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>Overview</strong></div>
          <div className="topbar-right"><span className="secure-label"><ShieldCheck size={15} /> Secure workspace</span><span className="topbar-avatar">{email ? email.slice(0, 1).toUpperCase() : "A"}</span></div>
        </header>

        <div className="app-content">
          <section className="dashboard-greeting">
            <div>
              <span className="dashboard-eyebrow"><span className="eyebrow-spark">✦</span> YOUR CONTROL CENTER</span>
              <h1>Make every conversation <span>count.</span></h1>
              <p>Welcome back. Get your WhatsApp workspace connected and ready to serve customers.</p>
            </div>
            <div className="greeting-orb" aria-hidden="true"><div className="orb-ring ring-one" /><div className="orb-ring ring-two" /><div className="orb-core"><MessageCircle size={31} /></div><span className="orb-spark spark-a">✦</span><span className="orb-spark spark-b">✧</span></div>
          </section>

          <section className="workspace-banner">
            <div className="workspace-symbol"><Command size={22} /></div>
            <div className="workspace-details"><span>ACTIVE WORKSPACE</span><strong>{loading ? "Loading workspace…" : workspaceName}</strong><small>{email || "Your business messaging space"}</small></div>
            <span className={"workspace-status " + (setupDone ? "status-ready" : "status-pending")}><span />{setupDone ? "Workspace active" : "Setup in progress"}</span>
          </section>

          <div className="section-title-row"><div><h2>Workspace overview</h2><p>Your essential tools, all in one place.</p></div><Link className="subtle-link" href="/dashboard/whatsapp">Manage setup <ArrowUpRight size={15} /></Link></div>
          <section className="workspace-cards">
            <article className="workspace-card whatsapp-card">
              <div className="workspace-card-top"><span className="workspace-card-icon blue-icon"><MessageCircle size={20} /></span><span className="card-status"><span /> ACTION NEEDED</span></div>
              <h3>Connect WhatsApp</h3><p>Connect an eligible WhatsApp Business account through Meta's official onboarding flow.</p>
              <Link className="card-action primary-action" href="/dashboard/whatsapp">Set up connection <ArrowUpRight size={16} /></Link>
            </article>
            <article className="workspace-card">
              <div className="workspace-card-top"><span className="workspace-card-icon cyan-icon"><Users size={20} /></span><span className="card-status neutral-status">READY FOR SETUP</span></div>
              <h3>Conversation inbox</h3><p>Prepare a central place for customer conversations once your account and webhooks are configured.</p>
              <Link className="card-action" href="/dashboard/conversations">Open inbox <ArrowUpRight size={16} /></Link>
            </article>
            <article className="workspace-card" id="automation">
              <div className="workspace-card-top"><span className="workspace-card-icon purple-icon"><Bot size={20} /></span><span className="card-status neutral-status">COMING NEXT</span></div>
              <h3>Smart automations</h3><p>Build repeatable workflows and assisted replies after messaging is connected and tested.</p>
              <span className="card-action disabled-action">Not available yet <ShieldCheck size={15} /></span>
            </article>
          </section>

          <section className="setup-panel">
            <div className="setup-panel-head"><div><span className="dashboard-eyebrow">YOUR NEXT STEPS</span><h2>Let's get you up and running.</h2><p>A quick checklist to help you prepare your messaging workspace.</p></div><div className="checklist-badge"><CheckCircle2 size={18} /><span>Setup checklist</span></div></div>
            <div className="setup-checklist">
              <div className="checklist-item"><span className="step-number">01</span><span className="checklist-icon"><Users size={17} /></span><div><strong>Create your workspace</strong><small>{orgs.length ? "Your workspace membership is available." : "Workspace membership may need to be completed."}</small></div><span className={orgs.length ? "step-state complete-state" : "step-state"}>{orgs.length ? "Found" : "Check"}</span></div>
              <div className="checklist-item"><span className="step-number">02</span><span className="checklist-icon"><MessageCircle size={17} /></span><div><strong>Connect a WhatsApp Business account</strong><small>Continue through the supported Meta onboarding flow.</small></div><Link className="step-link" href="/dashboard/whatsapp">Start <ChevronRight size={15} /></Link></div>
              <div className="checklist-item"><span className="step-number">03</span><span className="checklist-icon"><Zap size={17} /></span><div><strong>Test your messaging setup</strong><small>Verify permissions, templates and webhook delivery before launch.</small></div><span className="step-state">After connection</span></div>
            </div>
          </section>

          <footer className="app-footer"><span>© {new Date().getFullYear()} AI SOFT STUDIO</span><span><ShieldCheck size={13} /> Built for clearer, more controlled messaging operations.</span><Link href="/">Visit website <ArrowUpRight size={13} /></Link></footer>
        </div>
      </section>
    </main>
  );
}
