---
title: "Scheduling — Architecture"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: scheduling
mirror: verified
last_verified: 2026-05-23
tags: [scheduling, shift, architecture, solver, capabilities, shift-mcp, lifecycle]
---

# Scheduling — Architecture

> L1–L5 code map + 5-layer lifecycle trace. Every anchor is grep-verified.

## L1 — UI Surfaces

### Manager schedule (`apps/web/src/app/dashboard/schedule/`)

| File / Directory | Purpose |
|---|---|
| `page.tsx` | Main schedule grid page — renders `DailyGrid`, `PlannerCommandBar`, `DayInspector` |
| `layout.tsx` | Schedule layout wrapper |
| `_components/booking-dialog.tsx` | Create/edit shift modal (6 tabs: Detaljer, Funksjoner, Historie, Lønnsgrunnlag, Oppgaver, Innstillinger) |
| `_components/daily-grid.tsx` | Main calendar grid — Ansatt/Jobb/Team grouping |
| `_components/day-inspector.tsx` | Right-side panel: Summary, Issues, Actions, Activity |
| `_components/day-context-menu.tsx` | Per-day kebab: Publiser dag / Avpubliser / Kopiere / Lagre som mal / Last inn mal |
| `_components/day-control/` | Day-level controls (filter, guide popover) |
| `_components/SwapRequestDialog.tsx` | Swap request UI — feeds shift-swap capability |
| `_components/SwapApprovalSection.tsx` | Manager approves swap |
| `_components/PipelineLockBadge.tsx` | Shows `pipeline_lock_state_id` lock status |
| `_components/ShiftUnlockHint.tsx` | Explains temporal lock to user |
| `_components/ScheduleTabNav.tsx` | Ansatt / Jobb / Team tab navigation |
| `_hooks/use-publish-validation.ts` | Pre-publish constraint check |
| `_hooks/use-hours-overrides.ts` | Reads `department_hours_override` + `planning_event` |
| `marketplace/` | Open-shift marketplace sub-route |
| `proposed-plan/` | Solver bundle review sub-route |
| `pipeline/` | Pipeline state sub-route |

### Employee my-schedule (`apps/web/src/app/dashboard/my-schedule/`)

| File | Purpose |
|---|---|
| `page.tsx` | Employee schedule view — read-only upcoming shifts |
| `_components/` | Shift cards, absence markers |
| `_tools/` | Botsson page-tools (shift read surface) |
| `actions.ts` | Server actions for my-schedule mutations |

### Mobile schedule

| Surface | ADR | Status |
|---|---|---|
| Shift hub `apps/mobile/app/(app)/(shifts)/` | ADR-0133 | Mobile = execute verb (claim, confirm, clock-in) |
| Shift create `apps/mobile/app/(app)/(shifts)/create.tsx:54` | ADR-0277 | **DEVIATION** — direct insert, BFF migration pending |
| Shift confirm `POST /api/mobile/shifts/[id]/confirm/route.ts` | ADR-0277 | BFF path implemented |
| Shift clock-in `POST /api/mobile/shift-session/[id]/clock-in/route.ts` | ADR-0096 | D6 production — EDGE: belongs day-session |

## L2 — BFF / Server Actions

| Path | Purpose | ADR |
|---|---|---|
| `apps/web/src/app/api/mobile/shifts/route.ts` | POST — mobile shift create BFF | ADR-0277 |
| `apps/web/src/app/dashboard/_actions/add-shift-action.ts` | Web shift create server action (authority-gated) | ADR-0099 |
| `packages/schedule/src/use-grid-mutations.ts` | TanStack Query mutations: `useFillFromTemplate`, `usePublishWeek` | ADR-0047 |

## L3 — Capabilities (5)

### Naming note (Deviation D1)

`shift-swap` uses kebab-case; `shift_marketplace` uses snake_case. Both conventions coexist — this is a naming drift, not a bug. See [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md#d1).

| Capability | Dir | Tools (count) | Channel | ADR |
|---|---|---|---|---|
| `schedule` | `packages/ai/src/capabilities/schedule/` | 6 (read surface) | voice + chat | ADR-0036 |
| `scheduler` | `packages/ai/src/capabilities/scheduler/` | 3 (solve/propose/accept/reject) | chat-only | ADR-0307/0309 |
| `shift-lifecycle` | `packages/ai/src/capabilities/shift-lifecycle/` | 5 (publish/approve/interpret/settle/clock_in_check) | mixed (interpret+settle=system-only) | ADR-0095 |
| `shift-swap` | `packages/ai/src/capabilities/shift-swap/` | 6 (get_swap_requests/eligibility, request/respond/cancel/override) | chat-only mutations | ADR-0288 |
| `shift_marketplace` | `packages/ai/src/capabilities/shift_marketplace/` | 6 (list_open_offers/post_open/claim/approve_claim/cancel_offer/override) | chat-only mutations | ADR-0288/0306 |

**Tool inventory:**

**`schedule`** (`packages/ai/src/capabilities/schedule/tools.ts`):
- `get_my_shifts` (line 34) — employee reads own upcoming shifts
- `get_shift_colleagues` (line 122) — who else is on this shift (chat-only per ADR-0288)
- `get_today_schedule` (line 167) — today's schedule for workspace
- `get_shift_detail` (line 228) — single shift detail
- `get_workspace_schedule` (line 269) — manager reads full workspace schedule (chat-only)
- `get_date_schedule_for_me` (line 386) — employee reads own schedule for specific date
- `get_shift_lifecycle` (`tools/get-shift-lifecycle.ts:40`) — reads `v_shift_lifecycle` view

**`scheduler`** (`packages/ai/src/capabilities/scheduler/tools.ts`):
- `propose_plan` (line 261) — greedy solver → single `change_proposal` bundle
- `accept_proposal` (line 386) — atomic all-or-nothing accept
- `reject_proposal` (line 550) — reject and close proposal

**`shift-lifecycle`** (`packages/ai/src/capabilities/shift-lifecycle/tools.ts`):
- `publish_shift` (line 135) — D6 Execution: set status = published
- `approve_shift` (line 270) — C1 Decision: manager ratifies hours
- `interpret_shift` (line 471) — D6 Derived: apply D3 rules to Reality (system-channel only)
- `settle_shift` (line 529) — C3 Derivation: compute `shift_cost_snapshot` (system-channel only)
- `clock_in_check` (line 636) — pre-clock validation

**`shift-swap`** (`packages/ai/src/capabilities/shift-swap/tools.ts`):
- `get_swap_requests` (line 75), `get_swap_eligibility` (line 123) — reads
- `request_swap` (line 187), `respond_to_swap` (line 330), `cancel_swap` (line 502) — mutations (chat-only guard at lines 198, 339, 510)
- `override_swap_pipeline` (line 652) — admin override (chat-only)

**`shift_marketplace`** (`packages/ai/src/capabilities/shift_marketplace/tools.ts`):
- `list_open_offers` (line 123) — read
- `post_open` (line 171) — manager posts offer (chat-only: line 189)
- `claim` (line 324) — employee claims (chat-only: line 378)
- `approve_claim` (line 566) — manager approves (chat-only: line 574)
- `cancel_offer` (line 731) — manager cancels
- `override_marketplace_pipeline` (line 892) — admin override (chat-only)

## L4 — shift-mcp Service

`services/shift-mcp/` — Hono + MCP SDK, port 5011.

**Routes:**
- `GET /health` (`src/index.ts:43`)
- `POST /mcp` (`src/index.ts:53`) — stateless per-request, auth middleware creates `McpServer` with `workspaceId` closure

**MCP Tools** (`src/server.ts`):
- `create_shift` — creates new `schedule_shift`
- `update_shift` — updates fields (hours auto-recalc)
- `list_shifts` — workspace date-range query with optional employee/status/team filters
- `get_shift` — single shift by ID (workspace-scoped)
- `delete_shift` — only `created` or `unpublished` status; published/active/completed block

Auth: `src/middleware/` validates workspace; all tools operate with `workspaceId` bound at request time (zero ambient context).

**Greedy solver** (`packages/ai/src/scheduler/solver/greedy.ts`):
- Pure TypeScript function — no DB writes, no side effects
- Input: `SolverInput` (profiles, demand buckets, existing shifts, D3 rules)
- Output: `SolverOutput` {proposed_shifts[], gaps[], metadata}
- Tests: `packages/ai/src/scheduler/__tests__/greedy.test.ts`

## L5 — Data Layer

See [DATA-MODEL.md](./DATA-MODEL.md) for full table inventory, migration grouping, and telemetry events.

## Five-Layer Lifecycle (ADR-0095)

| Layer | Table | Migration anchor | Tool | Status |
|---|---|---|---|---|
| **Execution (D6 commitment)** | `schedule_shift` | `20260301300000_schedule_shift_table.sql:55` | shift-lifecycle: `publish_shift` | ✅ Built |
| **Reality (D6 source)** | `timesheet.time_entry` | `20260324090000_timesheet_schema.sql` | mobile punch (`use-punch.ts`) | ✅ Built (owned by day-session execution path) |
| **Interpretation (D6 derived)** | `shift_hour_interpretation` | `20260506100001_shift_derivation_layer.sql:40` | shift-lifecycle: `interpret_shift` (system-only) | ✅ Built |
| **Derivation (C3)** | `shift_cost_snapshot` | `20260506100001_shift_derivation_layer.sql` (ALTER) | shift-lifecycle: `settle_shift` (system-only) | ✅ Built |
| **Decision (C1)** | `shift_approval`, `daily_reconciliation` | `20260304200200_deviation_shift_approval.sql`, `20260304200100_daily_reconciliation.sql` | shift-lifecycle: `approve_shift` | ✅ Built |

Pipeline v2 (`20260620110200`) seeds two `engine_process` blueprints:
- `shift_swap_lifecycle` — 3 stages (propose→consent→approve)
- `marketplace_lifecycle` — 3 stages (post→claim→approve)

Both restricted to `ARRAY['chat']` per ADR-0340 §Q5 + ADR-0288.

Aggregate read views:
- `public.v_shift_lifecycle` — manager-role view (all columns incl `gross_cost`) — `20260508100000:29`
- `public.v_shift_lifecycle_employee` — employee-role view (cost columns masked) — `20260510200000:47`
