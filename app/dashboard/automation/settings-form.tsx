"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, Save, Sparkles } from "lucide-react";

type SettingsResponse = {
  organizationId: string;
  settings: { enabled: boolean; bot_name: string; system_prompt: string };
  configured: boolean;
};

export default function AutomationSettingsForm({ organizationId }: { organizationId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [botName, setBotName] = useState("AI Assistant");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful, polite customer support assistant. Reply in the language the customer uses. Keep WhatsApp replies concise and clear. If you do not know an answer, say that a human team member will help. Never invent prices, policies, guarantees, or financial claims.");
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/whatsapp/ai-settings", { cache: "no-store" }).then(async response => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not load settings.");
      if (active) {
        const data = json as SettingsResponse;
        setEnabled(Boolean(data.settings.enabled));
        setBotName(data.settings.bot_name || "AI Assistant");
        setSystemPrompt(data.settings.system_prompt || "");
        setConfigured(Boolean(data.configured));
      }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load settings."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/whatsapp/ai-settings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, enabled, botName, systemPrompt })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save settings.");
      setMessage("AI settings saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save settings."); }
    finally { setSaving(false); }
  }

  return <form className="auth-form" onSubmit={submit}>
    <div className="workspace-card-top"><span className="workspace-card-icon purple-icon"><Bot size={20} /></span><span className={"card-status " + (enabled ? "status-ready" : "neutral-status")}>{enabled ? "AUTO REPLY ON" : "AUTO REPLY OFF"}</span></div>
    <label>Assistant name<input required maxLength={80} value={botName} onChange={e => setBotName(e.target.value)} placeholder="e.g. Support Assistant" /></label>
    <label>Business instructions / system prompt<textarea required minLength={20} maxLength={2500} rows={7} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} placeholder="Describe your business, services, tone and when to hand over to a human." /></label>
    <label className="ai-toggle"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Enable automatic replies for new incoming WhatsApp messages</label>
    {!configured && <p className="form-error">OPENAI_API_KEY is not configured on the server yet. Add it in Render → Environment before enabling replies.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-message" role="status">{message}</p>}
    <button className="btn auth-submit" disabled={busy || saving}>{busy ? "Loading settings…" : saving ? "Saving…" : <><Save size={16} /> Save AI settings</>}</button>
    <p className="sub"><Sparkles size={14} /> Replies use the latest conversation history. Keep instructions factual; AI can make mistakes.</p>
  </form>;
}
