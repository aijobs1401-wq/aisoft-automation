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
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "WhatsApp connection failed.");
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
