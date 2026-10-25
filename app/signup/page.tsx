"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function makeSlug(value: string) {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState(""); const [company, setCompany] = useState("");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { display_name: name.trim(), organization_name: company.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` }
      });
      if (authError) throw authError;
      if (data.session && data.user) {
        const slug = makeSlug(company) || `workspace-${data.user.id.slice(0, 8)}`;
        const { error: orgError } = await supabase.rpc("create_my_organization", { org_name: company.trim(), org_slug: slug });
        if (orgError) throw orgError;
        router.replace("/dashboard"); router.refresh();
      } else {
        setMessage("Account created. Check your email to confirm your address, then sign in. If email confirmation is disabled, you can sign in now.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create account."); }
    finally { setBusy(false); }
  }

  return <main className="auth-wrap"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><section className="auth-card"><span className="eyebrow">GET STARTED</span><h1>Create your workspace</h1><p className="sub">Register your business to start setting up your messaging workspace.</p><form onSubmit={submit} className="auth-form"><label>Your name<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" /></label><label>Business name<input required minLength={2} value={company} onChange={e=>setCompany(e.target.value)} placeholder="Your company" /></label><label>Work email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" /></label><label>Password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}<button className="btn auth-submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button></form><p className="auth-bottom">Already have an account? <Link href="/login">Sign in</Link></p><p className="auth-foot"><Link href="/">← Back to website</Link></p></section></main>;
}
