---
title: "Scheduling — Domain Index"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: scheduling
mirror: mixed
last_verified: 2026-05-23
tags: [scheduling, shift, schedule_shift, solver, marketplace, swap, lifecycle, temporal-lock]
---

# Scheduling — Source of Truth

> Authoritative folder for the **scheduling** domain.
> If code contradicts this folder → **CODE wins**, update these docs.
>
> **Scope: PLAN-SIDE only.** This domain owns shift planning and the plan-to-production handoff point at `schedule_shift`. Execution (punch-in/out clock) belongs to **day-session** (ADR-0096). Payroll calc flows downstream. Year-wheel's `planning_event` is an upstream D4 demand signal.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| Schedule UI `apps/web/src/app/dashboard/schedule/` | ✅ | 🟡 | Multi-view grid (Ansatt/Jobb/Team), day ops, booking-dialog, publish flow, day-inspector; TanStack Query persistence (ADR-0047) |
| My-schedule UI `apps/web/src/app/dashboard/my-schedule/` | ✅ | 🟡 | Employee read-only schedule surface |
| `schedule_shift` table + enums | ✅ | ✅ | Migration `20260301300000_schedule_shift_table.sql:55` |
| Temporal lock (ADR-0066) | ✅ | ✅ | `20260428130000_schedule_shift_temporal_lock.sql`; rollout + audit `20260428133000` |
| 5-layer lifecycle (ADR-0095/0340) | 🟡 | 🟡 | Reality+Execution+Derivation+Interpretation+Decision all have tables; pipeline v2 seeded `20260620110200` |
| `shift_hour_interpretation` (Interpretation layer) | ✅ | 🔴 | `20260506100001_shift_derivation_layer.sql:40`; `derive_shift_hours()` RPC exists |
| `shift_cost_snapshot` (Derivation layer C3) | ✅ | 🔴 | Extended in `20260506100001`; `snapshot_shift_cost()` RPC exists |
| `v_shift_lifecycle` + `v_shift_lifecycle_employee` | ✅ | 🔴 | `20260508100000` + `20260510200000` |
| Capability `schedule` (6 tools) | ✅ | ✅ | `packages/ai/src/capabilities/schedule/` — read surface |
| Capability `scheduler` (3 tools) | ✅ | 🟡 | `packages/ai/src/capabilities/scheduler/` — greedy solver ADR-0307/0309 |
| Capability `shift-lifecycle` (5 tools) | ✅ | 🟡 | `packages/ai/src/capabilities/shift-lifecycle/` — publish/approve/interpret/settle/clock_in_check |
| Capability `shift-swap` (6 tools) | ✅ | 🟡 | `packages/ai/src/capabilities/shift-swap/` — ADR-0288 chat-only guards in place |
| Capability `shift_marketplace` (6 tools) | ✅ | 🟡 | `packages/ai/src/capabilities/shift_marketplace/` — ADR-0288 guards in place |
| Greedy solver `packages/ai/src/scheduler/solver/greedy.ts` | ✅ | ✅ | `__tests__/greedy.test.ts` exists |
| shift-mcp service (5 MCP tools, port 5011) | ✅ | 🟡 | `services/shift-mcp/` Hono server |
| shift-swap engine (Event Engine blueprint) | ✅ | 🟡 | `20260413123343_shift_swap_engine.sql` |
| Marketplace (ADR-0306): `schedule_shift_offer` + pipeline | ✅ | 🔴 | `20260611120000_wfm_foundation.sql:171`; authority `20260611120100` |
| Pipeline v2 (`engine_authority_pipeline` table + 2 blueprints) | ✅ | 🔴 | `20260620110200_shift_lifecycle_pipeline_v2.sql` |
| `shift_session` table (ADR-0367 runtime layer) | ✅ | 🟡 | `20260620120300_shift_session_table.sql`; day-line junction `20260620120400` |
| Mobile BFF `POST /api/mobile/shifts` | 🟡 | 🔴 | ADR-0277 proposed; direct mobile insert still exists in `apps/mobile/app/(app)/(shifts)/create.tsx:54`; BFF at `apps/web/src/app/api/mobile/shifts/route.ts` coexists — migration incomplete |
| Density persistence (ADR-0364) | ✅ | ✅ | `apps/e2e/schedule/density.spec.ts` |
| shift-assistant mission (seeded 2026-04-06) | ✅ | — | `20260406110001_seed_shift_assistant_mission.sql` |
| Voice policy (ADR-0288 own vs others) | ✅ | — | Inline guards in shift-swap (`tools.ts:198,339,510`) + marketplace (`tools.ts:189,378,574`) |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status across all domains: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map + 5-layer lifecycle trace |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, enums, RLS, telemetry, 52 migrations |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | ~20 journeys grouped by surface |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + ADR/spec refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Deviations, gaps, overlap, debt |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test coverage map |

## Agent Guardrails

> Read before touching any scheduling code. These rules are non-negotiable.

- **PLAN-SIDE ONLY.** `schedule_shift` is the plan artifact. Punch-in/out, session lifecycle, and daily approval belong to **day-session** (ADR-0096). Never route clock-in mutations through scheduling capabilities.
- **5 capabilities, distinct concerns.** `schedule` = read; `scheduler` = solve/propose; `shift-lifecycle` = publish/approve/interpret/settle; `shift-swap` = bilateral trade; `shift_marketplace` = open-shift posting+claim. Never cross-call between these capabilities. Never add a tool to the wrong capability.
- **Voice "own-vs-others" rule (ADR-0288).** `set_own` availability = voice allowed. Any tool that shows other employees' shift data = chat-only. Inline channel guard at `shift-swap/tools.ts:198,339,510` and `shift_marketplace/tools.ts:189,378,574` — NEVER remove or bypass.
- **Temporal lock is non-bypassable (ADR-0066).** `schedule_shift_is_temporally_locked()` trigger fires on every planning-field mutation. Once a shift date has passed or the shift has started, planning fields are immutable. Only `pipeline_lock_state_id` has a carve-out (per `20260620110200`).
- **`schedule_shift` ≠ `department_session` (ADR-0096).** 1 session : N shifts. `schedule_shift` is the plan; `department_session` is the runtime container owned by day-session. Never write `department_session` from scheduling code.
- **ADR-0277 mobile BFF (proposed, not fully closed).** Mobile shift-create must route through `POST /api/mobile/shifts` (BFF) with authority gate, audit reason, and source attribution. The legacy `apps/mobile/app/(app)/(shifts)/create.tsx` direct insert is a known deviation — do NOT add new direct inserts from mobile.
- **Greedy solver writes ONE `change_proposal` row per run (ADR-0309).** Atomic all-or-nothing accept. Never loop `propose_plan` N times per shift. Never split a solver run across multiple `change_proposal` rows.
- **Never hardcode regulatory rates.** All constraint values (overtime threshold, night-premium, weekend rate) resolve from `framework_rule` / `tariff_rate_table` at runtime. `packages/ai/src/scheduler/solver/greedy.ts` loads D3 rules via `loadSolverContext()`.
- **ADR-0173 frozen-4 boundaries.** `shift-swap` + `shift_marketplace` are separate capabilities. Capability-merge proposal (ADR-0340 §Q4) is DEFERRED. Do not collapse them without a new ADR.
- **Telemetry on every mutation (ADR-0134).** Every scheduling mutation emits. Key namespace: `shift.*` events (created/updated/deleted/published/punched_in/punched_out/hours_confirmed), `scheduler.proposal.*` (proposed/accepted/rejected), `schedule.density_changed`, `agent.schedule.*`.
- Owning surfaces: `apps/web/src/app/dashboard/schedule/` · `apps/web/src/app/dashboard/my-schedule/` · `packages/ai/src/capabilities/{schedule,scheduler,shift-lifecycle,shift-swap,shift_marketplace}/` · `packages/ai/src/scheduler/solver/greedy.ts` · `services/shift-mcp/` · Core tables: `public.schedule_shift`, `public.shift_hour_interpretation`, `public.shift_cost_snapshot`, `public.shift_approval`, `public.schedule_shift_offer`, `public.shift_session`, `public.engine_authority_pipeline`
