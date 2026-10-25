import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptWhatsAppToken } from "@/lib/whatsapp/token-crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.json({ error: "WhatsApp message sending is not configured on the server." }, { status: 503 });
  }

  const sessionClient = await createClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let body: { organizationId?: string; connectionId?: string; conversationId?: string; text?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const { organizationId, connectionId, conversationId } = body;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!organizationId || !connectionId || !conversationId || !text || text.length > 4096) {
    return NextResponse.json({ error: "Workspace, connection, conversation, and a message of 1–4096 characters are required." }, { status: 400 });
  }

  const { data: membership } = await sessionClient.from("organization_members")
    .select("organization_id").eq("user_id", user.id).eq("organization_id", organizationId).maybeSingle();
  if (!membership) return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });

  const admin = createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: connection, error: connectionError } = await admin.from("whatsapp_connections")
    .select("id,organization_id,phone_number_id,connection_status")
    .eq("id", connectionId).eq("organization_id", organizationId).maybeSingle();
  if (connectionError || !connection || connection.connection_status !== "connected") {
    return NextResponse.json({ error: "No connected WhatsApp number was found for this workspace." }, { status: 404 });
  }

  const { data: conversation, error: conversationError } = await admin.from("conversations")
    .select("id,organization_id,contact_id,contacts(wa_id,opted_out_at)")
    .eq("id", conversationId).eq("organization_id", organizationId).maybeSingle();
  if (conversationError || !conversation) return NextResponse.json({ error: "Conversation not found in this workspace." }, { status: 404 });
  const contact = conversation.contacts as unknown as { wa_id: string; opted_out_at: string | null } | null;
  if (!contact?.wa_id) return NextResponse.json({ error: "Conversation has no valid WhatsApp recipient." }, { status: 400 });
  if (contact.opted_out_at) return NextResponse.json({ error: "This contact has opted out. Sending is blocked." }, { status: 403 });

  const { data: latestInbound, error: inboundError } = await admin.from("messages")
    .select("occurred_at").eq("conversation_id", conversationId).eq("direction", "inbound")
    .order("occurred_at", { ascending: false }).limit(1).maybeSingle();
  if (inboundError) return NextResponse.json({ error: "Could not verify the customer service window." }, { status: 500 });
  const lastInboundAt = latestInbound?.occurred_at ? new Date(latestInbound.occurred_at).getTime() : 0;
  if (!lastInboundAt || Date.now() - lastInboundAt > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "The 24-hour customer service window is closed. Use an approved WhatsApp message template instead; template sending is not enabled yet." }, { status: 409 });
  }

  const { data: secret, error: secretError } = await admin.from("whatsapp_connection_secrets")
    .select("token_ciphertext,token_expires_at").eq("connection_id", connectionId).maybeSingle();
  if (secretError || !secret) return NextResponse.json({ error: "The encrypted WhatsApp token is missing." }, { status: 503 });
  if (secret.token_expires_at && new Date(secret.token_expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "The WhatsApp access token has expired. Reconnect this number through Meta." }, { status: 409 });
  }

  try {
    const token = decryptWhatsAppToken(secret.token_ciphertext);
    const graphVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${connection.phone_number_id}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: contact.wa_id,
        type: "text",
        text: { preview_url: false, body: text }
      }),
      cache: "no-store"
    });
    const result = await response.json() as { messages?: Array<{ id?: string; message_status?: string }>; error?: { message?: string; code?: number } };
    if (!response.ok || !result.messages?.[0]?.id) {
      return NextResponse.json({ error: result.error?.message || "Meta did not accept the message." }, { status: 502 });
    }

    const messageId = result.messages[0].id;
    const now = new Date().toISOString();
    const { error: saveError } = await admin.from("messages").insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      meta_message_id: messageId,
      direction: "outbound",
      message_type: "text",
      body: text,
      delivery_status: "sent",
      occurred_at: now
    });
    if (saveError) throw saveError;
    await admin.from("conversations").update({ last_message_at: now }).eq("id", conversationId);
    return NextResponse.json({ ok: true, messageId, status: result.messages[0].message_status ?? "accepted" });
  } catch {
    return NextResponse.json({ error: "Message sending failed. Check the server configuration and Meta connection." }, { status: 502 });
  }
}
