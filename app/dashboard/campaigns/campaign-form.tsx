"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, CheckCircle2, Send, ShieldCheck, Smartphone } from "lucide-react";

type Connection = { id: string; display_phone_number: string | null; verified_name: string | null; connection_status: string };
export default function CampaignForm({ organizationId, organizationName, connections }: { organizationId: string; organizationName: string; connections: Connection[] }) {
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [name, setName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [language, setLanguage] = useState("en");
  const [phonesText, setPhonesText] = useState("");
  const [confirmedOptIn, setConfirmedOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{sentCount:number;failedCount:number;results:Array<{phone:string;status:string;error?:string}>}|null>(null);
  const phones = phonesText.split(/[\n,;\t]+/).map((v) => v.trim()).filter(Boolean);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/whatsapp/campaigns/send", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ organizationId, connectionId, name, templateName, language, phones, confirmedOptIn }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Campaign could not be sent.");
      setResult(data); setPhonesText(""); setConfirmedOptIn(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Campaign failed."); }
    finally { setBusy(false); }
  }

  return <section className="campaign-layout">
    <form className="campaign-form" onSubmit={submit}>
      <div className="campaign-form-heading"><span className="campaign-icon"><Send size={20}/></span><div><h2>Create a campaign</h2><p>Workspace: {organizationName}</p></div><span className="campaign-secure"><ShieldCheck size={14}/> Secure</span></div>
      {!connections.length ? <div className="campaign-empty"><Smartphone size={25}/><h3>No connected WhatsApp number</h3><p>Connect a number through Meta Embedded Signup before sending campaigns.</p><a className="btn" href="/dashboard/whatsapp">Connect WhatsApp</a></div> : <>
        <label>WhatsApp Business number<select value={connectionId} onChange={e=>setConnectionId(e.target.value)} required>{connections.map(c=><option key={c.id} value={c.id}>{c.verified_name || "WhatsApp Business"} · {c.display_phone_number || "Connected number"}</option>)}</select></label>
        <label>Campaign name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. October product update" maxLength={100} required/></label>
        <div className="campaign-two-cols"><label>Approved template name<input value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="e.g. order_update" pattern="[a-z0-9_]{2,128}" required/><small>Use the exact approved template name from Meta.</small></label><label>Template language<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="en">English (en)</option><option value="en_US">English US (en_US)</option><option value="hi">Hindi (hi)</option><option value="hi_IN">Hindi India (hi_IN)</option></select></label></div>
        <label>Recipients <span className="field-count">{phones.length}/25</span><textarea value={phonesText} onChange={e=>setPhonesText(e.target.value)} placeholder={"919876543210\n919812345678\nUse country code; one number per line"} rows={6} required/><small>International format, digits only. Up to 25 unique numbers per campaign.</small></label>
        <label className="consent-check"><input type="checkbox" checked={confirmedOptIn} onChange={e=>setConfirmedOptIn(e.target.checked)} required/><span>I confirm every recipient explicitly opted in to receive WhatsApp messages from this business, and these contacts are not opted out.</span></label>
        <div className="campaign-warning"><AlertTriangle size={17}/><span>Only approved WhatsApp templates are sent. This initial version supports templates without variable placeholders. Meta rejects unapproved templates or invalid recipients.</span></div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="btn campaign-submit" type="submit" disabled={busy || phones.length===0 || phones.length>25}>{busy ? "Sending campaign…" : <><Send size={16}/> Send to {phones.length} recipient{phones.length===1?"":"s"}</>}</button>
      </>}
      {result ? <div className="campaign-result"><CheckCircle2 size={19}/><div><strong>Campaign finished</strong><p>{result.sentCount} accepted by Meta · {result.failedCount} failed. Delivery status updates may arrive later by webhook.</p>{result.results.filter(x=>x.status==="failed").slice(0,5).map((x,i)=><small key={i}>{x.phone}: {x.error}</small>)}</div></div> : null}
    </form>
    <aside className="campaign-side">
      <div className="campaign-side-card"><span className="campaign-side-icon"><ShieldCheck size={19}/></span><h3>Permission-first sending</h3><p>Every run requires an explicit opt-in confirmation. Existing opted-out contacts are blocked server-side.</p></div>
      <div className="campaign-side-card"><span className="campaign-side-icon"><Smartphone size={19}/></span><h3>Official WhatsApp API</h3><p>Messages use the connected number's encrypted server-side token and Meta's template endpoint.</p></div>
      <div className="campaign-side-card"><span className="campaign-side-icon"><CheckCircle2 size={19}/></span><h3>Track results</h3><p>See accepted and failed counts in campaign history. Final delivery/read updates depend on webhook events.</p></div>
    </aside>
  </section>;
}
