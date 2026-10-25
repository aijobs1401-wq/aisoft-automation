import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Webhook storage is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Webhook verification failed", { status: 403 });
}

function validSignature(rawBody: string, signature: string | null, appSecret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const receivedHex = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const received = Buffer.from(receivedHex, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function textBody(message: any): string | null {
  if (message?.text?.body) return String(message.text.body);
  if (message?.image?.caption) return String(message.image.caption);
  if (message?.video?.caption) return String(message.video.caption);
  if (message?.document?.caption) return String(message.document.caption);
  if (message?.button?.text) return String(message.button.text);
  if (message?.interactive?.button_reply?.title) return String(message.interactive.button_reply.title);
  if (message?.interactive?.list_reply?.title) return String(message.interactive.list_reply.title);
  return null;
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return NextResponse.json({ error: "Webhook signature verification is not configured." }, { status: 503 });
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 }); }

  let admin;
  try { admin = getAdminClient(); } catch {
    return NextResponse.json({ error: "Webhook database storage is not configured." }, { status: 503 });
  }

  const eventKey = createHash("sha256").update(rawBody).digest("hex");
  const { error: eventError } = await admin.from("webhook_events").upsert({
    event_key: eventKey,
    payload,
    processing_status: "pending"
  }, { onConflict: "event_key", ignoreDuplicates: true });
  if (eventError) return NextResponse.json({ error: "Could not persist webhook event." }, { status: 500 });

  try {
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change?.field !== "messages" && change?.field !== "smb_message_echoes") continue;
        const value = change?.value ?? {};
        const phoneNumberId = String(value?.metadata?.phone_number_id ?? "");
        if (!phoneNumberId) continue;

        const { data: connection, error: connectionError } = await admin
          .from("whatsapp_connections")
          .select("id,organization_id")
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();
        if (connectionError) throw connectionError;
        if (!connection) continue;

        const isAppEcho = change.field === "smb_message_echoes";
        const eventMessages = value.messages ?? value.smb_message_echoes ?? [];
        for (const message of eventMessages) {
          // Coexistence app echoes are outbound messages sent manually from the Business App.
          const waId = String(isAppEcho ? (message?.to ?? message?.recipient_id ?? "") : (message?.from ?? ""));
          if (!waId || !message?.id) continue;
          const profile = (value.contacts ?? []).find((contact: any) => String(contact?.wa_id ?? "") === waId);
          const { data: contact, error: contactError } = await admin
            .from("contacts")
            .upsert({
              organization_id: connection.organization_id,
              wa_id: waId,
              name: profile?.profile?.name ?? null
            }, { onConflict: "organization_id,wa_id" })
            .select("id").single();
          if (contactError || !contact) throw contactError ?? new Error("Unable to save contact.");

          const occurredAt = message.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : new Date().toISOString();
          const { data: conversation, error: conversationError } = await admin
            .from("conversations")
            .upsert({
              organization_id: connection.organization_id,
              connection_id: connection.id,
              contact_id: contact.id,
              status: "open",
              last_message_at: occurredAt
            }, { onConflict: "organization_id,contact_id,connection_id" })
            .select("id").single();
          if (conversationError || !conversation) throw conversationError ?? new Error("Unable to save conversation.");

          const { error: messageError } = await admin.from("messages").upsert({
            organization_id: connection.organization_id,
            conversation_id: conversation.id,
            meta_message_id: String(message.id),
            direction: isAppEcho ? "outbound" : "inbound",
            message_type: String(message.type ?? "unknown"),
            body: textBody(message),
            delivery_status: isAppEcho ? "sent" : "received",
            occurred_at: occurredAt
          }, { onConflict: "meta_message_id", ignoreDuplicates: true });
          if (messageError) throw messageError;
        }

        for (const status of (isAppEcho ? [] : (value.statuses ?? []))) {
          const mapped = ["sent", "delivered", "read", "failed"].includes(status?.status) ? status.status : null;
          if (!mapped || !status?.id) continue;
          const errorCode = status?.errors?.[0]?.code != null ? String(status.errors[0].code) : null;
          const { error: statusError } = await admin.from("messages")
            .update({ delivery_status: mapped, error_code: errorCode })
            .eq("meta_message_id", String(status.id))
            .eq("organization_id", connection.organization_id);
          if (statusError) throw statusError;
        }

        await admin.from("whatsapp_connections").update({ last_webhook_at: new Date().toISOString() }).eq("id", connection.id);
      }
    }
    await admin.from("webhook_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString()
    }).eq("event_key", eventKey);
    return NextResponse.json({ received: true });
  } catch {
    await admin.from("webhook_events").update({ processing_status: "failed" }).eq("event_key", eventKey);
    return NextResponse.json({ error: "Webhook event could not be processed; Meta may retry." }, { status: 500 });
  }
}
