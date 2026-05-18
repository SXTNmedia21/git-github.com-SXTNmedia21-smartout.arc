---
title: "Capability Boundary for Announcement Surface"
id: ADR_0370
status: accepted
layer: decision
created: 2026-05-18
updated: 2026-05-18
---

# ADR-0370: Capability Boundary for Announcement Surface

> Drafted from council REJECT verdict on V1 spec (`docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design.md`, 2026-05-18). **Decision: Option B (extend `communication` capability)** locked 2026-05-18 by Pontus. V2 spec implements per §Decision Outcome.

## Context and Problem Statement

The Announcement Kind/Tier/Entity-Link spec proposed extending the agent capability tool `publish_announcement` (currently in the `communication` capability) with new parameters `kind`, `tier`, `tags`, `linked_entity_type`, `linked_entity_id`. Spec pseudocode at §8 invoked `callGateAction({ capability: 'broadcast.send', ... })`. Council Phase 3 code-trace surfaced that the existing tool body at `packages/ai/src/capabilities/communication/publish-announcement.ts:91-96` invokes `callGateAction(... capability: "communication" ...)` — a different capability key with different authority seeding.

Capability seed comparison:
- `communication` — seeded at `supabase/migrations/20260601100000_seed_communication_authority.sql:42`, `level=suggest`, `min_role=employee`.
- `broadcast.send` — seeded at `supabase/migrations/20260515110000_seed_day_control_authority.sql:55` AND `supabase/migrations/20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:193`, `level=confirm`, `min_role=manager`.

If the spec shipped as-pseudocoded, ONE of the following would happen silently:
- (a) min_role jumps from `employee` to `manager` for the agent path — privilege regression, unflagged.
- (b) Gate fails with "no seed" because `broadcast.send` is not in the `CapabilityName` type union in `packages/ai/src/capabilities/types.ts:12-105` — only as a runtime string used by the Day-Control server action.

This is an architectural decision that affects: agent-router compatibility, intent-classifier vocabulary, mobile-parity (ADR-0133), and the per-tool capability seed surface.

## Decision Drivers

- The 4 composer paths (3 web hooks + 1 agent tool) need to share one capability key OR the spec must explicitly accept two keys with different authority levels.
- Mobile boundary per ADR-0133 (mobile = Approve/Execute, web = Author/Compose). `broadcast.send` manager+/confirm is a web-only authoring path; `communication` employee+/suggest is broader.
- ADR-0173 frozen-4 capability namespace boundaries must not be violated.
- L-0292/ADR-0112 intent-classifier same-commit lock applies to any capability vocabulary change.
- Cross-namespace writes are forbidden per ADR-0240 — the chosen boundary must respect cross-capability ownership.

## Considered Options

1. **Option A — New `broadcast.send`-bearing capability for announcements only.** Keeps Day-Control's `broadcast.send` and adds an announcement-flavoured variant. Pros: clean separation; explicit privilege level per use. Cons: capability proliferation; intent-classifier must learn a new intent value; mobile inherits a manager+/confirm path it cannot offer (mobile is read-only for announcements).

2. **Option B — Extend `communication` capability with kind/tier/link parameters (preferred fallback).** All 4 composer paths invoke `communication` capability `actionType='publish_announcement'`. Agent path stays employee+/suggest; web Day-Control path keeps its current `broadcast.send` server-action gate AS WELL as a Capability-router pass. Pros: minimal capability surface; matches existing `publish-announcement.ts` body; agent vocabulary unchanged. Cons: silent privilege asymmetry between agent path (employee+) and Day-Control path (manager+) — must be documented.

3. **Option C — Tier-discriminated permission inside `communication`.** Authority config seeds different min_role per `tier` value: `social→employee, work→manager, external→admin`. Single capability key; permission derives from request payload. Pros: most flexible operator UX. Cons: novel pattern for engine_authority_config; tier override → permission override coupling complicates the audit trail; CHECK constraint cannot enforce tier-against-role at insert time.

## Decision Outcome

**Chosen: Option B — Extend `communication` capability with kind/tier/link parameters.** Locked 2026-05-18 by Pontus.

Concrete:
- `publish_announcement_atomic` RPC body PERFORMs `public.assert_capability(workspace, profile, 'communication', 'publish_announcement_atomic')` as defense-in-depth (caller already gates).
- Agent path (`packages/ai/src/capabilities/communication/publish-announcement.ts`) keeps `callGateAction(..., { capability: 'communication', actionType: 'publish_announcement_atomic', ... })`. NO change to capability key.
- Day-Control server action (`apps/web/src/app/dashboard/_actions/send-broadcast-action.ts`) keeps existing `broadcast.send` gate untouched. After this RPC lands, server-action ALSO invokes the RPC (which re-gates via `communication`). Audit shows both gates fire — explicit defense-in-depth.
- `CapabilityName` type union at `packages/ai/src/capabilities/types.ts:12-105` — no addition needed; capability key `communication` already covered. The `'publish_announcement_atomic'` actionType is a free string passed to `callGateAction` and recorded in `gate_evaluation.action_type` for audit only (per code-trace of `supabase/migrations/20260516130000_gate_action_unseeded_warning.sql`).
- Intent classifier: NO change (capability key `'communication'` already in `packages/ai/src/router/intent-classifier.ts:46`, no actionType-level routing in classifier surface).
- Existing communication capability seed at `supabase/migrations/20260601100000_seed_communication_authority.sql:42` (level=suggest, min_role=employee) is sufficient for the new actionType — gate_action keys on `(workspace_id, capability)` only, not actionType (verified L96-100 of gate_action migration).

Day-Control path silent privilege asymmetry is documented: agent path is employee+/suggest; Day-Control server-action path enforces manager+/confirm via `broadcast.send` server-action gate THEN re-gates via `communication`. Both pass for managers; agent path cannot reach Day-Control surface.

## Rules and Consequences

- **Good, because** explicitly resolving the boundary stops the silent privilege regression and unblocks the harmonized write path.
- **Good, because** Option B preserves the existing agent-path authority level without breaking customers who rely on Mr. Botsson publishing employee-level announcements.
- **Bad, because** Day-Control's existing `broadcast.send` gate and the unified RPC's `communication` gate may produce defense-in-depth audit redundancy that obscures which check failed when something is denied.
- **Agent Impact:** Capability tool authors must verify the gate-action capability key in the existing tool body, NOT trust spec pseudocode. Spec pseudocode shall be treated as illustrative until the call signature + capability key match production code.

---

> After re-draft of spec: finalize one option, register in `docs/decisions/0000-decision-log.md`, update ADR table in `CLAUDE.md`. Pair with ADR-0369 + ADR-0371.
