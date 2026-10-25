# WhatsApp Cloud API / Embedded Signup v4 setup

## Render environment variables

Set these values on the `aisoft-automation` Render web service. Never prefix server secrets with `NEXT_PUBLIC_`.

- `NEXT_PUBLIC_SUPABASE_URL`: existing Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: existing Supabase publishable key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase server-only service-role key; needed for verified webhook writes and private token storage
- `META_APP_ID`: Meta app ID
- `META_APP_SECRET`: Meta app secret
- `META_EMBEDDED_SIGNUP_CONFIG_ID`: configuration ID created for Embedded Signup v4
- `META_WEBHOOK_VERIFY_TOKEN`: generated on Render; use the exact saved value when configuring the Meta webhook
- `WHATSAPP_TOKEN_ENCRYPTION_KEY`: generated on Render; do not rotate it without re-encrypting stored connection tokens
- `META_GRAPH_API_VERSION`: Graph API version, currently set to `v23.0`
- `APP_BASE_URL`: `https://aisoft-automation.onrender.com`

## Meta app setup

1. In Meta for Developers, create/select the Business app and add WhatsApp.
2. Set up **Facebook Login for Business** and create a new **WhatsApp Embedded Signup v4** configuration. Do not use legacy v2/v3 configurations.
3. Configure the coexistence flow using `featureType: whatsapp_business_app_onboarding`. The app/user/number must be eligible; the app cannot bypass Meta review or verification.
4. Configure Facebook Login for Business allowed domains / JavaScript SDK settings for `aisoft-automation.onrender.com` and any production custom domain.
5. In the Meta app's WhatsApp webhook configuration, set callback URL to:
   `https://aisoft-automation.onrender.com/api/whatsapp/webhook`
6. Enter the exact Render value of `META_WEBHOOK_VERIFY_TOKEN` as the Verify Token.
7. Subscribe to `messages`. For coexistence, also subscribe to `smb_message_echoes`, `smb_app_state_sync`, and `history` if available for the app/configuration. The webhook currently persists all signed event payloads and processes inbound messages, message statuses, and app-message echoes.
8. Complete any required Meta Tech Provider verification, App Review, and Advanced Access approvals before onboarding external customers.

## What the application implements

- Authenticated client workspace entry point at `/dashboard/whatsapp`.
- Server-side authorization-code exchange; access token is never returned to the browser.
- AES-256-GCM encrypted access-token storage in `public.whatsapp_connection_secrets`, with RLS enabled and no client-role grants.
- WABA webhook subscription after successful onboarding.
- `X-Hub-Signature-256` verification and WhatsApp webhook challenge verification.
- Tenant-scoped contacts, conversations, inbound messages, delivery statuses, and coexistence app-message echoes.
- Server-only text-send endpoint at `POST /api/whatsapp/messages/send`, limited to existing conversations inside the 24-hour customer-service window. Approved template sending is not implemented yet.

## References

- Meta Embedded Signup: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/
- Meta Embedded Signup v4: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4
- Meta coexistence onboarding: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
