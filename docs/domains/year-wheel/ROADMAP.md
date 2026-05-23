---
title: "Year Wheel — Roadmap"
status: in_progress
mirror: aspirational
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: year-wheel
tags: [domain, year-wheel, season, roadmap, aspirational]
---

# Year Wheel — Roadmap

> Aspirational. Forward plan derived from CAMPAIGN-year-wheel, PLAN-year-wheel, redesign specs, and ADR-0085.
> What's built lives in [OVERVIEW.md](./OVERVIEW.md) + [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md).

## Governance reference

**ADR-0085** — Year Wheel Governance Policy: single-active-season invariant, status transitions, lifecycle rules.

## Campaign overview

**Campaign:** `campaign/year-wheel` (branch: `campaign/year-wheel`, worktree: `/home/sxtnl/dev/smartout.ai-year-wheel`)

The campaign's four milestone tracks:

| Milestone | Status | Description |
|---|---|---|
| M1 Cascade-gap closure | ✅ DONE | `season.activate` → `department_operating_hours` generation. Activation gate, `SeasonActivationProposal`, D1 fanout trigger. ADR-0200. |
| M2 Design-debt sweep | 🟡 Partial | Nordic Split clean across year-wheel + season routes. i18n migration partially complete. |
| M3 Agent surface | ✅ DONE | 5 season tools registered under `season` capability, intent classifier extended, voice + chat work. C4 authority seeds shipped. |
| M4 Deferred P1 completions | 🔴 Not started | Goals/Procedures tabs out of `_deferred/`, activation checklist gate, Duplicate action, Seeded pill state. |

## M4 — Deferred P1 completions (next priority)

These were parked in `_deferred/` per L-0074 during the redesign sortie. They are production-ready table schemas with no UI surface:

1. **SeasonGoalsTab** — surface `season_goal` table. Create/edit/complete/cancel goals. Link to `season.get_readiness` tool output.
2. **SeasonProceduresTab** — surface `season_policy_binding`. Toggle policies per season. Drives HMS compliance binding.
3. **Activate/Archive/Duplicate** buttons on season overview page — complete the lifecycle action surface on the detail page (activate + archive partially wired via Botsson; Duplicate button not wired).
4. **Seeded pill** — show "D1 åpningstider seedet" status indicator when `seeded = true` (data available via `useSeasonsSeededState` hook).
5. **Activation checklist gate** — inline readiness checklist (budget ✓ / day factors ✓ / hour factors ✓) shown before the Activate button becomes primary.

## M5 — Voice mutation bridge (deferred per ADR-0201 §D5)

Mutation tools (`season.create`, `season.set_revenue`, `season.save_playbook`, `proposeActivateSeason`, `proposeArchiveSeason`) are currently chat + system only. Voice bridge for the propose- tools requires:
- LiveKit `proposeAction` pattern (non-blocking UI confirm before execution)
- ADR-0201 §D5 voice-safety review before wiring

## Design-debt backlog

| Item | Status | Spec ref |
|---|---|---|
| Drag-to-resize season blocks on canvas | 🔴 Not started | Spec §4.1 — pointer resize handles |
| Remaining hardcoded color classes | 🟡 Partial | CAMPAIGN M2 Nordic Split sweep |
| `isDark` prop drilling removal | 🟡 Partial | CAMPAIGN M2 |
| Spring constants → Nordic Split tokens (stiffness=30, damping=20) | 🟡 Partial | CAMPAIGN M2 |
| `useReducedMotion()` on all animated components | 🟡 Partial | CAMPAIGN M2 |
| Touch targets ≥ 44pt on canvas blocks | 🔴 Not started | CAMPAIGN M2 |
| i18n — remaining hardcoded Norwegian strings | 🟡 Partial | CAMPAIGN M2 |

## Planning event ownership (deferred split)

`planning_event` (D4 demand signal) is currently rendered on the year-wheel canvas and loaded by `usePlanningEvents` from `packages/year-wheel/src/hooks/use-planning-events.ts`. When the **scheduling** domain is defined, `planning_event` will migrate there. The year-wheel surface will become a read-only consumer of the scheduling domain's planning events.

This is flagged as open (deferred) in `docs/domains/_DASHBOARD.md` Overlap edges: `core-structure ↔ scheduling (future)`.

## "Copy last year" duplication flow

`duplicateSeasonAction` exists (`apps/web/src/app/dashboard/_actions/duplicate-season-action.ts`) and is authority-seeded (`20260518030000`). No UI button is wired. This is the PRD's "Copy last year" hypothesis (PRD §2). Suggested surface: year-wheel sidebar context menu or season detail page → "Duplicate" button.

## Aspirational — scheduling domain handoff

When the scheduling domain is formally defined:
1. `planning_event` → moves to scheduling domain ownership
2. Year-wheel becomes a consumer of scheduling's planning events
3. `planning_cycle` linkage (currently D1 in core-structure) may move to scheduling
4. This domain's `_DASHBOARD.md` overlap edges should be updated to `resolved (migrated)`

## Completed sorties (reference only)

| Plan file | Status |
|---|---|
| `docs/superpowers/plans/completed/2026-04-10-season-year-wheel-gap-closure.md` | ✅ Merged to development |
| `docs/superpowers/plans/completed/2026-04-13-year-wheel-cascade-resolution.md` | ✅ Merged to development |
| `docs/superpowers/plans/completed/2026-04-13-year-wheel-design-debt-cleanup.md` | ✅ Merged to development |
| `docs/superpowers/plans/completed/2026-04-20-year-wheel-redesign.md` | ✅ Merged to development — full redesign |

Active super-plan: `docs/superpowers/plans/2026-04-20-year-wheel-redesign.md` — identical content to the completed twin. Confirm whether this is the active campaign planning artifact or a duplicate.
