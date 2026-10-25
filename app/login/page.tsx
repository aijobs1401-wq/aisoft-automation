"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(search.get("message") ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      router.replace("/dashboard"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }

  return <main className="auth-wrap"><Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link><section className="auth-card"><span className="eyebrow">WELCOME BACK</span><h1>Sign in to your workspace</h1><p className="sub">Manage your business messaging from one secure place.</p><form onSubmit={submit} className="auth-form"><label>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" /></label><label>Password<input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message">{message}</p>}<button className="btn auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form><p className="auth-bottom">New to AI SOFT STUDIO? <Link href="/signup">Create an account</Link></p><p className="auth-foot"><Link href="/">← Back to website</Link></p></section></main>;
}
