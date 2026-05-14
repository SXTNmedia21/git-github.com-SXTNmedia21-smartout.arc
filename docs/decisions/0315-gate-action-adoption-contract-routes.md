---
title: "gateAction Adoption for SMA-311 Contract-Route Family"
id: ADR_0315
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: contracts
tags: [contracts, gate-action, c4-governance, sma-311, adr-0099, adr-0204]
---

# ADR-0315 — gateAction Adoption for SMA-311 Contract-Route Family

## Context

Five employment-contract API routes had no C4 authority gate despite being mutation endpoints:

1. `POST /api/employment-contracts/[id]/send` — send a draft contract
2. `POST /api/employment-contracts/[id]/revise` — create a revision
3. `POST /api/employment-contracts/[id]/regenerate` — re-derive terms from framework
4. `POST /api/employment-contracts/` (persist=true) — compose + persist a draft
5. `POST /api/contracts/send` (UPDATE section) — dispatch via DocuSeal (Q-H2 expansion)

ADR-0099 requires gate_action for mutation authority. L-0107 invariant: "authority appearance ≠
authority presence" — role checks alone are insufficient when capability governance (C4) exists.

## Decision

All 5 routes use `gateAction` from `apps/web/src/app/dashboard/_actions/_shared.ts`.

**NOT `gatedMutation`** — `gatedMutation` (ADR-0204 composition orchestrator, SS-4) is feature-
flagged behind `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED`. It throws `not_implemented` in
production for routes outside the orchestrator scope. `gateAction` is unconditional and matches
the established `bulk/route.ts:135-142` pattern.

| Route | action_type |
|-------|------------|
| `[id]/send` | `send_single` |
| `[id]/revise` | `revise` |
| `[id]/regenerate` | `regenerate` |
| `route.ts` POST | `compose` |
| `/api/contracts/send` UPDATE | `send_dispatch` |

**Gate call signature** (capability='contract', channel='system', entityId=contract_id):
```ts
const gateResult = await gateAction({
  workspaceId, capability: "contract", channel: "system",
  actorProfileId, actionType: "<action_type>", entityId: id,
});
if (!gateResult.allow) { return 403 gate_denied + emit gate.contract_send_denied; }
```

**Walt dev-stub removed (SMA-307):**
The dev-stub branch (lines 509–555, `/api/contracts/send/route.ts`) is removed entirely.
Service-down state is always 503 in all environments. Principle: "no synthetic database state
for environment convenience." `CONTRACT_SERVICE_DEV_FALLBACK` env flag removed from `.env.template`
and `apps/web/src/env.ts`.

**ADR-0151 forgery fix (compose route):**
`workspace_id` removed from `composeSchema` (Zod). Workspace derived from JWT actorProfile row
server-side — never from body. Profile membership in derived workspace verified before gate call.

**ADR-0099 compliance:**
`engine_authority_config` has no row for `capability='contract'` in local dev (verified pre-build).
`gate_action` RPC default-allows when no authority row exists. Platform default: allow with role
floor from profile. Future: seed a contract authority row to enforce min_role or four_eyes when needed.

## Rationale

- `gateAction` is the established production-safe pattern (bulk route).
- `gatedMutation` would throw `not_implemented` in prod — SS-4 feature flag not yet enabled.
- Future migration to `gatedMutation` requires separate ADR + sortie when SS-4 flag flips.
- `gate.contract_send_denied` event emitted on deny — activity_trail audit + posthog analytics.
- Walt stub removal prevents synthetic `contract` rows from polluting prod-like local state.

## Consequences

- 5 contract mutation routes now gate-checked.
- All gate denials are auditable via `gate.contract_send_denied` events.
- Dev E2E tests that relied on Walt stub must seed signing rows directly via admin client.
- If a contract authority row is seeded later (min_role=admin, four_eyes=false), behaviour changes.

## References

- ADR-0099: gate_action required for mutation authority
- ADR-0204: composition orchestrator (SS-4 feature flag)
- ADR-0151: workspace_id server-derivation
- ADR-0186: C4 gate spec compliance
- L-0107: authority appearance ≠ authority presence
- SMA-307 (Walt fallback), SMA-311 (singular bypass)
