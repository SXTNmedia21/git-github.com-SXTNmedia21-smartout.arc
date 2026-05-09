---
title: "Invitation Tokens Are Credentials, Not Identifiers"
id: ADR-0167
status: proposed
layer: decision
created: 2026-04-20
updated: 2026-04-20
---

# ADR-0167: Invitation Tokens Are Credentials, Not Identifiers

## Context and Problem Statement

The `/invitation/[token]` flow uses a UUID in the URL to look up an invitation and (in variant B) create a new `auth.users` row. Today that token is treated as a lookup key — it appears in activity_trail payloads, may be logged in full by Edge Function error paths, and has no classification in the secrets-protocol. A token in the wrong hands lets an attacker accept an invitation as someone else, creating a rogue `profile` row in a real workspace. The existing `get_invitation_by_token` RPC is SECURITY DEFINER but the token itself has no enforced handling rules.

## Decision Drivers

- Invitation acceptance writes to `auth.users`, `profile`, `company_member` — the identity layer itself.
- Tokens are currently logged in full in Edge Function telemetry (`accept-invitation/index.ts:414-431` uses the raw token in `activity_trail.properties`).
- The `secrets-protocol` skill classifies credentials (API keys, bearer tokens, JWTs) but does not yet cover invitation tokens.
- ADR-0078 restricts PII on voice channels but does not explicitly cover credentials — invitation tokens currently can reach any channel.
- Frontend devs may accept tokens from URL query strings, chat contexts, or copy-paste flows without realizing they are session-bootstrap credentials.

## Considered Options

1. **Treat as identifier** — current state. Token is a UUID, referenced freely, logged in full. No rules.
2. **Treat as credential** — classify under secrets-protocol. Never logged in full (first 8 chars only), never sent to AI context, never exposed in client-side error boundaries, single-use enforced at RPC layer.
3. **Two-layer token** — invitation has a public ID + a separate secret. Public ID can be logged; secret is a one-shot credential. Heavier to implement; splits data model.

## Decision Outcome

Chosen option: **"Treat as credential"**, because the token's authority scope (create identity + bind to workspace) is identical to an access token in blast radius, and the secrets-protocol already has the right primitives — we just extend them.

## Rules & Consequences

- **Good, because** invitation tokens get the same handling rigor as API keys: never in AI context (stage-engine, Botsson), censored in audit logs to first 8 characters, excluded from telemetry properties, single-use enforced by the accept-invitation Edge Function checking `status = 'pending'` before mutation.
- **Good, because** the ADR provides a single reference for future Edge Functions and UI components touching the token — no re-litigation on each new feature.
- **Bad, because** censoring existing activity_trail rows is a retrofit cost. `accept-invitation/index.ts:414-431` and `create-invitation/index.ts` (when its emit site is added per L-0083) must both use `substring(token, 1, 8) || '...'` in properties.
- **Bad, because** debugging a specific invitation becomes harder — ops must use the invitation ID (separate column), not the token, to trace a flow.
- **Agent Impact:**
  - `secrets-protocol` skill adds a row: invitation tokens classified as session-bootstrap credentials.
  - Every Edge Function / Server Action / UI site that reads an invitation token must censor to first 8 chars in any telemetry emit or log write.
  - `create-invitation/index.ts` when adding its missing emit site (P0 gap) must apply this rule from day one.
  - AI-router must reject any tool call that receives a token matching UUID pattern as a direct argument — tokens must be resolved server-side via RPC, not passed into capability context.
  - Any new ADR proposing a channel for invitation delivery (SMS, QR, voice) must cite this ADR and confirm the channel cannot leak the full token.

## References

- `secrets-protocol` skill (credentials classification)
- ADR-0078 (PII allowedChannels mandatory — extends to tokens)
- L-0083 (registered telemetry event without producer is phantom contract — emit-site for `create-invitation` must apply this rule)
- `supabase/migrations/20260327120001_invitation_rls_rpc.sql` (SECURITY DEFINER RPC `get_invitation_by_token`)
- `supabase/functions/accept-invitation/index.ts:414-431` (current telemetry pattern — will need censoring retrofit)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
