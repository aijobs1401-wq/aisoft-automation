# Implementation status

## Added in initial scaffold
- Next.js marketing homepage and responsive styling
- Login placeholder route (not real authentication)
- Supabase schema for organizations, memberships, WhatsApp connections, contacts, conversations, messages and webhook event storage
- Initial tenant-scoped read policies
- Environment-variable template

## Not implemented yet
- Supabase Auth login, registration, password reset and session middleware
- Secure first-admin bootstrap and role/permission model
- Organization creation and membership invitation flows
- Token encryption/decryption and secret rotation
- Meta Embedded Signup flow and server-side authorization-code exchange
- WhatsApp Cloud API send endpoint and webhook signature validation/event processor
- Automation builder, campaigns, subscription billing, usage quotas and audit logging
- Automated security tests, end-to-end tests and deployment verification

## Security notes
- Never use the Supabase service-role key in client components or NEXT_PUBLIC variables.
- Never trust a client-supplied organization ID without checking membership and role server-side.
- Do not store access tokens in plaintext. token_ciphertext is only a placeholder; encryption/decryption is not implemented.
- Verify Meta webhook signatures using the raw request body and app secret before processing events.
- Use durable retries and idempotent event processing.
- Respect WhatsApp opt-in, opt-out and approved-template policies.
- The current database policies provide limited read access only and do not yet provide production write workflows.
