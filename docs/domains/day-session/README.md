---
title: "Day Session — Domain Index"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: day-session
tags: [domain, day-session, d6, department-session, dagslinjen, signoff, reconciliation, source-of-truth]
---

# Day Session — Source of Truth

> Authoritative folder for the **day-session** domain. If code contradicts this folder → **CODE wins**, update these docs.
>
> **Absorption note:** `docs/modules/daytimeline/` (8 files) has been absorbed into this domain. The daytimeline module was the `active`-phase surface of the same `department_session`. Both are now unified here. The old folder is archived with `superseded_by: docs/domains/day-session/`.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| `department_session` lifecycle + state machine | ✅ | 🟡 | Schema + RLS + EF `session-lifecycle` + `session-watchdog-demoter`. `locked` status lives on `daily_reconciliation`, not on `department_session` (design deviation — see GAPS §4b). |
| Day Timeline (Dagslinjen) — dept-anchored | ✅ | 🟡 | `WebDayControl` + 7 tabs shipped. Playwright in `apps/e2e/dagslinjen-quickadd/` + `apps/e2e/timeline-templates/`. |
| Tri-layer (ADR-0367) — Phase A+B schema | ✅ | 🔴 | `day_line`, `shift_session`, `shift_session_day_line` tables + capabilities seeded. UI (Phase C), mobile (Phase D), push (Phase E) in flight. |
| session_hook + session-hook-executor | ✅ | 🔴 | EF fires hooks, materializes session_task rows, anchors via `fn_resolve_single_day_line`. |
| Signoff (close) flow | ✅ | 🟡 | `SignoffTab` + `signoffSessionAction` → pending_signoff → closed. Tips integration ADR-0228. |
| `financial_close_config` (customizable tolerances) | ✅ | 🔴 | Schema exists (`20260328120100`). UI to configure it: GAP — not confirmed in web. |
| Admin dagsgodkjenning (`/dashboard/reconciliation`) | ✅ | 🟡 | `DayList` + `DayDetail` + wizard + approve/lock flow live. Mislabelled "Avstemming" in sidebar (naming-collision GAP, see GAPS §6). |
| `daily_reconciliation` + `settlement_image` + `settlement_validation` | ✅ | 🔴 | Schema + RLS + OCR EF `process-settlement-image` + `validate-settlement` shipped. |
| Mobile Home (phase-aware before/during/after) | ✅ | 🔴 | `apps/mobile/app/(app)/(home)/index.tsx` — 4 views (NoShift + Before + During + After). `DuringShiftViewV2` behind feature flag. |
| Mobile day calendar route | ✅ | 🔴 | `apps/mobile/app/(app)/(calendar)/day/[date].tsx` — read-only vertical timeline. |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, FKs, enums, RLS, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | Flow index → journeys |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + ADR/journey refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test = proof of built |

## Agent Guardrails

> Read before touching day-session code. Truth lives in this folder.

- **Never write session mutations without `gatedMutation` (ADR-0204)** — all Server Actions must wrap `gate_action`. No direct browser writes.
- **`session_hook` is a template, NOT a per-session instance** — it does NOT receive `day_line_id` (ADR-0367 Rule 2). Only the `session_task` rows materialised from a hook at fire time carry `day_line_id`.
- **`locked` is NOT a `department_session_status` enum value** — it lives on `daily_reconciliation.status` (`reconciliation_status` enum). The design calls the 6th phase "locked" but code implements it through the reconciliation layer. This is intentional (per ADR-0156 precedent: stored status drifts). See GAPS §4b.
- **`daily_reconciliation` "Avstemming" ≠ billing "Avstemming"** — these are different objects sharing the same Norwegian word. The billing domain owns accountant-facing period reconciliation (`billing.settlement_period`). This domain owns operational day-approval (`daily_reconciliation`). Never conflate them. Rename the operational concept to "dagsgodkjenning" in new UI work (see GAPS §6).
- **`gaceMinutes` / `planned_open` / `planned_close`** — resolved at session creation from `department_operating_hours` via Cascade A1 (migration `20260421100350_cascade_a1_alter_existing.sql`). Never hardcode.
- **ID derivation is server-side** — `workspace_id`, `profile_id`, `department_id` derived in Server Actions via `getServerContext()` per ADR-0151. Body-supplied IDs are rejected.
- **`day_line_id` is accepted as tool input but validated against parent `department_session_id`** — see ADR-0367 §Rules.
- **All telemetry via `emit()`** — register new events in BOTH `SmartoutEvent` union AND `EVENT_ROUTING` map in `packages/telemetry/src/registry.ts` or they silently drop.
- **Mobile is read-only** per ADR-0133 — no new authoring affordances on mobile. Only `shift-lifecycle.clock_in/out` is the permitted write.
- **Owning tables:** `department_session`, `day_line`, `shift_session`, `shift_session_day_line`, `session_hook`, `session_task`, `deviation`, `daily_reconciliation`, `settlement_image`, `settlement_validation`, `timeline_template`, `schedule_day_booking`, `schedule_day_info`, `financial_close_config`.
- **Owning Edge Functions:** `session-lifecycle`, `session-hook-executor`, `session-watchdog-demoter`, `session-task-overdue-cron`, `daily-session-replenish`, `process-settlement-image`, `validate-settlement`, `ops-day-brief`.
- **Web entry point:** `apps/web/src/components/day/WebDayControl.tsx` (ADR-0156) · **Reconciliation route:** `apps/web/src/app/dashboard/reconciliation/` · **Mobile Home:** `apps/mobile/app/(app)/(home)/index.tsx`.
