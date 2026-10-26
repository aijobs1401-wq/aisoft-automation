"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (callback: (response: any) => void, options: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type SessionInfo = { wabaId: string; phoneNumberId: string };
type OnboardingMode = "coexistence" | "api_only";

export default function WhatsAppConnectButton({
  organizationId,
  appId,
  configId,
  graphVersion
}: {
  organizationId: string;
  appId: string;
  configId: string;
  graphVersion: string;
}) {
  const [sdkReady, setSdkReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>("coexistence");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [gstFile, setGstFile] = useState<File | null>(null);
  const [documentPath, setDocumentPath] = useState("");
  const [documentBusy, setDocumentBusy] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    if (!appId) return;
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
      setSdkReady(true);
    };
    if (document.getElementById("facebook-jssdk")) {
      if (window.FB) {
        window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
        setSdkReady(true);
      }
      return;
    }
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    return () => { window.fbAsyncInit = undefined; };
  }, [appId, graphVersion]);

  useEffect(() => {
    function receiveMessage(event: MessageEvent) {
      if (!/^(https:\/\/)?([a-z0-9-]+\.)?facebook\.com$/i.test(event.origin)) return;
      let data: any = event.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (data?.type !== "WA_EMBEDDED_SIGNUP" && data?.event !== "WA_EMBEDDED_SIGNUP") return;
      const eventName = data?.data?.event ?? data?.eventName ?? (data?.event !== "WA_EMBEDDED_SIGNUP" ? data?.event : undefined);
      const details = data?.data ?? {};
      if (eventName === "FINISH" || eventName === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
        const wabaId = String(details.waba_id ?? details.wabaId ?? "");
        const phoneNumberId = String(details.phone_number_id ?? details.phoneNumberId ?? "");
        if (wabaId) setSessionInfo({ wabaId, phoneNumberId });
        else setError("Meta signup finished, but no WhatsApp Business Account ID was returned. Check the Embedded Signup configuration and try again.");
      } else if (eventName === "CANCEL") {
        setError("WhatsApp setup was cancelled. You can try again.");
      } else if (eventName === "ERROR") {
        setError("Meta could not complete WhatsApp setup. Check the Meta app configuration and try again.");
      }
    }
    window.addEventListener("message", receiveMessage);
    return () => window.removeEventListener("message", receiveMessage);
  }, []);

  useEffect(() => {
    if (!code || !sessionInfo || submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    fetch("/api/whatsapp/embedded-signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        wabaId: sessionInfo.wabaId,
        phoneNumberId: sessionInfo.phoneNumberId,
        organizationId,
        onboardingMode
      })
    })
      .then(async response => {
        const responseText = await response.text();
        let data: { error?: string; connection?: { phoneNumber?: string } } = {};
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error(
            `Server returned non-JSON response (HTTP ${response.status}): ${responseText.slice(0, 200) || "Empty response"}`
          );
        }
        if (!response.ok) {
          throw new Error(data.error || `WhatsApp connection failed (HTTP ${response.status}).`);
        }
        setMessage(`Connected ${data.connection?.phoneNumber || "WhatsApp number"} successfully.`);
      })
      .catch(err => {
        submitted.current = false;
        setError(err instanceof Error ? err.message : "WhatsApp connection failed.");
      })
      .finally(() => setBusy(false));
  }, [code, sessionInfo, organizationId, onboardingMode]);

  function launchSignup() {
    setError(""); setMessage("");
    if (!websiteUrl.trim() && !gstFile && !documentPath) { setError("Please add your active business website or upload a GST certificate before continuing."); return; }
    if (websiteUrl.trim() && !/^https?:\/\//i.test(websiteUrl.trim())) { setError("Enter the full website URL starting with https://"); return; }
    if (!documentPath) { void uploadBusinessDetailsAndLaunch(); return; }
    startMetaSignup();
  }

  async function uploadBusinessDetailsAndLaunch() {
    setDocumentBusy(true); setError("");
    try {
      const form = new FormData(); form.append("organizationId", organizationId);
      if (websiteUrl.trim()) form.append("websiteUrl", websiteUrl.trim());
      if (gstFile) form.append("file", gstFile);
      const response = await fetch("/api/whatsapp/business-document", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not upload business document.");
      setDocumentPath(String(result.path || "submitted"));
      startMetaSignup();
    } catch (err) { setError(err instanceof Error ? err.message : "Document upload failed."); }
    finally { setDocumentBusy(false); }
  }

  function startMetaSignup() {
    setError(""); setMessage(""); setCode(""); setSessionInfo(null); submitted.current = false;
    if (!appId || !configId) { setError("Meta setup is not complete yet. Admin must configure META_APP_ID, META_APP_SECRET, and META_EMBEDDED_SIGNUP_CONFIG_ID on the server."); return; }
    if (!window.FB || !sdkReady) { setError("Meta login is still loading. Wait a moment and try again."); return; }
    window.FB.login(response => {
      const authCode = response?.authResponse?.code;
      if (authCode) setCode(String(authCode));
      else if (response?.status !== "connected") setError("Meta login did not return an authorization code. Check app mode, allowed domains, and test-user access.");
    }, { config_id: configId, auth_type: "rerequest", response_type: "code", override_default_response_type: true,
      extras: onboardingMode === "coexistence" ? { setup: {}, featureType: "whatsapp_business_app_onboarding" } : { setup: {} } });
  }

  return (
    <div className="wa-onboarding">
      <style>{`
        .wa-onboarding{display:grid;gap:20px}.wa-step{font-size:10px;letter-spacing:.14em;color:#85caff;font-weight:800}.wa-onboarding h3{margin:7px 0;font-size:18px}.wa-muted{color:#9aabc2;font-size:12px;line-height:1.7;margin:0}.wa-options,.wa-doc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.wa-option{position:relative;display:grid;gap:10px;padding:17px;border:1px solid #273c57;border-radius:16px;background:linear-gradient(145deg,#10223a,#0a1727);cursor:pointer}.wa-option.selected{border-color:#328cff;box-shadow:0 0 0 1px #328cff30}.wa-option input{position:absolute;right:14px;top:14px;accent-color:#2587ff}.wa-option .wa-ico{font-size:22px}.wa-option strong{font-size:13px;padding-right:18px}.wa-option small{font-size:11px;line-height:1.65;color:#9aabc2}.wa-option ul{list-style:none;padding:0;margin:0;display:grid;gap:7px}.wa-option li{font-size:11px;line-height:1.5;color:#c7d6e8}.wa-option li:before{content:'✓';color:#5bdcb4;margin-right:7px}.wa-doc-panel{padding:18px;border:1px solid #263d59;border-radius:16px;background:#0a1726}.wa-field{display:grid;gap:8px;color:#dce8f8;font-size:12px;font-weight:650}.wa-field input{width:100%;min-width:0;padding:12px;border:1px solid #2b425e;border-radius:11px;background:#071321;color:#f5f8ff;font:inherit;font-size:12px}.wa-field input:focus{outline:2px solid #2587ff55}.wa-connect{width:100%;min-height:48px;border:0;border-radius:12px;background:linear-gradient(110deg,#267cf3,#20b9db);color:white;font-weight:800;font-size:13px;cursor:pointer}.wa-connect:disabled{opacity:.55;cursor:wait}.wa-privacy{padding:11px;border-radius:10px;background:#2483ff0c;color:#a7c8ed;font-size:11px;line-height:1.65}.wa-onboarding .form-error,.wa-onboarding .form-message{font-size:12px;line-height:1.7;overflow-wrap:anywhere}@media(max-width:620px){.wa-options,.wa-doc-grid{grid-template-columns:1fr}.wa-option{padding:14px}}
      `}</style>
      <div><span className="wa-step">STEP 1 · CHOOSE YOUR NUMBER TYPE</span><h3>How do you want to connect?</h3><p className="wa-muted">Pick the setup that matches your business. Meta confirms eligibility during official onboarding.</p></div>
      <div className="wa-options">
        <label className={`wa-option ${onboardingMode === "coexistence" ? "selected" : ""}`}><input type="radio" name="whatsapp-onboarding-mode" checked={onboardingMode === "coexistence"} onChange={() => setOnboardingMode("coexistence")}/><span className="wa-ico">💬</span><strong>WA Business App number</strong><small>Keep using your existing WhatsApp Business app with supported API features.</small><ul><li>No new number required</li><li>App + API together when eligible</li><li>AI replies and chat automation</li><li>Broadcast and catalog features may be limited</li></ul></label>
        <label className={`wa-option ${onboardingMode === "api_only" ? "selected" : ""}`}><input type="radio" name="whatsapp-onboarding-mode" checked={onboardingMode === "api_only"} onChange={() => setOnboardingMode("api_only")}/><span className="wa-ico">⚡</span><strong>New number · API-only</strong><small>Use a fresh number not currently registered with WhatsApp Personal or Business.</small><ul><li>Dedicated platform-based messaging</li><li>API catalog integrations may be available</li><li>AI replies and chat automation</li><li>Mobile app use is not supported for this number</li></ul></label>
      </div>
      <div className="wa-doc-panel"><span className="wa-step">STEP 2 · BUSINESS DETAILS</span><h3>Business verification details</h3><p className="wa-muted">Provide an active business website or GST certificate for your onboarding record. Meta may request additional verification.</p>
        <div className="wa-doc-grid" style={{marginTop:15}}><label className="wa-field">Active business website URL<input type="url" value={websiteUrl} onChange={e=>setWebsiteUrl(e.target.value)} placeholder="https://yourbusiness.com"/></label><label className="wa-field">GST certificate (PDF/JPG/PNG)<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={e=>{setGstFile(e.target.files?.[0]??null);setDocumentPath("");}}/></label></div>
        <p className="wa-muted" style={{marginTop:12}}>You can provide either one. If you provide both, the GST certificate will be uploaded.</p>{gstFile?<p className="form-message">Selected: {gstFile.name} · {(gstFile.size/1024/1024).toFixed(2)} MB</p>:null}{documentPath?<p className="form-message">Business document uploaded securely.</p>:null}
        <p className="wa-privacy" style={{marginTop:13}}>🔒 Upload only business documents you are authorized to share. Documents are stored privately for onboarding review.</p>
      </div>
      {!appId||!configId?<p className="form-message">Meta configuration is pending. Add the Meta App ID and Embedded Signup Configuration ID on the server to launch official signup.</p>:null}
      <button type="button" className="wa-connect" onClick={launchSignup} disabled={busy||documentBusy||!sdkReady||!appId||!configId}>{documentBusy?"Uploading document…":busy?"Connecting WhatsApp…":"Continue to Meta signup →"}</button>
      {error?<p className="form-error" role="alert">{error}</p>:null}{message?<p className="form-message" role="status">{message}</p>:null}
      <p className="auth-foot">Meta determines number eligibility, business verification, display name, broadcast limits, catalog support and calling features.</p>
    </div>
  );
}
}
