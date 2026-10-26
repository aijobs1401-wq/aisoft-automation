"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Minimize2, Send, Sparkles, X } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function WebsiteChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! 👋 I’m the AI SOFT STUDIO assistant. Ask me about our AI chatbot, WhatsApp automation, or getting your workspace set up." }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/public-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12).map(({ role, content }) => ({ role, content })) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The assistant is temporarily unavailable.");
      setMessages(current => [...current, { role: "assistant", content: String(data.reply) }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="website-chat-root">
      {open && <section className="website-chat-panel" aria-label="AI SOFT STUDIO AI assistant">
        <header className="website-chat-header">
          <span className="website-chat-avatar"><Sparkles size={19} /></span>
          <span className="website-chat-title"><strong>AI SOFT STUDIO AI</strong><small><span /> Online assistant</small></span>
          <button type="button" className="website-chat-icon-btn" onClick={() => setOpen(false)} aria-label="Minimize chat"><Minimize2 size={17} /></button>
          <button type="button" className="website-chat-icon-btn" onClick={() => setOpen(false)} aria-label="Close chat"><X size={17} /></button>
        </header>
        <div className="website-chat-messages" ref={scrollRef} aria-live="polite">
          <div className="website-chat-day">AI SOFT STUDIO SUPPORT</div>
          {messages.map((message, index) => <div key={index} className={"website-chat-row " + (message.role === "user" ? "from-user" : "from-bot")}>
            {message.role === "assistant" && <span className="website-chat-mini-avatar"><Bot size={14} /></span>}
            <p>{message.content}</p>
          </div>)}
          {busy && <div className="website-chat-row from-bot"><span className="website-chat-mini-avatar"><Bot size={14} /></span><p className="website-chat-typing"><i /><i /><i /></p></div>}
          {error && <div className="website-chat-error" role="alert">{error}</div>}
        </div>
        <form className="website-chat-compose" onSubmit={submit}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder="Message AI SOFT STUDIO…" maxLength={2000} aria-label="Your message" />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send message"><Send size={17} /></button>
        </form>
        <div className="website-chat-foot">AI can make mistakes. Never share passwords or OTPs.</div>
      </section>}
      <button className={"website-chat-launcher " + (open ? "is-open" : "")} type="button" onClick={() => setOpen(value => !value)} aria-label={open ? "Close AI chat" : "Open AI chat"}>
        {open ? <X size={23} /> : <><MessageCircle size={22} /><span>Ask AI SOFT</span></>}
      </button>
    </div>
  );
}
