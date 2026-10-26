import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const { data: membership } = await session.from("organization_members")
    .select("organization_id").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Create a workspace first." }, { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server database configuration is missing." }, { status: 503 });
  const admin = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error: settingsError } = await admin.from("whatsapp_ai_settings")
    .select("organization_id,enabled,bot_name,system_prompt,updated_at")
    .eq("organization_id", membership.organization_id).maybeSingle();
  if (settingsError) return NextResponse.json({ error: "Could not load AI settings." }, { status: 500 });
  return NextResponse.json({
    organizationId: membership.organization_id,
    settings: data ?? {
      enabled: false,
      bot_name: "AI Assistant",
      system_prompt: "You are a helpful, polite customer support assistant. Reply in the language the customer uses. Keep WhatsApp replies concise and clear. If you do not know an answer, say that a human team member will help. Never invent prices, policies, guarantees, or financial claims."
    },
    configured: Boolean(process.env.OPENAI_API_KEY)
  });
}

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  let body: { organizationId?: string; enabled?: boolean; botName?: string; systemPrompt?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const organizationId = String(body.organizationId ?? "");
  const botName = String(body.botName ?? "AI Assistant").trim().slice(0, 80);
  const systemPrompt = String(body.systemPrompt ?? "").trim();
  if (!organizationId || typeof body.enabled !== "boolean" || !botName || systemPrompt.length < 20 || systemPrompt.length > 2500) {
    return NextResponse.json({ error: "Provide a bot name and instructions between 20 and 2,500 characters." }, { status: 400 });
  }
  const { data: membership } = await session.from("organization_members")
    .select("organization_id").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server database configuration is missing." }, { status: 503 });
  const admin = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: saveError } = await admin.from("whatsapp_ai_settings").upsert({
    organization_id: organizationId,
    enabled: body.enabled,
    bot_name: botName,
    system_prompt: systemPrompt,
    updated_by: user.id,
    updated_at: new Date().toISOString()
  }, { onConflict: "organization_id" });
  if (saveError) {
    console.error("AI settings save failed", { code: saveError.code, message: saveError.message, details: saveError.details, hint: saveError.hint });
    return NextResponse.json({ error: `Could not save AI settings: ${saveError.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, enabled: body.enabled });
}
