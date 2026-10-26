import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bot, Code2, MessageCircle, MessagesSquare, Send, ShieldCheck, Webhook,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import WhatsAppConnectButton from "./connect-button";

const tools = [
  {
    href: "/dashboard/conversations",
    title: "Incoming messages",
    description: "Open your customer inbox and review conversations saved by the platform.",
    Icon: MessagesSquare,
  },
  {
    href: "/dashboard/campaigns",
    title: "Send messages",
    description: "Open the campaign area to prepare outbound messaging workflows.",
    Icon: Send,
  },
  {
    href: "/dashboard/automation",
    title: "AI auto-reply",
    description: "Configure your assistant and choose whether automatic replies are enabled.",
    Icon: Bot,
  },
  {
    href: "/dashboard/api",
    title: "Webhooks & API",
    description: "Create a workspace API key and configure inbound event delivery.",
    Icon: Webhook,
  },
];

export default async function WhatsAppSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20connect%20WhatsApp");

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id,role,organizations(name,status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const membership = memberships?.[0];
  const organization = membership?.organizations as { name?: string; status?: string } | null;
  const appId = process.env.META_APP_ID ?? "";
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ?? "";
  const graphVersion = process.env.META_GRAPH_API_VERSION ?? "v23.0";

  return (
    <main className="dashboard-wrap">
      <header className="dash-nav">
        <Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link>
        <div className="dash-user"><Link href="/dashboard">Back to dashboard</Link></div>
      </header>

      <section className="dash-welcome">
        <span className="eyebrow">WHATSAPP CONTROL CENTER</span>
        <h1>Connect and manage WhatsApp</h1>
        <p className="sub">Connect through Meta's official WhatsApp Business onboarding, then manage conversations, AI replies, and API integrations from one workspace.</p>
      </section>

      <section className="dash-tile org-panel">
        <h2><MessageCircle size={20} /> WhatsApp connection</h2>
        {error || !membership ? (
          <div>
            <p className="form-error">No workspace membership was found. Create or finish your workspace first, then return here.</p>
            <p><Link className="btn" href="/dashboard/workspace/new">Create workspace</Link></p>
          </div>
        ) : (
          <>
            <p><strong>{organization?.name ?? "Your workspace"}</strong></p>
            <p className="sub">Role: {membership.role} · Workspace status: {organization?.status ?? "pending"}</p>
            <WhatsAppConnectButton organizationId={membership.organization_id} appId={appId} configId={configId} graphVersion={graphVersion} />
          </>
        )}
        <p className="sub" style={{ marginTop: 16 }}>
          <ShieldCheck size={15} /> This setup uses Meta's Cloud API onboarding. It does not use the QR-code device session shown in the supplied legacy HTML.
        </p>
      </section>

      <section className="dash-welcome" style={{ paddingBottom: 8 }}>
        <span className="eyebrow">WORKSPACE TOOLS</span>
        <h2>What would you like to do?</h2>
        <p className="sub">These shortcuts open the existing AI SOFT STUDIO features. Availability depends on your Meta connection and workspace configuration.</p>
      </section>

      <section className="dash-grid">
        {tools.map(({ href, title, description, Icon }) => (
          <article className="dash-tile org-panel" key={href}>
            <h2><Icon size={20} /> {title}</h2>
            <p className="sub">{description}</p>
            <Link className="btn" href={href}>Open {title} →</Link>
          </article>
        ))}
      </section>

      <section className="dash-tile org-panel">
        <h2><Code2 size={20} /> Before connecting</h2>
        <ul>
          <li>Your Meta app must have an Embedded Signup configuration and the required WhatsApp permissions.</li>
          <li>For Coexistence, Meta must display the option and confirm that the existing WhatsApp Business App number is eligible.</li>
          <li>Keep the Meta app secret, Supabase service-role key, and token-encryption key on the server only.</li>
          <li>Test sending and receiving with an authorized test number before enabling automation for customers.</li>
        </ul>
      </section>
    </main>
  );
}
