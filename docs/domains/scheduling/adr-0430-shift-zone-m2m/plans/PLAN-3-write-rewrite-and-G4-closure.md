---
title: "PLAN-3 — WRITE-rewrite + G4 closure + Pattern B audit symmetry + Rule 7 forgery defense + 3 emit-site extensions"
sortie: adr-0430-shift-zone-m2m
plan: 3
tier: T3
phase: write-side
created: 2026-05-28
status: pending
depends_on: [PLAN-2]
blocks: [PLAN-4]
estimated_effort_hours: 10-14
adr_rules_covered: [Rule 4, Rule 6, Rule 6b, Rule 7, Rule 9]
adrs_referenced: [ADR-0151, ADR-0173, ADR-0204, ADR-0287, ADR-0356, ADR-0367, ADR-0429]
---

# PLAN-3 — WRITE-rewrite

## Purpose

Rewrite the 3 WRITE call-sites to populate `shift_zone` (instead of `schedule_shift.zone` TEXT field), close the G4 gap (ADR-0204) at `add-shift-action.ts`, implement Rule 7 forgery defense, apply ADR-0356 Pattern B audit symmetry for cross-namespace writes, and extend 3 telemetry events with `zone_ids[]`.

This is the **load-bearing plan** — security gate closure, capability boundary discipline (ADR-0173), and Pattern B symmetry all land together here.

## Scope

### 3.1 — `apps/web/src/app/dashboard/_actions/add-shift-action.ts:288-313` — G4 closure + zone_ids[] support

**Current state (ADR-0430 §Context):** direct `.insert()` on `schedule_shift` outside `gatedMutation` — G4 gap (ADR-0204 violation).

**Target state:**
1. Wrap entire INSERT block in `gatedMutation(...)` per ADR-0204 SS-5 backlog (this is the canonical G4 closure).
2. Accept `zone_ids: string[]` input (added to Server Action signature; client-side calls update separately).
3. Server-resolve workspace_id + actor_id from session (ADR-0151 — never trust body-supplied IDs).
4. Implement Rule 7 forgery defense (per-zone validation):
   - For each `zone_id`, fetch `zone WHERE id = zone_id AND workspace_id = ctx.workspaceId`
   - Assert `zone.location_id IN (SELECT location_id FROM department_location WHERE department_id = resolved_department_id AND workspace_id = ctx.workspaceId)`
   - Return 400 on first invalid zone
5. After `schedule_shift` insert succeeds:
   - Resolve or create `shift_session` (existing flow — verify)
   - For each `(zone_id, day_line_id)` pair: insert `shift_zone` row with `location_id` denormalized from `zone.location_id`
6. Emit `"shift added_manual"` with extended `data.zone_ids` (Rule 6b).

### 3.2 — `packages/ai/src/capabilities/timeline-template/tools.ts:288` — cross-namespace write with Pattern B

**Current state:** text zone field written on shift insert.

**Target state:**
1. Replace text-zone write with `shift_zone` INSERT (server-resolved `zone_id`).
2. **Pattern B audit symmetry (ADR-0356):** Since `timeline-template` capability is writing to `shift_session_day_line`-derived data owned by `schedule`/`scheduler`, the emit MUST include:
   ```typescript
   await emit('shift created', {
     // ... existing fields
     zone_ids: resolvedZoneIds,
     actor_capability: 'schedule',         // <-- ADR-0356 Pattern B
     delegated_via: 'timeline-template',   // <-- ADR-0356 Pattern B
   });
   ```
3. Forgery defense (Rule 7) applies the same way as in 3.1.
4. Emit `"shift created"` (registry.ts:709) extended (Rule 6b).

### 3.3 — `packages/ai/src/capabilities/scheduler/tools.ts:541-561, 587-610` — own-namespace gated write

**Current state:** existing `gatedMutation` block already handles `location_id` assignment.

**Target state:**
1. Extend the `gatedMutation` exec to include atomic `shift_zone` INSERT after `shift_session` creation.
2. **NO Pattern B required** — `scheduler` writing to `shift_session_day_line`-related rows is own-namespace per ADR-0173 frozen-4 boundary (scheduler owns `schedule_shift` + `shift_session` + by-extension `shift_zone`).
3. Forgery defense (Rule 7) — same shape as 3.1/3.2.
4. Emit `"scheduler.proposal.accepted"` extended with `zone_ids` per bundle (Rule 6b — **one emit per bundle, NOT per shift** per ADR-0309).

### 3.4 — Telemetry registry extensions (Rule 6 + 6b)

**Three interface extensions, ALL in same commit as their respective emit-site updates (L-0176 spirit):**

| Event name | Interface | Registry path | Extension |
|---|---|---|---|
| `"shift added_manual"` | `ShiftAddedManual` | `packages/telemetry/src/registry.ts:752` | Add `zone_ids?: string[]` to `properties.data` |
| `"shift created"` | `ShiftCreated` | `packages/telemetry/src/registry.ts:709` | Add `zone_ids?: string[]` to `properties.data` |
| `"scheduler.proposal.accepted"` | (per registry entry) | `packages/telemetry/src/registry.ts:<line>` | Add `zone_ids?: string[]` (verify exact line via grep) |

**Important:** `zone_ids` is `?: string[]` (optional, undefined-able) so all existing call-sites compile without modification.

### 3.5 — Mobile BFF parity (Rule 6b mobile-leg)

- `apps/web/src/app/api/mobile/shifts/route.ts` — extend emit with `zone_ids: []` (empty array) since mobile is read-only on shift authoring per ADR-0133. Document inline why empty array is correct (NOT a bug, NOT a TODO).

### 3.6 — Rule 9 channel pinning verification

- Verify `engine_authority_config` row for `roster.add_shift_manual` has `channel_constraint = 'chat_only'`.
- If row missing or `channel_constraint` differs: ADD migration to PLAN-3 commit (seed migration on `engine_authority_config`). Confirm with PLAN-0 AC-0.9 — column must exist.
- Verify `services/voice-agent/src/tools-*.ts` registers NO tool that writes to `shift_zone`. If found: REMOVE in this plan (voice surface MUST NOT expose zone-write).

## Falsifiable acceptance criteria

| AC | Check | Pass condition |
|----|-------|----------------|
| AC-3.1 | G4 closed | `grep -A 50 'export async function addShiftAction' apps/web/src/app/dashboard/_actions/add-shift-action.ts` shows `gatedMutation(` wrapping the INSERT block; no bare `.insert()` outside gate. |
| AC-3.2 | `zone_ids[]` in addShiftAction signature | TypeScript signature accepts `{ zone_ids: string[] }` (or compatible) as input. Optional vs required is implementer's call — recommend required with empty-array default to force callers to be explicit. |
| AC-3.3 | Rule 7 forgery defense — workspace check | Manual test: client supplies `zone_id` from another workspace → server returns 400, no INSERT. Test added to `apps/e2e/security/` or capability unit-test. |
| AC-3.4 | Rule 7 forgery defense — department-area check | Manual test: client supplies `zone_id` whose `zone.location_id` is NOT in `department_location` for the resolved department → server returns 400. |
| AC-3.5 | timeline-template Pattern B emit | `grep -A 20 "shift created" packages/ai/src/capabilities/timeline-template/tools.ts` shows `actor_capability: 'schedule'` AND `delegated_via: 'timeline-template'` in emit payload. |
| AC-3.6 | scheduler own-namespace emit (NO Pattern B) | `grep -A 20 "scheduler.proposal.accepted\|gatedMutation" packages/ai/src/capabilities/scheduler/tools.ts:540-610` does NOT contain `actor_capability` or `delegated_via` (own-namespace per ADR-0173). |
| AC-3.7 | Atomic write — shift_session + shift_zone in same transaction | Per ADR-0287 + ADR-0204: shift_zone INSERT and parent shift_session creation are in the SAME `gatedMutation` exec body (one transaction). Verify by code-trace, not just call-site. |
| AC-3.8 | Telemetry registry extended | `grep -A 30 'ShiftAddedManual\|ShiftCreated' packages/telemetry/src/registry.ts` shows `zone_ids?:` on `data` shape; both events. `scheduler.proposal.accepted` likewise. |
| AC-3.9 | Emit-sites extended | All 4 emit-sites (add-shift-action.ts:326, timeline-template/tools.ts:300, scheduler/tools.ts:640, api/mobile/shifts/route.ts) pass `zone_ids` to `emit()`. Mobile BFF passes empty array `[]` with inline doc comment. |
| AC-3.10 | Rule 9 channel pinning | `psql` query `SELECT channel_constraint FROM engine_authority_config WHERE capability_tool = 'roster.add_shift_manual'` returns `'chat_only'`. |
| AC-3.11 | Voice surface NO zone-write | `grep -rn "shift_zone\|zone_ids" services/voice-agent/src/` returns 0 matches. |
| AC-3.12 | ADR-0112 intent-enum compliance | Per ADR-0430 Agent Impact: NO new intent-enum entry needed (zone-assignment is web-only authoring, Botsson does NOT route). Verify `packages/ai/src/router/intent-classifier-enum.ts` (or equivalent) is unchanged. |
| AC-3.13 | typecheck green | `pnpm turbo typecheck` with TURBO_CONCURRENCY=1 (WSL2 OOM mitigation per MEMORY.md L-0397) — 0 errors. |
| AC-3.14 | Continuous E2E green | `pnpm exec playwright test apps/e2e/scheduling/` PASS including any new zone-related test added in this plan. |
| AC-3.15 | Capability unit-tests for forgery defense | New test files in `packages/ai/src/capabilities/schedule/__tests__/` cover: (a) zone from wrong workspace, (b) zone from wrong department-area, (c) happy-path zone within department-area. All 3 PASS. |
| AC-3.16 | Council Phase 5 8 MF still satisfied | Re-read ADR-0430 Rules 1-9; spot-check that PLAN-3 implementation does not silently drift. (One-pager mental checklist before commit.) |

## Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| `gatedMutation` wrap exposes a hidden bug that existed under the bare `.insert()` path | MEDIUM — surfaces in tests | Treat as positive find. Fix in same plan; do not defer. |
| Pattern B emit fields missing on timeline-template = silent audit hole | HIGH — ADR-0356 violation, L-0176 sibling | AC-3.5 + code-review require both fields. Add lint rule (future) if recurrence. |
| Rule 7 forgery defense miss → workspace-leak | CRITICAL — same class as ADR-0151 | TWO ACs (AC-3.3 + AC-3.4); both must have automated tests (not just manual smoke). |
| Atomicity broken — shift_session created but shift_zone insert fails → orphan shift_session | HIGH — data inconsistency | AC-3.7 requires single-transaction guarantee. Either all-or-nothing or explicit compensating rollback. |
| Mobile BFF empty-array `zone_ids: []` interpreted by downstream as "shift unassigned to any zone" | LOW — if downstream queries `shift_zone` by shift_session_id, empty result = correct semantic | Document in `api/mobile/shifts/route.ts` inline. Verify downstream consumers (briefing.ts, schedule/tools.ts post-PLAN-2) handle empty-zone shifts gracefully. |
| Rule 9 channel_constraint column missing (PLAN-0 AC-0.9 failed) | BLOCKER | Cannot proceed with PLAN-3 §3.6 until column added. If PLAN-0 surfaced this, separate migration was already added; verify. |
| `roster.add_shift_manual` is the gate identifier but `"shift added_manual"` is the event name — implementer confuses the two | MEDIUM — registry.ts:751 vs :752 confusion | ADR Rule 6 explicitly notes this. Code-review check: `grep` confirms event name spelling (with space, not dot). |

## Dependencies

- **PLAN-2** must pass all 8 ACs.
- **PLAN-1 M2** must be applied (shift_zone table exists). If only M1 applied without M2, this plan cannot complete §3.1-3.3.
- **PLAN-0 AC-0.9** must have confirmed channel_constraint column exists.

## Files to touch

- **Edit:** `apps/web/src/app/dashboard/_actions/add-shift-action.ts` (G4 closure + zone_ids[] + Rule 7 forgery defense)
- **Edit:** `packages/ai/src/capabilities/timeline-template/tools.ts` (line 288 area — Pattern B emit)
- **Edit:** `packages/ai/src/capabilities/scheduler/tools.ts` (lines 541-561, 587-610 — gatedMutation extension)
- **Edit:** `apps/web/src/app/api/mobile/shifts/route.ts` (emit extension with empty zone_ids)
- **Edit:** `packages/telemetry/src/registry.ts` (3 interface extensions)
- **Edit (if Pre-6 from PLAN-0 surfaced gap):** `engine_authority_config` seed migration for `roster.add_shift_manual` channel_constraint
- **Create:** `packages/ai/src/capabilities/schedule/__tests__/forgery-defense.test.ts` (Rule 7 unit tests)
- **Create:** `apps/e2e/scheduling/zone-assignment.spec.ts` (E2E zone happy-path + forgery 400 paths)
- **Decision log:** Append PLAN-3 closure entry to `docs/decisions/0000-decision-log.md`

## Validation gate (must pass before PLAN-4 ships)

All 16 ACs PASS. Continuous E2E green. Typecheck green. Forgery defense tests prove workspace + department-area enforcement at the capability layer (independent of DB CHECK constraint — which is the last line of defense).

## Notes

- This is the security-critical plan. G4 closure is independent of zone reform (closes ADR-0204 violation in its own right). Reviewers should treat the G4 wrap + the forgery defense as two separate concerns landed together because the same Server Action is being touched.
- ADR-0356 Pattern B distinction (`timeline-template` cross-namespace vs `scheduler` own-namespace) is subtle and easy to mis-apply. AC-3.5 and AC-3.6 are paired contrast-checks — get BOTH right or BOTH wrong, never one without the other.
- **Council protocol carryover:** If implementer encounters ambiguity not covered by ADR Rules 1-9 (e.g. zone-add to ALREADY-existing shift via PATCH endpoint), DO NOT improvise — surface to orchestrator, dispatch council, treat verdict as binding per SDSM v2.
- Rule 6 is "HARD pick already resolved" per ADR — Option β (extend existing events) chosen, no new event names. Future ADR can add `shift_zone.assigned` events with L-0176 pair constraint; not in this sortie.
