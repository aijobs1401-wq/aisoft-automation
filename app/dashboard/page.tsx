"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, ArrowUpRight, Bot, CheckCircle2, Code2, ChevronDown, CircleHelp, ContactRound, CreditCard, Instagram, LayoutDashboard, Megaphone, MessageCircle, MessagesSquare, Plus, Settings, ShieldCheck, Sparkles, Users, Wallet, Webhook, Zap, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "./sign-out-button";
import "./interakt-dashboard.css";

type Organization = { id: string; name: string; status: string; slug: string };
type Membership = { role: string; organizations: Organization | Organization[] | null };
type Connection = { id: string; organization_id: string; display_phone_number: string | null; verified_name: string | null; connection_status: string; onboarding_mode: string };

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [orgs, setOrgs] = useState<Membership[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [campaignCount, setCampaignCount] = useState<number | null>(null);
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          window.location.href = "/login?message=Please%20sign%20in%20to%20continue";
          return;
        }
        const { data: membershipRows, error: membershipError } = await supabase.from("organization_members")
          .select("role, organizations(id,name,status,slug)").eq("user_id", user.id);
        if (membershipError) throw membershipError;
        const memberships = (membershipRows ?? []) as unknown as Membership[];
        const orgValue = memberships[0]?.organizations;
        const org = Array.isArray(orgValue) ? orgValue[0] : orgValue;
        if (!active) return;
        setEmail(user.email ?? "");
        setOrgs(memberships);
        if (!org?.id) return;

        const [conn, contacts, campaigns, messages] = await Promise.all([
          supabase.from("whatsapp_connections").select("id,organization_id,display_phone_number,verified_name,connection_status,onboarding_mode").eq("organization_id", org.id).order("created_at", { ascending: false }),
          supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          supabase.from("whatsapp_campaigns").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          supabase.from("messages").select("id", { count: "exact", head: true }).eq("organization_id", org.id)
        ]);
        if (!active) return;
        if (conn.error) setLoadError("WhatsApp status could not be loaded. Open WhatsApp setup to check the connection.");
        else setConnections((conn.data ?? []) as Connection[]);
        setContactCount(contacts.error ? null : contacts.count ?? 0);
        setCampaignCount(campaigns.error ? null : campaigns.count ?? 0);
        setMessageCount(messages.error ? null : messages.count ?? 0);
      } catch {
        if (active) setLoadError("We couldn't load all workspace details. Refresh the page or open WhatsApp setup.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDashboard();
    return () => { active = false; };
  }, []);

  const orgValue = orgs[0]?.organizations;
  const organization = Array.isArray(orgValue) ? orgValue[0] : orgValue;
  const activeConnection = useMemo(() => connections.find(c => c.connection_status === "connected") ?? connections[0] ?? null, [connections]);
  const connected = activeConnection?.connection_status === "connected";
  const setupDone = Boolean(orgs.length && organization?.status === "active");
  const baseName = email.split("@")[0]?.replace(/[._-]+/g, " ") || "there";
  const greetingName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  return <main className="ifx-shell">
    <aside className="ifx-sidebar">
      <Link className="ifx-brand" href="/" aria-label="AI SOFT STUDIO home"><span className="ifx-brand-mark"><Sparkles size={21}/></span><span><strong>AI SOFT STUDIO</strong><small>WHATSAPP AUTOMATION</small></span></Link>
      <div className="ifx-nav-label">WORKSPACE</div>
      <nav className="ifx-nav" aria-label="Main navigation">
        <Link className="ifx-nav-link is-active" href="/dashboard"><LayoutDashboard size={18}/> Home</Link>
        <Link className="ifx-nav-link" href="/dashboard/conversations"><MessagesSquare size={18}/> Inbox</Link>
        <Link className="ifx-nav-link" href="/dashboard/campaigns"><Megaphone size={18}/> Campaigns</Link>
        <Link className="ifx-nav-link" href="/dashboard/whatsapp"><ContactRound size={18}/> Contacts & numbers</Link>
        <Link className="ifx-nav-link" href="/dashboard/automation"><Bot size={18}/> Automation</Link>
        <Link className="ifx-nav-link" href="/dashboard/integrations"><Webhook size={18}/> Integrations</Link>
        <Link className="ifx-nav-link" href="/dashboard/api"><Code2 size={18}/> API & Webhooks</Link>
      </nav>
      <div className="ifx-nav-label ifx-nav-label-spaced">MANAGE</div>
      <nav className="ifx-nav" aria-label="Management navigation">
        <Link className="ifx-nav-link" href="/dashboard/automation"><Zap size={18}/> AI Agent & FAQ</Link>
        <Link className="ifx-nav-link" href="/dashboard/whatsapp"><Instagram size={18}/> Channels</Link>
        <Link className="ifx-nav-link" href="/dashboard/api"><Settings size={18}/> Settings</Link>
      </nav>
      <div className="ifx-sidebar-help"><span className="ifx-help-icon"><CircleHelp size={18}/></span><strong>Need a hand?</strong><p>Get help connecting your business number and setting up automations.</p><Link href="/dashboard/whatsapp">Open setup guide <ArrowUpRight size={14}/></Link></div>
      <div className="ifx-account"><span className="ifx-avatar">{email ? email.slice(0,1).toUpperCase() : "A"}</span><span className="ifx-account-copy"><strong>{email || "Loading account…"}</strong><small>{organization?.name ?? "Workspace account"}</small></span><SignOutButton/></div>
    </aside>

    <section className="ifx-main">
      <header className="ifx-topbar"><div className="ifx-breadcrumb">Workspace <span>/</span> <strong>Home</strong></div><div className="ifx-top-actions"><span className="ifx-secure"><ShieldCheck size={15}/> Secure workspace</span><Link className="ifx-icon-button" href="/dashboard/whatsapp" aria-label="Notifications"><Bell size={18}/><i/></Link><Link className="ifx-profile" href="/dashboard/api" aria-label="Account settings">{email ? email.slice(0,1).toUpperCase() : "A"}<ChevronDown size={13}/></Link></div></header>

      <div className="ifx-content">
        <section className="ifx-welcome"><div><div className="ifx-eyebrow">YOUR BUSINESS CONTROL CENTER</div><h1>Welcome, {greetingName}!</h1><p>Manage customer conversations, connect channels, and automate your support from one place.</p></div><Link className="ifx-primary-button" href="/dashboard/whatsapp"><Plus size={17}/> Connect WhatsApp</Link></section>
        {loadError ? <div className="ifx-alert" role="status">{loadError}</div> : null}

        <section className="ifx-channel-switch" aria-label="Available channels"><Link href="/dashboard/whatsapp" className="ifx-channel is-selected"><MessageCircle size={18}/> WhatsApp <span className={connected ? "ifx-dot is-green" : "ifx-dot"}/></Link><Link href="/dashboard/integrations" className="ifx-channel"><Instagram size={18}/> Integrations <span className="ifx-coming">Manage</span></Link><span className="ifx-channel-note"><ShieldCheck size={15}/> Official Meta connection</span></section>

        <section className="ifx-agent-banner"><div className="ifx-agent-icon"><Bot size={25}/></div><div className="ifx-agent-copy"><strong>Build your AI Agent</strong><p>Handle common questions, qualify leads, and assist customers automatically.</p></div><Link href="/dashboard/automation" className="ifx-dark-button">Configure agent <ArrowRight size={16}/></Link></section>

        <section className="ifx-section-heading"><div><h2>Workspace overview</h2><p>Your WhatsApp tools and performance at a glance.</p></div><span className={"ifx-status-pill " + (connected ? "is-connected" : "is-pending")}><i/>{loading ? "Checking connection…" : connected ? "WhatsApp connected" : "Connection needed"}</span></section>
        <section className="ifx-quick-grid">
          <article className="ifx-tool-card"><div className="ifx-tool-heading"><span className="ifx-tool-icon whatsapp"><MessageCircle size={21}/></span><span className={"ifx-mini-status " + (connected ? "is-connected" : "is-pending")}>{connected ? "Connected" : "Not connected"}</span></div><h3>{connected ? (activeConnection?.verified_name || "WhatsApp Business") : "Connect number"}</h3><p>{connected ? (activeConnection?.display_phone_number || "Your WhatsApp number is linked to this workspace.") : "Connect a WhatsApp Business number through Meta Embedded Signup."}</p><Link className="ifx-card-action" href="/dashboard/whatsapp">{connected ? "Manage connection" : "Connect number"} <ArrowUpRight size={15}/></Link></article>
          <article className="ifx-tool-card"><div className="ifx-tool-heading"><span className="ifx-tool-icon greeting"><Sparkles size={20}/></span><span className="ifx-mini-status is-neutral">Automation</span></div><h3>Greeting & FAQ flows</h3><p>Configure welcome messages and frequently asked question replies.</p><Link className="ifx-card-action" href="/dashboard/automation">Edit automation <ArrowUpRight size={15}/></Link></article>
          <article className="ifx-tool-card"><div className="ifx-tool-heading"><span className="ifx-tool-icon inbox"><MessagesSquare size={20}/></span><span className="ifx-mini-status is-neutral">Inbox</span></div><h3>Customer conversations</h3><p>Review messages and follow up with customers from one place.</p><Link className="ifx-card-action" href="/dashboard/conversations">Open inbox <ArrowUpRight size={15}/></Link></article>
          <article className="ifx-tool-card"><div className="ifx-tool-heading"><span className="ifx-tool-icon contacts"><Users size={20}/></span><span className="ifx-mini-status is-neutral">Contacts</span></div><h3>Manage contacts</h3><p>Contacts saved in this workspace: <strong>{loading ? "…" : contactCount === null ? "—" : contactCount}</strong></p><Link className="ifx-card-action" href="/dashboard/conversations">View inbox contacts <ArrowUpRight size={15}/></Link></article>
          <article className="ifx-tool-card"><div className="ifx-tool-heading"><span className="ifx-tool-icon campaigns"><Megaphone size={20}/></span><span className="ifx-mini-status is-neutral">Campaigns</span></div><h3>Campaign manager</h3><p>Campaigns created: <strong>{loading ? "…" : campaignCount === null ? "—" : campaignCount}</strong></p><Link className="ifx-card-action" href="/dashboard/campaigns">Manage campaigns <ArrowUpRight size={15}/></Link></article>
          <article className="ifx-tool-card"><div className="ifx-tool-heading"><span className="ifx-tool-icon activity"><Activity size={20}/></span><span className="ifx-mini-status is-neutral">Messaging</span></div><h3>Message activity</h3><p>Messages recorded: <strong>{loading ? "…" : messageCount === null ? "—" : messageCount}</strong></p><Link className="ifx-card-action" href="/dashboard/conversations">View activity <ArrowUpRight size={15}/></Link></article>
        </section>

        <section className="ifx-bottom-grid">
          <article className="ifx-panel"><div className="ifx-panel-heading"><div><h2>Connection checklist</h2><p>Complete these steps before going live.</p></div><ShieldCheck size={20}/></div>
            <div className="ifx-check-row"><span className={orgs.length ? "ifx-check is-done" : "ifx-check"}>{orgs.length ? <CheckCircle2 size={17}/> : "1"}</span><div><strong>Workspace membership</strong><small>{orgs.length ? "Your account belongs to a workspace." : "No workspace membership was found."}</small></div><span className="ifx-step-state">{orgs.length ? "Ready" : "Action needed"}</span></div>
            <div className="ifx-check-row"><span className={connected ? "ifx-check is-done" : "ifx-check"}>{connected ? <CheckCircle2 size={17}/> : "2"}</span><div><strong>Connect a WhatsApp number</strong><small>{connected ? (activeConnection?.display_phone_number || "WhatsApp is linked.") : "Use the official Meta onboarding flow."}</small></div><Link href="/dashboard/whatsapp" className="ifx-step-link">{connected ? "Manage" : "Connect"} <ArrowRight size={14}/></Link></div>
            <div className="ifx-check-row"><span className="ifx-check">3</span><div><strong>Test messages and webhooks</strong><small>Confirm inbound messages and delivery updates.</small></div><Link href="/dashboard/api" className="ifx-step-link">Review <ArrowRight size={14}/></Link></div>
          </article>
          <article className="ifx-panel ifx-usage-panel"><div className="ifx-panel-heading"><div><h2>Workspace summary</h2><p>Current account information.</p></div><Wallet size={20}/></div>
            <div className="ifx-summary-row"><span><Users size={16}/> Workspace</span><strong>{loading ? "Loading…" : organization?.name ?? "Not configured"}</strong></div>
            <div className="ifx-summary-row"><span><ShieldCheck size={16}/> Workspace status</span><strong>{loading ? "Checking…" : setupDone ? "Active" : "Setup required"}</strong></div>
            <div className="ifx-summary-row"><span><CreditCard size={16}/> Number setup</span><strong>{activeConnection?.onboarding_mode === "coexistence" ? "App + Cloud API" : activeConnection?.onboarding_mode === "api_only" ? "Cloud API" : "Not connected"}</strong></div>
            <Link className="ifx-summary-button" href="/dashboard/whatsapp">Manage WhatsApp setup <ArrowRight size={15}/></Link>
          </article>
        </section>
        <footer className="ifx-footer"><span>© {new Date().getFullYear()} AI SOFT STUDIO</span><span><ShieldCheck size={13}/> Workspace-scoped business data.</span><Link href="/dashboard/integrations">All integrations <ArrowUpRight size={13}/></Link></footer>
      </div>
    </section>
  </main>;
}
