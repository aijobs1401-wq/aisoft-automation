import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createClientWorkspace, updateWorkspaceStatus, updateWorkspaceBot, addWorkspaceMember } from "./actions";
import { ShieldCheck, Users, Building2, Bot, MessageCircle, Send, KeyRound, Webhook, Activity, UserCheck, Clock3, Search, Settings, ArrowUpRight, LayoutDashboard, PlugZap, CircleAlert, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const panel = "rounded-3xl border border-white/10 bg-[#121720] p-5 md:p-6";
const field = "w-full rounded-xl border border-white/10 bg-[#090e17] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-300";
const action = "rounded-xl bg-orange-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-orange-300";

export default async function PlatformAdminPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20continue");
  const allowedEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  const shell = "min-h-screen bg-[#080b11] px-4 py-6 text-white md:px-8 md:py-8";
  if (!allowedEmails.length) return <main className={shell}><div className="mx-auto max-w-5xl"><Link href="/dashboard" className="text-orange-300">← Dashboard</Link><section className={panel + " mt-8"}><ShieldCheck size={34} className="text-orange-300"/><h1 className="mt-4 text-3xl font-black">Admin access not configured</h1><p className="mt-3 text-gray-300">Render → Environment mein server-only <code>PLATFORM_ADMIN_EMAILS</code> set karein. Value mein <code>admin@aisoft.app</code> hona chahiye agar isi account se login karte hain.</p></section></div></main>;
  if (!user.email || !allowedEmails.includes(user.email.toLowerCase())) return <main className={shell}><div className="mx-auto max-w-5xl"><Link href="/dashboard" className="text-orange-300">← Dashboard</Link><section className={panel + " mt-8"}><ShieldCheck size={34} className="text-red-300"/><h1 className="mt-4 text-3xl font-black">Access denied</h1><p className="mt-3 text-gray-300">Signed-in email allowlist mein nahi hai. Current email: {user.email ?? "unknown"}.</p></section></div></main>;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main className={shell}><div className="mx-auto max-w-5xl"><Link href="/dashboard" className="text-orange-300">← Dashboard</Link><section className={panel + " mt-8"}><CircleAlert size={34} className="text-orange-300"/><h1 className="mt-4 text-3xl font-black">Admin database access missing</h1><p className="mt-3 text-gray-300">Render Environment mein <code>SUPABASE_SERVICE_ROLE_KEY</code> aur <code>NEXT_PUBLIC_SUPABASE_URL</code> set karein. Service role key ko kabhi client-side/NEXT_PUBLIC variable mein na rakhein.</p></section></div></main>;

  const admin = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [usersRes, orgRes, membersRes, connRes, aiRes, campaignRes, convoRes, msgRes, apiRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("organizations").select("id,name,slug,status,created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("organization_members").select("organization_id,user_id,role,created_at").limit(1000),
    admin.from("whatsapp_connections").select("id,organization_id,display_phone_number,verified_name,connection_status,last_webhook_at,created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("whatsapp_ai_settings").select("id,organization_id,enabled,bot_name,updated_at").order("updated_at", { ascending: false }).limit(200),
    admin.from("whatsapp_campaigns").select("id,organization_id,name,status,recipient_count,sent_count,failed_count,created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("conversations").select("id", { count: "exact", head: true }),
    admin.from("messages").select("id", { count: "exact", head: true }),
    admin.from("organization_api_settings").select("organization_id,api_key_prefix,webhook_url,updated_at").limit(200)
  ]);
  const users = usersRes.data?.users ?? [];
  const orgs = orgRes.data ?? [];
  const members = membersRes.data ?? [];
  const connections = connRes.data ?? [];
  const bots = aiRes.data ?? [];
  const campaigns = campaignRes.data ?? [];
  const apiSettings = apiRes.data ?? [];
  const orgNames = new Map(orgs.map(o => [o.id, o.name]));
  const confirmed = users.filter(u => !!u.email_confirmed_at).length;
  const connected = connections.filter(c => c.connection_status === "connected").length;
  const activeBots = bots.filter(b => b.enabled).length;
  const webhookCount = apiSettings.filter(a => !!a.webhook_url).length;
  const stats = [
    { title: "Registered accounts", value: users.length, detail: `${confirmed} email confirmed`, Icon: Users },
    { title: "Client workspaces", value: orgRes.error ? "—" : orgs.length, detail: orgRes.error ? "Database query failed" : `${orgs.filter(o => o.status === "active").length} active workspaces`, Icon: Building2 },
    { title: "WhatsApp connected", value: connRes.error ? "—" : connected, detail: connRes.error ? "Connection query failed" : `${connections.length} connections loaded`, Icon: MessageCircle },
    { title: "AI bots enabled", value: aiRes.error ? "—" : activeBots, detail: aiRes.error ? "AI settings query failed" : `${bots.length} bot configurations`, Icon: Bot },
    { title: "Conversations", value: convoRes.count ?? "—", detail: "All client workspaces", Icon: MessageCircle },
    { title: "Messages", value: msgRes.count ?? "—", detail: "Saved message records", Icon: Send },
    { title: "Workspace members", value: membersRes.error ? "—" : members.length, detail: "Membership assignments", Icon: UserCheck },
    { title: "API / webhooks", value: apiRes.error ? "—" : apiSettings.length, detail: `${webhookCount} webhook endpoints saved`, Icon: Webhook }
  ];

  return <main className={shell}>
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <Link href="/" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-orange-300 to-orange-600 font-black text-black">AI</span><span><strong className="block tracking-wide">AI SOFT STUDIO</strong><small className="text-xs tracking-[.18em] text-gray-400">MASTER CONTROL PANEL</small></span></Link>
        <div className="flex flex-wrap items-center gap-3"><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">Admin authenticated</span><span className="text-sm text-gray-400">{user.email}</span><Link href="/dashboard" className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:border-orange-300">App dashboard ↗</Link></div>
      </header>

      <section className="py-8 md:py-10"><div className="flex flex-wrap items-end justify-between gap-5"><div><span className="text-xs font-bold tracking-[.25em] text-orange-300">PLATFORM OPERATIONS</span><h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Master <span className="text-orange-300">Admin</span></h1><p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">Clients, accounts, workspace access, WhatsApp connections, AI bots, campaigns and service configuration — ek jagah se manage karein.</p></div><div className="flex gap-2"><Link href="/dashboard/dashboard/admin/users" className={action}>All registrations ↗</Link><Link href="/dashboard/conversations" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:border-orange-300">Inbox ↗</Link></div></div></section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({title,value,detail,Icon}) => <article key={title} className="rounded-2xl border border-white/10 bg-[#121720] p-5"><div className="flex items-center justify-between gap-3"><span className="text-sm text-gray-400">{title}</span><Icon size={20} className="text-orange-300"/></div><strong className="mt-4 block text-3xl font-black">{value}</strong><p className="mt-2 text-xs text-gray-500">{detail}</p></article>)}</section>

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className={panel}>
          <div className="mb-5 flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-400/10 text-orange-300"><Building2 size={21}/></span><div><h2 className="text-xl font-bold">Create client workspace</h2><p className="mt-1 text-sm text-gray-400">Client pehle apne email se sign up kare. Yahan workspace banakar usko owner access assign karein.</p></div></div>
          <form action={createClientWorkspace} className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-xs text-gray-400">Workspace / business name<input name="name" required maxLength={120} placeholder="Example: ABC Digital" className={field}/></label><label className="grid gap-2 text-xs text-gray-400">Registered client email<input name="owner_email" required type="email" placeholder="client@example.com" className={field}/></label><label className="grid gap-2 text-xs text-gray-400">Initial status<select name="status" className={field} defaultValue="pending"><option value="pending">Pending review</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label><div className="flex items-end"><button className={action} type="submit">Create workspace + assign owner</button></div></form>
          <p className="mt-3 text-xs leading-5 text-gray-500">Only existing Supabase Auth users can be assigned. This action does not send invitations or create client passwords.</p>
        </div>
        <div className={panel}>
          <div className="mb-5 flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-400/10 text-blue-300"><Activity size={21}/></span><div><h2 className="text-xl font-bold">Platform health & configuration</h2><p className="mt-1 text-sm text-gray-400">Presence check only; successful end-to-end operation still needs testing.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["OpenAI AI replies", !!process.env.OPENAI_API_KEY, "OPENAI_API_KEY"],
              ["Supabase admin access", !!process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"],
              ["Meta app ID", !!process.env.META_APP_ID, "META_APP_ID"],
              ["Embedded Signup config", !!process.env.META_EMBEDDED_SIGNUP_CONFIG_ID, "META_EMBEDDED_SIGNUP_CONFIG_ID"]
            ].map(([name,ok,env]) => <div key={String(env)} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{String(name)}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ok ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>{ok ? "CONFIGURED" : "MISSING"}</span></div><p className="mt-2 text-xs text-gray-500">{String(env)}</p></div>)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><Link href="/dashboard/whatsapp" className="rounded-xl bg-orange-400 px-4 py-2.5 text-sm font-bold text-black">WhatsApp setup ↗</Link><Link href="/dashboard/automation" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:border-orange-300">Automation ↗</Link><Link href="/dashboard/api" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:border-orange-300">API & webhooks ↗</Link><Link href="/dashboard/campaigns" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:border-orange-300">Campaigns ↗</Link></div>
        </div>
      </section>

      <section className={"mt-7 " + panel}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Client workspaces & access control</h2><p className="mt-1 text-sm text-gray-400">Activate/suspend a workspace, change bot state, or add an existing user to a workspace.</p></div><span className="text-xs text-gray-500">{orgs.length} shown · max 200</span></div>
        {orgRes.error ? <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">Workspace data could not load: {orgRes.error.message}. Check Supabase service-role key, table schema and permissions.</p> : orgs.length === 0 ? <p className="text-sm text-gray-400">No workspaces yet. Use the form above after the client has registered.</p> : <div className="space-y-4">{orgs.map(org => { const bot = bots.find(b => b.organization_id === org.id); const orgMembers = members.filter(m => m.organization_id === org.id); const connection = connections.find(c => c.organization_id === org.id); return <article key={org.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-[200px] flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{org.name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${org.status === "active" ? "bg-emerald-400/10 text-emerald-300" : org.status === "suspended" ? "bg-red-400/10 text-red-300" : "bg-orange-400/10 text-orange-200"}`}>{org.status}</span></div><p className="mt-1 text-xs text-gray-500">Slug: {org.slug} · ID: {org.id}</p><p className="mt-2 text-xs text-gray-400">{orgMembers.length} member(s) · WhatsApp: {connection?.connection_status ?? "not connected"} · Bot: {bot?.enabled ? "enabled" : "disabled"}</p></div><form action={updateWorkspaceStatus} className="flex flex-wrap gap-2"><input type="hidden" name="organization_id" value={org.id}/><select name="status" defaultValue={org.status ?? "pending"} className={field + " !w-auto min-w-36"}><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option></select><button className="rounded-xl border border-orange-300/30 px-3 py-2 text-xs font-bold text-orange-200 hover:bg-orange-400/10" type="submit">Save status</button></form></div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <form action={updateWorkspaceBot} className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><input type="hidden" name="organization_id" value={org.id}/><label className="grid gap-1 text-[11px] text-gray-400">Bot name<input name="bot_name" defaultValue={bot?.bot_name ?? "AI SOFT Assistant"} maxLength={80} className={field}/></label><label className="grid gap-1 text-[11px] text-gray-400">AI auto-reply<select name="enabled" defaultValue={bot?.enabled ? "true" : "false"} className={field}><option value="false">Disabled</option><option value="true">Enabled</option></select></label><button type="submit" className="rounded-xl bg-blue-500 px-3 py-2.5 text-xs font-bold text-white">Save bot</button></form>
            <form action={addWorkspaceMember} className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><input type="hidden" name="organization_id" value={org.id}/><label className="grid gap-1 text-[11px] text-gray-400">Add existing user by email<input name="email" type="email" required placeholder="user@example.com" className={field}/></label><label className="grid gap-1 text-[11px] text-gray-400">Role<select name="role" defaultValue="client" className={field}><option value="owner">Owner</option><option value="admin">Admin</option><option value="agent">Agent</option><option value="client">Client</option></select></label><button type="submit" className="rounded-xl border border-white/15 px-3 py-2.5 text-xs font-bold hover:border-orange-300">Assign member</button></form>
          </div>
        </article>; })}</div>}
      </section>

      <section className="mt-7 grid gap-5 xl:grid-cols-2">
        <div className={panel}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-bold">WhatsApp connections</h2><p className="mt-1 text-sm text-gray-400">Connection status and latest webhook activity.</p></div><MessageCircle className="text-orange-300"/></div>{connRes.error ? <p className="text-sm text-amber-200">Query failed: {connRes.error.message}</p> : connections.length === 0 ? <p className="text-sm text-gray-500">No WhatsApp connections yet.</p> : <div className="space-y-2">{connections.slice(0,10).map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div><strong className="block text-sm">{c.verified_name || c.display_phone_number || "WhatsApp account"}</strong><span className="text-xs text-gray-500">{orgNames.get(c.organization_id) ?? "Unknown workspace"} · {c.display_phone_number ?? "No display number"}</span></div><div className="text-right"><span className={`rounded-full px-2 py-1 text-[10px] ${c.connection_status === "connected" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>{c.connection_status}</span><p className="mt-2 text-[10px] text-gray-500">Webhook: {c.last_webhook_at ? new Date(c.last_webhook_at).toLocaleString("en-IN") : "Not received"}</p></div></div>)}</div>}</div>
        <div className={panel}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-bold">AI bots & recent campaigns</h2><p className="mt-1 text-sm text-gray-400">Bot state and outbound campaign counts.</p></div><Bot className="text-orange-300"/></div><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">AI bots</h3>{aiRes.error ? <p className="text-sm text-amber-200">Query failed: {aiRes.error.message}</p> : bots.length === 0 ? <p className="text-sm text-gray-500">No AI bot settings yet.</p> : <div className="space-y-2">{bots.slice(0,6).map(b => <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div><strong className="block text-sm">{b.bot_name || "AI assistant"}</strong><span className="text-xs text-gray-500">{orgNames.get(b.organization_id) ?? "Workspace"}</span></div><span className={b.enabled ? "text-xs text-emerald-300" : "text-xs text-gray-500"}>{b.enabled ? "Enabled" : "Disabled"}</span></div>)}</div>}<h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-gray-500">Recent campaigns</h3>{campaignRes.error ? <p className="text-sm text-amber-200">Query failed: {campaignRes.error.message}</p> : campaigns.length === 0 ? <p className="text-sm text-gray-500">No campaigns yet.</p> : <div className="space-y-2">{campaigns.slice(0,5).map(c => <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div><strong className="block text-sm">{c.name}</strong><span className="text-xs text-gray-500">{orgNames.get(c.organization_id) ?? "Workspace"} · {c.sent_count ?? 0}/{c.recipient_count ?? 0} sent</span></div><span className="text-xs text-gray-400">{c.status}</span></div>)}</div>}<div className="mt-4 flex flex-wrap gap-2"><Link href="/dashboard/campaigns" className="rounded-xl border border-white/15 px-3 py-2 text-xs hover:border-orange-300">Open campaigns ↗</Link><Link href="/dashboard/conversations" className="rounded-xl border border-white/15 px-3 py-2 text-xs hover:border-orange-300">Customer inbox ↗</Link></div></div>
      </section>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        {title:"Registrations",desc:"Search registration list and email verification state.",href:"/dashboard/dashboard/admin/users",Icon:Users},
        {title:"WhatsApp",desc:"Meta onboarding and connection setup.",href:"/dashboard/whatsapp",Icon:PlugZap},
        {title:"API & webhooks",desc:"Workspace API settings and event delivery.",href:"/dashboard/api",Icon:Webhook},
        {title:"Automation",desc:"Bot instructions and auto-reply configuration.",href:"/dashboard/automation",Icon:Settings}
      ].map(({title,desc,href,Icon}) => <Link href={href} key={href} className="group rounded-2xl border border-white/10 bg-[#121720] p-5 transition hover:border-orange-300/50"><div className="flex items-center justify-between"><Icon className="text-orange-300" size={22}/><ArrowUpRight className="text-gray-500 group-hover:text-orange-300" size={18}/></div><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-gray-400">{desc}</p></Link>)}</section>
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-gray-500"><span>© {new Date().getFullYear()} AI SOFT STUDIO · Master Admin</span><span><ShieldCheck className="mr-1 inline" size={13}/> Every write action re-checks admin access on the server.</span></footer>
    </div>
  </main>;
}
