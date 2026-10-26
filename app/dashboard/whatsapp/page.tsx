import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bot, Code2, MessageCircle, MessagesSquare, Send, ShieldCheck, Webhook, Sparkles, WandSparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import WhatsAppConnectButton from "./connect-button";

const tools = [
  {
    href: "/dashboard/conversations",
    title: "Incoming messages",
    emoji: "💬",
    description: "Bring customer conversations into one organized inbox.",
    Icon: MessagesSquare,
  },
  {
    href: "/dashboard/campaigns",
    title: "Send messages",
    emoji: "🚀",
    description: "Prepare and manage your outbound messaging campaigns.",
    Icon: Send,
  },
  {
    href: "/dashboard/automation",
    title: "AI auto-reply",
    emoji: "🤖",
    description: "Build smarter replies and automate customer conversations.",
    Icon: Bot,
  },
  {
    href: "/dashboard/api",
    title: "Webhooks & API",
    emoji: "🔗",
    description: "Connect your workspace tools and receive message events.",
    Icon: Webhook,
  },
];

export default async function WhatsAppSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Please%20sign%20in%20to%20connect%20WhatsApp");

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id,role,organizations(name,status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const membership = memberships?.[0];
  const organization = membership?.organizations as { name?: string; status?: string } | null;
  const appId = process.env.META_APP_ID ?? "";
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ?? "";
  const graphVersion = process.env.META_GRAPH_API_VERSION ?? "v23.0";

  return (
    <main className="dashboard-wrap wa-control-center">
      <style>{`
        .wa-control-center{position:relative;isolation:isolate;overflow:hidden;background:#06101f;color:#f4f9ff;border-radius:22px;padding:0 22px 28px;min-height:100vh}\n        .wa-control-center .dash-tile,.wa-control-center .org-panel{background:linear-gradient(145deg,#071d3b 0%,#06152b 72%,#071b35 100%);border:1px solid #168dff72;border-radius:18px;box-shadow:inset 0 1px 0 #ffffff0a,0 12px 32px #0003}\n        .wa-control-center .btn{background:linear-gradient(100deg,#087cff,#08c8ed);color:#fff;border:0;border-radius:12px;box-shadow:0 6px 22px #078bff38}\n        .wa-control-center .sub{color:#a9c3e0}\n        .wa-control-center .dash-nav{border-bottom:1px solid #168dff38;padding-bottom:16px}\n        .wa-control-center .wa-tool-card{background:linear-gradient(135deg,#062647,#071631 70%,#061d3b);min-height:210px}\n        .wa-control-center .wa-hero-title{max-width:780px}\n        .wa-control-center .wa-gradient-text{background-image:linear-gradient(100deg,#28d7f7 0%,#2483ff 48%,#eafaff 100%)}
        .wa-control-center:before{content:"";position:absolute;z-index:-1;pointer-events:none;inset:0 -18vw auto;height:560px;background:radial-gradient(ellipse at 18% 20%,#1678ff25,transparent 42%),radial-gradient(ellipse at 76% 8%,#20d8ed18,transparent 38%);animation:waAura 9s ease-in-out infinite alternate}
        .wa-control-center .dash-nav{position:relative;z-index:1}
        .wa-control-center .brand .logo{box-shadow:0 0 25px #2483ff42;animation:waLogoPulse 3.5s ease-in-out infinite}
        .wa-hero{position:relative;padding:48px 0 28px;max-width:900px}
        .wa-kicker{display:inline-flex;align-items:center;gap:9px;padding:8px 13px;border:1px solid #38bdf855;border-radius:999px;background:#0a2545b8;color:#a9e7ff;font-size:11px;font-weight:800;letter-spacing:.12em;box-shadow:0 0 28px #2483ff12}
        .wa-live-dot{width:7px;height:7px;border-radius:50%;background:#42e6b5;box-shadow:0 0 0 5px #42e6b51b,0 0 15px #42e6b5;animation:waBlink 1.8s ease-in-out infinite}
        .wa-hero-title{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:clamp(34px,5vw,54px);letter-spacing:-.055em;line-height:1.08;margin:20px 0 13px}
        .wa-gradient-text{background:linear-gradient(100deg,#fff 4%,#8de7ff 43%,#6da4ff 70%,#fff 95%);background-size:220% auto;background-clip:text;-webkit-background-clip:text;color:transparent;animation:waShimmer 6s linear infinite}
        .wa-wand{display:inline-grid;place-items:center;width:47px;height:47px;border:1px solid #4bb9ff50;border-radius:15px;background:linear-gradient(140deg,#2386ff2d,#28d7f718);color:#8de8ff;box-shadow:0 0 30px #2483ff22;animation:waWandFloat 3s ease-in-out infinite}
        .wa-wand svg{animation:waWandSpin 7s ease-in-out infinite}
        .wa-hero-copy{max-width:700px;margin:0;color:#9fb4cc;font-size:14px;line-height:1.85}
        .wa-hero-chips{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}
        .wa-hero-chip{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid #ffffff12;border-radius:10px;background:#ffffff05;color:#bfd0e4;font-size:11px;animation:waRise .7s both}
        .wa-hero-chip:nth-child(2){animation-delay:.12s}.wa-hero-chip:nth-child(3){animation-delay:.24s}
        .wa-panel{position:relative;overflow:hidden}
        .wa-panel:before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,#35bfff99,#28d7f788,transparent)}
        .wa-panel-heading{display:flex;align-items:center;gap:10px}
        .wa-panel-heading .wa-heading-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,#2483ff28,#28d7f714);border:1px solid #2483ff35;color:#8be8ff}
        .wa-panel-heading h2{margin:0!important}
        .wa-workspace-pill{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;border:1px solid #ffffff16;background:#ffffff05;color:#b9cce2;font-size:11px}
        .wa-tools-heading{display:flex;align-items:end;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .wa-tools-heading h2{margin:13px 0 4px;font-size:25px;letter-spacing:-.04em}
        .wa-tool-card{position:relative;overflow:hidden;transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease}
        .wa-tool-card:before{content:"";position:absolute;inset:-80% auto -80% -35%;width:45%;transform:rotate(22deg);background:linear-gradient(90deg,transparent,#ffffff09,transparent);transition:left .55s ease;pointer-events:none}
        .wa-tool-card:hover{transform:translateY(-5px);border-color:#398cff7a;box-shadow:0 18px 45px #0003,0 0 24px #2483ff0d}
        .wa-tool-card:hover:before{left:120%}
        .wa-tool-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .wa-tool-emoji{display:grid;place-items:center;width:45px;height:45px;border-radius:14px;border:1px solid #ffffff13;background:linear-gradient(145deg,#ffffff0b,#2483ff0b);font-size:22px;animation:waEmojiBob 4s ease-in-out infinite}
        .wa-tool-card:nth-child(2) .wa-tool-emoji{animation-delay:.35s}.wa-tool-card:nth-child(3) .wa-tool-emoji{animation-delay:.7s}.wa-tool-card:nth-child(4) .wa-tool-emoji{animation-delay:1.05s}
        .wa-tool-arrow{color:#77cfff;transition:transform .2s}.wa-tool-card:hover .wa-tool-arrow{transform:translateX(4px)}
        .wa-checklist li{justify-content:flex-start!important;align-items:flex-start!important;color:#b8c9de;font-size:12px}
        .wa-checklist li:before{content:"✓";flex:0 0 auto;color:#4de0b3;font-weight:900;margin-right:9px}
        @keyframes waAura{from{opacity:.55;transform:translateY(-8px)}to{opacity:1;transform:translateY(10px)}}
        @keyframes waLogoPulse{0%,100%{box-shadow:0 0 18px #2483ff25}50%{box-shadow:0 0 29px #28d7f745}}
        @keyframes waBlink{0%,100%{opacity:1}50%{opacity:.45}}
        @keyframes waShimmer{0%{background-position:0% center}100%{background-position:220% center}}
        @keyframes waWandFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-7px) rotate(4deg)}}
        @keyframes waWandSpin{0%,80%,100%{transform:rotate(0) scale(1)}88%{transform:rotate(-22deg) scale(1.12)}94%{transform:rotate(18deg) scale(1.08)}}
        @keyframes waEmojiBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes waRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media(prefers-reduced-motion:reduce){.wa-control-center *, .wa-control-center:before{animation:none!important;transition:none!important}}
        @media(max-width:620px){.wa-hero{padding-top:35px}.wa-hero-title{font-size:35px;gap:10px}.wa-wand{width:40px;height:40px}.wa-hero-copy{font-size:13px}.wa-tool-card:hover{transform:none}}
      `}</style>

      <header className="dash-nav">
        <Link className="brand" href="/"><span className="logo">AI</span><span>AI SOFT STUDIO</span></Link>
        <div className="dash-user"><Link href="/dashboard">← Back to dashboard</Link></div>
      </header>

      <section className="wa-hero">
        <span className="wa-kicker"><span className="wa-live-dot" /> AI POWERED <span aria-hidden="true">✨</span></span>
        <h1 className="wa-hero-title"><span className="wa-gradient-text">WhatsApp Control Center</span><span className="wa-wand" aria-label="Magic automation"><WandSparkles size={25} /></span></h1>
        <p className="wa-hero-copy">Manage your WhatsApp business, automate conversations, and grow your audience — all in one place. 🪄</p>
        <div className="wa-hero-chips">
          <span className="wa-hero-chip">🔐 Official Meta onboarding</span>
          <span className="wa-hero-chip">🤖 AI-powered automation</span>
          <span className="wa-hero-chip">💬 Customer conversations</span>
        </div>
      </section>

      <section className="dash-tile org-panel wa-panel">
        <div className="wa-panel-heading"><span className="wa-heading-icon"><MessageCircle size={20} /></span><h2>Connect your WhatsApp</h2></div>
        {error || !membership ? (
          <div>
            <p className="form-error">No workspace membership was found. Create or finish your workspace first, then return here.</p>
            <p><Link className="btn" href="/dashboard/workspace/new">✨ Create workspace</Link></p>
          </div>
        ) : (
          <>
            <p><strong>🏢 {organization?.name ?? "Your workspace"}</strong></p>
            <p className="sub">👤 Role: {membership.role} · Workspace status: {organization?.status ?? "pending"}</p>
            <WhatsAppConnectButton organizationId={membership.organization_id} appId={appId} configId={configId} graphVersion={graphVersion} />
          </>
        )}
        <p className="sub" style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <ShieldCheck size={16} /> <span>🔒 Secure setup using Meta’s WhatsApp Cloud API onboarding. Your app secret and access tokens stay server-side.</span>
        </p>
      </section>

      <section className="dash-welcome" style={{ paddingBottom: 8 }}>
        <div className="wa-tools-heading"><div><span className="eyebrow">✨ YOUR AUTOMATION TOOLKIT</span><h2>Everything you need, in one place</h2></div><span className="wa-workspace-pill"><Sparkles size={14} /> Smart workspace tools</span></div>
        <p className="sub">Jump straight into the tools that help your team respond faster and work smarter.</p>
      </section>

      <section className="dash-grid">
        {tools.map(({ href, title, emoji, description, Icon }) => (
          <article className="dash-tile org-panel wa-tool-card" key={href}>
            <div className="wa-tool-top"><span className="wa-tool-emoji" aria-hidden="true">{emoji}</span><Icon className="wa-tool-arrow" size={20} /></div>
            <h2>{title}</h2>
            <p className="sub">{description}</p>
            <Link className="btn" href={href}>Open {title} <span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </section>

      <section className="dash-tile org-panel wa-panel">
        <div className="wa-panel-heading"><span className="wa-heading-icon"><ShieldCheck size={20} /></span><h2>Before you connect</h2></div>
        <ul className="wa-checklist">
          <li>Meta app has an Embedded Signup configuration and the required WhatsApp permissions.</li>
          <li>For Coexistence, Meta confirms that your existing WhatsApp Business App number is eligible.</li>
          <li>🔐 Keep the Meta app secret, Supabase service-role key and encryption key private.</li>
          <li>🧪 Test sending and receiving with an authorized test number before enabling automation for customers.</li>
        </ul>
      </section>
    </main>
  );
}
