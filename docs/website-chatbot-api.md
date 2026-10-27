# Website AI Chatbot API v1

This branch adds a hosted website chat widget. A client pastes one script tag into their website; the chat UI calls AI SOFT STUDIO's Render API and the server calls OpenAI. Customers do not receive your OpenAI key or Supabase service-role key.

## Before testing
1. Apply supabase/migrations/202610280001_website_chatbot_api.sql in Supabase SQL Editor.
2. Confirm Render has server-only SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, and OPENAI_API_KEY. Never expose secrets through NEXT_PUBLIC variables.
3. Deploy this branch after review.
4. Sign in as a workspace owner/admin and open /dashboard/website-bot.
5. Add the exact website origins, save bot instructions and plan, generate a widget key, then copy the embed snippet.
6. Test from the registered origin and from an unregistered origin.

## Embed snippet
The dashboard generates this format:
<script src="https://aisoft-automation.onrender.com/aisoft-chat.js" data-key="gfw_pub_YOUR_WIDGET_KEY" data-title="Ask our team" data-color="#176747" defer></script>

Place it before the closing body tag. The key is a publishable, origin-restricted widget key, not an OpenAI secret. Revoke it if it leaks.

## API
POST https://aisoft-automation.onrender.com/api/v1/chat
Headers: Content-Type: application/json and X-Widget-Key: gfw_pub_...
Body: {"messages":[{"role":"user","content":"What are your opening hours?"}]}
Response: {"reply":"...","botName":"Website Assistant"}

## Quota plans (editable starting suggestions)
Starter: 1,000 messages/month; Growth: 10,000; Pro: 50,000. The current code enforces these quotas server-side and meters each visitor prompt with an atomic database RPC. The plan selection is not a payment subscription; billing/checkout and automatic plan changes are not implemented yet.

## Security and launch notes
- The SQL migration creates tenant-specific bot settings, hashed widget keys, monthly usage records, RLS for workspace configuration, and an atomic quota function. Apply it before deploying or requests will fail closed.
- Widget key plaintext is shown only when generated. Database stores only its SHA-256 hash.
- Origins are checked on the server for every chat request. The OPTIONS preflight allows browser headers but does not authorize a chat; POST still enforces the allowlist.
- The public widget key is visible to site visitors by design; use exact allowed origins, quotas, revocation, and server-side secrets.
- Add durable per-IP/per-key burst rate limiting, alerting, payment integration, privacy/retention controls, and human handoff before wide commercial launch.
- API quota currently counts attempted visitor prompts before the AI provider call, so failed provider attempts can consume quota. Consider a reservation/refund ledger if you need billing-grade metering.
