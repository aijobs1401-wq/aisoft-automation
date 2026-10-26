import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const hashKey = (value: string) => createHash("sha256").update(value).digest("hex");

async function getWorkspace() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  const { data: membership } = await session.from("organization_members")
    .select("organization_id,role").eq("user_id", user.id)
    .in("role", ["owner", "admin"]).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!membership) return { response: NextResponse.json({ error: "Workspace owner/admin access required. Create a workspace or ask its owner." }, { status: 403 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { response: NextResponse.json({ error: "Server database configuration is missing." }, { status: 503 }) };
  return { user, membership, admin: createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

export async function GET() {
  const ctx = await getWorkspace();
  if ("response" in ctx) return ctx.response;
  const { data: existing, error } = await ctx.admin.from("organization_api_settings")
    .select("organization_id,api_key_prefix,webhook_url,created_at,updated_at")
    .eq("organization_id", ctx.membership.organization_id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load API settings." }, { status: 500 });
  if (existing) return NextResponse.json({ settings: existing, apiKey: null, keyCreated: false });

  const apiKey = "gfs_" + randomBytes(32).toString("base64url");
  const { data, error: insertError } = await ctx.admin.from("organization_api_settings").insert({
    organization_id: ctx.membership.organization_id,
    api_key_hash: hashKey(apiKey),
    api_key_prefix: apiKey.slice(0, 12),
    webhook_url: null
  }).select("organization_id,api_key_prefix,webhook_url,created_at,updated_at").single();
  if (insertError) return NextResponse.json({ error: "Could not create your API key. Refresh and try again." }, { status: 500 });
  return NextResponse.json({ settings: data, apiKey, keyCreated: true });
}

export async function PATCH(request: Request) {
  const ctx = await getWorkspace();
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.webhookUrl !== "string") return NextResponse.json({ error: "Webhook URL is required as text." }, { status: 400 });
  const webhookUrl = body.webhookUrl.trim();
  if (webhookUrl) {
    try {
      const parsed = new URL(webhookUrl);
      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") throw new Error();
      if (parsed.username || parsed.password) throw new Error();
    } catch {
      return NextResponse.json({ error: "Enter a valid HTTPS webhook URL." }, { status: 400 });
    }
  }
  const { error } = await ctx.admin.from("organization_api_settings").update({
    webhook_url: webhookUrl || null, updated_at: new Date().toISOString()
  }).eq("organization_id", ctx.membership.organization_id);
  if (error) return NextResponse.json({ error: "Could not save webhook URL." }, { status: 500 });
  return NextResponse.json({ saved: true, webhookUrl: webhookUrl || null });
}

export async function POST() {
  const ctx = await getWorkspace();
  if ("response" in ctx) return ctx.response;
  const apiKey = "gfs_" + randomBytes(32).toString("base64url");
  const { data, error } = await ctx.admin.from("organization_api_settings").upsert({
    organization_id: ctx.membership.organization_id,
    api_key_hash: hashKey(apiKey),
    api_key_prefix: apiKey.slice(0, 12),
    updated_at: new Date().toISOString()
  }, { onConflict: "organization_id" })
  .select("organization_id,api_key_prefix,webhook_url,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: "Could not rotate API key." }, { status: 500 });
  return NextResponse.json({ settings: data, apiKey, keyCreated: true });
}
