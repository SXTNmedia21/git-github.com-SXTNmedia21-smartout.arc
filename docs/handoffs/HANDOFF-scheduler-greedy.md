---
title: Handoff — Greedy Scheduler V1
status: in_progress
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [handoff, scheduler, greedy, wfm]
---

# Handoff — Greedy Scheduler V1

> Branch: `feat/world-best-wfm-scheduler-greedy` | Worktree: `/home/sxtnl/wsl/smartout.ai-world-best-wfm-wt-3` | Campaign: `campaign/world-best-wfm`

---

## What Was Built (Tasks 0–3 + 2 STAGE-D fixes)

### Task 0 — Riksavtalen framework_rule seed

Migration `*_riksavtalen_framework_rule_seed.sql` (timestamp > 20260615200100). Seeds one `regulatory_framework` row (`Riksavtalen NHO`, country `NO`, industry `hospitality`) and 5 `framework_rule` baseline rows: `aml_daily_hour_cap=9.0`, `aml_weekly_hour_cap=40.0`, `aml_rest_period_min=11.0`, `riksavtalen_kveldstillegg_threshold=18:00`, `riksavtalen_helgetillegg_threshold=lørdag-06:00`. Closes PHASE 0 A1 golden-case warning that solver had no D3 rules to enforce against.

### Task 1 — Pure TypeScript greedy solver

`packages/ai/src/scheduler/solver/greedy.ts`. Exported types: `SolverInput` (planning_cycle, demand_buckets, profiles, framework_rules, absences, existing_shifts, workspace_id) + `SolverProposal` (proposed_shifts, gaps, objective_score, solver_version:'greedy_v1', solver_run_id, solver_inputs_hash). Exported function: `solveGreedy(input): SolverProposal` — pure, deterministic. Algorithm: slice cycle into hour-buckets per department → sort by headcount demand DESC → per bucket filter via `eligibilityFor` → assign lowest `utilized_hours ASC, profile_id ASC` → emit ProposedShift or Gap. SHA-256 hash of canonical inputs for reproducibility. **8 Vitest tests** (determinism, gap-detection, fairness tie-break, AML constraint, absence exclusion, no-double-booking, demand coverage, hash stability).

### Task 2 — `scheduler` capability (3 tools)

`packages/ai/src/capabilities/scheduler/`. Registered in capability registry. Three tools:

- `propose_plan` (manager+, chat-only/web Compose): loads cascade context via BFF, calls `solveGreedy`, single `mutateWithGate` INSERT to `change_proposal` with `kind='scheduler_bundle'`, `trigger_type='manual_override'`, `changes` JSONB per ADR-0309 §V1 Persistence Shape, emits `scheduler.proposal.proposed` once
- `accept_proposal` (manager+, chat+mobile Approve): single `mutateWithGate` exec with transactional callback — `SELECT FOR UPDATE` → assert pending → parse JSONB → multi-row INSERT all proposed_shifts → UPDATE status='applied' + resolved_by + applied_at; emits `scheduler.proposal.accepted` ONCE
- `reject_proposal` (manager+, chat+mobile Approve): UPDATE status='rejected' + reason; emits `scheduler.proposal.rejected`

**9 Vitest tests** (3 per tool: happy + auth-fail + state-precondition).

### Task 3 — BFF `/api/scheduler/*` routes

Four Route Handlers under `apps/web/src/app/api/scheduler/`:
- `POST /api/scheduler/propose-plan`
- `POST /api/scheduler/accept-bundle` (body: `{change_proposal_id}`)
- `POST /api/scheduler/reject-bundle`
- `GET /api/scheduler/proposals` (inbox filtered `kind='scheduler_bundle'`)

### STAGE-D fixes

- **R3 commit `406971e4f`**: `accept_proposal` column drift — `entity_id` → `trigger_entity_id` in the mutateWithGate exec callback. Caught by Stop-hook typecheck.
- **R3 commit `35d7cf915`**: Tightened ADR-0288 voice guard on all 3 tools to positive enumeration (only `["chat"]` / `["chat","mobile"]` allowed — no fallback-to-reject logic; explicit allow-list).

---

## Decisions

| ADR | Decision |
|---|---|
| ADR-0307 | Greedy V1 chosen over OR-Tools/CP-SAT. V2 trigger: gap-rate >30% over 2 cycles. |
| ADR-0309 | Single-row bundle pattern: ONE `change_proposal` per solver run, JSONB immutable, atomic accept V1. V2a (proposal_group_id) + V2b (partial_applied enum) migration paths documented. |
| ADR-0307 §47 G3 amendment | Solver does NOT read `v_pos_sales_hour` V1 — manual `day_factor × hour_factor` coefficients only. G3 follow-on ADR-0320 covers POS-driven `hour_factor` calibration loop V2 trigger conditions. |

---

## Learnings

- **L-0272** (stub-cron-without-algorithm = telemetry-domain drift): if the calibration loop (ADR-0320) ships as a cron stub without the actual POS-to-`hour_factor` algorithm body, telemetry events will fire with no real state change underneath. The loop MUST carry the algorithm or be gated behind a feature flag.
- **L-0273** (column-name drift): `entity_id` vs `trigger_entity_id` in `mutateWithGate` exec callbacks. STAGE-D R3 caught this via Stop-hook typecheck on commit `406971e4f`. Pattern: always verify column names against the latest schema type, not plan code samples which drift from real types.
- **L-0247** (single-call mutateWithGate, no loop): `accept_proposal` applier uses a transactional exec callback that internally does the multi-row insert. The gate wraps the ENTIRE transaction once, not one gate call per shift. Verified in code review.

---

## Known Issues / Debt

### Deferred to next sortie (Tasks 4–7)

1. **Task 4 — Web `/dashboard/schedule/proposed-plan`**: glass header card (date range + N proposed + N gaps + objective_score) + read-only proposed shifts list (NO checkboxes V1) + gaps section with blocker codes + two buttons ("Godta hele planen" success / "Avvis" destructive) + single-sweep gradient animation on accept (NOT 50 simultaneous springs, per Frontend Phase 3 guidance)
2. **Task 5 — Mobile 3-component bundle UI**: `<BundleCard>` (summary) + `<BundleActionBar>` (bottom sheet Accept ALL / Reject ALL with `bg-background border-t border-border py-safe-bottom`) + `<ReadOnlyShiftList>` (flat list employee + role + time, NO per-row toggle V1). Route: `apps/mobile/app/(app)/(shifts)/proposed-plan.tsx`
3. **Task 6 — E2E protocols**: `p-scheduler-propose-accept.ts` (seed golden case → propose via chat → assert change_proposal JSONB → web Godta → assert N schedule_shift + single accepted event) + `p-scheduler-mobile-bundle.ts` (mobile BundleCard renders → Accept ALL → assert same DB state). Closes S10 + S11.
4. **Task 7 — Type regen + full typecheck**: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts` + `pnpm turbo typecheck` 52/52 + all tests green.

### STAGE-D R3 remaining gaps

- **Important #2 — `accept_proposal` voice-channel test gap**: body has the guard at line 396 (`channel !== "chat"` positive enum post-fix). Test suite covers happy path + auth-fail + state-precondition, but the voice-rejection path is NOT covered by a dedicated test case. Add in Task 6 batch or as standalone fix.
- **Important #3 — `day_category: "morning" as const` hardcoded**: all inserted shifts receive `day_category='morning'` V1 placeholder. Fix V2 by deriving from `start_at` hour (morning/afternoon/evening/night threshold from framework_rules or config) OR explicitly document as known V1 deferral in ADR-0309 §V2 errata.

### ADR-0309 V2 migration paths (documented, not shipped)

- **V2a**: `proposal_group_id UUID` column on `change_proposal` — enables partial-accept grouping across multiple `scheduler_bundle` proposals
- **V2b**: `partial_applied` enum value for `change_proposal.status` — tracks mixed-state bundles

### Calibration loop V2 (ADR-0320)

POS-driven `hour_factor` calibration (Lightspeed integration) is the follow-on ADR-0320. V2 trigger conditions: Lightspeed integration live + 30 days of real sales data available. Until then, demand is `day_factor × hour_factor × baseline_headcount` (manually maintained coefficients).

---

## Next Steps

1. Ship Task 4 web UI + Task 5 mobile UI + Task 6 E2E in follow-on sortie
2. Task 7 type regen + full typecheck pass in close-feature batch
3. Address Important #2 (voice-channel test) and Important #3 (day_category) — can bundle with Task 4/5 sortie
4. Register ADR-0320 when Lightspeed integration is scoped
5. `close-feature.sh` gate requires: decision log updated, JOURNEY complete, typecheck 52/52, HANDOFF present. Tasks 4–7 must complete before gate can pass.
