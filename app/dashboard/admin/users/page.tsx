import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ShieldCheck, Users, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20continue");
  const allowedEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!allowedEmails.length) return <main className="dashboard-wrap"><header className="dash-nav"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><Link href="/dashboard">Back to dashboard</Link></header><section className="dash-tile org-panel"><h1>Admin access not configured</h1><p>Add your account email to the server-only PLATFORM_ADMIN_EMAILS environment variable in Render. Multiple emails can be comma-separated.</p></section></main>;
  if (!user.email || !allowedEmails.includes(user.email.toLowerCase())) {
    return <main className="dashboard-wrap"><header className="dash-nav"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><Link href="/dashboard">Back to dashboard</Link></header><section className="dash-tile org-panel"><h1>Access denied</h1><p>This account is not on the platform admin allowlist.</p></section></main>;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main className="dashboard-wrap"><Link href="/dashboard">← Back to dashboard</Link><h1>Admin setup incomplete</h1><p>SUPABASE_SERVICE_ROLE_KEY is missing on the server.</p></main>;
  const admin = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = data?.users ?? [];
  return (
    <main className="dashboard-wrap">
      <header className="dash-nav"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><div className="dash-user"><Link href="/dashboard">Back to dashboard</Link></div></header>
      <section className="dash-welcome"><span className="eyebrow">PLATFORM ADMIN</span><h1>Customer registrations</h1><p className="sub">Registered accounts from Supabase Auth. This page is restricted to allowlisted admin emails.</p></section>
      <section className="dash-grid">
        <article className="dash-tile"><span className="eyebrow">TOTAL LOADED</span><h2><Users size={20} /> {users.length}</h2><p className="sub">Up to 1,000 most recently registered accounts.</p></article>
        <article className="dash-tile"><span className="eyebrow">CONFIRMED</span><h2>{users.filter(item => Boolean(item.email_confirmed_at)).length}</h2><p className="sub">Accounts with confirmed email addresses.</p></article>
        <article className="dash-tile"><span className="eyebrow">PENDING CONFIRMATION</span><h2>{users.filter(item => !item.email_confirmed_at).length}</h2><p className="sub">Accounts still waiting for email confirmation.</p></article>
      </section>
      <section className="dash-tile org-panel">
        <h2><ShieldCheck size={19} /> Registered users</h2>
        {error ? <p className="form-error">Could not load registered users. Check the server service-role key.</p> : !users.length ? <p className="sub">No registered users found yet.</p> : <div className="campaign-table-wrap"><table className="campaign-table"><thead><tr><th>Name / business</th><th>Email</th><th>Registered</th><th>Email status</th><th>Last sign-in</th></tr></thead><tbody>{users.map(item => {
          const metadata = item.user_metadata ?? {};
          return <tr key={item.id}><td><strong>{String(metadata.display_name ?? "—")}</strong><small>{String(metadata.organization_name ?? "No business name")}</small></td><td>{item.email ?? "—"}</td><td>{item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "—"}</td><td><span className={"campaign-status " + (item.email_confirmed_at ? "status-completed" : "status-processing")}>{item.email_confirmed_at ? "Confirmed" : "Pending"}</span></td><td>{item.last_sign_in_at ? new Date(item.last_sign_in_at).toLocaleString("en-IN") : "Never"}</td></tr>;
        })}</tbody></table></div>}
      </section>
      <p className="auth-foot"><Link href="/dashboard"><ArrowUpRight size={14} /> Return to workspace</Link></p>
    </main>
  );
}
