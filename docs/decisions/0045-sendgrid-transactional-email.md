---
title: "SendGrid for Transactional Email"
id: ADR_0045
status: accepted
layer: decision
created: 2026-03-03
updated: 2026-04-22
---

> **Clarification 2026-04-22 (ADR-0179 / Wave H):** `packages/notifications` is the single dispatch surface for all transactional email and SMS. Browser-originated dispatch routes through Next.js route handlers (Node runtime) which import `@smartout/notifications` directly. Edge Functions (Deno) MUST route dispatch through a Next.js route handler or a server-internal callback rather than re-implementing dispatch in Deno. The previous `create-invitation` Edge Function silently violated this by hand-rolling `fetch` to SendGrid — fixed by Wave H deletion.

# ADR-0045: SendGrid for Transactional Email Over Resend

## Context and Problem Statement

Module 1 documentation references "Resend" as the email provider for sending invitations. The actual implementation uses SendGrid. The notifications package and Edge Functions are built around SendGrid. We need to document which provider is canonical.

## Decision Drivers

- SendGrid already integrated in `packages/notifications` and Edge Functions
- SendGrid API key stored in Supabase Vault (per secrets protocol)
- Resend was considered during design phase but never implemented
- SendGrid has proven track record for transactional email at scale
- Twilio (SMS provider) owns SendGrid — single vendor relationship

## Considered Options

1. **SendGrid** — keep current implementation
2. **Resend** — migrate to Resend as originally documented
3. **Supabase Auth emails** — use built-in Supabase email for auth-related messages only

## Decision Outcome

Chosen option: **SendGrid**, because it's already implemented, integrated with the notification service, secrets are in Vault, and the Twilio/SendGrid vendor relationship simplifies billing.

## Rules & Consequences

- **Good, because** no migration needed, proven in production
- **Good, because** Twilio (SMS) + SendGrid (email) = one vendor, one billing relationship
- **Bad, because** SendGrid has more complex API than Resend
- **Agent Impact:** All transactional email goes through SendGrid via `packages/notifications`. Never reference Resend in code or docs — it was a design-phase consideration only.
