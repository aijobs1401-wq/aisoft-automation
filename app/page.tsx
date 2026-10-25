"use client";

import { ArrowUpRight, Bot, Check, ChevronRight, MessageCircle, ShieldCheck, Workflow, Zap, Users, ChartNoAxesCombined, Sparkles, CirclePlay } from "lucide-react";

const features = [
  { icon: MessageCircle, title: "One shared inbox", body: "Give your team one place to manage customer conversations and keep every handoff clear." },
  { icon: Workflow, title: "Visual automations", body: "Plan welcome flows, FAQs and follow-ups with clear rules and human handoff points." },
  { icon: Users, title: "Client workspaces", body: "Keep each client’s workspace and access separated as your service grows." },
  { icon: ChartNoAxesCombined, title: "Campaign visibility", body: "Bring approved templates, opted-in contacts and delivery events into one operating view." },
  { icon: ShieldCheck, title: "Official Meta onboarding", body: "Connect eligible WhatsApp Business accounts through Meta’s supported onboarding flow." },
  { icon: Bot, title: "AI-assisted support", body: "Create a foundation for smarter replies while keeping people in control of important decisions." }
];

const steps = [
  { number: "01", title: "Connect", body: "Connect an eligible WhatsApp Business account through Meta." },
  { number: "02", title: "Configure", body: "Set up your team, approved templates and automation rules." },
  { number: "03", title: "Operate", body: "Manage conversations and monitor activity from one workspace." }
];

export default function Home() {
  return (
    <main className="marketing">
      <div className="marketing-wrap">
        <header className="marketing-nav">
          <a className="marketing-brand" href="/" aria-label="AI SOFT STUDIO home">
            <span className="marketing-logo"><Sparkles size={21} strokeWidth={2.4} /></span>
            <span><strong>AI SOFT STUDIO</strong><small>MESSAGING AUTOMATION</small></span>
          </a>
          <nav className="marketing-links" aria-label="Main navigation">
            <a href="#platform">Platform</a><a href="#features">Features</a><a href="#how-it-works">How it works</a>
          </nav>
          <div className="marketing-nav-actions"><a className="marketing-signin" href="/login">Sign in</a><a className="marketing-cta small" href="/login">Open dashboard <ArrowUpRight size={16} /></a></div>
        </header>

        <section className="marketing-hero" id="platform">
          <div className="marketing-copy">
            <div className="marketing-kicker"><span className="live-dot" /> A smarter way to manage business messaging</div>
            <h1>Turn conversations into <span>customer connections.</span></h1>
            <p className="marketing-lead">A modern workspace for WhatsApp support and automation. Bring conversations, client accounts and repeatable workflows together—without losing sight of the human behind every message.</p>
            <div className="marketing-actions"><a className="marketing-cta" href="/login">Get started <ArrowUpRight size={18} /></a><a className="marketing-watch" href="#how-it-works"><CirclePlay size={19} /> See how it works</a></div>
            <div className="marketing-trust"><span><Check size={15} /> Multi-client ready</span><span><Check size={15} /> Security-minded design</span><span><Check size={15} /> Meta onboarding flow</span></div>
          </div>
          <div className="product-stage" aria-label="Illustrative product interface preview">
            <div className="stage-glow" />
            <div className="product-window">
              <div className="window-top"><div className="window-brand"><span className="mini-logo"><Sparkles size={14} /></span><strong>Studio workspace</strong></div><span className="preview-label">PRODUCT PREVIEW</span></div>
              <div className="window-body">
                <aside className="mock-sidebar"><div className="mock-side-active"><MessageCircle size={16} /> Inbox <span>3</span></div><div><Workflow size={16} /> Automations</div><div><Users size={16} /> Contacts</div><div><ChartNoAxesCombined size={16} /> Analytics</div><div><ShieldCheck size={16} /> Connections</div><div className="mock-side-bottom"><span className="avatar">AS</span><span><strong>Workspace admin</strong><small>Owner access</small></span></div></aside>
                <div className="mock-main"><div className="mock-heading"><div><small>OVERVIEW</small><h3>Good afternoon 👋</h3><p>Here’s your workspace at a glance.</p></div><span className="date-pill">Today <ChevronRight size={13} /></span></div>
                  <div className="mock-metrics"><div><small>Conversations</small><strong>—</strong><span>Connect to begin</span></div><div><small>Automations</small><strong>—</strong><span>Not configured</span></div><div><small>Connected numbers</small><strong>0</strong><span>Awaiting setup</span></div></div>
                  <div className="mock-bottom"><div className="mock-activity"><div className="mock-section-title"><strong>Activity overview</strong><small>Sample visual</small></div><div className="mock-chart">{[31,48,39,63,48,76,57,89,67,81,54,73].map((h,i)=><span key={i} style={{height:h+"%"}} />)}</div><div className="mock-chart-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div><div className="mock-setup"><div className="setup-icon"><Zap size={17} /></div><strong>Finish your setup</strong><p>Connect your WhatsApp Business account to begin.</p><a href="/login">Continue setup <ArrowUpRight size={13} /></a></div></div>
                </div>
              </div>
            </div>
            <div className="floating-note"><span className="floating-icon"><ShieldCheck size={18} /></span><span><strong>Designed with control in mind</strong><small>Clear access. Clear workflows.</small></span></div>
          </div>
        </section>

        <section className="marketing-proof"><div><strong>One workspace</strong><span>for customer conversations</span></div><div><strong>Built for teams</strong><span>and service providers</span></div><div><strong>Official integration path</strong><span>through Meta onboarding</span></div><div><strong>Human-led control</strong><span>for important actions</span></div></section>

        <section className="marketing-section" id="features"><div className="section-heading"><span className="marketing-eyebrow">THE PLATFORM</span><h2>Everything starts with a better workflow.</h2><p>Organize the essentials today, then build out your messaging operations as your business grows.</p></div><div className="marketing-features">{features.map(({icon: Icon,title,body},i)=><article className="marketing-feature" key={title}><div className={"marketing-feature-icon icon-"+i}><Icon size={21} strokeWidth={1.8} /></div><span className="feature-number">0{i+1}</span><h3>{title}</h3><p>{body}</p><a href="/login">Explore workspace <ArrowUpRight size={15} /></a></article>)}</div></section>

        <section className="workflow-section" id="how-it-works"><div className="workflow-intro"><span className="marketing-eyebrow">SIMPLE BY DESIGN</span><h2>From setup to smoother conversations.</h2><p>Start with the essentials. Add automation when your account, templates and customer journey are ready.</p><a className="marketing-cta" href="/login">Go to your workspace <ArrowUpRight size={17} /></a></div><div className="workflow-steps">{steps.map(step=><div className="workflow-step" key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.body}</p></div><ChevronRight size={19} /></div>)}</div></section>

        <section className="marketing-bottom-cta"><div className="bottom-cta-mark"><Sparkles size={23} /></div><div><span className="marketing-eyebrow">READY WHEN YOU ARE</span><h2>Your workspace starts here.</h2><p>Sign in to manage your workspace and continue setup.</p></div><a className="marketing-cta" href="/login">Open dashboard <ArrowUpRight size={18} /></a></section>
        <footer className="marketing-footer"><a className="marketing-brand" href="/"><span className="marketing-logo"><Sparkles size={18} /></span><span><strong>AI SOFT STUDIO</strong><small>MESSAGING AUTOMATION</small></span></a><span>© {new Date().getFullYear()} AI SOFT STUDIO. All rights reserved.</span><div><a href="/login">Sign in</a><a href="#features">Features</a></div></footer>
        <p className="marketing-disclaimer">Product preview is illustrative. Live WhatsApp messaging depends on successful Meta onboarding, account eligibility, permissions, templates and webhook configuration.</p>
      </div>
    </main>
  );
}
