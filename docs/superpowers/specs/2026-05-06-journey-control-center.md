---
title: "Local Journey Control Center"
status: draft
created: 2026-05-06
updated: 2026-05-06
module: journey-engine
tags: [spec, journey-engine, e2e, dashboard, speed-profiles]
relates_to:
  - PLAN_2026_05_06_journey_control_center
---

# Local Journey Control Center

## Goal

Standalone Next.js dashboard at port 3334 that lists every JourneyIR TS-file
AND every markdown journey draft, lets Pontus pick any, compiles markdown→IR
via Claude on demand, runs with 3 speed profiles
(`full` / `normal` / `ai_companion`), and streams live progress to the browser.

## Why

Today journeys run only via CLI per file. No fleet view of compiled vs draft.
No speed-profile selection. No live progress for non-CLI users. Manual
markdown→IR compile is a separate sortie. This feature consolidates the
authoring + runtime loop into a single local surface.

## Design

See implementation plan:
[PLAN-journey-control-center](../plans/2026-05-06-journey-control-center.md).

29 tasks, 9 phases. Reuses `apps/e2e/runners/protocol-runner.ts` core
unchanged. New `apps/journey-control/` Next.js 16 app. Markdown→IR via
Anthropic SDK with structured output.

## Out of scope

- Real fjernkontroll-driver with pause/resume mid-run (separate sortie)
- Mobile fjernkontroll port
- DB-backed `journey_version` rows (file-based only)
- `/join` and `/onboarding` IR-er (Sortie B)

## Acceptance

- Two journeys verified: `run-journey-with-speed`, `compile-markdown-to-ir`
- ADR-0284 (speed profiles) accepted
- Plan tasks 100% checked
