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
    setError("");
    setMessage("");
    setCode("");
    setSessionInfo(null);
    submitted.current = false;
    if (!appId || !configId) {
      setError("Meta setup is not complete yet. Admin must configure META_APP_ID, META_APP_SECRET, and META_EMBEDDED_SIGNUP_CONFIG_ID on the server.");
      return;
    }
    if (!window.FB || !sdkReady) {
      setError("Meta login is still loading. Wait a moment and try again.");
      return;
    }
    window.FB.login(response => {
      const authCode = response?.authResponse?.code;
      if (authCode) setCode(String(authCode));
      else if (response?.status !== "connected") setError("Meta login did not return an authorization code. Check app mode, allowed domains, and test-user access.");
    }, {
      config_id: configId,
      auth_type: "rerequest",
      response_type: "code",
      override_default_response_type: true,
      extras: onboardingMode === "coexistence"
        ? { setup: {}, featureType: "whatsapp_business_app_onboarding" }
        : { setup: {} }
    });
  }

  return (
    <div className="auth-form">
      <fieldset className="onboarding-choice" style={{ border: "1px solid var(--border, #26364d)", borderRadius: 12, padding: 16, margin: "0 0 16px" }}>
        <legend style={{ padding: "0 8px", fontWeight: 700 }}>Choose number setup</legend>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "8px 0", cursor: "pointer" }}>
          <input type="radio" name="whatsapp-onboarding-mode" value="coexistence" checked={onboardingMode === "coexistence"} onChange={() => setOnboardingMode("coexistence")} />
          <span><strong>Keep WhatsApp Business App (Coexistence)</strong><br /><span className="sub">Use an eligible existing Business App number while keeping the app available.</span></span>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "8px 0", cursor: "pointer" }}>
          <input type="radio" name="whatsapp-onboarding-mode" value="api_only" checked={onboardingMode === "api_only"} onChange={() => setOnboardingMode("api_only")} />
          <span><strong>New / API-only number</strong><br /><span className="sub">Set up a number for the WhatsApp Business Platform without the coexistence flow.</span></span>
        </label>
      </fieldset>
      {!appId || !configId ? (
        <p className="form-message">Meta configuration is pending. Once the Meta App ID and Embedded Signup v4 Configuration ID are added, this button will launch the official Meta flow.</p>
      ) : null}
      <button type="button" className="btn auth-submit" onClick={launchSignup} disabled={busy || !sdkReady || !appId || !configId}>
        {busy ? "Connecting WhatsApp…" : "Connect WhatsApp Business"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-message" role="status">{message}</p> : null}
      <p className="auth-foot">For existing WhatsApp Business App numbers, Meta will show the coexistence option only when the business and number are eligible. The app cannot force eligibility or bypass Meta verification.</p>
    </div>
  );
}  return (
    <div className="wa-onboarding">
      <style>{`
        .wa-onboarding{display:grid;gap:22px}.wa-step-label{font-size:10px;letter-spacing:.14em;color:#85caff;font-weight:800}.wa-onboarding h3{margin:8px 0;font-size:19px;letter-spacing:-.03em}.wa-onboarding .wa-muted{color:#9aabc2;font-size:12px;line-height:1.75;margin:0}.wa-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.wa-option{position:relative;display:flex;flex-direction:column;gap:11px;padding:18px;border:1px solid #273c57;border-radius:17px;background:linear-gradient(145deg,#10223a,#0a1727);cursor:pointer;transition:border-color .2s,transform .2s}.wa-option:hover{border-color:#398cff;transform:translateY(-2px)}.wa-option.selected{border-color:#328cff;box-shadow:0 0 0 1px #328cff30,inset 0 0 30px #247fff0b}.wa-option input{position:absolute;right:15px;top:15px;accent-color:#2587ff;width:16px;height:16px}.wa-option-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#247fff20;color:#7cdcff;font-size:20px}.wa-option strong{font-size:14px;display:block;padding-right:15px}.wa-option small{font-size:11px;line-height:1.7;color:#9aabc2}.wa-points{display:grid;gap:8px;margin-top:3px}.wa-points span{display:flex;align-items:flex-start;gap:7px;color:#c7d6e8;font-size:11px;line-height:1.6}.wa-points i{font-style:normal;color:#5bdcb4}.wa-document-panel{padding:19px;border:1px solid #263d59;border-radius:17px;background:#0a1726}.wa-doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:15px}.wa-field{display:grid;gap:8px;color:#dce8f8;font-size:12px;font-weight:650}.wa-field input{min-width:0;width:100%;padding:12px;border:1px solid #2b425e;border-radius:11px;background:#071321;color:#f5f8ff;font:inherit;font-size:12px}.wa-field input:focus{outline:2px solid #2587ff55;border-color:#2587ff}.wa-doc-note{display:flex;gap:9px;padding:11px 12px;margin-top:14px;border-radius:11px;background:#2483ff0c;color:#a7c8ed;font-size:11px;line-height:1.7}.wa-divider{display:flex;align-items:center;gap:10px;margin:13px 0;color:#7187a4;font-size:10px}.wa-divider:before,.wa-divider:after{content:"";height:1px;flex:1;background:#24374f}.wa-connect-btn{width:100%;min-height:48px;border:0;border-radius:12px;background:linear-gradient(110deg,#267cf3,#20b9db);color:white;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 10px 24px #167df32a}.wa-connect-btn:disabled{opacity:.55;cursor:wait}.wa-onboarding .form-error,.wa-onboarding .form-message{font-size:12px;line-height:1.7;overflow-wrap:anywhere}.wa-legal{color:#8196b1;font-size:10px;line-height:1.7;text-align:center}@media(max-width:640px){.wa-options,.wa-doc-grid{grid-template-columns:1fr}.wa-option{padding:15px}.wa-onboarding h3{font-size:17px}}
      `}</style>
      <div><span className="wa-step-label">STEP 1 · CHOOSE YOUR NUMBER TYPE</span><h3>How do you want to connect?</h3><p className="wa-muted">Choose the option that matches your business. Meta will confirm eligibility during its official onboarding.</p></div>
      <div className="wa-options">
        <label className={`wa-option ${onboardingMode === "coexistence" ? "selected" : ""}`}>
          <input type="radio" name="whatsapp-onboarding-mode" value="coexistence" checked={onboardingMode === "coexistence"} onChange={() => setOnboardingMode("coexistence")} />
          <span className="wa-option-icon">💬</span><strong>WA Business App number</strong><small>Keep using your existing WhatsApp Business app with supported API features.</small>
          <div className="wa-points"><span><i>✓</i> No new number required</span><span><i>✓</i> App and API can work together when eligible</span><span><i>✓</i> AI replies and chat automation</span><span><i>!</i> Broadcast speed and catalog features may be limited</span></div>
        </label>
        <label className={`wa-option ${onboardingMode === "api_only" ? "selected" : ""}`}>
          <input type="radio" name="whatsapp-onboarding-mode" value="api_only" checked={onboardingMode === "api_only"} onChange={() => setOnboardingMode("api_only")} />
          <span className="wa-option-icon">⚡</span><strong>New number · API-only</strong><small>Use a fresh number that is not registered with WhatsApp Personal or Business.</small>
          <div className="wa-points"><span><i>✓</i> Built for platform-based messaging</span><span><i>✓</i> API catalog and integrations may be available</span><span><i>✓</i> AI replies and chat automation</span><span><i>!</i> WhatsApp mobile app use is not supported for this number</span></div>
        </label>
      </div>
      <div className="wa-document-panel">
        <span className="wa-step-label">STEP 2 · BUSINESS DETAILS</span><h3>Verify your business details</h3><p className="wa-muted">Provide an active business website or upload a GST certificate for your onboarding record. Meta may request additional verification depending on your account.</p>
        <div className="wa-doc-grid">
          <label className="wa-field">Business website URL <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://yourbusiness.com" /></label>
          <label className="wa-field">GST certificate (PDF, JPG or PNG)<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={e => {setGstFile(e.target.files?.[0] ?? null);setDocumentPath("");}} /></label>
        </div>
        <div className="wa-divider">OR</div><p className="wa-muted">You can provide either a website URL or a GST certificate. If both are provided, the certificate is uploaded securely.</p>
        {gstFile ? <p className="form-message">Selected document: {gstFile.name} · {(gstFile.size/1024/1024).toFixed(2)} MB</p> : null}
        {documentPath ? <p className="form-message">Business document uploaded securely.</p> : null}
        <div className="wa-doc-note"><span>🔒</span><span>Documents are intended for business onboarding review. Upload only documents you are authorized to share. Do not upload passwords or payment card details.</span></div>
      </div>
      {!appId || !configId ? <p className="form-message">Meta configuration is pending. Once the Meta App ID and Embedded Signup Configuration ID are added on the server, the official signup flow can launch.</p> : null}
      <button type="button" className="wa-connect-btn" onClick={launchSignup} disabled={busy || documentBusy || !sdkReady || !appId || !configId}>{documentBusy ? "Uploading business document…" : busy ? "Connecting WhatsApp…" : "Continue to Meta signup →"}</button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}{message ? <p className="form-message" role="status">{message}</p> : null}
      <p className="wa-legal">Meta decides number eligibility and business verification. Display-name approval, broadcast limits, catalog support and calling features depend on Meta’s current policies and account setup.</p>
    </div>
  ); client";

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
    setError("");
    setMessage("");
    setCode("");
    setSessionInfo(null);
    submitted.current = false;
    if (!appId || !configId) {
      setError("Meta setup is not complete yet. Admin must configure META_APP_ID, META_APP_SECRET, and META_EMBEDDED_SIGNUP_CONFIG_ID on the server.");
      return;
    }
    if (!window.FB || !sdkReady) {
      setError("Meta login is still loading. Wait a moment and try again.");
      return;
    }
    window.FB.login(response => {
      const authCode = response?.authResponse?.code;
      if (authCode) setCode(String(authCode));
      else if (response?.status !== "connected") setError("Meta login did not return an authorization code. Check app mode, allowed domains, and test-user access.");
    }, {
      config_id: configId,
      auth_type: "rerequest",
      response_type: "code",
      override_default_response_type: true,
      extras: onboardingMode === "coexistence"
        ? { setup: {}, featureType: "whatsapp_business_app_onboarding" }
        : { setup: {} }
    });
  }

  return (
    <div className="auth-form">
      <fieldset className="onboarding-choice" style={{ border: "1px solid var(--border, #26364d)", borderRadius: 12, padding: 16, margin: "0 0 16px" }}>
        <legend style={{ padding: "0 8px", fontWeight: 700 }}>Choose number setup</legend>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "8px 0", cursor: "pointer" }}>
          <input type="radio" name="whatsapp-onboarding-mode" value="coexistence" checked={onboardingMode === "coexistence"} onChange={() => setOnboardingMode("coexistence")} />
          <span><strong>Keep WhatsApp Business App (Coexistence)</strong><br /><span className="sub">Use an eligible existing Business App number while keeping the app available.</span></span>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "8px 0", cursor: "pointer" }}>
          <input type="radio" name="whatsapp-onboarding-mode" value="api_only" checked={onboardingMode === "api_only"} onChange={() => setOnboardingMode("api_only")} />
          <span><strong>New / API-only number</strong><br /><span className="sub">Set up a number for the WhatsApp Business Platform without the coexistence flow.</span></span>
        </label>
      </fieldset>
      {!appId || !configId ? (
        <p className="form-message">Meta configuration is pending. Once the Meta App ID and Embedded Signup v4 Configuration ID are added, this button will launch the official Meta flow.</p>
      ) : null}
      <button type="button" className="btn auth-submit" onClick={launchSignup} disabled={busy || !sdkReady || !appId || !configId}>
        {busy ? "Connecting WhatsApp…" : "Connect WhatsApp Business"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-message" role="status">{message}</p> : null}
      <p className="auth-foot">For existing WhatsApp Business App numbers, Meta will show the coexistence option only when the business and number are eligible. The app cannot force eligibility or bypass Meta verification.</p>
    </div>
  );
}
