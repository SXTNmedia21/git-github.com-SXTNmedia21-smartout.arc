# ADR-0015: Bubble.io Rebuild Strategy

**Date:** 2026-02-27
**Status:** Accepted

## Context

Smartout v2 runs on Bubble.io with live customers, active Stripe billing, and DocuSign contract management. We are rebuilding on a modern stack (Next.js + Supabase) for scalability, performance, and developer experience.

## Decision

This is a **full rebuild**, not a migration. We are rewriting all functionality from scratch on the new stack while keeping the existing Bubble.io system operational during the transition.

### Third-Party Integrations (Already Live)

| Service  | Status         | Approach                                        |
| -------- | -------------- | ----------------------------------------------- |
| Stripe   | Live billing   | Rebuild integration using Stripe SDK + webhooks |
| DocuSign | Live contracts | Rebuild integration using DocuSign API          |
| SendGrid | Configured     | New integration via `SENDGRID_API_KEY`          |
| Twilio   | Configured     | New integration via Twilio SDK                  |
| PostHog  | Live analytics | Fresh setup on EU instance                      |

### Rebuild Principles

1. **No data migration yet** — Build the new system to feature parity first
2. **Parallel operation** — Bubble.io stays live until the new system is validated
3. **Schema-first** — Database design verified before building UI
4. **Module-by-module** — Each module (18 total) is spec'd independently in `docs/modules/`

## Rationale

- Bubble.io limitations (performance, customization, vendor lock-in) drove the rebuild decision
- A full rebuild allows proper architecture decisions without Bubble.io constraints
- Keeping Bubble.io running during rebuild eliminates customer disruption
- Third-party integrations (Stripe, DocuSign) are already operational — we rebuild the integration layer, not the external services

## Consequences

- Must maintain Bubble.io until new system reaches feature parity
- Data migration plan needed before cutover (separate future ADR)
- Third-party webhook URLs will need updating during cutover
- Feature parity tracking needed to know when Bubble.io can be retired
