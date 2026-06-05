---
title: Stenhård Lista — Dashboard Feature (component+telemetry worklist)
status: in_progress
created: 2026-06-03
updated: 2026-06-03
module: design-handoff
tags: [worklist, component-index, stenhard-lista, dashboard, telemetry]
---

# Stenhård Lista — Dashboard feature

> The rock-hard worklist. Every interactive component on the `/dashboard` admin surface, mapped to
> its domain + telemetry event + backend binding + state. Grounded in code (Phase 1+2,
> domain-steward + component-index, 2026-06-03). Drives the plan + the fan-out. **State machine:**
> `wired` (real backend + registered event) · `partial` (visual ok, event or hook missing) ·
> `ghost` (hardcoded, no source — needs honest-empty or a new hook, DB-wall gated).

## Domains the dashboard touches
`day-session` (primary, the daily spine) · `scheduling` (absence/coverage) · `core-structure`
(profile/dept/season/KPI/budget) · `procedure-engine` (cascade tasks) · `reports` (activity feed +
heatmap) · `year-wheel` (season lifecycle).

## Rollup (the truth)

| Domain | Total | Wired | Partial | Ghost | Events MISSING | Hooks MISSING |
|---|---:|---:|---:|---:|---:|---:|
| day-session | 27 | 10 | 9 | 8 | 8 | 4 |
| scheduling | 3 | 0 | 3 | 0 | 3 | 0 |
| core-structure | 11 | 3 | 8 | 0 | 8 | 0 |
| procedure-engine | 5 | 3 | 2 | 0 | 2 | 0 |
| reports | 9 | 0 | 4 | 5 | 9 | 1 |
| year-wheel | 1 | 0 | 1 | 0 | 1 | 0 |
| **TOTAL** | **56** | **16** | **27** | **13** | **31** | **5** |

Wired 29% · partial 48% · ghost 23%.

## Backend-ready ranking (lightest → heaviest)
1. **procedure-engine / TodoTaskView** — 3/5 wired, 0 ghost, 0 hooks missing. LIGHTEST.
2. **day-session / ReconciliationView** — backbone real (approve/reject/day-approve); 1 ghost (handoff).
3. **core-structure / StrategicView+Budget** — KPIs real; gap = pure telemetry registration (8 events).
4. **scheduling / Strategic KPIs** — real hooks; telemetry-only (3 events).
5. **reports / ActivityView** — feed real; heatmap = `Math.random()` ghost; filter button unwired.
6. **day-session / OversiktCockpit ghost cluster** — HEAVIEST: 8 ghost (Brief, RiskTomorrow, 3 pulse tiles, receipts, coverage) — need net-new hooks (DB-wall gated).

## The plan (3 waves)

**Wave 1 — telemetry sweep (cheapest, backend-free).** Register + wire the ~18 MISSING events on the
NON-ghost partial/wired components (procedure-engine, core-structure, scheduling, reconciliation).
Moves ~18 partials → wired. Pure `register-events` (3-site + emit call-site). No design rewrite.

**Wave 2 — backend-ready ports (lightest-first).** Close domains to wired in rank order: 1 → 5.
frontend-designer polishes visual · harness-builder wires page-tools + gate + emit per `component_id`.

**Wave 3 — gap-track (ghost cluster, DB-wall gated).** The 13 ghosts: honest-empty NOW (truthful,
no fabricated data), build the missing hooks LATER with founder approval (oversikt Brief/RiskTomorrow/
coverage/receipts + activity heatmap). Each ghost = a backend-capability gap, not a 1-day close.

**Done = gates green:** every component traces to real backend (noop_gate); every event lands in
`activity_trail` (L3, when the smartout local Supabase is up). 31 phantom events → 0.

## Full per-component tables
See the Phase-1 domain-steward report (transcript 2026-06-03) for the 56-row per-component tables
(`component_id | feature | tier | module | telemetry_event_id | backend_binding | state`). Key ghosts:
OversiktCockpit Brief + RiskTomorrow (100% static), 3 pulse tiles (hardcoded 0/null), receipts (empty),
Reconciliation handoff (toast-only "not ready"), ActivityView heatmap (`Math.random()`, ActivityView.tsx:83).
