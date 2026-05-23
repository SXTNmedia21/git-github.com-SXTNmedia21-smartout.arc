---
title: "Scheduling — Gaps and Debt"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: scheduling
mirror: verified
last_verified: 2026-05-23
tags: [scheduling, gaps, debt, deviation, overlap]
---

# Scheduling — Gaps and Debt

> Honest record of deviations (code diverges from ADR/spec), gaps (feature not built), overlaps (seams with other domains), and debt (known tech debt). CODE WINS — if something works but doesn't match docs, update docs.

## Deviations

### D1 — Naming drift: `shift-swap` (kebab) vs `shift_marketplace` (underscore)

**What:** Two capabilities in the same domain use different naming conventions.
- `packages/ai/src/capabilities/shift-swap/` — kebab-case directory + capability name `shift_swap`
- `packages/ai/src/capabilities/shift_marketplace/` — snake_case directory + capability name `shift_marketplace`

**Impact:** Inconsistent `pnpm list` output; tool-collision scanner may miss cross-naming conflicts. Not functional.

**Fix path:** Rename one convention to match the other in a dedicated cleanup sortie. Requires updating all import paths + `known-tool-name-collisions.json`.

**Classification:** Minor — naming only. No behavioral impact.

### D2 — Mobile shift-create bypasses BFF authority gate (ADR-0277 open)

**What:** `apps/mobile/app/(app)/(shifts)/create.tsx:54` imports `useCreateShift` which does a direct `supabase.from("schedule_shift").insert()` without authority gate, audit reason, or source attribution.

**BFF exists but is not the sole path:** `apps/web/src/app/api/mobile/shifts/route.ts` implements the BFF side. The legacy path has not been removed.

**Impact:** CRITICAL compliance gap (Aml. §14-6, bokføringsloven §13) — shifts created from mobile have no gate, no source, no audit reason. `day_category` derived in device timezone (not workspace timezone) = potential tariff bucket error.

**Fix path:** Close ADR-0277 (proposed → accepted), remove legacy `useCreateShift` direct path, route all mobile shift-create through BFF. Authority gate via `gatedMutation()` (ADR-0204 SS-5 backlog).

**Classification:** CRITICAL deviation.

### D3 — `department_session_lifecycle` engine_process seed not confirmed

**What:** `20260427100000_seed_shifts_published_trigger.sql` references process `department_session_lifecycle` but SHIFT_LIFECYCLE_MAP.md §Stage 2 flags: "seed migration not located." The `shift_lifecycle_v1` and `daily_close` processes are confirmed; `department_session_lifecycle` is uncertain.

**Impact:** Publish event may not correctly trigger session lifecycle if process is missing.

**Fix path:** Search `supabase/migrations/` for `department_session_lifecycle` seed; if missing, create seed migration.

### D4 — `hours_confirmed` telemetry emit missing in approval handlers

**What:** SHIFT_LIFECYCLE_MAP.md §Stage 4 flags: "`shift hours_confirmed` declared in `registry.ts:~1254` but `emit()` not present in admin handler paths."

**Impact:** Audit trail incomplete for manager hour-approval events.

**Fix path:** Add `emit('shift hours_confirmed', {...})` to `shift-lifecycle` capability `approve_shift` tool post-success path.

### D5 — Dual event-name routing partially unwound

**What:** `shift published` (singular) and `shifts.published` (plural) existed as two routes for the same event. `20260507100200_unwind_shifts_published_alias.sql` was supposed to clean this up, but verify the duplicate is fully removed.

**Fix path:** Grep `packages/telemetry/src/registry.ts` for both `shift published` and `shifts.published` — confirm only singular survives.

### D6 — `shift_cost_snapshot` not always present at close

**What:** SHIFT_LIFECYCLE_MAP.md §Stage 6 flags: payroll export handler not found. `shift_cost_snapshot` rows exist after `settle_shift` runs, but full payroll export integration (Stripe/accounting) is not implemented.

**Classification:** Known gap, tracked in Roadmap.

## Gaps

### G1 — `v_shift_lifecycle` aggregate read view — ADR-0095 §Rules

ADR-0095 states: "no aggregate view ships until all five layers have authoritative tables." All 5 layers now have tables; `v_shift_lifecycle` ships. **Gap closed.** ✅

### G2 — Geofence validation on punch-in

SHIFT_LIFECYCLE_MAP.md §Stage 3: "`punch_in_location` captured but never validated against `department_operating_hours`." Geofence validation = GAP.

**Owner:** day-session domain (clock-in execution). Document as EDGE here.

### G3 — Late/no-show event handlers missing

SHIFT_LIFECYCLE_MAP.md §Stage 3: events `late_detected`, `no_show_escalated` declared in telemetry but no handlers found.

**Owner:** day-session + procedure-engine (escalation). Document as EDGE.

### G4 — `propose_plan` mobile surface

ADR-0307/0309 clarify `propose_plan` is web-only (Compose verb per ADR-0133). Mobile may `accept_proposal` / `reject_proposal` (Approve verb). No mobile UI for proposal review exists yet.

### G5 — Solver framework rules seeded for Riksavtalen only

`20260615200200_riksavtalen_scheduler_framework_rules.sql` seeds Riksavtalen constraint rules. Other frameworks (custom workspace overrides) are not yet seeded. Solver reads `framework_rule` rows — if a workspace has no matching rules, solver may produce unconstrained proposals.

### G6 — `shift_session` trigger coverage incomplete

`20260620130000_ensure_shift_session_trigger.sql` seeds trigger for auto-creating `shift_session`. Verify trigger fires on all relevant publish events, not only on explicit shift-session mutations.

### G7 — `cancel_shift_swap_rpc` end-to-end wiring

`20260504100004_cancel_shift_swap_rpc.sql` adds the RPC. `shift-swap` capability `cancel_swap` tool (`tools.ts:502`) calls it. Verify the full cancel flow (cancel → notify both parties) is wired in Event Engine.

## Overlaps

### O1 — `schedule_shift` ↔ `department_session` seam (day-session domain)

`schedule_shift` (plan) → `department_session` (session runtime). Formal 1:N relation per ADR-0096. Day-session owns `department_session` writes; scheduling owns `schedule_shift` writes. NEVER write `department_session` from scheduling capabilities.

**Status:** resolved (keep — ADR-0096).

### O2 — `shift_session` ownership ambiguity

`shift_session` (`20260620120300`) bridges plan (`schedule_shift`) and runtime (`department_session`). Scheduling domain owns the table (it's a scheduling-layer runtime slot, ADR-0367 §4.2), but `department_session_id` FK means day-session references it.

**Status:** scheduling owns the table; day-session reads it via FK. Not a conflict. Document as formal seam.

### O3 — `schedule_shift` → `payroll.calculation` (payroll domain)

Payroll reads `schedule_shift` to compute per-shift calculations. Scheduling does NOT write to payroll tables. Clear author/consumer boundary.

**Status:** resolved (keep — payroll reads scheduling).

### O4 — `planning_event` (year-wheel domain)

`planning_event` (D4 demand signal) rendered on year-wheel canvas. Scheduling reads `planning_event` via `use-hours-overrides.ts:40` for day-override context. Year-wheel authors; scheduling reads.

**Split candidate:** per `_DASHBOARD.md` year-wheel edge, `planning_event` will migrate to scheduling domain when scheduling domain matures. For now: year-wheel authors + scheduling reads.

**Status:** open (split candidate — deferred).

### O5 — Botsson reads `schedule_shift` (botsson domain)

ADR-0297 workforce snapshot: `schedule_shift` injected into Botsson's chat context at session start. Botsson reads; scheduling owns the table.

**Status:** resolved (keep — botsson reads only).

### O6 — `session_task` links to shifts (procedure-engine domain)

`session_task` rows may bind to specific `schedule_shift` via ADR-0391 expansion. Procedure-engine generates task content; scheduling produces the shift. Clear author/consumer.

**Status:** resolved (keep — procedure-engine generates tasks; scheduling provides shift anchor).

### O7 — Shift-clock execution (future day-session or shift-clock domain)

`apps/web/src/app/dashboard/shift-clock/` + mobile punch-clock are plan EXECUTION, not plan AUTHORING. These belong to day-session (or a future dedicated shift-clock domain). Scheduling domain should never claim ownership of punch-in/out.

**Status:** EDGE — scheduling provides the shift plan; clock-in is D6 production.

### O8 — `shift_session` clock-in BFF route

`POST /api/mobile/shift-session/[id]/clock-in/route.ts` touches `shift_session` (scheduling-owned table) but represents a D6 production execution act. This is an EDGE seam. If shift-session is reclassified to day-session as the domain matures, this route moves with it.

**Status:** open seam — document, don't move without explicit ADR.

## Tech Debt

### T1 — `addShiftAction` uses legacy `gateAction()` (ADR-0204 SS-5)

`apps/web/src/app/dashboard/_actions/add-shift-action.ts:201-211` uses legacy `gateAction()` (Pathway A), not `gatedMutation()` orchestrator. Tracked in ADR-0204 SS-5 backlog. Not this domain's sortie; flag here.

### T2 — pg_cron shift_reminder_crons not confirmed in prod

`20260504100003_shift_reminder_crons.sql` registers shift reminder crons. Per MEMORY.md (ADR-0388 learning): pg_cron was silently disabled in prod. Verify these crons are registered in production after pg_cron enablement.

### T3 — Day-category derivation client-side in grid mutations

SHIFT_LIFECYCLE_MAP.md §Stage 1: `use-grid-mutations.ts:340-359` derives `day_category` client-side. Should be server-side (D3 concern). Low priority — server-side BFF path does this correctly; only legacy direct-write path is affected.

### T4 — Solver constraint coverage limited to Riksavtalen

`20260615200200_riksavtalen_scheduler_framework_rules.sql` seeds only Riksavtalen. Custom workspace frameworks are not seeded. When custom frameworks are added, verify solver reads them correctly via `loadSolverContext()`.

### T5 — Parallel event routing in push-dispatch vs Event Engine

SHIFT_LIFECYCLE_MAP.md §Stage 2: `push_dispatch` trigger fires in parallel with Event Engine `send_notification` step. ADR-0095 plan is to migrate pg_net push to EE `send_notification`. Not yet done — both paths active.
