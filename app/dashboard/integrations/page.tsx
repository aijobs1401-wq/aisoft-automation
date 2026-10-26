import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowUpRight, Bot, CheckCircle2, CircleHelp, Code2, Instagram, Megaphone, MessageCircle, MessagesSquare, PlugZap, ShieldCheck, Users, Webhook, Workflow } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Connection = { id: string; display_phone_number: string | null; verified_name: string | null; connection_status: string; onboarding_mode: string | null };

function IntegrationCard({ title, description, status, href, label, Icon }: {
  title: string; description: string; status: "connected" | "available" | "setup"; href: string; label: string; Icon: typeof MessageCircle;
}) {
  const statusText = status === "connected" ? "Connected" : status === "available" ? "Available in workspace" : "Setup required";
  return <article className="dash-tile" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 205 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 12, background: status === "connected" ? "#e5f8ed" : "#eef3f6", color: status === "connected" ? "#07884f" : "#526b65" }}><Icon size={21}/></span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "6px 9px", fontSize: 11, background: status === "connected" ? "#e7f8ee" : "#f2f5f4", color: status === "connected" ? "#087b4b" : "#63756f" }}><i style={{ width: 6, height: 6, borderRadius: "50%", background: status === "connected" ? "#0aaf67" : "#a0aca7" }}/>{statusText}</span>
    </div>
    <div><h2 style={{ margin: "0 0 7px", fontSize: 16 }}>{title}</h2><p className="sub" style={{ margin: 0, lineHeight: 1.65 }}>{description}</p></div>
    <div style={{ marginTop: "auto" }}><Link className="btn" href={href} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{label}<ArrowUpRight size={15}/></Link></div>
  </article>;
}

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20manage%20integrations");

  const { data: memberships, error: membershipError } = await supabase.from("organization_members")
    .select("organization_id,role,organizations(name)")
    .eq("user_id", user.id).order("created_at", { ascending: true }).limit(1);
  const membership = memberships?.[0];
  const organization = membership?.organizations as { name?: string } | null;
  let connections: Connection[] = [];
  let connectionError = false;
  if (membership) {
    const result = await supabase.from("whatsapp_connections")
      .select("id,display_phone_number,verified_name,connection_status,onboarding_mode")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false });
    connections = (result.data ?? []) as Connection[];
    connectionError = Boolean(result.error);
  }
  const active = connections.find(c => c.connection_status === "connected");
  const metaConfigured = Boolean(process.env.META_APP_ID && process.env.META_EMBEDDED_SIGNUP_CONFIG_ID);
  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const waStatus = active ? "connected" : "setup";
  const instagramStatus = "setup";

  return <main className="dashboard-wrap">
    <header className="dash-nav"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><div className="dash-user"><Link href="/dashboard">Back to dashboard</Link></div></header>
    <section className="dash-welcome"><span className="eyebrow">CHANNELS & CONNECTORS</span><h1>Integrations</h1><p className="sub">Manage the services that power your AI SOFT STUDIO WhatsApp SaaS. Statuses are based on workspace records and server configuration—not demo badges.</p></section>

    {!membership || membershipError ? <section className="dash-tile org-panel"><h2><CircleHelp size={20}/> Workspace setup needed</h2><p className="sub">Create or finish a workspace before connecting channels and configuring integrations.</p><Link className="btn" href="/dashboard/workspace/new">Create workspace</Link></section> : <>
      <section className="dash-tile org-panel" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div><span className="eyebrow">CURRENT WORKSPACE</span><h2 style={{ margin: "8px 0" }}>{organization?.name ?? "Your workspace"}</h2><p className="sub" style={{ margin: 0 }}>Connection inventory and setup shortcuts for this workspace.</p></div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 11px", borderRadius: 9, background: "#f0f7f3", color: "#176346", fontSize: 12 }}><ShieldCheck size={15}/> Workspace-scoped</span>
        </div>
        {connectionError ? <p className="form-error">Could not read WhatsApp connection records. Check the Supabase table permissions and migrations.</p> : null}
        {active ? <p style={{ margin: "15px 0 0", color: "#176346", fontSize: 13 }}><CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }}/>{active.verified_name || "WhatsApp Business"}{active.display_phone_number ? " · " + active.display_phone_number : ""} · {active.onboarding_mode === "coexistence" ? "App + Cloud API" : active.onboarding_mode === "api_only" ? "Cloud API" : "Meta connected"}</p> : <p className="sub" style={{ margin: "14px 0 0" }}>No connected WhatsApp number found yet. Start with Meta Embedded Signup below.</p>}
      </section>

      <div className="dash-grid">
        <IntegrationCard title="WhatsApp Cloud API" description={active ? "A WhatsApp Business number is saved as connected for this workspace." : metaConfigured ? "Meta app settings are present. Connect a number through the official Embedded Signup flow." : "Connect a business number with Meta Embedded Signup. Meta App ID or Configuration ID still needs server configuration if the button is unavailable."} status={waStatus} href="/dashboard/whatsapp" label={active ? "Manage number" : "Connect WhatsApp"} Icon={MessageCircle}/>
        <IntegrationCard title="Instagram Messaging" description="Instagram messaging needs a Meta app configured for Instagram messaging, the right permissions, and an eligible professional Instagram account. This project does not yet store an Instagram connection." status={instagramStatus} href="/dashboard/api" label="Review API setup" Icon={Instagram}/>
        <IntegrationCard title="Webhooks & API keys" description={apiConfigured ? "Server-side Supabase configuration is present. Manage your workspace API key and customer event webhook endpoint." : "Server-side configuration is incomplete. Configure the required server environment variables before using API integrations."} status={apiConfigured ? "available" : "setup"} href="/dashboard/api" label="Open API settings" Icon={Webhook}/>
        <IntegrationCard title="AI Agent & FAQ" description="Configure the assistant instructions and enable or disable automatic replies to new inbound WhatsApp messages." status="available" href="/dashboard/automation" label="Configure AI agent" Icon={Bot}/>
        <IntegrationCard title="Campaigns & templates" description="Create outbound campaigns using approved WhatsApp templates and review sent/failed counts." status="available" href="/dashboard/campaigns" label="Open campaigns" Icon={Megaphone}/>
        <IntegrationCard title="Customer inbox" description="View saved customer conversations and message delivery states after Meta webhook events arrive." status="available" href="/dashboard/conversations" label="Open inbox" Icon={MessagesSquare}/>
        <IntegrationCard title="Delivery events" description="Inspect the API and webhook setup required for your own platform to receive message events." status="available" href="/dashboard/api" label="Configure webhook" Icon={Activity}/>
        <IntegrationCard title="Automation workflows" description="Set up AI reply behavior and review the checklist for connecting a number and testing webhook events." status="available" href="/dashboard/automation" label="Open automation" Icon={Workflow}/>
        <IntegrationCard title="Developer integration" description="Use the workspace API credentials and webhook settings for supported integrations with your own software." status="available" href="/dashboard/api" label="Developer tools" Icon={Code2}/>
      </div>
    </>}
    <section className="dash-tile org-panel" style={{ marginTop: 18 }}>
      <h2><PlugZap size={20}/> What still requires setup?</h2>
      <ul style={{ lineHeight: 1.8, paddingLeft: 20 }}>
        <li><strong>Meta credentials:</strong> add App ID, App Secret, Embedded Signup Configuration ID, webhook verify token, and encryption key to Render server environment variables.</li>
        <li><strong>Meta dashboard:</strong> add the exact production website domain, configure WhatsApp webhook subscriptions, and request the permissions needed for customer onboarding.</li>
        <li><strong>Instagram:</strong> implement a separate OAuth/permission flow and persistence for Instagram professional accounts; it is not connected by the WhatsApp signup.</li>
        <li><strong>Live verification:</strong> test with a real authorized Meta business account and confirm inbound messages, outbound templates, and delivery-status webhooks.</li>
      </ul>
      <p className="sub">Never paste Meta App Secret, access tokens, Supabase service-role keys, or encryption keys into client-side code or public chat.</p>
    </section>
    <p className="auth-foot"><Link href="/dashboard">← Return to dashboard</Link></p>
  </main>;
}
