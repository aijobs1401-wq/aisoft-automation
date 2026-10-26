import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { encryptWhatsAppToken } from "@/lib/whatsapp/token-crypto";

export const runtime = "nodejs";

type GraphError = { error?: { message?: string; type?: string; code?: number } };

async function graphGet(path: string, accessToken: string) {
  const version = process.env.META_GRAPH_API_VERSION || "v23.0";
  const url = new URL(`https://graph.facebook.com/${version}/${path.replace(/^\/+/, "")}`);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json() as GraphError & Record<string, unknown>;
  if (!response.ok) throw new Error(data.error?.message || "Meta Graph API request failed.");
  return data;
}

async function graphPost(path: string, accessToken: string) {
  const version = process.env.META_GRAPH_API_VERSION || "v23.0";
  const url = `https://graph.facebook.com/${version}/${path.replace(/^\/+/, "")}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: accessToken }),
    cache: "no-store"
  });
  const data = await response.json() as GraphError & Record<string, unknown>;
  if (!response.ok || data.success === false) throw new Error(data.error?.message || "Unable to subscribe the WhatsApp account.");
  return data;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let stage = "request_received";
  console.info(`[WhatsApp signup ${requestId}] POST received`);
  stage = "check_environment";
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!appId || !appSecret || !serviceKey || !supabaseUrl || !process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.json({ error: "WhatsApp integration is not fully configured. Admin setup is required." }, { status: 503 });
  }

  stage = "authenticate_user";
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let body: { code?: string; wabaId?: string; phoneNumberId?: string; organizationId?: string; onboardingMode?: "coexistence" | "api_only" };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const { code, wabaId, phoneNumberId, organizationId } = body;
  const onboardingMode = body.onboardingMode === "api_only" ? "api_only" : body.onboardingMode === "coexistence" ? "coexistence" : null;
  if (!code || !wabaId || !organizationId || !onboardingMode ||
      !/^[0-9]{5,40}$/.test(wabaId) || (phoneNumberId && !/^[0-9]{5,40}$/.test(phoneNumberId))) {
    return NextResponse.json({ error: "The completed Meta signup did not return a valid WABA ID." }, { status: 400 });
  }

  stage = "check_workspace_membership";
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members").select("organization_id,role")
    .eq("user_id", user.id).eq("organization_id", organizationId).maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });

  try {
    stage = "exchange_meta_authorization_code";
    const graphVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
    const exchangeUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    exchangeUrl.searchParams.set("client_id", appId);
    exchangeUrl.searchParams.set("client_secret", appSecret);
    exchangeUrl.searchParams.set("code", code);
    const exchangeResponse = await fetch(exchangeUrl, { cache: "no-store" });
    const tokenData = await exchangeResponse.json() as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (!exchangeResponse.ok || !tokenData.access_token) {
      return NextResponse.json({ error: tokenData.error?.message || "Meta authorization-code exchange failed." }, { status: 502 });
    }

    const accessToken = tokenData.access_token;
    stage = "fetch_whatsapp_phone_details";
    const phoneList = await graphGet(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, accessToken) as {
      data?: Array<{ id?: string; display_phone_number?: string; verified_name?: string }>;
    };
    if (!phoneList.data?.length) {
      return NextResponse.json({ error: "Meta finished onboarding but no phone number is available yet. Complete phone verification in Meta and retry signup." }, { status: 409 });
    }
    let selectedPhoneNumberId = phoneNumberId;
    let phone: { display_phone_number?: string; verified_name?: string; id?: string };
    if (selectedPhoneNumberId) {
      const selectedPhone = phoneList.data.find(item => item.id === selectedPhoneNumberId);
      if (!selectedPhone) {
        return NextResponse.json({ error: "The selected phone number does not belong to the WhatsApp Business Account returned by Meta." }, { status: 400 });
      }
      phone = selectedPhone;
    } else {
      if (phoneList.data.length !== 1 || !phoneList.data[0].id) {
        return NextResponse.json({ error: "Meta returned multiple phone numbers. Please restart signup and select the intended number." }, { status: 409 });
      }
      phone = phoneList.data[0];
      selectedPhoneNumberId = phone.id;
    }
    if (!selectedPhoneNumberId || (phone.id && phone.id !== selectedPhoneNumberId)) {
      return NextResponse.json({ error: "Meta returned an invalid phone number ID." }, { status: 502 });
    }
    stage = "subscribe_app_to_waba";
    await graphPost(`${wabaId}/subscribed_apps`, accessToken);

    stage = "initialize_supabase_admin";
    const admin = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    stage = "check_existing_connection";
    const { data: existing, error: existingError } = await admin
      .from("whatsapp_connections").select("id,organization_id")
      .eq("phone_number_id", selectedPhoneNumberId).maybeSingle();
    if (existingError) throw existingError;
    if (existing && existing.organization_id !== organizationId) {
      return NextResponse.json({ error: "This WhatsApp number is already linked to another workspace. Contact platform support." }, { status: 409 });
    }

    stage = "save_whatsapp_connection";
    const connectionValues = {
      organization_id: organizationId,
      phone_number_id: selectedPhoneNumberId,
      waba_id: wabaId,
      display_phone_number: phone.display_phone_number ?? null,
      verified_name: phone.verified_name ?? null,
      onboarding_mode: onboardingMode,
      connection_status: "pending",
      updated_at: new Date().toISOString()
    };
    const saved = existing
      ? await admin.from("whatsapp_connections").update(connectionValues).eq("id", existing.id).select("id").single()
      : await admin.from("whatsapp_connections").insert({ ...connectionValues, created_at: new Date().toISOString() }).select("id").single();
    if (saved.error || !saved.data) throw saved.error || new Error("Could not save WhatsApp connection.");

    stage = "save_encrypted_whatsapp_secret";
    const expiresAt = typeof tokenData.expires_in === "number" && tokenData.expires_in > 0
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;
    const { error: secretSaveError } = await admin.from("whatsapp_connection_secrets").upsert({
      connection_id: saved.data.id,
      token_ciphertext: encryptWhatsAppToken(accessToken),
      token_key_version: 1,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString()
    }, { onConflict: "connection_id" });
    if (secretSaveError) {
      await admin.from("whatsapp_connections").update({ connection_status: "error", updated_at: new Date().toISOString() }).eq("id", saved.data.id);
      throw secretSaveError;
    }

    stage = "mark_connection_connected";
    const { error: activateError } = await admin.from("whatsapp_connections")
      .update({ connection_status: "connected", updated_at: new Date().toISOString() })
      .eq("id", saved.data.id);
    if (activateError) throw activateError;

    console.info(`[WhatsApp signup ${requestId}] completed successfully`);
    return NextResponse.json({
      ok: true,
      connection: { id: saved.data.id, phoneNumber: phone.display_phone_number ?? null, verifiedName: phone.verified_name ?? null, status: "connected" }
    });
  } catch (error) {
    // Supabase/PostgREST errors are plain objects, not always Error instances.
    const detail = error && typeof error === "object"
      ? error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
      : null;
    const message = error instanceof Error
      ? error.message
      : typeof detail?.message === "string" ? detail.message : String(error ?? "Unknown error");
    const code = typeof detail?.code === "string" ? detail.code : undefined;
    // Log diagnostic fields only; never log tokens, OAuth codes, app secrets, or request bodies.
    console.error(`[WhatsApp signup ${requestId}] failed at ${stage}: code=${code ?? "none"} message=${message}`);
    return NextResponse.json({ error: "WhatsApp connection failed.", requestId, stage }, { status: 502 });
  }
}
