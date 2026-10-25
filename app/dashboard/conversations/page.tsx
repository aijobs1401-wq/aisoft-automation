import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SendMessageForm from "./send-message-form";

type ConversationRow = {
  id: string;
  contact_id: string;
  connection_id: string | null;
  status: string;
  last_message_at: string | null;
  contacts: { name: string | null; wa_id: string } | null;
  whatsapp_connections: { display_phone_number: string | null } | null;
};

type MessageRow = {
  conversation_id: string;
  body: string | null;
  direction: string;
  occurred_at: string;
  delivery_status: string;
};

export default async function ConversationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20continue");

  const { data: memberships } = await supabase.from("organization_members")
    .select("organization_id,role,organizations(name)")
    .eq("user_id", user.id).order("created_at", { ascending: true }).limit(1);
  const membership = memberships?.[0];
  if (!membership) {
    return <main className="dashboard-wrap"><Link href="/dashboard">← Back to dashboard</Link><h1>Workspace required</h1><p className="sub">Finish workspace setup before opening conversations.</p></main>;
  }

  const organizationId = membership.organization_id;
  const { data: rows, error } = await supabase.from("conversations")
    .select("id,contact_id,connection_id,status,last_message_at,contacts(name,wa_id),whatsapp_connections(display_phone_number)")
    .eq("organization_id", organizationId)
    .order("last_message_at", { ascending: false })
    .limit(50);
  const conversations = (rows ?? []) as unknown as ConversationRow[];
  const ids = conversations.map(item => item.id);
  let messages: MessageRow[] = [];
  if (ids.length) {
    const { data } = await supabase.from("messages")
      .select("conversation_id,body,direction,occurred_at,delivery_status")
      .in("conversation_id", ids)
      .order("occurred_at", { ascending: false })
      .limit(200);
    messages = (data ?? []) as MessageRow[];
  }
  const latest = new Map<string, MessageRow>();
  for (const item of messages) if (!latest.has(item.conversation_id)) latest.set(item.conversation_id, item);

  return (
    <main className="dashboard-wrap">
      <header className="dash-nav">
        <Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link>
        <div className="dash-user"><Link href="/dashboard">Back to dashboard</Link></div>
      </header>
      <section className="dash-welcome">
        <span className="eyebrow">TEAM INBOX</span>
        <h1>Conversations</h1>
        <p className="sub">Inbound messages and coexistence app echoes appear here after Meta sends webhook events.</p>
      </section>
      {error ? <p className="form-error">Could not load conversations. Check your workspace database setup.</p> : null}
      {!conversations.length ? (
        <section className="dash-tile org-panel">
          <h2>No conversations yet</h2>
          <p className="sub">Connect a WhatsApp number and configure the Meta webhook. New customer messages will appear here.</p>
          <Link className="btn" href="/dashboard/whatsapp">Set up WhatsApp</Link>
        </section>
      ) : (
        <section className="dash-grid">
          {conversations.map(item => {
            const contact = item.contacts;
            const last = latest.get(item.id);
            return (
              <article className="dash-tile" key={item.id}>
                <span className="eyebrow">{item.status.toUpperCase()}</span>
                <h2>{contact?.name || contact?.wa_id || "WhatsApp contact"}</h2>
                <p className="sub">{contact?.wa_id ?? "No recipient number"} · {item.whatsapp_connections?.display_phone_number ?? "WhatsApp number"}</p>
                <p>{last ? `${last.direction === "inbound" ? "Customer" : "You"}: ${last.body || `[${last.delivery_status} ${last.direction} message]`}` : "No messages loaded yet."}</p>
                {last ? <p className="auth-foot">{new Date(last.occurred_at).toLocaleString()}</p> : null}
                {item.connection_id ? <SendMessageForm organizationId={organizationId} connectionId={item.connection_id} conversationId={item.id} /> : <p className="form-error">This conversation has no active WhatsApp connection.</p>}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
