---
title: Stenhård Lista — MASTER (whole-app component+telemetry worklist)
status: in_progress
created: 2026-06-03
updated: 2026-06-03
module: design-handoff
tags: [worklist, component-index, stenhard-lista, master, telemetry]
---

# Stenhård Lista — MASTER

> The whole-app worklist. 6 major features mapped component-by-component via the `component-worklist`
> skill (domain-steward SQL-side + JSX-side + telemetry classification), grounded in code 2026-06-03.
> Per-feature detail lives in `STENHARD-LISTA-<feature>.md` + the dispatch transcripts. This is the index.
> **State:** `wired` (real backend + registered event) · `partial` (visual ok, event/hook missing — cheap) ·
> `ghost` (hardcoded, no source — honest-empty now + new hook later, DB-wall gated).

## Grand total (413 components, 6 features)

| Feature | total | wired | partial | ghost | events MISSING | hooks MISSING |
|---|---:|---:|---:|---:|---:|---:|
| kommunikasjon | 62 | 34 | 16 | 12 | 28 | 3 |
| vaktplan/schedule | 77 | 39 | 33 | 5 | 36 | 3 |
| lønn/payroll | 42 | 18 | 23 | 2 | 24 | 2 |
| dashboard | 56 | 16 | 27 | 13 | 31 | 5 |
| ansatte/people | 108 | 29 | 33 | 46 | 75 | 2 |
| hms | 68 | 9 | 49 | 10 | 55 | 10 |
| **TOTAL** | **413** | **145** | **181** | **88** | **249** | **25** |

**Wired 35% · partial 44% · ghost 21% · 249 telemetry events to register · 25 missing hooks.**

## Backend-ready ranking (feature wave order — lightest friction first)
1. **kommunikasjon** (55% wired) — call/channel/message/helpdesk all wired; gap = nav events + nyheter read-receipt ghost.
2. **vaktplan** (51% wired) — every mutation wired (shift/swap/template/absence); 33 partials = pure nav/filter telemetry sweep; ferieplan approve/reject not built.
3. **lønn** (43% wired) — period/export/PDF mutations wired; partials = tab/drawer nav; 2 ghosts (tariff history + supplement-overrides BFF-empty).
4. **dashboard** (29% wired) — wave-1 telemetry sweep DONE (13 events, fd0d2f717); oversikt ghost cluster (Brief/RiskTomorrow) heaviest.
5. **ansatte** (27% wired) — 46 ghost, but most are read-only filters (legit ghost); 3 raw client-writes bypass gate (people [id] hr_save/deactivate — ADR-0114 finding).
6. **hms** (13% wired, 49 partial) — backbone live (deviation/drift/session_task); cheapest sweep (mostly partial); LearnFlow `mark_done` lands NO row (critical gap); 2 client-side DB writes (ADR-0114).

## The 3-wave plan (applied app-wide)
- **Wave 1 — telemetry sweep** (cheapest, backend-free): register + wire the **249 missing events** on the
  181 partial components (real backend already). Per feature, per the `register-events` recipe. Moves
  partial → wired. *(dashboard wave-1 done: fd0d2f717.)*
- **Wave 2 — backend-ready ports** (lightest-first per ranking): frontend-designer ports visual · harness-builder
  wires page-tools + gate + emit per `component_id`. Telemetry sweep first within each.
- **Wave 3 — gap-track** (the 88 ghosts, DB-wall gated): honest-empty NOW; build the missing 25 hooks LATER
  with founder approval. Key: oversikt Brief/RiskTomorrow · hms LearnFlow completion · ferieplan approve ·
  activity heatmap · tariff history · nyheter read-receipt · 3-5 ADR-0114 client-write promotions.

## Cross-cutting findings (real, surfaced by the 5 agents)
- **ADR-0114 client-side DB writes** (should be server actions + gated): people `[id]` hr_save/deactivate,
  employee-profile-card deactivate, hms `useCreateSessionHook` + `useBulkAssignProtocol`. 5 sites.
- **Phantom-done**: hms LearnFlow `mark_done` reaches "done" with zero DB write / no emit — never lands a row.
- **Fake-data partials**: hms `hms.umbrella.viewed` fires with hardcoded `0` readiness; dashboard oversikt Brief.
- **BFF-delegated telemetry** (correct, not a gap): marketplace/proposed-plan/payroll emit in the BFF per ADR-0134;
  client onSuccess has no emit by design — do NOT double-register.

## Method
`.claude/skills/component-worklist/` — the reusable skill. One agent per feature, read-only, parallel-safe.
Detail per feature: `STENHARD-LISTA-dashboard.md` + transcripts (vaktplan/ansatte/hms/lønn/kommunikasjon, 2026-06-03).
