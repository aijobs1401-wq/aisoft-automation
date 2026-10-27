import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to set up your workspace." }, { status: 401 });
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (membershipError) {
    return NextResponse.json({ error: "Could not check your workspace membership." }, { status: 500 });
  }
  if (memberships?.[0]?.organization_id) {
    return NextResponse.json({ workspaceId: memberships[0].organization_id, alreadyExists: true });
  }

  const body = await request.json().catch(() => null) as { workspaceName?: unknown } | null;
  const metadataName = user.user_metadata?.organization_name;
  const workspaceName = typeof body?.workspaceName === "string"
    ? body.workspaceName.trim()
    : typeof metadataName === "string" ? metadataName.trim() : "";

  if (workspaceName.length < 2 || workspaceName.length > 80) {
    return NextResponse.json({ error: "Enter a workspace name between 2 and 80 characters." }, { status: 400 });
  }

  const slug = slugify(workspaceName) || `workspace-${user.id.slice(0, 8)}`;
  const { data: workspaceId, error: createError } = await supabase.rpc("create_my_organization", {
    org_name: workspaceName,
    org_slug: slug
  });

  if (createError || !workspaceId) {
    console.error("[workspace bootstrap] Workspace creation failed", { code: createError?.code });
    return NextResponse.json({ error: "Workspace setup failed. Please try again or contact support." }, { status: 500 });
  }

  return NextResponse.json({ workspaceId, alreadyExists: false }, { status: 201 });
}
