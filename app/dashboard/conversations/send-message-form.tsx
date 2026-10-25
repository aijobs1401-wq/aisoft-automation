"use client";

import { useState, type FormEvent } from "react";

export default function SendMessageForm({
  organizationId,
  connectionId,
  conversationId
}: {
  organizationId: string;
  connectionId: string;
  conversationId: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/whatsapp/messages/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, connectionId, conversationId, text })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message could not be sent.");
      setText("");
      setMessage("Message accepted by Meta.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={send}>
      <label>Reply to customer
        <textarea required maxLength={4096} rows={3} value={text} onChange={event => setText(event.target.value)} placeholder="Type a reply…" />
      </label>
      <button className="btn auth-submit" type="submit" disabled={busy || !text.trim()}>{busy ? "Sending…" : "Send WhatsApp reply"}</button>
      <p className="auth-foot">Free-form replies are allowed only within 24 hours of the customer's latest message. Approved template messages are not enabled yet.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </form>
  );
}
