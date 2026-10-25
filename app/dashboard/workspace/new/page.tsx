"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, Building2 } from "lucide-react";

function makeSlug(value: string) {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login?message=Please%20sign%20in%20first"); return; }
      const { data: memberships } = await supabase.from("organization_members")
        .select("organization_id").eq("user_id", user.id).limit(1);
      if (memberships?.length) { router.replace("/dashboard/automation"); return; }
      const suggested = String(user.user_metadata?.organization_name ?? "").trim();
      if (active && suggested) setCompany(suggested);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please sign in again.");
      const orgName = company.trim();
      if (orgName.length < 2) throw new Error("Enter a business/workspace name.");
      const slug = makeSlug(orgName) || `workspace-${user.id.slice(0, 8)}`;
      const { error: createError } = await supabase.rpc("create_my_organization", {
        org_name: orgName, org_slug: slug
      });
      if (createError) throw new Error(createError.message || "Workspace could not be created.");
      router.replace("/dashboard/automation");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workspace could not be created.");
    } finally { setBusy(false); }
  }

  return <main className="auth-wrap">
    <Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link>
    <section className="auth-card">
      <span className="eyebrow"><Sparkles size={14} /> WORKSPACE SETUP</span>
      <h1>Create your workspace</h1>
      <p className="sub">Add your business name to create your private workspace. You can configure the AI chatbot right after this.</p>
      {loading ? <p className="sub">Checking your account…</p> : <form onSubmit={submit} className="auth-form">
        <label><Building2 size={15} /> Business / workspace name
          <input required minLength={2} maxLength={80} value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. My Business" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn auth-submit" disabled={busy}>{busy ? "Creating workspace…" : "Create workspace & continue"}</button>
      </form>}
      <p className="auth-bottom"><Link href="/dashboard">← Back to dashboard</Link></p>
    </section>
  </main>;
}
