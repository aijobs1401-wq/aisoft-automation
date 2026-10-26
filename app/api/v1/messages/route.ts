import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptWhatsAppToken } from "@/lib/whatsapp/token-crypto";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server database configuration missing.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
function secureEqual(a: string, b: string) {
  const aa = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex");
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(gfs_[A-Za-z0-9_-]{30,})$/);
  if (!match) return NextResponse.json({ error: "Use Authorization: Bearer YOUR_WORKSPACE_API_KEY." }, { status: 401 });
  let admin;
  try { admin = adminClient(); } catch { return NextResponse.json({ error: "API service is not configured." }, { status: 503 }); }
  const keyHash = createHash("sha256").update(match[1]).digest("hex");
  const { data: settings, error: keyError } = await admin.from("organization_api_settings")
    .select("organization_id,api_key_hash").eq("api_key_hash", keyHash).maybeSingle();
  if (keyError || !settings || !secureEqual(settings.api_key_hash, keyHash)) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const to = String(body?.to ?? "").replace(/[^0-9]/g, "");
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const connectionId = typeof body?.connectionId === "string" ? body.connectionId : null;
  if (!/^\d{8,15}$/.test(to)) return NextResponse.json({ error: "'to' must be a phone number with country code, digits only." }, { status: 400 });
  if (!text || text.length > 4000) return NextResponse.json({ error: "'text' is required and must be 1–4000 characters." }, { status: 400 });

  let query = admin.from("whatsapp_connections").select("id,phone_number_id,connection_status")
    .eq("organization_id", settings.organization_id).eq("connection_status", "connected");
  if (connectionId) query = query.eq("id", connectionId);
  const { data: connections, error: connectionError } = await query.limit(2);
  if (connectionError) return NextResponse.json({ error: "Could not read WhatsApp connections." }, { status: 500 });
  if (!connections?.length) return NextResponse.json({ error: "No connected WhatsApp number found for this workspace." }, { status: 409 });
  if (!connectionId && connections.length > 1) return NextResponse.json({ error: "Multiple WhatsApp numbers are connected. Provide connectionId." }, { status: 400 });
  const connection = connections[0];

  const { data: contact } = await admin.from("contacts").select("id,opted_out_at")
    .eq("organization_id", settings.organization_id).eq("wa_id", to).maybeSingle();
  if (contact?.opted_out_at) return NextResponse.json({ error: "This contact has opted out and cannot be messaged." }, { status: 403 });

  const { data: secret, error: secretError } = await admin.from("whatsapp_connection_secrets")
    .select("token_ciphertext,token_expires_at").eq("connection_id", connection.id).maybeSingle();
  if (secretError || !secret || (secret.token_expires_at && new Date(secret.token_expires_at).getTime() <= Date.now())) {
    return NextResponse.json({ error: "WhatsApp access token is missing or expired. Reconnect WhatsApp." }, { status: 409 });
  }
  let token: string;
  try { token = decryptWhatsAppToken(secret.token_ciphertext); }
  catch { return NextResponse.json({ error: "Could not decrypt WhatsApp token. Reconnect WhatsApp." }, { status: 500 }); }

  const graphVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
  let response: Response;
  let result: any;
  try {
    response = await fetch(`https://graph.facebook.com/${graphVersion}/${connection.phone_number_id}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text } }),
      cache: "no-store", signal: AbortSignal.timeout(15000)
    });
    result = await response.json();
  } catch {
    return NextResponse.json({ error: "WhatsApp API request failed. Try again later." }, { status: 502 });
  }
  if (!response.ok) return NextResponse.json({ error: "Meta rejected the message.", details: result?.error?.message || "Check WhatsApp policy, template/window rules and phone number." }, { status: 502 });
  const messageId = result?.messages?.[0]?.id;
  if (!messageId) return NextResponse.json({ error: "Meta response did not contain a message ID.", meta: result }, { status: 502 });

  let contactId = contact?.id;
  if (!contactId) {
    const { data: newContact, error } = await admin.from("contacts").upsert({
      organization_id: settings.organization_id, wa_id: to
    }, { onConflict: "organization_id,wa_id" }).select("id").single();
    if (error || !newContact) return NextResponse.json({ error: "Message sent, but contact history could not be saved.", messageId }, { status: 200 });
    contactId = newContact.id;
  }
  const { data: conversation } = await admin.from("conversations").upsert({
    organization_id: settings.organization_id, connection_id: connection.id, contact_id: contactId,
    status: "open", last_message_at: new Date().toISOString()
  }, { onConflict: "organization_id,contact_id,connection_id" }).select("id").single();
  if (conversation) await admin.from("messages").upsert({
    organization_id: settings.organization_id, conversation_id: conversation.id, meta_message_id: messageId,
    direction: "outbound", message_type: "text", body: text, delivery_status: "sent", occurred_at: new Date().toISOString()
  }, { onConflict: "meta_message_id", ignoreDuplicates: true });
  return NextResponse.json({ success: true, messageId, status: "sent" }, { status: 200 });
}
