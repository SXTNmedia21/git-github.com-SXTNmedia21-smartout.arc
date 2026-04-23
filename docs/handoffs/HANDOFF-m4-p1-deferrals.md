---
title: "Handoff — M4 P1 Deferrals (L-0074)"
status: complete
updated: 2026-04-23
created: 2026-04-23
module: year-wheel
feature: campaign/year-wheel M4
tags: [handoff, m4, p1-deferrals, year-wheel, season]
---

# Handoff — M4 P1 Deferrals

> **Campaign:** campaign/year-wheel · **Milestone:** M4 (final)
> **Commits:** b429b25f · f03bbad4 · 2d174b87 · 9d85c634

## Summary

Landed all P1 items the 2026-04-20 Year Wheel council deferred per L-0074. The campaign/year-wheel roadmap is complete — M1 (cascade gap) + M2 (design debt) + M3 (agent capability) + M4 (P1 deferrals).

## What was built

### Commit 1 — Promote Goals + Procedures tabs (b429b25f)

- Moved `SeasonGoalsTab.tsx` (279 LOC) and `SeasonProceduresTab.tsx` (162 LOC) out of `_deferred/` to `apps/web/src/app/dashboard/season/[seasonId]/_components/`.
- Registered 2 new tabs in `SeasonSubmenu.tsx` (`goals` + `procedures`, Norwegian labels "Mål" + "Prosedyrer").
- Extended `TabKey` type in `season-page-client.tsx` + render conditionals.
- Zero DB changes — both tables (`season_goal`, `season_policy_binding`) existed from prior migrations.

### Commit 2 — Archive + Duplicate (f03bbad4)

- Two new Server Actions: `archive-season-action.ts`, `duplicate-season-action.ts` (mirror `activate-season-action.ts` pattern).
- Authority seed migration `20260518030000_season_archive_duplicate_authority_seed.sql`:
  - `season.archive` — `suggest` / `manager`
  - `season.duplicate` — `suggest` / `admin`
- Extended `CapabilityName` union in `packages/ai/src/capabilities/types.ts`.
- CTAs in `SeasonOverviewTab.tsx`:
  - Archive: shadcn AlertDialog confirmation (destructive intent)
  - Duplicate: one-click + toast + `router.push('/dashboard/season/' + newSeasonId)`

### Commit 3 — Seeded pill (2d174b87)

- New hook `useSeasonsSeededState(workspaceId, seasonIds)` — one SQL query returning `Map<seasonId, boolean>` for O(1) per-season lookup in render.
- Located in `packages/year-wheel/src/hooks/use-seasons-seeded-state.ts` + thin web wrapper in `apps/web/src/app/dashboard/year-wheel/_hooks/` following DashboardShell-context-injection convention.
- `SeasonSidebar.tsx` renders Lucide `CheckCircle2` + "Seedet" uppercase label in muted-foreground tokens when a season has D1 `department_operating_hours` rows. Nordic Split compliant — no hardcoded colors.

### Commit 4 — Activation checklist (9d85c634)

- New `ActivationChecklistCard` component above Activate button in `SeasonOverviewTab.tsx`:
  - Budget set (blocking)
  - Day factors defined (blocking)
  - Hour factors defined (blocking)
  - Operating hours present (non-blocking amber, Invariant 12)
- Uses existing hooks (`useSeasonBudget`, `useDayFactors`, `useHourFactors`, `useSeasonOperatingHours`).
- Hidden when `season.status === 'active' || 'archived'`.
- Activate button stays enabled per Invariant 13; hover tooltip surfaces when blockers present.

## Decisions applied

- **One ADR extension** implicit in Commit 2 — `season.archive` + `season.duplicate` join the season namespace established in ADR-0201. No new ADR needed; seeded per the ADR-0189 parity CI pattern.
- **Deviation noted:** M4 scope originally planned a separate ADR for Archive/Duplicate capabilities. Extension of ADR-0201's namespace was cleaner than a new ADR; no authority/architecture decisions require council review.

## Learnings

- **"Deferred" tabs were production-ready.** Exploration expected scaffolds; actual state was 441 LOC of fully-wired components with complete DB backing. Promotion was a file-move exercise, not an implementation milestone. Pattern: always read deferred components' actual content before planning promotion scope.
- **Hook location convention is package-first.** First iteration of the seeded-state hook placed it in the web app; canonical location is `packages/year-wheel/src/hooks/` with a thin web-side wrapper. Mirrors every other `useSeasons*` hook. Package hook cannot use `useMemo` for identity stabilization because React types aren't a dep — use TanStack `select` caching instead.
- **UX polish tension: hover-tooltip vs disabled button.** Invariant 13 says Activate must be reachable. Disabled-until-ready UX is cleaner but violates the invariant. Resolution: button enabled, tooltip surfaces blockers, modal renders typed errors from Server Action. This keeps the path to Server Action observable even when preconditions fail.

## Known issues / debt

### Shipped in scope

- Archive + Duplicate Server Actions emit NO telemetry. M4 scope called this out explicitly. M5+ work could add `season archived` / `season duplicated` events under reserved `emitPrefix: "season"` from ADR-0201 if telemetry demand emerges.
- Duplicate uses `(kopi)` name suffix in Norwegian only; English side is planned but not wired. i18n key `seasonActions.duplicate.copySuffix` added placeholder.

### Pre-existing upstream issues (NOT M4 scope)

- `availability/tools.ts` + `shift-swap/tools.ts` emit with dotted event names while registry uses space-separated. Introduced by `campaign/schedule-harness` (PR #251). Flagged in merge commit `cc95cbfc`. Blocks `@smartout/ai` typecheck in isolation but passes under full turbo orchestration (dependency order differs).
- `authority-seed-parity` still fails on pre-existing `contract`, `memory`, `x` fixture gaps.

## Verification state

| Gate | Result |
|------|--------|
| `pnpm turbo typecheck --filter=web --filter=@smartout/year-wheel --filter=@smartout/i18n` | 10/10 tasks green |
| Authority-seed-parity for `season.archive` + `season.duplicate` | Both paired (literal ↔ seed) |
| Pre-push hook (full `pnpm turbo typecheck`) | Pending final push |
| Invariants (ADR-0200 I11/I12/I13, ADR-0201 I1–I12) | Unchanged from M3 acceptance |

## Campaign/year-wheel — COMPLETE

All 4 milestones landed:

| Milestone | ADR | Status |
|-----------|-----|--------|
| M1 — Cascade gap closure | ADR-0200 | ✅ Shipped, council APPROVE-WITH-CHANGES, 12 fixes applied |
| M2 — Design-debt sweep | — | ✅ Shipped (3 fixes, narrow scope) |
| M3 — Season agent capability | ADR-0201 | ✅ Shipped, 5 open questions resolved via code-trace |
| M4 — P1 deferrals (L-0074) | — | ✅ Shipped (4 commits, ADR-0201 namespace extension) |

Plus one fix-forward commit (`18adec54`) and one merge resolution (`cc95cbfc`) for concurrent-campaign CI hygiene.

## Next steps

Campaign `campaign/year-wheel` is ready for milestone merge to `development`. The PR #249 captures M1–M4 plus the parity fix + merge resolution.

Follow-ups NOT in this campaign's scope but visible on the horizon:
- Voice bridge for `season.get_readiness` + `season.learn_factors` (M5 or standalone sub-sortie).
- Multi-turn voice wizard for `season.create` (M5).
- `season archived` + `season duplicated` telemetry events if M4's Archive/Duplicate Server Actions need observability.
- Upstream repair: fix `availability/tools.ts` + `shift-swap/tools.ts` event-name convention (schedule-harness owner).
- Upstream repair: address pre-existing `contract` / `memory` authority-seed gaps (other campaign owners).

## Credits

Orchestrator: Pontus + Claude Opus 4.7. Build agents: single agent for M4 (all 4 commits, tightly coupled). Prior-session handoff: `HANDOFF-cascade-gap-closure.md` + `HANDOFF-season-agent-capability.md`.
