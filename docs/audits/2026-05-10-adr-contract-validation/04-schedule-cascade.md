---
title: "Audit Slice 04 — Schedule / Cascade"
status: done
created: 2026-05-10
updated: 2026-05-10
module: cascade
tags: [audit, cascade, schedule, adr-0032, adr-0047, adr-0091, adr-0156, adr-0204]
---

# Audit Slice 04 — Schedule / Cascade

**Repo:** `campaign/botsson-arena`
**Date:** 2026-05-10
**ADR cluster:** ADR-0032, ADR-0047, ADR-0091, ADR-0156, ADR-0204
**Surface audited:**
- `apps/web/src/app/dashboard/schedule/`
- `apps/web/src/lib/cascade/`
- `packages/ai/src/industry/`
- `apps/web/src/components/day/WebDayControl.tsx`

**Anchor:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

**Known FPs skipped:** FP-002 (rate numeric values), FP-003 (useRoster fix), FP-004 (WalkAiProvider)

---

## Summary

9 findings. 2 HIGH, 4 MEDIUM, 3 LOW. The schedule surface has good telemetry discipline on primary CRUD hooks but has two systemic gate-bypass patterns. The most severe issue is that the `schedule-voice-tools` client performs real DB writes (booking create + update, session_task create) without any `gate_action`, `gatedMutation`, or `emit()` call — bypassing the entire C4 + telemetry contract. The second systemic issue is that all primary shift/absence mutations use direct `supabase.from().insert/update/delete` without crossing the ADR-0204 `gatedMutation` orchestrator.

---

## Findings

### F-SC-01 — Voice tool direct DB writes with no gate and no emit

**Severity:** HIGH
**ADR violated:** ADR-0204 (gatedMutation orchestrator mandatory), ADR-0091 (cascade_gate_write), ADR-0099 (gate_action), CLAUDE.md telemetry invariant ("every mutation emits")
**Files:**
- `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts:663–694` — `addReservationTool`: direct `supabase.from("schedule_day_booking").insert(...)`, no gate, no emit
- `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts:758–762` — `updateReservationTool`: direct `supabase.from("schedule_day_booking").update(...)`, no gate, no emit
- `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts:853–868` — session and session_task insert inside `addTaskTool`, no gate, no emit

**Evidence:**
The file imports `createClient` from `@smartout/supabase/client` but has zero imports from `@smartout/telemetry` and zero calls to `emit()`. The `addReservationTool` and `updateReservationTool` perform real `schedule_day_booking` mutations in the anon browser context with no capability authority check and no audit trail. The session and task creation path inside `addTaskTool` (lines 820–895) creates `department_session` and `session_task` rows similarly.

The `updateShiftTool` (line 511–532) and `deleteShiftTool` are correctly ghost-mode only (they create proposals, not direct writes). The audit does NOT flag those. But the booking and task tools are real writes.

**ADR-0204 §1** states: "every new capability tool `execute()` that writes to the DB MUST compose via `gatedMutation`." ADR-0091 WP4 extension codifies direct supabase writes on governance-adjacent tables as ESLint-blocked merge patterns. No `gate_action` RPC precedes any of these writes, violating "Confident ≠ Authorized" (C4).

**Cascade integrity impact:** `schedule_day_booking` is a D6 execution entity. Its writes have no provenance record (no `gate_evaluation` row, no `activity_trail` row). This is a cascade invariant #8 violation ("every output must have provenance").

**Remediation:** Migrate `addReservationTool`, `updateReservationTool`, and the task-create path in `addTaskTool` to Server Action delegates following the `createDayInfoAction` pattern already used in `use-day-info.ts:131`. Server Actions are the canonical mutation host (ADR-0114). Client voice tools must call the Server Action, not Supabase directly. Server Action adds `gate_action` + `emit()`.

---

### F-SC-02 — Shift/absence primary mutations bypass gatedMutation orchestrator

**Severity:** HIGH
**ADR violated:** ADR-0204 §1 (gatedMutation mandatory for all DB mutations), ADR-0091 amendment 2026-04-23 (cascade_gate_write composable via orchestrator)
**Files:**
- `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts:83` — `useCreateShift`: direct `supabase.from("schedule_shift").insert(dbRow)`
- `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts:162` — `useUpdateShift`: direct `supabase.from("schedule_shift").update(dbPatch)`
- `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts:244` — `useDeleteShift`: direct `supabase.from("schedule_shift").delete()`
- `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts:321` — `useMoveShift`: direct update
- `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts:400` — `usePublishShifts`: direct update
- `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts:506` — `usePasteDay`: direct insert
- `apps/web/src/app/dashboard/schedule/_hooks/use-absences.ts:65` — `useCreateAbsence`: direct `supabase.from("schedule_absence").insert(...)`

**Evidence:**
All seven mutation hooks call `supabase.from(...)` directly in `mutationFn` without calling `gate_action` (ADR-0099) or `cascade_gate_write` (ADR-0091) individually, let alone the composed `gatedMutation` orchestrator (ADR-0204). These are the primary schedule write paths for the entire dashboard.

The hooks correctly place `void emit(...)` in `onSuccess` for telemetry, so audit trail destinations are populated after the fact. However, the dual-gate contract (capability authority FIRST, then data-rule) is completely absent. Per ADR-0204 §4, authority must be evaluated before the write — not implicitly trusted from the client session.

**Important nuance:** ADR-0047 (accepted) codified "direct supabase-js calls" for the schedule data layer. ADR-0204 (accepted 2026-04-24) supersedes this for governance-gated entities by requiring the orchestrator. `schedule_shift` and `schedule_absence` are D6 production entities with framework rules (D3) that should gate them via `cascade_gate_write`. The 33 ESLint warnings referenced in ADR-0204 §Agent Impact include schedule call sites.

**This is not a new violation introduced by this campaign — it is the SS-5 migration backlog from ADR-0204.** Flag: the backlog is growing (voice tools add more bypass paths on top of it).

**Remediation:** ADR-0204 SS-5 migration. Schedule hooks are a known backlog item. Priority should rise given F-SC-01 adds voice tool mutations on top of the same gap.

---

### F-SC-03 — Saturday helgetillegg boundary mismatch between seed metadata and runtime resolver

**Severity:** MEDIUM
**ADR violated:** Cascade Core invariant #6 ("rates, rules, and constraints are declarative"), FP-002 acknowledged: rate NUMERIC values not audited, but the BOUNDARY DESCRIPTION is auditable metadata
**Files:**
- `packages/ai/src/industry/packages/hospitality.ts:23` — `HOSPITALITY_TARIFF_RATES`: `applies: "Sat 15:00 - Sun 24:00"` (metadata says 15:00)
- `packages/ai/src/industry/packages/hospitality.ts:353` — `tariffs[].supplements[].description: "Kl. 15:00–24:00"` (seed description says 15:00)
- `apps/web/src/lib/cascade/resolve-tariff-rate.ts:98` — `isSaturdayTime`: `localWeekday === 6 && localHour >= 14` (runtime resolver uses 14:00)
- `apps/web/src/lib/cascade/resolve-tariff-rate.ts:98` — comment: `"Prior code used 15:00 — off by 1 hour"`

**Evidence:**
The resolver comment explicitly states the prior code used 15:00 and was corrected to 14:00. However, the hospitality package's metadata fields (`applies`, `description`) still say 15:00. These metadata fields are consumed by:
1. I1 bootstrap seed UI
2. Any future K1a documentation generator
3. Potentially the workspace setup wizard display

The runtime resolver is the authoritative computation path and the 14:00 value aligns with Riksavtalen §4-3.3.1. The metadata descriptions are stale. This is not FP-002 (which covers numeric rate amounts) — FP-002 explicitly does NOT cover time boundaries.

**Cascade integrity:** Stale metadata on seed constants weakens the reproducibility argument. An I1 bootstrap that reads `applies` fields to display rules to admins will show incorrect boundaries. A future `evaluate-framework-rules` refactor that reads these metadata strings as configuration would import the wrong boundary.

**Remediation:** Update `HOSPITALITY_TARIFF_RATES[1].applies` from `"Sat 15:00 - Sun 24:00"` to `"Sat 14:00 - Sun 06:00"` and the `description` field at line 353 from `"Kl. 15:00–24:00"` to `"Kl. 14:00–24:00"`. Low-risk string change.

---

### F-SC-04 — `useAbsences` creates absence without gate; `schedule_absence` requires admin gate

**Severity:** MEDIUM
**ADR violated:** ADR-0286 (schedule_absence INSERT is `is_admin_in_workspace`-gated), ADR-0204 (orchestrator mandatory), CLAUDE.md "Never bypass RLS with service role for user-facing operations"
**Files:**
- `apps/web/src/app/dashboard/schedule/_hooks/use-absences.ts:60–74` — `useCreateAbsence`: direct `supabase.from("schedule_absence").insert(dbRow)` from anon client

**Evidence:**
ADR-0286 line 26 states explicitly: "`schedule_absence` has `is_admin_in_workspace`-gated INSERT — employees cannot write the table at all." The absence creation hook uses the browser anon client and relies entirely on RLS to enforce the admin gate. This is the known pattern (F-SC-02 parent), but the `schedule_absence` case is higher severity than generic shifts because:

1. The RLS is already defined as the sole gate — the application layer has no secondary check
2. ADR-0286 was accepted 2026-04-23 and explicitly names the admin-gate as load-bearing
3. `schedule_absence` affects D6 execution data with payroll implications (L-0132 cited in ADR-0286)

If the RLS policy on `schedule_absence` regresses (e.g. a migration mistake), there is no application-layer gate to catch it. ADR-0263 defense-in-depth principle requires server-side explicit re-checks for high-stakes entities.

**Remediation:** `useCreateAbsence` should delegate to a Server Action with explicit `is_admin_in_workspace` re-check before insert (ADR-0114 pattern). This is the same pattern applied to `createDayInfoAction`. Required by ADR-0204 SS-5 migration and should be prioritized over generic shift CRUD due to ADR-0286 declaration.

---

### F-SC-05 — `workspace_operating_hours` used as fallback in schedule hooks (table not listed in D1 canonical sources)

**Severity:** MEDIUM
**ADR violated:** ADR-0218 (operating hours source-of-truth and writer contract), cascade dimension concern mixing
**Files:**
- `apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts:73` — fallback reads from `workspace_operating_hours` when `department_operating_hours` is empty

**Evidence:**
`usePlannedHours` has a 3-tier fallback: department_session → department_operating_hours → workspace_operating_hours. The `workspace_operating_hours` table exists in `database.types.ts:19725` and is queried when no department-specific hours exist.

The cascade spec defines D1 operating hours via `department_operating_hours` and `department_hours_override`. The `workspace_operating_hours` table is not named in the canonical D1 dimension list in either the spec or DATABASE.md. ADR-0218 (operating-hours source-of-truth and writer contract) was filed 2026-04-28 precisely to resolve multi-table operating hours confusion.

**Status:** This fallback may be intentional design (workspace defaults before department specifics), but it is not documented against the D1 dimension spec and creates an undeclared ownership chain. If `workspace_operating_hours` is a legitimate D1 source, it must be declared in the D1 entity table in DATABASE.md and the cascade spec. If it is a legacy pre-D1 table, it should not be in the fallback path.

**Remediation:** Verify against ADR-0218 whether `workspace_operating_hours` is approved as D1 fallback. If yes: document in DATABASE.md D1 section. If no: remove from fallback chain and ensure I1 bootstrap seeds `department_operating_hours` for all departments.

---

### F-SC-06 — `useShiftRuleCheck` evaluates framework rules client-side but result is advisory only — no gate integration

**Severity:** MEDIUM
**ADR violated:** ADR-0091 WP1 intent (framework rule evaluation must gate writes, not just warn UI), cascade invariant #3 (derivation must be reproducible from persisted inputs)
**Files:**
- `apps/web/src/app/dashboard/schedule/_hooks/use-shift-rule-check.ts:110–141` — evaluates rules in `useMemo`, returns `EvaluationResult`; result is rendered as UI badge only
- `apps/web/src/app/dashboard/schedule/_hooks/use-shift-rule-check.ts:44–102` — loads framework rules + overrides from DB

**Evidence:**
`useShiftRuleCheck` correctly loads `workspace_framework_binding`, `framework_rule`, and `workspace_rule_override` from Supabase and runs the pure `evaluateFrameworkRules()` function. The result is a warning badge in the shift modal UI. However, the evaluation result does not feed back into the `useCreateShift` or `useUpdateShift` mutations — a manager can acknowledge the warning and still write the shift directly.

ADR-0091 WP1 (pending) specifies that `evaluate_framework_rules` must run inside `cascade_gate_write` (server-side, in the RPC), not as UI-advisory-only client-side code. The current client evaluation is useful pre-flight UX but does not satisfy the gate requirement. A manager can dismiss the warning and proceed; the cascade gate does not block.

**This is the defined WP1 gap in ADR-0091 §Implementation Status.** The finding here is that WP1 is still open while the surface has expanded (voice tools, paste, auto-fill) without tracking WP1 completion as a blocker.

**Remediation:** Track WP1 completion as a blocking dependency for SS-5 migration. Until WP1 ships, the `useShiftRuleCheck` advisory is the only rule evaluation in place — document this explicitly in the hook's file comment and in STATE.md.

---

### F-SC-07 — WebDayControl `pinDayControlContextAction` session-context writes without emit

**Severity:** LOW
**ADR violated:** CLAUDE.md telemetry invariant ("every mutation emits")
**Files:**
- `apps/web/src/components/day/WebDayControl.tsx:120–128` — `pinDayControlContextAction` called in `useEffect` with no downstream emit visible

**Evidence:**
`WebDayControl` calls `pinDayControlContextAction({ sessionId, departmentName, date })` every time the session or date changes. The action pins context into `engine_memory` for Botsson. ADR-0156 §Agent Impact explicitly specifies this pattern. However, the action itself needs to emit if it performs a write to `engine_memory`. The call is fire-and-forget (`void`) in the effect. If `pinDayControlContextAction` does not emit after its write, the `engine_memory` mutation has no audit trail.

**Action required before ruling:** Read `apps/web/src/app/dashboard/_actions/pin-day-control-context.ts` to verify whether emit is called inside the Server Action. This finding is conditional — if emit is present server-side, it is a LOW/resolved false-alarm.

---

### F-SC-08 — `usePlannedHours` creates supabase client at component render time (not in queryFn)

**Severity:** LOW
**ADR violated:** Performance governance (CLAUDE.md: "Promise.all for independent async ops; no barrel re-exports")
**Files:**
- `apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts:35` — `const supabase = createClient();` at hook body level, not inside queryFn

**Evidence:**
`usePlannedHours` creates the Supabase client at hook call time (line 35), outside the `queryFn`. This means a new client is instantiated on every render where `usePlannedHours` is called — even renders that don't trigger any query. The canonical pattern in this codebase (as seen in `use-shifts.ts:83`, `use-shift-rule-check.ts:51`) is `const supabase = createClient()` inside the `queryFn` body.

This is a consistency issue and potential performance micro-cost on frequent re-renders (day navigation fires `usePlannedHours` on each date change).

**Remediation:** Move `createClient()` inside each `queryFn` body.

---

### F-SC-09 — `evaluateFrameworkRules` skips `split_shift_gap` check silently

**Severity:** LOW
**ADR violated:** Cascade invariant #6 (rules must be declarative and evaluated), D3 framework_rule completeness
**Files:**
- `apps/web/src/lib/cascade/evaluate-framework-rules.ts:141–143` — `case "split_shift_gap"`: returns `null` unconditionally with comment "Not evaluated here — requires multi-shift context"

**Evidence:**
The `checkRule` function has a case for `"split_shift_gap"` that returns `null` (no violation detected) regardless of entity context. The comment acknowledges this requires multi-shift context. However, `split_shift_gap` is a Riksavtalen §4-3 rule that creates Delt dagsverk entitlement — a payroll-affecting rule. Silently skipping it means the UI will never warn a manager who creates a split shift, and `cascade_gate_write` (WP1) will never evaluate it either.

This is not a regression — the function was written this way — but it is a gap in rule coverage. A framework_rule seeded with `check: "split_shift_gap"` will always return "allowed" regardless of actual gap between shifts.

**Remediation:** Implement `split_shift_gap` evaluation in `checkRule`. The `EntityContext` type already has `lastShiftEnd` and `date`. The caller (`useShiftRuleCheck`) already passes `existingShifts`. `buildEntityContext` would need to expose all same-day prior shifts' times (currently it aggregates to `dailyHoursWorked` only). Track as a WP1 companion task.

---

## ADR Compliance Summary

| ADR | Status |
|-----|--------|
| ADR-0032 (local state architecture) | Superseded by ADR-0047 — local state replaced. Compliant. |
| ADR-0047 (TanStack Query persistence) | Implemented. Direct supabase-js calls as per ADR-0047. ADR-0204 supersedes this for gate requirement. |
| ADR-0091 (cascade_gate_write RPC) | WP1 still pending. WP3 wrappers exist. Schedule call sites are the SS-5 backlog. Booking/task voice tools are new bypass (F-SC-01). |
| ADR-0156 (WebDayControl canonical D6 surface) | Surface present and wired to `department_session`. Phase enum derivation via `derivePhase()` correct. ADR-0188 handover column deprecation — not verified in this run. Generally compliant. |
| ADR-0204 (gatedMutation orchestrator) | SS-5 backlog: all schedule CRUD hooks bypass orchestrator. Voice tool direct writes are a new regression on top (F-SC-01). |

## Cascade Dimension Boundary Check

| Entity used | Declared dimension | Concern mixing? |
|-------------|-------------------|----------------|
| `schedule_shift` | D6 Production | No mixing |
| `schedule_absence` | D6 Production | No mixing (but F-SC-04) |
| `schedule_day_booking` | D6 Production | No mixing (but F-SC-01) |
| `department_session` | D6 Production | No mixing |
| `session_task` | D6 Production | No mixing (but F-SC-01) |
| `framework_rule` | D3 Rules | Correctly read-only from UI |
| `workspace_rule_override` | D3 Rules | Correctly read-only from UI |
| `tariff_rate_table` | D3 Rules | Correctly read-only from UI |
| `department_operating_hours` | D1 Envelope | No mixing |
| `workspace_operating_hours` | Undeclared (F-SC-05) | Potential concern |
| `employee_payroll_profile` | D2 Resource | Correctly read-only from `getTariffContext` |

No D1/D2/D3/D4 data is mutated from the schedule surface. Concern-mixing is absent for reads. Write-side violations are gate-process failures (F-SC-01, F-SC-02), not dimension placement failures.

## C4 Governance Gate Coverage

| Mutation path | gate_action | cascade_gate_write | gatedMutation | Verdict |
|---------------|-------------|-------------------|---------------|---------|
| `useCreateShift` | No | No | No | FAIL (SS-5 backlog) |
| `useUpdateShift` | No | No | No | FAIL (SS-5 backlog) |
| `useDeleteShift` | No | No | No | FAIL (SS-5 backlog) |
| `useMoveShift` | No | No | No | FAIL (SS-5 backlog) |
| `usePublishShifts` | No | No | No | FAIL (SS-5 backlog) |
| `usePasteDay` | No | No | No | FAIL (SS-5 backlog) |
| `useCreateAbsence` | No | No | No | FAIL (F-SC-04 — elevated vs shifts) |
| `addReservationTool` (voice) | No | No | No | FAIL — new regression (F-SC-01) |
| `updateReservationTool` (voice) | No | No | No | FAIL — new regression (F-SC-01) |
| `addTaskTool` (voice session/task) | No | No | No | FAIL — new regression (F-SC-01) |
| `useCreateDayInfo` (Server Action delegate) | Yes (in action) | n/a | n/a | PASS |
| `updateShiftTool` (voice) | Ghost mode only | n/a | n/a | PASS |
| `deleteShiftTool` (voice) | Ghost mode only | n/a | n/a | PASS |

## Telemetry Coverage

| Mutation | emit() | In onSuccess | void or await |
|----------|--------|-------------|---------------|
| useCreateShift | Yes | Yes | void — known pattern |
| useUpdateShift | Yes | Yes | void — known pattern |
| useDeleteShift | Yes | Yes | void — known pattern |
| useMoveShift | Yes | Yes | void — known pattern |
| usePublishShifts | Yes | Yes | void — known pattern |
| usePasteDay | Yes | Yes (per shift) | void — known pattern |
| useCreateAbsence | Yes | Yes | void — known pattern |
| addReservationTool (voice) | **No** | — | — — MISSING (F-SC-01) |
| updateReservationTool (voice) | **No** | — | — — MISSING (F-SC-01) |
| addTaskTool session+task (voice) | **No** | — | — — MISSING (F-SC-01) |

## Performance / Test Gate Check

- No cascade seed helpers (`apps/e2e/helpers/seed.ts`) spotted for `schedule_day_booking`, `session_task`, `department_session` in this run — would need E2E journey tests for voice tool booking flows
- `evaluate-framework-rules.ts` has `__tests__` directory present — test coverage likely exists for pure function
- `split_shift_gap` rule silently returns null — any existing rule evaluation tests pass by vacuous truth on this case (F-SC-09)

---

## Prioritised Action List

| Priority | Finding | Effort | Blocks |
|----------|---------|--------|--------|
| P0 | F-SC-01: Voice tools direct DB writes without gate or emit | Low (delegate to Server Actions) | C4 integrity, audit trail |
| P1 | F-SC-04: useCreateAbsence bypasses admin gate at app layer | Low (Server Action delegate) | ADR-0286, ADR-0263 defense-in-depth |
| P2 | F-SC-02: All shift CRUD hooks bypass gatedMutation | Medium (ADR-0204 SS-5) | ADR-0204 SS-5 completion |
| P3 | F-SC-03: Saturday helgetillegg metadata says 15:00, resolver uses 14:00 | Trivial (string change) | Seed accuracy, documentation |
| P4 | F-SC-05: workspace_operating_hours fallback undeclared in D1 spec | Low (verify ADR-0218, update DATABASE.md) | D1 dimension clarity |
| P5 | F-SC-06: Rule evaluation advisory-only, WP1 still open | Medium (WP1 completion) | Framework gate completion |
| P6 | F-SC-07: pinDayControlContextAction emit TBD | Trivial (verify action body) | Audit completeness |
| P7 | F-SC-09: split_shift_gap silently skipped | Medium (implement check) | Riksavtalen delt-dagsverk detection |
| P8 | F-SC-08: createClient at hook render time | Trivial | Consistency |
