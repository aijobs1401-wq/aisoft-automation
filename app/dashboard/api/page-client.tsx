"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Webhook, RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

type Settings = { organization_id: string; api_key_prefix: string; webhook_url: string | null; created_at: string; updated_at: string };
export default function ApiSettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/account/api-settings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load API settings.");
      setSettings(data.settings);
      setWebhookUrl(data.settings.webhook_url || "");
      if (data.apiKey) setApiKey(data.apiKey);
      if (data.keyCreated) setNotice("A new API key was created. Copy it now; it will not be shown again.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load settings."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function saveWebhook(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/account/api-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhookUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save webhook.");
      setNotice("Webhook URL saved. New incoming message events will be delivered to this endpoint.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save webhook."); }
    finally { setBusy(false); }
  }

  async function rotateKey() {
    if (!window.confirm("Regenerate API key? The current key will stop working immediately.")) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/account/api-settings", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not regenerate key.");
      setSettings(data.settings); setApiKey(data.apiKey || "");
      setNotice("API key regenerated. Update all integrations with this new key.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not regenerate key."); }
    finally { setBusy(false); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice("Copied to clipboard."); }
    catch { setNotice("Copy failed. Select the text and copy it manually."); }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://aisoft-automation.onrender.com";
  const sample = `curl -X POST "${origin}/api/v1/messages" \\\n  -H "Authorization: Bearer YOUR_WORKSPACE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"to":"919876543210","text":"Hello from AI SOFT STUDIO"}'`;

  if (loading) return <section className="dash-tile org-panel"><p>Loading your API & webhook settings…</p></section>;
  return <div className="space-y-6">
    {error && <div className="flex gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"><AlertCircle size={18}/>{error}</div>}
    {notice && <div className="flex gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200"><CheckCircle2 size={18}/>{notice}</div>}
    <section className="dash-tile org-panel">
      <h2><KeyRound size={20}/> Your API key</h2>
      <p className="sub">Every workspace gets its own key automatically. Keep it private and use it only on your server.</p>
      {apiKey ? <div className="mt-4 rounded-2xl border border-orange-300/30 bg-orange-300/5 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-orange-200">Copy this key now — shown only once</p><div className="mt-3 break-all font-mono text-sm">{apiKey}</div><button type="button" onClick={() => void copy(apiKey)} className="mt-3 rounded-xl bg-orange-300 px-4 py-2 text-sm font-bold text-black"><Copy size={15} className="mr-2 inline"/>Copy API key</button></div> : <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-sm text-gray-400">Current key starts with <code>{settings?.api_key_prefix}…</code>. For security, the full key is not stored in readable form.</p></div>}
      <button disabled={busy} type="button" onClick={() => void rotateKey()} className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm hover:border-orange-300 disabled:opacity-50"><RefreshCw size={15} className="mr-2 inline"/>Regenerate key</button>
    </section>
    <section className="dash-tile org-panel">
      <h2><Webhook size={20}/> Incoming message webhook</h2>
      <p className="sub">When an incoming WhatsApp message is stored, the platform will POST a JSON event to your HTTPS URL.</p>
      <form onSubmit={saveWebhook} className="mt-4 space-y-3">
        <label htmlFor="webhook-url" className="block text-sm font-medium">Your webhook URL</label>
        <input id="webhook-url" type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://yourdomain.com/webhooks/whatsapp" className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-orange-300"/>
        <p className="text-xs text-gray-500">Use a public HTTPS endpoint. Leave blank to disable external event delivery.</p>
        <button disabled={busy} className="rounded-xl bg-orange-300 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50">{busy ? "Saving…" : "Save webhook URL"}</button>
      </form>
    </section>
    <section className="dash-tile org-panel">
      <h2><ExternalLink size={20}/> API quick start</h2>
      <p className="sub">Send a text message through an active WhatsApp connection. Meta rules, templates and the customer-service window still apply.</p>
      <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-gray-200">{sample}</pre>
      <button type="button" onClick={() => void copy(sample)} className="mt-3 rounded-xl border border-white/15 px-4 py-2 text-sm"><Copy size={15} className="mr-2 inline"/>Copy cURL example</button>
      <p className="mt-4 text-xs text-gray-500">Endpoint: <code>POST /api/v1/messages</code> · Authentication: <code>Authorization: Bearer YOUR_WORKSPACE_API_KEY</code></p>
    </section>
  </div>;
}
