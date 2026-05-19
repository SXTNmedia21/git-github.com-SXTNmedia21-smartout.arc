---
title: Slice 14 — missions-e2e
run: 2026-05-18 (full)
adrs: []
status: late-arrival # agent wrote to scratch, transcribed here for completeness
---

# missions-e2e — 2026-05-18 (full)

Agent transcribed post-hoc — original write missed disk.

## Findings

### CRITICAL
none

### HIGH
none

### MEDIUM
- **F-14-01** `apps/web/src/components/day/DayLineStrip.tsx:101` — `attach-routine-trigger` exact testid was dynamic suffix (`${line.day_line_id}`), causing primary spec selector in `apps/e2e/tests/day-line/attach-routine.spec.ts:69` to never match. Role-based fallback (`/Legg til rutine/i`) masked the gap.
  - **STATUS: CLOSED in commit 628041add (testid static + day-line-id moved to data attribute).**

### LOW
- **F-14-02** `packages/ai/src/missions/types.ts` — `SEASON_LIFECYCLE_MISSION_ID = "season-lifecycle"` intentionally absent from MissionIdSchema (session-spawned, not routed through getMission()), but no inline comment documenting the design decision.
- **F-14-03** No E2E spec covers season-lifecycle session-spawn path. Nearest coverage = DB-level `season-activation.spec.ts`.
- **F-14-04** `packages/ai/src/missions/registry.ts` — MISSIONS typed `Record<string, AgentMission>` not `Record<MissionId, AgentMission>` — no compile-time enum guard against drift between registry and schema.

## Coverage

- Missions package — structural integrity verified (MissionIdSchema ↔ MISSIONS 7:7, MISSION_MANIFEST import-time derived)
- ADR-0367 day-line web E2E — 3 specs structurally correct, graceful skip patterns, all expected testids confirmed present in DOM EXCEPT F-14-01 (now closed)
- Mobile spec — all 4 testids in `(calendar)/day/[date].tsx` confirmed (calendar-day-screen, day-screen-day-date, day-screen-scroll, day-screen-loading, day-line-sections)
- Mission publish pipeline (`journey-capability-publish-mission.spec.ts` + `journey-mission-resolution.spec.ts`) — strongest specs in suite, L-0125 spirit-vs-letter pattern correct, double-negative invariant covers ADR-0196 Invariant 11

## Notes

E2E specs gracefully degrade via `test.skip` when Phase-C UI triggers absent — correct pattern. Mission resolution serial-mode prevents race. Cleanup order respects FK constraint (engine_stages before engine_missions).
