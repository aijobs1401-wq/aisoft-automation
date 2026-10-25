import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  ShieldCheck, Users, Building2, Bot, MessageCircle, Send, Settings,
  ArrowUpRight, UserCheck, Clock3, LayoutDashboard
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20continue");

  const allowedEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);

  const shell = "min-h-screen bg-[#090b0f] text-white px-5 py-8 md:px-10";
  if (!allowedEmails.length) {
    return <main className={shell}><div className="mx-auto max-w-4xl"><Link href="/dashboard" className="text-orange-300">← Dashboard</Link><section className="mt-8 rounded-3xl border border-orange-400/30 bg-[#15171c] p-8"><ShieldCheck className="mb-4 text-orange-300" size={32}/><h1 className="text-3xl font-bold">Admin access not configured</h1><p className="mt-3 text-gray-300">Render service ke Environment mein <code>PLATFORM_ADMIN_EMAILS</code> set karein. Ismein sirf aapka admin login email ho; multiple emails comma-separated ho sakte hain.</p></section></div></main>;
  }
  if (!user.email || !allowedEmails.includes(user.email.toLowerCase())) {
    return <main className={shell}><div className="mx-auto max-w-4xl"><Link href="/dashboard" className="text-orange-300">← Dashboard</Link><section className="mt-8 rounded-3xl border border-red-400/30 bg-[#15171c] p-8"><ShieldCheck className="mb-4 text-red-300" size={32}/><h1 className="text-3xl font-bold">Access denied</h1><p className="mt-3 text-gray-300">Signed-in account platform admin allowlist mein nahi hai.</p></section></div></main>;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return <main className={shell}><div className="mx-auto max-w-4xl"><Link href="/dashboard" className="text-orange-300">← Dashboard</Link><section className="mt-8 rounded-3xl border border-orange-400/30 bg-[#15171c] p-8"><h1 className="text-3xl font-bold">Admin setup incomplete</h1><p className="mt-3 text-gray-300">Render server environment mein SUPABASE_SERVICE_ROLE_KEY missing hai. Is key ko client-side ya NEXT_PUBLIC variable mein na daalein.</p></section></div></main>;
  }

  const admin = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [{ data: userData, error: userError }, { data: orgData, error: orgError }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("organizations").select("id,name,slug,status,created_at").order("created_at", { ascending: false }).limit(100)
  ]);
  const users = userData?.users ?? [];
  const orgs = orgData ?? [];
  const confirmed = users.filter(item => Boolean(item.email_confirmed_at)).length;
  const pending = users.length - confirmed;

  const cards = [
    { label: "Registered users", value: String(users.length), detail: "Latest up to 1,000 accounts", icon: Users },
    { label: "Confirmed emails", value: String(confirmed), detail: "Verified accounts", icon: UserCheck },
    { label: "Pending confirmation", value: String(pending), detail: "Need email verification", icon: Clock3 },
    { label: "Workspaces / clients", value: orgError ? "—" : String(orgs.length), detail: orgError ? "Workspace query unavailable" : "Latest up to 100 workspaces", icon: Building2 }
  ];

  const shortcuts = [
    { title: "User registrations", desc: "Review account emails, signup times and confirmation status.", href: "/dashboard/admin/users", icon: Users },
    { title: "WhatsApp connections", desc: "Open the WhatsApp onboarding and connection setup.", href: "/dashboard/whatsapp", icon: MessageCircle },
    { title: "AI chatbot settings", desc: "Configure AI replies, bot name and instructions for a workspace.", href: "/dashboard/automation", icon: Bot },
    { title: "Bulk messaging", desc: "Open campaign tools and messaging workflows.", href: "/dashboard/campaigns", icon: Send },
    { title: "Customer inbox", desc: "View conversations handled by the platform.", href: "/dashboard/conversations", icon: MessageCircle },
    { title: "Workspace dashboard", desc: "Return to the main application dashboard.", href: "/dashboard", icon: LayoutDashboard }
  ];

  return <main className={shell}>
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <Link href="/" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-orange-300 to-orange-600 font-black text-black">AI</span><span><strong className="block tracking-wide">AI SOFT STUDIO</strong><small className="text-xs text-gray-400">PLATFORM ADMIN</small></span></Link>
        <div className="flex items-center gap-4"><span className="text-sm text-gray-400">{user.email}</span><Link href="/dashboard" className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:border-orange-300">App dashboard ↗</Link></div>
      </header>
      <section className="py-9"><span className="text-xs font-bold tracking-[0.25em] text-orange-300">CONTROL CENTER</span><h1 className="mt-3 text-4xl font-black md:text-5xl">Admin <span className="text-orange-300">Panel</span></h1><p className="mt-3 max-w-2xl text-gray-400">Manage platform registrations and quickly access clients, WhatsApp, AI automation and messaging tools from one place.</p></section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => { const Icon = card.icon; return <article key={card.label} className="rounded-3xl border border-white/10 bg-[#14171c] p-5"><div className="flex items-center justify-between"><span className="text-sm text-gray-400">{card.label}</span><Icon className="text-orange-300" size={21}/></div><strong className="mt-4 block text-4xl font-bold">{card.value}</strong><p className="mt-2 text-xs text-gray-500">{card.detail}</p></article>; })}</section>
      <section className="mt-9"><div className="mb-4 flex items-center gap-2"><Settings className="text-orange-300" size={20}/><h2 className="text-xl font-bold">Admin tools</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shortcuts.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="group rounded-3xl border border-white/10 bg-[#14171c] p-5 transition hover:-translate-y-0.5 hover:border-orange-300/60"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-400/10 text-orange-300"><Icon size={21}/></span><ArrowUpRight size={18} className="text-gray-500 group-hover:text-orange-300"/></div><h3 className="mt-4 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-gray-400">{item.desc}</p></Link>; })}</div></section>
      <section className="mt-9 rounded-3xl border border-white/10 bg-[#14171c] p-5 md:p-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Recent workspaces / clients</h2><p className="mt-1 text-sm text-gray-400">Latest workspace records in the database.</p></div><Link href="/dashboard/admin/users" className="text-sm text-orange-300 hover:underline">View registrations ↗</Link></div>
      {orgError ? <p className="text-sm text-amber-300">Workspace list could not load. Verify the Supabase service-role key and organizations table permissions.</p> : !orgs.length ? <p className="text-sm text-gray-400">No workspaces found yet. Registered accounts will appear above; create a workspace to see it here.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-gray-500"><tr><th className="pb-3 pr-4">Workspace</th><th className="pb-3 pr-4">Slug</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Created</th></tr></thead><tbody>{orgs.map(org => <tr key={org.id} className="border-t border-white/10"><td className="py-4 pr-4 font-semibold">{org.name}</td><td className="py-4 pr-4 text-gray-400">{org.slug}</td><td className="py-4 pr-4"><span className="rounded-full bg-orange-300/10 px-3 py-1 text-orange-200">{org.status ?? "unknown"}</span></td><td className="py-4 text-gray-400">{org.created_at ? new Date(org.created_at).toLocaleString("en-IN") : "—"}</td></tr>)}</tbody></table></div>}
      {userError && <p className="mt-4 text-sm text-red-300">Could not load Auth registrations. Check Supabase service-role configuration.</p>}
      </section>
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-gray-500"><span>© {new Date().getFullYear()} AI SOFT STUDIO · Admin access restricted</span><span><ShieldCheck className="mr-1 inline" size={13}/> Server-side admin verification</span></footer>
    </div>
  </main>;
}
