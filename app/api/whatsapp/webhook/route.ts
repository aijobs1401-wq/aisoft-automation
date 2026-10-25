import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptWhatsAppToken } from "@/lib/whatsapp/token-crypto";

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
            .select("id,opted_out_at").single();
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

          const { data: insertedMessages, error: messageError } = await admin.from("messages").upsert({
            organization_id: connection.organization_id,
            conversation_id: conversation.id,
            meta_message_id: String(message.id),
            direction: isAppEcho ? "outbound" : "inbound",
            message_type: String(message.type ?? "unknown"),
            body: textBody(message),
            delivery_status: isAppEcho ? "sent" : "received",
            occurred_at: occurredAt
          }, { onConflict: "meta_message_id", ignoreDuplicates: true }).select("id");
          if (messageError) throw messageError;

          // Generate one automatic reply only for a newly inserted, text-bearing inbound message.
          // AI failures must not cause Meta webhook retries or block inbox persistence.
          const inboundText = textBody(message);
          if (!isAppEcho && insertedMessages?.length && inboundText && !contact.opted_out_at && process.env.OPENAI_API_KEY) {
            try {
              const { data: aiSettings } = await admin.from("whatsapp_ai_settings")
                .select("enabled,bot_name,system_prompt")
                .eq("organization_id", connection.organization_id).maybeSingle();
              if (aiSettings?.enabled) {
                const { data: history } = await admin.from("messages")
                  .select("direction,body,occurred_at")
                  .eq("conversation_id", conversation.id)
                  .order("occurred_at", { ascending: false }).limit(12);
                const chatMessages = (history ?? []).reverse()
                  .filter((item: any) => typeof item.body === "string" && item.body.trim())
                  .map((item: any) => ({
                    role: item.direction === "inbound" ? "user" : "assistant",
                    content: String(item.body).slice(0, 2000)
                  }));
                const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
                  body: JSON.stringify({
                    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                    temperature: 0.4,
                    max_tokens: 350,
                    messages: [
                      {
                        role: "system",
                        content: `You are ${aiSettings.bot_name || "AI Assistant"}, a WhatsApp customer-support assistant. Follow these business instructions: ${aiSettings.system_prompt}. Keep replies concise and useful. Do not claim to be human, invent facts, request passwords or OTPs, or promise refunds or financial returns. If uncertain, offer a human handoff.`
                      },
                      ...chatMessages
                    ]
                  }),
                  cache: "no-store",
                  signal: AbortSignal.timeout(12000)
                });
                const aiJson = await aiResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
                const replyText = aiJson.choices?.[0]?.message?.content?.trim().slice(0, 3500);
                if (aiResponse.ok && replyText) {
                  const { data: secret } = await admin.from("whatsapp_connection_secrets")
                    .select("token_ciphertext,token_expires_at").eq("connection_id", connection.id).maybeSingle();
                  if (secret && (!secret.token_expires_at || new Date(secret.token_expires_at).getTime() > Date.now())) {
                    const token = decryptWhatsAppToken(secret.token_ciphertext);
                    const graphVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
                    const sendResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
                      method: "POST",
                      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
                      body: JSON.stringify({
                        messaging_product: "whatsapp",
                        recipient_type: "individual",
                        to: waId,
                        type: "text",
                        text: { preview_url: false, body: replyText }
                      }),
                      cache: "no-store",
                      signal: AbortSignal.timeout(12000)
                    });
                    const sendJson = await sendResponse.json() as { messages?: Array<{ id?: string }> };
                    const replyMessageId = sendJson.messages?.[0]?.id;
                    if (sendResponse.ok && replyMessageId) {
                      const replyAt = new Date().toISOString();
                      await admin.from("messages").upsert({
                        organization_id: connection.organization_id,
                        conversation_id: conversation.id,
                        meta_message_id: replyMessageId,
                        direction: "outbound",
                        message_type: "text",
                        body: replyText,
                        delivery_status: "sent",
                        occurred_at: replyAt
                      }, { onConflict: "meta_message_id", ignoreDuplicates: true });
                      await admin.from("conversations").update({ last_message_at: replyAt }).eq("id", conversation.id);
                    }
                  }
                }
              }
            } catch {
              // The inbound message remains saved; automation can be diagnosed separately.
            }
          }
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
