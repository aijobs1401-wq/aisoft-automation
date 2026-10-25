import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptWhatsAppToken } from "@/lib/whatsapp/token-crypto";

export const runtime = "nodejs";
type RecipientResult = { phone: string; status: "sent" | "failed"; error?: string };

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.json({ error: "WhatsApp campaign sending is not configured on the server." }, { status: 503 });
  }

  const session = await createClient();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let body: { organizationId?: string; connectionId?: string; name?: string; templateName?: string; language?: string; phones?: string[]; confirmedOptIn?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const organizationId = String(body.organizationId ?? "");
  const connectionId = String(body.connectionId ?? "");
  const campaignName = String(body.name ?? "").trim().slice(0, 100);
  const templateName = String(body.templateName ?? "").trim();
  const language = String(body.language ?? "en").trim();
  const rawPhones = Array.isArray(body.phones) ? body.phones : [];
  const phones = [...new Set(rawPhones.map((value) => String(value).replace(/[\\s()+.-]/g, "")).filter((value) => /^\\d{8,15}$/.test(value)))];

  if (!organizationId || !connectionId || !campaignName || !/^[a-z0-9_]{2,128}$/.test(templateName) ||
      !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language) || !body.confirmedOptIn ||
      !rawPhones.length || phones.length !== rawPhones.length || phones.length > 25) {
    return NextResponse.json({ error: "Provide a campaign name, valid approved template, language, 1–25 unique phone numbers in international format, and confirm every recipient opted in." }, { status: 400 });
  }

  const { data: membership } = await session.from("organization_members").select("organization_id")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });

  const admin = createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: connection, error: connectionError } = await admin.from("whatsapp_connections")
    .select("id,organization_id,phone_number_id,connection_status,display_phone_number")
    .eq("id", connectionId).eq("organization_id", organizationId).maybeSingle();
  if (connectionError || !connection || connection.connection_status !== "connected") {
    return NextResponse.json({ error: "Choose a connected WhatsApp Business number." }, { status: 404 });
  }

  const { data: secret, error: secretError } = await admin.from("whatsapp_connection_secrets")
    .select("token_ciphertext,token_expires_at").eq("connection_id", connectionId).maybeSingle();
  if (secretError || !secret) return NextResponse.json({ error: "The encrypted WhatsApp token is missing." }, { status: 503 });
  if (secret.token_expires_at && new Date(secret.token_expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "The WhatsApp access token has expired. Reconnect through Meta." }, { status: 409 });
  }

  const { data: existingContacts, error: contactsError } = await admin.from("contacts")
    .select("wa_id,opted_out_at").eq("organization_id", organizationId).in("wa_id", phones);
  if (contactsError) return NextResponse.json({ error: "Could not verify contact consent status." }, { status: 500 });
  const optedOut = new Set((existingContacts ?? []).filter((c) => c.opted_out_at).map((c) => c.wa_id));
  const blocked = phones.filter((phone) => optedOut.has(phone));
  if (blocked.length) return NextResponse.json({ error: "Some recipients have opted out. Remove them before sending.", blocked }, { status: 409 });

  const now = new Date().toISOString();
  const { data: campaign, error: campaignError } = await admin.from("whatsapp_campaigns").insert({
    organization_id: organizationId, connection_id: connectionId, created_by: user.id,
    name: campaignName, template_name: templateName, template_language: language,
    status: "processing", recipient_count: phones.length
  }).select("id").single();
  if (campaignError || !campaign) return NextResponse.json({ error: "Could not create campaign record." }, { status: 500 });

  const token = decryptWhatsAppToken(secret.token_ciphertext);
  const graphVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
  const results: RecipientResult[] = [];
  for (const phone of phones) {
    try {
      const { data: contact, error: contactError } = await admin.from("contacts").upsert({
        organization_id: organizationId, wa_id: phone,
        opted_in_at: (existingContacts ?? []).find((c) => c.wa_id === phone)?.opted_out_at ? null : now
      }, { onConflict: "organization_id,wa_id", ignoreDuplicates: false }).select("id,wa_id,opted_out_at").single();
      if (contactError || !contact || contact.opted_out_at) throw new Error("Recipient consent could not be verified.");

      const { data: conversation, error: conversationError } = await admin.from("conversations").upsert({
        organization_id: organizationId, connection_id: connectionId, contact_id: contact.id,
        status: "open", last_message_at: now
      }, { onConflict: "organization_id,contact_id,connection_id" }).select("id").single();
      if (conversationError || !conversation) throw new Error("Could not create conversation.");

      const response = await fetch(`https://graph.facebook.com/${graphVersion}/${connection.phone_number_id}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", recipient_type: "individual", to: phone,
          type: "template",
          template: { name: templateName, language: { code: language } }
        }),
        cache: "no-store"
      });
      const result = await response.json() as { messages?: Array<{ id?: string }>; error?: { message?: string } };
      const messageId = result.messages?.[0]?.id;
      if (!response.ok || !messageId) throw new Error(result.error?.message || "Meta did not accept the message.");

      const { error: messageError } = await admin.from("messages").insert({
        organization_id: organizationId, conversation_id: conversation.id, meta_message_id: messageId,
        direction: "outbound", message_type: "template", body: `Template: ${templateName}`,
        delivery_status: "sent", occurred_at: now
      });
      if (messageError) throw new Error("Message was accepted but local history could not be saved.");
      results.push({ phone, status: "sent" });
    } catch (error) {
      results.push({ phone, status: "failed", error: error instanceof Error ? error.message.slice(0, 180) : "Send failed." });
    }
  }

  const sentCount = results.filter((item) => item.status === "sent").length;
  const failedCount = results.length - sentCount;
  const status = sentCount === phones.length ? "completed" : sentCount > 0 ? "partial" : "failed";
  await admin.from("whatsapp_campaigns").update({
    sent_count: sentCount, failed_count: failedCount, status, completed_at: new Date().toISOString()
  }).eq("id", campaign.id);

  return NextResponse.json({ ok: failedCount === 0, campaignId: campaign.id, sentCount, failedCount, results });
}
