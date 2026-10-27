"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function WorkspaceSetupPage() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        window.location.replace("/login?message=Please%20sign%20in%20to%20continue");
        return;
      }
      const metadataName = user.user_metadata?.organization_name;
      if (active && typeof metadataName === "string") setWorkspaceName(metadataName);
      if (active) setLoading(false);
    }
    void loadUser();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceName })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Workspace setup failed.");
      window.location.replace("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workspace setup failed. Please try again.");
      setSaving(false);
    }
  }

  return <main className="auth-wrap">
    <Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link>
    <section className="auth-card">
      <span className="eyebrow">WORKSPACE SETUP</span>
      <h1>Finish setting up your workspace</h1>
      <p className="sub">Your account is signed in, but it is not linked to a workspace yet. Create your business workspace to continue. Existing workspaces and data will not be changed.</p>
      {loading ? <p className="sub" role="status">Checking your account…</p> : <form onSubmit={submit} className="auth-form">
        <label>Business / workspace name
          <input required minLength={2} maxLength={80} value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} placeholder="e.g. My Business" />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="btn auth-submit" disabled={saving}>{saving ? "Setting up…" : "Create workspace"}</button>
      </form>}
      <p className="auth-foot"><Link href="/dashboard">Back to dashboard</Link> · <Link href="/login">Sign out and sign in again</Link></p>
    </section>
  </main>;
}
