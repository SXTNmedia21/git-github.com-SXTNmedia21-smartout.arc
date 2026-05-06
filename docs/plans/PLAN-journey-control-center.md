---
title: "Plan — journey-control-center"
feature: journey-control-center
spec: ../superpowers/specs/2026-05-06-journey-control-center.md
status: draft
updated: 2026-05-06
created: 2026-05-06
module: journey-engine
tags: [plan]
---

# Plan — journey-control-center

> Branch: `feat/journey-control-center` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-1` | Base: `development` | Module: journey-engine | Started: 2026-05-06

**Spec:** [Local Journey Control Center](../superpowers/specs/2026-05-06-journey-control-center.md)
**Detailed implementation plan (29 tasks / 9 phases):** [superpowers/plans/2026-05-06-journey-control-center.md](../superpowers/plans/2026-05-06-journey-control-center.md)

## Journeys (the contract)

- [JOURNEY-journey-control-center-run-journey-with-speed](../journeys/JOURNEY-journey-control-center-run-journey-with-speed.md) — Pontus picks journey + speed profile (full/normal/ai_companion), klikker Run, ser live SSE-progress
- [JOURNEY-journey-control-center-compile-markdown-to-ir](../journeys/JOURNEY-journey-control-center-compile-markdown-to-ir.md) — Pontus velger draft markdown, klikker Compile, Claude returnerer IR, journey blir kjørbar

## Goal

Standalone Next.js dashboard at port 3334 lister kompilerte + draft journeys, kompilerer markdown→IR via Claude, kjører med 3 speed profiles, streamer live progress til browser.

## Tasks

29 tasks i 9 faser — full breakdown i [superpowers/plans/2026-05-06-journey-control-center.md](../superpowers/plans/2026-05-06-journey-control-center.md):

- [ ] Fase 1: SpeedProfile-primitiv i `@smartout/journey-ir`
- [ ] Fase 2: protocol-runner.ts + gate-checker.ts respekterer profil
- [ ] Fase 3: `apps/journey-control/` Next.js-app oppe på port 3334
- [ ] Fase 4: Filsystem-discovery via `GET /api/journeys`
- [ ] Fase 5: Run-engine spawner Playwright child + SSE-stream
- [ ] Fase 6: Dashboard-UI: liste, speed-picker, run-knapp, log-viewer
- [ ] Fase 7: Markdown→IR-compile via Claude Sonnet 4.6
- [ ] Fase 8: Abort-knapp + søk-filter
- [ ] Fase 9: ADR-0284 + journey-doc + handoff

## Acceptance Criteria

- [ ] Begge journeys har `status: verified` i frontmatter
- [ ] Typecheck grønn: `pnpm turbo typecheck`
- [ ] ADR-0284 (speed profiles) registrert i `0000-decision-log.md`
- [ ] Minst én E2E-test per journey
- [ ] App starter rent på port 3334 via `pnpm --filter @smartout/journey-control dev`
