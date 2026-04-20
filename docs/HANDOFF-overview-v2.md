---
title: "HANDOFF — overview-v2 (WebDayControl replaces OversiktView)"
status: done
updated: 2026-04-19
created: 2026-04-19
module: dashboard
tags: [handoff, day-control, overview]
---

# HANDOFF — overview-v2

> Branch: `feat/overview-v2` · Council 2026-04-19 · 4 PRs + 3 gates · ADR-0156 + ADR-0157 + L-0064

## Summary

Replaced `apps/web/src/components/dashboard/OversiktView.tsx` (1070 LOC, mock-data executive roll-up) with `WebDayControl` — a session-centric 7-tab admin panel driven by `department_session`. The admin "Oversikt" route now renders a D6-anchored operational surface instead of an aggregate summary.

Ships:
- 10 canonical widgets (shared-ready for mobile extraction per ADR-0133)
- 7 tabs: Oversikt, Dagslinjen, Bemanning, Oppgaver, Avvik, Melding, Oppgjør
- 3 new Server Actions (signoff, task toggle, broadcast)
- 2 new hooks (`useSessionHooksWithTasks`, `useRoster`)
- 1 new helper (`derivePhase` in `packages/utils/src/cascade/`)
- 1 agent-capability fix (`operations.complete_task` now uses `emit()` registry)

## Decisions captured

| ID | Title | Status |
|----|-------|--------|
| [ADR-0156](decisions/0156-day-control-panel-canonical-admin-surface.md) | Day-Control Panel as Canonical D6 Admin Surface | accepted |
| [ADR-0157](decisions/0157-server-actions-scope-amendment-adr-0114.md) | Server Actions Scope — Amendment to ADR-0114 | accepted |
| [L-0064](learnings/0064-phase-enum-ui-vs-db-drift.md) | Phase Enum UI-vs-DB Drift — Use Named Derivation Helpers | canonical |

## PR series

| # | Commit | What landed |
|---|--------|-------------|
| Spec | `1dc7d323` | Implementation spec + ADR drafts + learning + council log |
| Spec fix | `217aa118` | Self-review fixes (compose-drawers OOS, admin fallback, ESLint enforcement) |
| PR 1 | `ac0c6be8` | Design tokens: dept dark variants |
| Gate 1 fix | `93612d44` | Kitchen chroma + warm-neutral inactive/low |
| PR 2 | `ef56b144` | Scaffold: 10 widgets + WebDayControl shell + Overview tab live |
| Gate 2 fix | `002ce328` | PhaseBadge pulse-dot-only + radiogroup + timeline easing + ESLint |
| PR 3 | `40b1ebd7` | 6 tabs live + 3 Server Actions + 2 hooks + engine_memory pin |
| Gate 3 fix | `bd086820` | Error toasts + broadcast sessionId + emit registry unification |
| PR 4 | (this) | Motion + ambient orb + delete OversiktView + remove feature flag |

## Learnings

### L-0064 — Phase enum UI-vs-DB drift

UI needed 6 phases (`upcoming | active | pending_signoff | closed | missed | locked`). DB enum has 5 (no `locked`). The fix: a named helper `derivePhase(session, recon) => UiPhase` in `packages/utils/src/cascade/`. Widgets consume `UiPhase` exclusively. `locked` is computed from `session.status === 'closed' && recon.status === 'locked'` — never stored. Scales to any cascade surface needing richer state than DB enum.

### Emit-contract unification (Trust Gate dual-write fix)

`packages/ai/src/capabilities/operations/tools.ts` `complete_task` was inserting directly into `engine_event` with event_type `"session_task.completed"` (dotted). Server Action path emits registry event `"session task_completed"` (spaced). Two strings = two routing outcomes. Agent writes missed PostHog, logger, activity_trail. Fixed: agent tool now calls `emit()` with the registry name. Steward: L-0058-class bug prevented.

### ADR-0114 grandfathering rule (ADR-0157)

Steward/Supervisor semantic conflict on ADR-0114 scope resolved via explicit amendment: new mutations introduced by a feature PR MUST be Server Actions. Existing TanStack mutations grandfathered until scheduled migration. Test: (1) new caller writing new data → Server Action; (2) material change to existing mutation → prefer Server Action migration; (3) re-use of existing hook → TanStack OK. Scales to all future feature PRs.

### Widget staging discipline (ADR-0156 §8)

Widgets live at `apps/web/src/components/day/widgets/` with portability rules enforced by ESLint: no `next/*` imports, no direct `@smartout/supabase` access. When mobile consumer lands, extraction to `packages/ui/day-control/` is near-zero cost. The ESLint rule is the enforcement — documentation alone would drift.

## Known issues / debt

1. **`session_hook` time labels** — `useSessionHooksWithTasks` renders hook times as midnight-offset HH:MM because it doesn't know session open time. PhaseTimeline receives correct `plannedOpen/Close`; HookTile header times are approximate. Minor cosmetic gap. Follow-up: derive exact hook time from `session.plannedOpen + trigger_offset_min`.
2. **`tasks_total/tasks_completed` columns** — still read from `department_session` row (not derived client-side). Supervisor flagged trigger gap; deferred because the columns work "well enough" for seeded sessions. Long-term: add trigger OR deprecate columns.
3. **Revenue/labor-cost KPIs** — Overview tab shows "—" with `source: "post-reconciliation"` label. Real values land when `daily_reconciliation` is wired.
4. **engine_authority_config integration** — Server Actions currently enforce role via `hasMinimumRole` helper (hardcoded `employee < manager < admin < owner` in `_shared.ts`). **Correction (post-council 2026-04-19):** `engine_authority_config.min_role` column DOES exist (added by `supabase/migrations/20260410000001_add_min_role_to_authority_config.sql`), and `gate_action()` function already consumes it via `_role_rank()` comparator (`20260509100000_gate_action_four_eyes_history.sql`). The real follow-up is a code-only refactor to wire `hasMinimumRole` callers through `gate_action()` — see Linear ticket T3 for scope.
5. **Deviation scoping** — `DeviationsTab` shows workspace-wide deviations; session-scoped filter can be added via existing `useDeviations({ sessionId })` option once seed data makes it meaningful.
6. **Broadcast feed** — currently shows only in-session successful sends (local React state). Reading existing news-channel history via `useChannelMessages` is a small follow-up.

## Next steps

1. **Merge to development** — feat/overview-v2 is ready for close-feature.sh.
2. **Follow-up PR (tracked)** — session_hook time derivation (#1 above).
3. **Mobile extraction** — when mobile consumer needs the same widgets, extract `components/day/` → `packages/ui/day-control/` per ADR-0156.
4. **engine_authority_config min_role wiring** — schema exists; wire `hasMinimumRole()` callers through the existing `gate_action()` function. Code-only refactor.
5. **Revenue KPIs** — gated on `daily_reconciliation` wiring (ReconciliationView already reads this; WebDayControl can reuse).

## Verification

- [x] `pnpm turbo typecheck` passes with 0 errors (7+8 packages clean across gates)
- [x] Council log entry committed 2026-04-19
- [x] Decision log updated (ADR-0156, ADR-0157 accepted)
- [x] Learning log updated (L-0064 registered)
- [x] User journey: `docs/journeys/JOURNEY-overview-v2.md`
- [x] Feature flag removed
- [x] OversiktView deleted
- [x] All 3 council gates cleared
