# Supervisor Agent Memory

## Module Docs Location
- CLAUDE.md references "23 module docs" in `docs/modules/` but most have been moved to `docs/architecture/modules/`. Only `MODULE_YEAR_WHEEL_PRD.md` is in `docs/modules/` currently. 3 remain in `docs/architecture/modules/` (BOTSSON, 0_ROADMAP, AGENT_SDK).
- MODULE_ naming convention is established but inconsistent in location.

## Year Wheel / Season Architecture
- `/dashboard/season/` route is fully deleted. All code lives at `/dashboard/year-wheel/` (29 files).
- Gap closure plan (`2026-04-10-season-year-wheel-gap-closure.md`) still references `/dashboard/season/` paths in 44 locations — stale and dangerous for agents.
- ADR-0085 is the actual year wheel governance policy. The gap closure plan references creating it as ADR-0080, but 0080 was taken by `compliance-drift-signal-read-only`.
- `duplicateYear` mutation clones seasons + planning_events but explicitly skips budgets, day_factors, hour_factors. Comment in code says "those need fresh configuration."
- All 5 mutations in `use-seasons.ts` have `emit()` calls: createSeason, activateSeason, archiveSeason, duplicateYear (emits "season created"), updateSeasonDates.
- Season hooks live in `apps/web/src/app/dashboard/year-wheel/_hooks/` — violates mobile parity rule (should be in `packages/`). STATE.md tracks this as known gap.

## ADR Numbering
- As of 2026-04-12: ADRs 0001-0085 exist. 0080 = compliance-drift-signal, 0085 = year-wheel-governance.
- Historical collision resolution documented in STATE.md (6 collisions resolved 2026-04-07).

## Common Agent Mistakes to Watch For
- Creating files under `/dashboard/season/` instead of `/dashboard/year-wheel/`
- Creating custom tracking tables instead of using Event Engine
- Hardcoding Norwegian text instead of i18n keys
- Missing `emit()` on mutations
- ADR number collisions (always check latest ADR before assigning number)
