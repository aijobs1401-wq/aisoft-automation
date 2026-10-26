"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

async function getPlatformAdmin() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user?.email) throw new Error("Please sign in with your platform admin account.");
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(user.email.toLowerCase())) throw new Error("Platform admin access denied.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server admin data access is not configured. Check Render environment variables.");
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`Missing required field: ${key}`);
  return value;
}

export async function updateWorkspaceStatus(formData: FormData) {
  const admin = await getPlatformAdmin();
  const id = required(formData, "organization_id");
  const status = required(formData, "status");
  if (!["pending", "active", "suspended"].includes(status)) throw new Error("Invalid workspace status.");
  const { error } = await admin.from("organizations").update({ status }).eq("id", id);
  if (error) throw new Error(`Workspace update failed: ${error.message}`);
  revalidatePath("/dashboard/admin");
}

export async function updateWorkspaceBot(formData: FormData) {
  const admin = await getPlatformAdmin();
  const organizationId = required(formData, "organization_id");
  const enabled = required(formData, "enabled") === "true";
  const botName = String(formData.get("bot_name") ?? "AI SOFT Assistant").trim().slice(0, 80) || "AI SOFT Assistant";
  const { data: existing, error: readError } = await admin.from("whatsapp_ai_settings").select("id").eq("organization_id", organizationId).maybeSingle();
  if (readError) throw new Error(`AI settings lookup failed: ${readError.message}`);
  const result = existing
    ? await admin.from("whatsapp_ai_settings").update({ enabled, bot_name: botName, updated_at: new Date().toISOString() }).eq("organization_id", organizationId)
    : await admin.from("whatsapp_ai_settings").insert({ organization_id: organizationId, enabled, bot_name: botName });
  if (result.error) throw new Error(`AI bot update failed: ${result.error.message}`);
  revalidatePath("/dashboard/admin");
}

export async function createClientWorkspace(formData: FormData) {
  const admin = await getPlatformAdmin();
  const name = required(formData, "name").slice(0, 120);
  const email = required(formData, "owner_email").toLowerCase();
  const status = String(formData.get("status") ?? "pending");
  if (!["pending", "active", "suspended"].includes(status)) throw new Error("Invalid workspace status.");
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "client";
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authError) throw new Error(`Could not find client account: ${authError.message}`);
  const owner = authData.users.find(u => u.email?.toLowerCase() === email);
  if (!owner) throw new Error("No registered account found for that email. Ask the client to sign up first.");
  const { data: org, error: orgError } = await admin.from("organizations").insert({ name, slug: `${slug}-${crypto.randomUUID().slice(0, 6)}`, status }).select("id").single();
  if (orgError || !org) throw new Error(`Workspace creation failed: ${orgError?.message ?? "No workspace returned"}`);
  const { error: memberError } = await admin.from("organization_members").upsert({ organization_id: org.id, user_id: owner.id, role: "owner" }, { onConflict: "organization_id,user_id" });
  if (memberError) {
    await admin.from("organizations").delete().eq("id", org.id);
    throw new Error(`Workspace created but owner assignment failed; rollback attempted: ${memberError.message}`);
  }
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/users");
}

export async function addWorkspaceMember(formData: FormData) {
  const admin = await getPlatformAdmin();
  const organizationId = required(formData, "organization_id");
  const email = required(formData, "email").toLowerCase();
  const role = String(formData.get("role") ?? "client");
  if (!["owner", "admin", "agent", "client"].includes(role)) throw new Error("Invalid workspace role.");
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authError) throw new Error(authError.message);
  const member = authData.users.find(u => u.email?.toLowerCase() === email);
  if (!member) throw new Error("No registered account found for that email. Ask the user to sign up first.");
  const { error } = await admin.from("organization_members").upsert({ organization_id: organizationId, user_id: member.id, role }, { onConflict: "organization_id,user_id" });
  if (error) throw new Error(`Could not assign workspace member: ${error.message}`);
  revalidatePath("/dashboard/admin");
}
