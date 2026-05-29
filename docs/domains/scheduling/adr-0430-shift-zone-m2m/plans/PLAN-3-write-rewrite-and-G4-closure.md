---
title: "PLAN-3 — WRITE-rewrite + G4 closure + Pattern B audit symmetry + Rule 7 forgery defense + 3 emit-site extensions"
sortie: adr-0430-shift-zone-m2m
plan: 3
tier: T3
phase: write-side
created: 2026-05-28
updated: 2026-05-28
status: council-approved
council_log: docs/domains/scheduling/adr-0430-shift-zone-m2m/COUNCIL-PLAN-3.md
council_verdict: APPROVE-WITH-9-AMENDMENTS
council_date: 2026-05-28
depends_on: [PLAN-2]
blocks: [PLAN-4]
estimated_effort_hours: 10-14
adr_rules_covered: [Rule 4, Rule 6, Rule 6b, Rule 7, Rule 9]
adrs_referenced: [ADR-0151, ADR-0173, ADR-0204, ADR-0287, ADR-0309, ADR-0356, ADR-0367, ADR-0427, ADR-0429, ADR-0430]
amendments: [MF-A, MF-B, MF-C, MF-D, MF-E, MF-F, MF-G, MF-H, MF-J]
---

# PLAN-3 — WRITE-rewrite

## Purpose

Rewrite the 3 WRITE call-sites to populate `shift_zone` (instead of `schedule_shift.zone` TEXT field), close the G4 gap (ADR-0204) at `add-shift-action.ts`, implement Rule 7 forgery defense, apply ADR-0356 Pattern B audit symmetry for cross-namespace writes, and extend 3 telemetry events with `zone_ids[]`.

This is the **load-bearing plan** — security gate closure, capability boundary discipline (ADR-0173), and Pattern B symmetry all land together here.

## Scope

### 3.1 — `apps/web/src/app/dashboard/_actions/add-shift-action.ts:299-326` — G4 closure + zone_ids[] support

> **MF-G (line ref drift):** Line refs updated from `:288-313` → `:299-326`. Cause: post-PLAN-1 `departmentId!` assertion + null guard added 11 lines to add-shift-action.ts. Sub-dispatch MUST re-grep before editing to catch further drift.

**Current state (ADR-0430 §Context):** direct `.insert()` on `schedule_shift` outside `gatedMutation` — G4 gap (ADR-0204 violation).

**Target state:**
1. Wrap entire INSERT block in `gatedMutation(...)` per ADR-0204 SS-5 backlog (this is the canonical G4 closure).
2. Accept `zone_ids: string[]` input (added to Server Action signature; client-side calls update separately).
3. Server-resolve workspace_id + actor_id from session (ADR-0151 — never trust body-supplied IDs).
4. Implement Rule 7 forgery defense (per-zone validation):
   - For each `zone_id`, fetch `zone WHERE id = zone_id AND workspace_id = ctx.workspaceId`
   - Assert `zone.location_id IN (SELECT location_id FROM department_location WHERE department_id = resolved_department_id AND workspace_id = ctx.workspaceId)`
   - Return 400 on first invalid zone
   - **MF-H (AC-3.3.1):** See AC-3.3.1 below — null-check fail-fast is explicit and required (L-0177 sibling, NO silent fallback)
5. After `schedule_shift` insert succeeds:
   - Resolve or create `shift_session` (existing flow — verify)
   - For each `(zone_id, day_line_id)` pair: insert `shift_zone` row with `location_id` denormalized from `zone.location_id`
6. Emit `"shift added_manual"` with extended `data.zone_ids` (Rule 6b).

### 3.2 — `packages/ai/src/capabilities/timeline-template/tools.ts:299` — cross-namespace write with Pattern B

> **MF-G (line ref drift):** `:288` → `:299` (same +11 offset as §3.1 add-shift-action.ts drift). Re-grep before editing.

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

**AC-3.2.1 — MF-D: Zod schema same-commit migration (ADR-0112 type contract).**
`packages/types/src/timeline-template.ts:52-59` `SchedShiftPayload` field migrates from:
```
zone: z.string().max(40).nullable()
```
to:
```
zone_ids: z.array(z.string().uuid()).default([])
```
in the SAME commit as `timeline-template/tools.ts:299` consumer rewrite. ADR-0112 type contract same-commit gate applies (sibling to intent enum gate). Split-commit = MF, reject.

**MF-B (compensating rollback):** `mutateWithGate.execute` in this path is serial-not-transactional. If `schedule_shift` INSERT succeeds but any `shift_zone` INSERT fails, the execute callback MUST: (1) catch the error, (2) `DELETE FROM schedule_shift WHERE schedule_shift_id = <new_id>` (compensating), (3) return `{ok: false, reason: "shift_zone_insert_failed:<zone_id>"}`. Document as PLAN-N follow-up: extract atomic compose to SECURITY DEFINER RPC `fn_create_shift_with_zones(p_shift jsonb, p_zone_ids uuid[])` (out of Phase b scope per ADR-0427 forward-only discipline).

### 3.3 — `packages/ai/src/capabilities/scheduler/tools.ts:541-561, 587-610` — own-namespace gated write

**Current state:** existing `gatedMutation` block already handles `location_id` assignment.

**Target state:**
1. Extend the `gatedMutation` exec to include atomic `shift_zone` INSERT after `shift_session` creation.
2. **NO Pattern B required** — `scheduler` writing to `shift_session_day_line`-related rows is own-namespace per ADR-0173 frozen-4 boundary (scheduler owns `schedule_shift` + `shift_session` + by-extension `shift_zone`).
3. Forgery defense (Rule 7) — same shape as 3.1/3.2 — null-check fail-fast per MF-H (AC-3.3.1).
4. Emit `"scheduler.proposal.accepted"` extended with `zone_ids` per bundle (Rule 6b — **one emit per bundle, NOT per shift** per ADR-0309).

**MF-E — Bundle event `zone_assignments` shape (Phase 5 council verdict):**

Extend `SchedulerProposalAccepted.data` interface at `packages/telemetry/src/registry.ts:10158` (re-grep to confirm current line — use `grep -n "SchedulerProposalAccepted" packages/telemetry/src/registry.ts`) with:
```typescript
zone_assignments?: Array<{
  shift_id: string;
  zone_ids: string[];
}>;
```

Rationale: ADR-0309 emits one event per bundle. Per-shift `zone_assignments` array preserves audit reconstruction without a follow-up query against `shift_zone`. Flat `zone_ids: string[]` would lose per-shift mapping. Bundle-level count loses provenance entirely.

Emit-site at `scheduler/tools.ts:640` populates this array from the proposal's per-shift `zone_ids` (sourced from the JSONB `proposed_shifts[].zone_ids` after PLAN-3 §3.3 internal shape extension). The proposal JSONB shape MUST be extended to carry `zone_ids: string[]` per shift prior to emit.

**MF-B (compensating rollback — scheduler path):** Same serial-not-transactional constraint as §3.2 applies here. If any `shift_zone` INSERT fails within the `gatedMutation` execute block, the callback MUST: (1) catch the error, (2) compensating `DELETE FROM schedule_shift WHERE schedule_shift_id = <new_id>`, (3) return `{ok: false, reason: "shift_zone_insert_failed:<zone_id>"}`. Atomic compose RPC (`fn_create_shift_with_zones`) deferred to PLAN-N per ADR-0427.

### 3.4 — Telemetry registry extensions (Rule 6 + 6b)

**Three interface extensions, ALL in same commit as their respective emit-site updates (L-0176 spirit — see AC-3.10.1):**

| Event name | Interface | Registry path | Extension |
|---|---|---|---|
| `"shift added_manual"` | `ShiftAddedManual` | `packages/telemetry/src/registry.ts:752` | Add `zone_ids?: string[]` to `properties.data` |
| `"shift created"` | `ShiftCreated` | `packages/telemetry/src/registry.ts:709` | Add `zone_ids?: string[]` to `properties.data` |
| `"scheduler.proposal.accepted"` | `SchedulerProposalAccepted` | `packages/telemetry/src/registry.ts:10158` (re-grep) | Add `zone_assignments?: Array<{shift_id: string; zone_ids: string[];}>` (MF-E shape, NOT flat `zone_ids`) |

**Important:** `zone_ids` is `?: string[]` (optional, undefined-able) so all existing call-sites compile without modification. `zone_assignments` likewise optional.

**AC-3.4.3 — MF-E council verdict:** `SchedulerProposalAccepted` bundle interface MUST be extended with `zone_assignments?: Array<{shift_id: string; zone_ids: string[];}>` per Phase 5 verdict. Flat `zone_ids: string[]` or bundle-level count is REJECTED (loses per-shift provenance). Emit-site at `scheduler/tools.ts:640` MUST populate array. Same-commit gate (L-0176 / AC-3.10.1) applies.

### 3.5 — Mobile BFF integration — DELEGATION not emit-site (MF-F)

> **MF-F (Phase 5 council verdict):** The original §3.5 language ("extend emit at api/mobile/shifts/route.ts") was incorrect. The BFF route is a delegation path — it does NOT emit. Replaced.

`apps/web/src/app/api/mobile/shifts/route.ts` is a delegation route — it calls `addShiftAction` and returns the result. The emit happens inside `addShiftAction`, not at the BFF layer. Placing a second `emit()` in the BFF would double-count the event.

**PLAN-3 strategy for mobile BFF:**

1. Extend `addShiftAction` input schema (Zod) to accept `zone_ids?: string[]` (optional, defaults to `[]`).
2. Mobile BFF route passes `zone_ids: []` when delegating to `addShiftAction` (mobile is read-only on shift authoring per ADR-0133 — no zone authoring UI on mobile surface).
3. **NO second `emit()` call in the BFF route.** Add inline code comment: `// zone_ids: [] — mobile is read-only on shift authoring (ADR-0133). Emit happens inside addShiftAction.`

**Updated AC-3.9:** `addShiftAction` input Zod schema accepts `zone_ids?: string[]`. Mobile BFF passes `zone_ids: []`. NO duplicate emit at BFF route. Inline comment present per MF-F.

### 3.6 — Rule 9 channel pinning — enforcement strategy (MF-A)

> **MF-A (Phase 5 council verdict):** The original §3.6 language implied PLAN-3 enforces `channel_constraint` at the `gate_action` RPC level. This is incorrect. Replaced with accurate enforcement model.

**Rule 9 enforcement: DEFERRED at gate-RPC level.** `gate_action` RPC (`supabase/migrations/20260516130000`) reads `level, min_role, requires_four_eyes` from `engine_authority_config` — it does NOT read `channel_constraint`. The PLAN-1 M2 seed `channel_constraint='chat_only'` for `roster.add_shift_manual` is declarative-only at the gate layer today. Sibling of L-0083 (authority-seed-inert pattern).

**PLAN-3 Rule 9 enforcement strategy (3-layer defense):**

1. `add-shift-action.ts:103` Zod `channel: z.enum(["chat", "system"])` already excludes voice at the request boundary. Add inline comment: `// Rule 9 (ADR-0430) + L-0083 sibling: voice excluded at Zod boundary; gate_action RPC does not yet read channel_constraint (deferred enforcement).`
2. Stage Engine routing layer (ADR-0078 channel pinning) prevents voice surface from calling `roster.add_shift_manual`.
3. Forensic value of `channel_constraint='chat_only'` seed retained for future `gate_action` PL/pgSQL amendment.

**Deferred to future ADR:** extend `gate_action` PL/pgSQL to read `channel_constraint` when present. Scope = cross-cutting (every capability call affected) — out of ADR-0430 Phase b scope.

**Verification steps (unchanged):**
- Verify `engine_authority_config` row for `roster.add_shift_manual` has `channel_constraint = 'chat_only'` (AC-3.10 still applies — seed is declarative record, not RPC enforcement).
- Verify `services/voice-agent/src/tools-*.ts` registers NO tool that writes to `shift_zone` (AC-3.11).

**AC-3.6.1 — MF-A:** Inline comment added at `apps/web/src/app/dashboard/_actions/add-shift-action.ts:103` Zod enum citing ADR-0430 Rule 9 + L-0083 sibling pattern.

**AC-3.6.2 — MF-A:** HANDOFF section "Deferred enforcement" documents Rule 9 dead-letter at gate-RPC + 3-layer defense (Zod enum + ADR-0078 channel pinning + forensic seed).

## Falsifiable acceptance criteria

| AC | Check | Pass condition |
|----|-------|----------------|
| AC-3.1 | G4 closed | `grep -A 50 'export async function addShiftAction' apps/web/src/app/dashboard/_actions/add-shift-action.ts` shows `gatedMutation(` wrapping the INSERT block; no bare `.insert()` outside gate. |
| AC-3.2 | `zone_ids[]` in addShiftAction signature | TypeScript signature accepts `{ zone_ids: string[] }` (or compatible) as input. Optional vs required is implementer's call — recommend required with empty-array default to force callers to be explicit. |
| AC-3.2.1 | **MF-D:** SchedShiftPayload Zod migration same-commit | `packages/types/src/timeline-template.ts` shows `zone_ids: z.array(z.string().uuid()).default([])` (NOT `zone: z.string()`). Lands in same commit as `timeline-template/tools.ts` consumer rewrite. Split-commit = MF, reject. |
| AC-3.3 | Rule 7 forgery defense — workspace check | Manual test: client supplies `zone_id` from another workspace → server returns 400, no INSERT. Test added to `apps/e2e/security/` or capability unit-test. |
| AC-3.3.1 | **MF-H:** Null-check fail-fast on zone validation (L-0177 sibling) | Code trace: `.from("zone").select("location_id").eq("id", zone_id).eq("workspace_id", ctx.workspaceId).single()` returning null → `{ok: false, reason: "zone_forgery_workspace"}`. `.from("department_location")...single()` returning null → `{ok: false, reason: "zone_forgery_dept_area"}`. NO silent fallback to default zone. NO skip-on-null. Applies to all 3 mutation paths (§3.1 + §3.2 + §3.3). |
| AC-3.4 | Rule 7 forgery defense — department-area check | Manual test: client supplies `zone_id` whose `zone.location_id` is NOT in `department_location` for the resolved department → server returns 400. |
| AC-3.4.3 | **MF-E:** SchedulerProposalAccepted bundle interface extended | `grep -A 10 "SchedulerProposalAccepted" packages/telemetry/src/registry.ts` shows `zone_assignments?: Array<{shift_id: string; zone_ids: string[];}>` (NOT flat `zone_ids: string[]`). Emit-site at `scheduler/tools.ts:640` populates array. Same-commit gate (AC-3.10.1) applies. |
| AC-3.5 | timeline-template Pattern B emit | `grep -A 20 "shift created" packages/ai/src/capabilities/timeline-template/tools.ts` shows `actor_capability: 'schedule'` AND `delegated_via: 'timeline-template'` in emit payload. |
| AC-3.6 | scheduler own-namespace emit (NO Pattern B) | `grep -A 20 "scheduler.proposal.accepted\|gatedMutation" packages/ai/src/capabilities/scheduler/tools.ts:540-610` does NOT contain `actor_capability` or `delegated_via` (own-namespace per ADR-0173). |
| AC-3.6.1 | **MF-A:** Rule 9 Zod inline comment | `grep -n "channel" apps/web/src/app/dashboard/_actions/add-shift-action.ts` shows inline comment at Zod enum citing ADR-0430 Rule 9 + L-0083 sibling pattern. |
| AC-3.6.2 | **MF-A:** HANDOFF deferred-enforcement section | HANDOFF document contains section "Deferred enforcement" documenting: (a) gate_action RPC does not read channel_constraint, (b) 3-layer defense (Zod + ADR-0078 + forensic seed), (c) future ADR scope. |
| AC-3.7 | Atomic write — shift_session + shift_zone in same transaction | Per ADR-0287 + ADR-0204: shift_zone INSERT and parent shift_session creation are in the SAME `gatedMutation` exec body (one transaction). Verify by code-trace, not just call-site. |
| AC-3.7.1 | **MF-B:** Compensating rollback on partial-INSERT failure | Code trace: if any `shift_zone` INSERT fails after `schedule_shift` INSERT succeeds, execute callback (a) catches error, (b) issues `DELETE FROM schedule_shift WHERE schedule_shift_id = <new_id>`, (c) returns `{ok: false, reason: "shift_zone_insert_failed:<zone_id>"}`. NO orphan shift_session. Applies to all 3 mutation paths (§3.1 + §3.2 + §3.3). |
| AC-3.8 | Telemetry registry extended | `grep -A 30 'ShiftAddedManual\|ShiftCreated' packages/telemetry/src/registry.ts` shows `zone_ids?:` on `data` shape; both events. `SchedulerProposalAccepted` shows `zone_assignments?:` shape per MF-E. |
| AC-3.9 | **MF-F updated:** Emit-sites + Mobile BFF delegation | `addShiftAction` Zod input accepts `zone_ids?: string[]`. 3 emit-sites (add-shift-action.ts:326, timeline-template/tools.ts:300, scheduler/tools.ts:640) pass `zone_ids`/`zone_assignments` to `emit()`. Mobile BFF (`api/mobile/shifts/route.ts`) passes `zone_ids: []` to `addShiftAction` — NO second `emit()` call in BFF. Inline comment present per MF-F. |
| AC-3.10 | Rule 9 channel pinning (declarative record) | `psql` query `SELECT channel_constraint FROM engine_authority_config WHERE capability_tool = 'roster.add_shift_manual'` returns `'chat_only'`. (Forensic value; gate-RPC enforcement deferred per MF-A.) |
| AC-3.10.1 | **MF-C:** L-0176 same-commit proof | `git diff --stat HEAD^` for the telemetry+emit commit shows ALL of: `packages/telemetry/src/registry.ts` (3 interface extensions: ShiftAddedManual + ShiftCreated + SchedulerProposalAccepted) AND `apps/web/src/app/dashboard/_actions/add-shift-action.ts:336` AND `packages/ai/src/capabilities/timeline-template/tools.ts:300` AND `packages/ai/src/capabilities/scheduler/tools.ts:640`. Split-commit = MF, reject. |
| AC-3.11 | Voice surface NO zone-write | `grep -rn "shift_zone\|zone_ids" services/voice-agent/src/` returns 0 matches. |
| AC-3.12 | ADR-0112 intent-enum compliance | Per ADR-0430 Agent Impact: NO new intent-enum entry needed (zone-assignment is web-only authoring, Botsson does NOT route). Verify `packages/ai/src/router/intent-classifier-enum.ts` (or equivalent) is unchanged. |
| AC-3.13 | typecheck green | `pnpm turbo typecheck` with TURBO_CONCURRENCY=1 (WSL2 OOM mitigation per MEMORY.md L-0397) — 0 errors. |
| AC-3.14 | Continuous E2E green | `pnpm exec playwright test apps/e2e/scheduling/` PASS including any new zone-related test added in this plan. |
| AC-3.15 | Capability unit-tests for forgery defense | New test files in `packages/ai/src/capabilities/schedule/__tests__/` cover: (a) zone from wrong workspace → `zone_forgery_workspace`, (b) zone from wrong department-area → `zone_forgery_dept_area`, (c) happy-path zone within department-area. All 3 PASS. No silent fallback path exists. |
| AC-3.16 | **MF-J:** Pre-flight flag + 9 MF council amendments satisfied | (a) `grep -r "SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED=false" .env*` returns 0 matches (pre-flight P-3.1 passed). (b) All 9 council amendments (MF-A..MF-J) verified against this AC table before commit. Re-read ADR-0430 Rules 1-9; spot-check implementation does not silently drift. |

## Pre-flight gates

> **MF-J — Pre-flight P-3.1: gatedMutation flag verification (Phase 5 council addition).**
>
> Before code edits begin, verify `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED` is NOT explicitly set to `false` anywhere:
> - `grep -r "SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED=false" .env*` returns 0 matches
> - If Vercel CLI accessible: check project envs for `smartout-web` — 0 matches
>
> Default (undefined) returns `true` per `gatedMutation.ts:81`. Any env explicitly setting `false` silently turns G4 closure into a no-op. **Block PLAN-3 dispatch until verified.**
>
> Pass condition documented in AC-3.16(a).

## Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| `gatedMutation` wrap exposes a hidden bug that existed under the bare `.insert()` path | MEDIUM — surfaces in tests | Treat as positive find. Fix in same plan; do not defer. |
| Pattern B emit fields missing on timeline-template = silent audit hole | HIGH — ADR-0356 violation, L-0176 sibling | AC-3.5 + code-review require both fields. Add lint rule (future) if recurrence. |
| Rule 7 forgery defense miss → workspace-leak | CRITICAL — same class as ADR-0151 | AC-3.3 + AC-3.3.1 + AC-3.4; null-check fail-fast (MF-H) + automated tests. NO silent fallback path. |
| Atomicity broken — shift_session created but shift_zone insert fails → orphan shift_session | HIGH — data inconsistency | AC-3.7 + AC-3.7.1 (MF-B): explicit compensating rollback required on all 3 mutation paths. Atomic RPC deferred to PLAN-N. |
| `zone_assignments` flat vs nested confusion — implementer uses `zone_ids: string[]` on SchedulerProposalAccepted | HIGH — loses per-shift provenance, ADR-0309 audit reconstruction broken | AC-3.4.3 (MF-E): council verdict explicitly rejects flat shape. Both ACs required. |
| Mobile BFF emits duplicate event (implementer adds second emit() call) | MEDIUM — double-counts event in PostHog + activity_trail | AC-3.9 (MF-F): BFF is delegation-only; inline comment + AC verification required. |
| `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED=false` in env silently disables G4 gate | HIGH — entire G4 closure is no-op | Pre-flight P-3.1 (MF-J) blocks dispatch until verified. AC-3.16(a). |
| Mobile BFF empty-array `zone_ids: []` interpreted by downstream as "shift unassigned to any zone" | LOW — if downstream queries `shift_zone` by shift_session_id, empty result = correct semantic | Document in `api/mobile/shifts/route.ts` inline. Verify downstream consumers (briefing.ts, schedule/tools.ts post-PLAN-2) handle empty-zone shifts gracefully. |
| Rule 9 channel_constraint column missing (PLAN-0 AC-0.9 failed) | BLOCKER | Cannot proceed with PLAN-3 §3.6 until column added. If PLAN-0 surfaced this, separate migration was already added; verify. |
| `roster.add_shift_manual` is the gate identifier but `"shift added_manual"` is the event name — implementer confuses the two | MEDIUM — registry.ts:751 vs :752 confusion | ADR Rule 6 explicitly notes this. Code-review check: `grep` confirms event name spelling (with space, not dot). |

## Dependencies

- **PLAN-2** must pass all 8 ACs.
- **PLAN-1 M2** must be applied (shift_zone table exists). If only M1 applied without M2, this plan cannot complete §3.1-3.3.
- **PLAN-0 AC-0.9** must have confirmed channel_constraint column exists.

## Files to touch

> **MF-G note:** All line refs below derived from post-PLAN-1 state (+11 offset vs pre-PLAN-1). Sub-dispatch MUST re-grep before editing — further drift possible if PLAN-2 touched these files.

- **Edit:** `apps/web/src/app/dashboard/_actions/add-shift-action.ts` (G4 closure at lines 299-326 area + zone_ids[] Zod + Rule 7 forgery defense + MF-A Rule 9 inline comment at :103 + MF-H null-check fail-fast + MF-B compensating rollback)
- **Edit:** `packages/ai/src/capabilities/timeline-template/tools.ts` (line 299 area — Pattern B emit + MF-B compensating rollback)
- **Edit:** `packages/ai/src/capabilities/scheduler/tools.ts` (lines 541-561, 587-610 — gatedMutation extension + MF-E zone_assignments shape + MF-B compensating rollback)
- **Edit:** `apps/web/src/app/api/mobile/shifts/route.ts` (MF-F: delegation route — pass `zone_ids: []` to addShiftAction + inline comment; NO second emit())
- **Edit:** `packages/telemetry/src/registry.ts` (3 interface extensions — ShiftAddedManual + ShiftCreated + SchedulerProposalAccepted with MF-E zone_assignments shape; SAME commit as all 4 emit-sites per AC-3.10.1)
- **Edit:** `packages/types/src/timeline-template.ts` (MF-D: SchedShiftPayload `zone` → `zone_ids`; SAME commit as timeline-template/tools.ts consumer rewrite per AC-3.2.1)
- **Edit (if Pre-6 from PLAN-0 surfaced gap):** `engine_authority_config` seed migration for `roster.add_shift_manual` channel_constraint
- **Create:** `packages/ai/src/capabilities/schedule/__tests__/forgery-defense.test.ts` (Rule 7 unit tests — 3 cases per AC-3.15)
- **Create:** `apps/e2e/scheduling/zone-assignment.spec.ts` (E2E zone happy-path + forgery 400 paths)
- **Decision log:** Append PLAN-3 closure entry to `docs/decisions/0000-decision-log.md`

## Validation gate (must pass before PLAN-4 ships)

Pre-flight P-3.1 (MF-J) verified before dispatch. All 22 ACs (original 16 + 6 council amendments: AC-3.2.1, AC-3.3.1, AC-3.4.3, AC-3.6.1, AC-3.6.2, AC-3.7.1, AC-3.10.1) PASS. Continuous E2E green. Typecheck green. Forgery defense tests prove workspace + department-area enforcement at the capability layer (independent of DB CHECK constraint — which is the last line of defense). MF-B compensating rollback verified on all 3 mutation paths. MF-C same-commit proof (`git diff --stat`) verified.

## Notes

- This is the security-critical plan. G4 closure is independent of zone reform (closes ADR-0204 violation in its own right). Reviewers should treat the G4 wrap + the forgery defense as two separate concerns landed together because the same Server Action is being touched.
- ADR-0356 Pattern B distinction (`timeline-template` cross-namespace vs `scheduler` own-namespace) is subtle and easy to mis-apply. AC-3.5 and AC-3.6 are paired contrast-checks — get BOTH right or BOTH wrong, never one without the other.
- **Council protocol carryover:** If implementer encounters ambiguity not covered by ADR Rules 1-9 (e.g. zone-add to ALREADY-existing shift via PATCH endpoint), DO NOT improvise — surface to orchestrator, dispatch council, treat verdict as binding per SDSM v2.
- Rule 6 is "HARD pick already resolved" per ADR — Option β (extend existing events) chosen, no new event names. Future ADR can add `shift_zone.assigned` events with L-0176 pair constraint; not in this sortie.
- **Council Phase 5 amendments:** 9 amendments (MF-A..MF-J) applied to this spec per council session 2026-05-28. Council log: `docs/domains/scheduling/adr-0430-shift-zone-m2m/COUNCIL-PLAN-3.md`. Key enforcement changes: Rule 9 deferred (MF-A), compensating rollback explicit (MF-B), same-commit gates hardened (MF-C + MF-D), bundle event shape locked (MF-E), BFF delegation model corrected (MF-F), line refs updated (MF-G), null-check fail-fast made explicit (MF-H), pre-flight flag check added (MF-J).
- **Deferred items (PLAN-N):** Atomic SECURITY DEFINER RPC `fn_create_shift_with_zones` (MF-B follow-up per ADR-0427). `gate_action` PL/pgSQL channel_constraint enforcement (MF-A follow-up — cross-cutting, needs dedicated ADR).
