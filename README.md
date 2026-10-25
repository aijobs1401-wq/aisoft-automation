# AI SOFT STUDIO — WhatsApp Automation SaaS

A multi-tenant WhatsApp automation platform using Next.js, Supabase, and the official Meta WhatsApp Cloud API.

## Status

This repository is being initialized. The files added in this first scaffold are a starting point, not a production-ready SaaS. Meta Embedded Signup, token encryption, complete authentication screens, webhook event processing, messaging, tenant authorization tests, and deployment verification must be completed before real client use.

## Planned modules

- Public landing page and authentication
- Super Admin client and plan management
- Isolated client workspaces
- WhatsApp connection via Meta Embedded Signup
- Conversations, contacts, automation, campaigns, reports
- Supabase PostgreSQL with Row-Level Security
- Verified Meta webhooks and server-side message sending

## Requirements

- Node.js 20+
- Supabase project
- Meta developer app with WhatsApp product configured

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill values from your own Supabase and Meta projects.
3. Apply `supabase/migrations/0001_initial.sql` in Supabase SQL Editor.
4. Run `npm run dev`.

Never commit real secrets. Do not expose service-role keys or Meta app secrets in browser code.
