---
title: "Plan — perf-sprint-wave-1"
status: done
updated: 2026-04-18
created: 2026-04-17
module: performance
tags: [plan, adr-0091, adr-0113, adr-0114, adr-0115]
---

# Plan — perf-sprint-wave-1

> Branch: `feat/perf-sprint-wave-1` | Worktree: wt-2 | Module: performance | Started: 2026-04-17 | Closed: 2026-04-18

## Goal

Execute the Web Performance Council 2026-04-16 verdict in a single wave: ship ADR-0091 WP3 scaffold, split DashboardContext per ADR-0113, promote ADR-0114, migrate 11 dashboard routes to ADR-0115 RSC pattern, and audit the telemetry registry.

## Tasks

- [x] A1 — gate-client + ESLint rule (commit `b90dc1f5`)
- [x] A2 — telemetry registry audit (commit `42781ce1`)
- [x] A3 — DashboardContext split + facade hook (commit `92c71128`)
- [x] A4 — RSC migration: billing, cost, year-wheel (governance skipped — redirect-only)
- [x] B1 — RSC migration: my-salary, reconciliation, my-cv, komm
- [x] B2 — RSC migration: website, close, onboarding-assistant, ai
- [x] B3 — promote ADR-0114 to `accepted` (commit `57e52d63`)
- [x] C1 — integration: typecheck + lint + HANDOFF + JOURNEY (commit `3081fde7`)
- [x] Council review — post-implementation, 4 reviewers, FAIL blocker found
- [x] F1 — ADR/HANDOFF scope correction (cascade_gate_write RPC not shipped)
- [x] F2 — add SkeletonEntrance to 4 loading files (website, close, onboarding-assistant, ai)

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck` (33/33, baseline parity)
- [x] Lint passes: `pnpm turbo lint` (19/19, 0 errors, 424 expected `no-direct-supabase-write` warnings)
- [x] Decision log updated (ADR-0113/0114/0115 entries, ADR-0091 Implementation Status note)
- [x] User journeys written: `docs/journeys/JOURNEY-perf-sprint-wave-1.md`
- [x] HANDOFF written: `docs/HANDOFF-perf-sprint-wave-1.md`
- [x] Council verdict: APPROVE WITH REQUIRED FIXES (fixes applied)

## Known deferred work (not in scope)

- ADR-0091 WP2 — Postgres migration creating `public.cascade_gate_write`. Until this ships, any `gated*` helper call throws `42883 function does not exist`.
- DashboardContext consumer migration — 153 legacy consumers still route through the facade. Perf gain from the split is not realized until they migrate to slice hooks (`useThemeContext`, `useWorkspaceContext`, etc.).
- Telemetry phantom cleanup — 213 registered events never emitted (per A2 audit).
- 4 `useMutation` sites missing `emit()` (ReconciliationView, DailyNoteSheet, ReservationSheet, use-notifications).
