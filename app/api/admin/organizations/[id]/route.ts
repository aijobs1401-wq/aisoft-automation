import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await createClient();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user?.email) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const allowedEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!allowedEmails.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server admin database configuration is missing." }, { status: 500 });

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!["active", "pending", "suspended"].includes(status)) {
    return NextResponse.json({ error: "Status must be active, pending, or suspended." }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.from("organizations").update({ status }).eq("id", id).select("id,name,status").single();
  if (error) return NextResponse.json({ error: "Could not update workspace status." }, { status: 500 });
  return NextResponse.json({ workspace: data });
}
