---
title: "Stage-engine must re-derive profile_id server-side"
id: ADR_0151
status: accepted
layer: decision
created: 2026-04-19
updated: 2026-04-23
---

# ADR-0151: Stage-engine must re-derive profile_id server-side (no trust in request body)

## Context and Problem Statement

`services/stage-engine/src/routes/agent/chat.ts:34` accepts `profile_id: z.string().uuid()` in the POST body and uses it at lines 94, 131, 191 without cross-checking against the bearer token's `auth.userId`. The mobile BFF path (`apps/web/src/app/api/emma/chat/route.ts:61-114`) already resolves `profile_id` server-side from the Supabase-verified user and the workspace context — so mobile *cannot* forge it when routed through the BFF.

However, stage-engine itself is reachable via a service-to-service API key (`STAGE_ENGINE_API_KEY`). Anyone holding that key (future direct integrations, leaked key, or a second BFF variant) can forge `profile_id` and cause stage-engine to act and emit telemetry under a forged actor. This is a defense-in-depth gap at the C4 Policy & Governance plane — "Confident ≠ Authorized" inverted: stage-engine is *confident* in a forged *authorization*.

## Decision Drivers

- C4 authority primitive: actor identity must never be client-asserted.
- Defense-in-depth: the BFF is the only current gate; stage-engine should also validate.
- L-0058 (client-asserted profile_id is forgeable audit actor) recurrence across entry points.
- Trust Gate: new agent tools that emit with this `profile_id` inherit the forgery surface.

## Considered Options

1. **Reject `profile_id` in the stage-engine schema, derive server-side from bearer token** — stage-engine performs its own `admin.auth.getUser(bearerToken)` + workspace/profile lookup.
2. **Keep `profile_id` in schema but cross-check against token subject** — accept body value, reject on mismatch.
3. **Leave as-is, document BFF as sole gate** — accept defense-in-depth gap.

## Decision Outcome

Chosen option: **"Option 1 — derive server-side"**, mirroring the BFF pattern. `profile_id` is removed from the stage-engine request schema. Stage-engine accepts bearer token + `workspace_id`, then resolves `profile_id` via the same pattern as `api/emma/chat/route.ts:108-114`. Direct API-key callers must supply a separate `actor_profile_id` channel with an explicit service-to-service scope that declares the impersonation is authorized.

## Rules & Consequences

- **Good, because** actor identity becomes forgery-proof regardless of entry point. Closes L-0058 at the runtime layer.
- **Good, because** removes implicit trust between BFF and stage-engine — each validates independently.
- **Bad, because** small latency cost per request for the auth lookup (likely cacheable).
- **Bad, because** existing tests that POST `profile_id` must be updated.
- **Agent Impact:** All agent tool implementations that read `ctx.actor_id` are unchanged — the value is resolved the same way, just from a trusted source. Any future direct-API-key caller must use the explicit impersonation channel.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.

## Implementation

Landed 2026-04-23 via `feat/botsson-arena-harness-hardening` sortie.

- Helper: `services/stage-engine/src/core/derive-profile-id.ts`.
- Wired in: `/agent/chat`, `/sessions`.
- Type: `AgentToolContext.profileId: NonEmptyString` (upstream brand per ADR-0193).
- Integration test: `services/stage-engine/src/__tests__/agent-chat-forged-profile.test.ts`.

Ultravox / Telegram adapter surfaces retain the optional `profile_id` body field for now — different auth model; follow-up spec.
