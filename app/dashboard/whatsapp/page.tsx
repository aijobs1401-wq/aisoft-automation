import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WhatsAppConnectButton from "./connect-button";

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
        <span className="eyebrow">OFFICIAL META ONBOARDING</span>
        <h1>Connect WhatsApp Business</h1>
        <p className="sub">Connect your own WhatsApp Business Account to this workspace using Meta's official Embedded Signup flow.</p>
      </section>
      <section className="dash-tile org-panel">
        <h2>Workspace</h2>
        {error || !membership ? (
          <p className="form-error">No workspace membership was found. Finish workspace setup first, then return here.</p>
        ) : (
          <>
            <p><strong>{organization?.name ?? "Your workspace"}</strong></p>
            <p className="sub">Role: {membership.role} · Status: {organization?.status ?? "pending"}</p>
            <WhatsAppConnectButton organizationId={membership.organization_id} appId={appId} configId={configId} graphVersion={graphVersion} />
          </>
        )}
      </section>
      <section className="dash-tile org-panel">
        <h2>Before connecting</h2>
        <ul>
          <li>Your Meta app must have an Embedded Signup v4 configuration.</li>
          <li>For Coexistence, Meta must show the option and confirm the existing WhatsApp Business App number is eligible.</li>
          <li>App secret, service-role key, and token-encryption key stay on the server and are never sent to the browser.</li>
        </ul>
      </section>
    </main>
  );
}
