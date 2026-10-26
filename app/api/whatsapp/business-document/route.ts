import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in before uploading business documents." }, { status: 401 });

  const form = await request.formData();
  const organizationId = String(form.get("organizationId") || "");
  const file = form.get("file");
  const website = String(form.get("websiteUrl") || "").trim();
  if (!organizationId || (!(file instanceof File) && !website)) return NextResponse.json({ error: "Provide a business website or GST certificate." }, { status: 400 });
  if (website && !/^https?:\\/\\//i.test(website)) return NextResponse.json({ error: "Website URL must start with https://." }, { status: 400 });
  if (file instanceof File && !ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Upload a PDF, JPG, or PNG file." }, { status: 415 });
  if (file instanceof File && (file.size <= 0 || file.size > MAX_BYTES)) return NextResponse.json({ error: "The document must be smaller than 10 MB." }, { status: 413 });

  const { data: membership, error: membershipError } = await supabase.from("organization_members")
    .select("organization_id").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Private document storage is not configured. Please contact the platform administrator." }, { status: 503 });

  const admin = createSupabaseAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const bucket = "business-verification";
  let path: string | null = null;
  if (file instanceof File) {
    const { data: buckets, error: bucketListError } = await admin.storage.listBuckets();
    if (bucketListError) return NextResponse.json({ error: "Could not check private document storage configuration." }, { status: 503 });
    if (!buckets?.some(item => item.name === bucket)) {
      const { error: createError } = await admin.storage.createBucket(bucket, { public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: [...ALLOWED_TYPES] });
      if (createError && !/already exists/i.test(createError.message)) return NextResponse.json({ error: "Could not initialize private document storage." }, { status: 503 });
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "business-document";
    path = `${organizationId}/${user.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: "Business document upload failed. Please try again." }, { status: 502 });
  }
  const { error: saveError } = await admin.from("whatsapp_business_verification").insert({
    organization_id: organizationId, submitted_by: user.id, business_website: website || null, document_path: path, status: "submitted"
  });
  if (saveError) return NextResponse.json({ error: "Could not save business verification details. Apply the latest database migration and try again." }, { status: 503 });
  return NextResponse.json({ ok: true, path, message: "Business details saved." });
}
