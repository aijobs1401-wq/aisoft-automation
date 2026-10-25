import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CampaignForm from "./campaign-form";

type Connection = { id: string; display_phone_number: string | null; verified_name: string | null; connection_status: string };
type Campaign = { id: string; name: string; template_name: string; status: string; recipient_count: number; sent_count: number; failed_count: number; created_at: string };

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20continue");

  const { data: memberships } = await supabase.from("organization_members")
    .select("organization_id,organizations(name)").eq("user_id", user.id)
    .order("created_at", { ascending: true }).limit(1);
  const membership = memberships?.[0];
  if (!membership) return <main className="dashboard-wrap"><Link href="/dashboard">← Back to dashboard</Link><h1>Workspace required</h1><p className="sub">Finish workspace setup before launching campaigns.</p></main>;

  const organizationId = membership.organization_id;
  const { data: connections } = await supabase.from("whatsapp_connections")
    .select("id,display_phone_number,verified_name,connection_status")
    .eq("organization_id", organizationId).eq("connection_status", "connected");
  const { data: campaigns } = await supabase.from("whatsapp_campaigns")
    .select("id,name,template_name,status,recipient_count,sent_count,failed_count,created_at")
    .eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(10);
  const organization = membership.organizations as { name?: string } | null;

  return (
    <main className="dashboard-wrap">
      <header className="dash-nav">
        <Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link>
        <div className="dash-user"><Link href="/dashboard">Back to dashboard</Link></div>
      </header>
      <section className="dash-welcome">
        <span className="eyebrow">CAMPAIGN STUDIO · ORANGE EDITION</span>
        <h1>WhatsApp campaigns</h1>
        <p className="sub">Send approved WhatsApp template messages to opted-in customers and review campaign results.</p>
      </section>
      <CampaignForm organizationId={organizationId} organizationName={organization?.name ?? "Your workspace"} connections={(connections ?? []) as Connection[]} />
      <section className="campaign-history">
        <div className="section-title-row"><div><h2>Recent campaigns</h2><p>Your latest campaign attempts and send counts.</p></div></div>
        {!campaigns?.length ? <div className="dash-tile"><h2>No campaigns yet</h2><p className="sub">Your campaign history will appear here after your first send.</p></div> : (
          <div className="campaign-table-wrap"><table className="campaign-table"><thead><tr><th>Campaign</th><th>Template</th><th>Recipients</th><th>Sent</th><th>Failed</th><th>Status</th></tr></thead><tbody>
            {(campaigns as Campaign[]).map((campaign) => <tr key={campaign.id}><td><strong>{campaign.name}</strong><small>{new Date(campaign.created_at).toLocaleString()}</small></td><td><code>{campaign.template_name}</code></td><td>{campaign.recipient_count}</td><td>{campaign.sent_count}</td><td>{campaign.failed_count}</td><td><span className={"campaign-status status-" + campaign.status}>{campaign.status}</span></td></tr>)}
          </tbody></table></div>
        )}
      </section>
      <p className="campaign-disclaimer">WhatsApp delivery is controlled by Meta. Use only approved templates, message people who explicitly opted in, honour opt-outs, and comply with WhatsApp Business Messaging Policy. Campaign sending is limited to 25 recipients per run in this initial version.</p>
    </main>
  );
}
