---
title: Sidebar Reorg — Closure Handoff
status: review
updated: 2026-05-15
created: 2026-05-15
module: dashboard
tags: [sidebar, navigation, ui-shell, campaign-ui-shell]
---

# Handoff: feat/ui-shell-sidebar-reorg

First sub-sortie of `campaign/ui-shell` (MODULE_01 Dashboard).

## Summary

Refactored `apps/web/src/components/dashboard/DashboardShell.tsx` from a flat 3-mode inline `<NavItem>` block (~280 lines of JSX) into a data-driven grouped renderer backed by `SIDEBAR_GROUPS_ADMIN | SIDEBAR_GROUPS_EMPLOYEE | SIDEBAR_GROUPS_DEMO` config + a new `<SidebarGroup>` wrapper component. 23 previously-orphan dashboard routes now reachable via the sidebar. Mobile sidebar untouched (ADR-0133 — mobile keeps fixed 5-tab Approve/Execute pattern).

Net change in DashboardShell: −416 / +46 lines. Three new files: `sidebar-config.ts` (423 lines), `SidebarGroup.tsx` (134 lines), `NavItem.tsx` (160 lines, extracted from inline DashboardShell fn).

## Commits

| SHA | Subject |
|---|---|
| `809065363` | docs(sidebar): propagate canonical implementation plan to wt-3 |
| `f09a12325` | feat(sidebar): SIDEBAR_GROUPS_ADMIN/EMPLOYEE/DEMO config + tests |
| `05399cfcc` | feat(sidebar): SidebarGroup wrapper + NavItem extracted to own file |
| `4c1e0e71e` | feat(sidebar): wire DashboardShell to SIDEBAR_GROUPS — 3-mode renderer |
| `2134653cf` | test(sidebar): S12 orphan-coverage smoke — 23/23 steps passed |
| `fadc875d1` | docs(sidebar): S12 protocol artifacts — audits + guide + mission draft |

## Test status

| Suite | Result |
|---|---|
| `sidebar-config.test.ts` (vitest) | 11/11 PASS |
| `SidebarGroup.test.tsx` (vitest) | 12/12 PASS |
| **S12 protocol** (playwright e2e) | **23/23 PASS** — all 20 linked-orphan routes reachable, no HTTP 500 |
| Dev server `/dashboard` smoke | HTTP 307 (auth-redirect, expected), compile clean, no module-not-found, no duplicate-symbol |

## Scope decisions (not formal ADRs)

These are scope decisions captured during execution via AskUserQuestion. They shape the artifact but do not warrant standalone ADRs because they encode existing patterns rather than new architecture.

1. **All 3 sidebar modes get the 9-group structure.** Admin / employee / demo all consume SIDEBAR_GROUPS variants. Demo keeps its Showcase pitch flow (Templates / Analytics / System Intelligence) as group 0, then reuses admin groups 2-9 so investors see the full surface beyond Showcase.
2. **Kommunikasjon position.** Moved into ordered SIDEBAR_GROUPS_ADMIN as group #6 — not preserved as separate always-on render path. Cleaner data-driven config.
3. **Settings + Help footer placement.** Both items remain in the DashboardShell footer alongside the Admin/Employee toggle. Veiledning group becomes Manualer-only (orphan placeholder).
4. **Placeholder rendering for not-yet-built routes.** Rutiner (`/dashboard/tasks`) and Manualer (`/dashboard/manuals`) render as muted, non-clickable items via `DisabledNavItem` inside SidebarGroup. Status flag `not-yet-built`. No new pages built in this sortie.
5. **NavItem extraction strategy.** Extracted inline NavItem (formerly DashboardShell.tsx lines 2113-2256) to `./NavItem.tsx` as a named export. Original inline copy + `NavItemProps` interface deleted in T4 commit. Footer NavItem calls (Settings/Help) bind via the new top-level import.

## Learnings

1. **Turbo cache cross-contamination on fresh worktrees.** `pnpm turbo build` reported cache hits restored from OTHER worktree paths (saw `wt-1/packages/ai`, `wt-6/packages/utils` in our `ui-shell-wt-1` build output). Cache "succeeded" but the dev server compile still failed with `Module not found: @smartout/telemetry`. Trust dist file presence (and entry-point completeness) over turbo cache status. Same class as L-0190 / L-stale-telemetry-dist. Worth promoting to memory if hit again.
2. **Sub-agent dispatch race against harness rejection.** T2 / T3 / T4 agent dispatches were marked "rejected" by the harness, but the agents had already started executing and produced full work product (files staged or written to disk). Rejection signal arrived after agent completion. Recovery: verify file presence + run tests before assuming rejection killed the work.
3. **DashboardShell sidebar is a 3-mode tree, not a flat `<a>` block.** The original plan assumed inline `<a href>` JSX between lines 1320 and 1550. Reality: `<NavItem>` abstraction with mode branching (`isDocumentMode` / `isAdminMode + isDemoMode` / employee), always-on Kommunikasjon block, feature-flag gates (`FEATURE_FLAGS.MY_CV`, `FEATURE_FLAGS.AI_CHAT`), composite active states (Ansatte activates on `/dashboard/people` OR `/dashboard/contracts`), collapsed-mode tooltips, and a footer with the Admin/Employee toggle. T1 explore caught this — saved Task 4 from a broken rewire.
4. **`isActive` prefix-match vs exact-match per route.** `/dashboard` and `/dashboard/komm` need exact-match (otherwise every nested path activates them). Encoded as `exactMatch?: boolean` in the SidebarItem schema. Default behavior in `computeActive`: prefix-match with trailing-slash boundary so `/dashboard/people` doesn't activate when on `/dashboard/people-old`.
5. **Sidebar lacks `data-testid` attrs.** SidebarGroup + DashboardShell sidebar render no testids. S12 protocol gates fell back to `url_match` instead of `ui_state`. Listed as debt — next sub-sortie can upgrade.

## Known issues / debt

1. **Sidebar testids.** Add `data-testid="sidebar-nav"` to the `<nav>` wrapper in DashboardShell. Add `sidebar-group-<slug>` to each group header in SidebarGroup.tsx. Add `sidebar-disabled-<route>` to DisabledNavItem instances. Upgrade S12 gates from `url_match` → `ui_state` per protocol-writer missing-testid list (commit `2134653cf` mission-draft). Trivial follow-up sortie.
2. **Disabled placeholder S12 assertion.** Currently S12 asserts placeholder routes (Rutiner, Manualer) via URL-match only. After testids land, assert DOM presence with `[data-disabled="true"]` for direct verification.
3. **Mobile sidebar untouched.** Per ADR-0133 mobile-surface-boundary: mobile keeps fixed 5-tab Approve/Execute pattern. No mobile work needed — this sortie is web-only by design.
4. **Unrelated hook patch in worktree.** `.claude/hooks/typecheck.sh` is dirty in this worktree (temp wt-N skip patch from another sortie). Not part of this sub-sortie; the patch should NOT be included in the merge.
5. **Stale plan duplicate.** `docs/plans/PLAN-sidebar-reorg.md` (English-named, older version) exists alongside the canonical `docs/superpowers/plans/2026-05-15-sidebar-reorg.md`. Recommend deleting the stale file during close, or scheduling a small cleanup sortie.
6. **17 of 20 linked-orphan routes need data-quality + UX polish.** S12 verifies they don't return HTTP 500. Whether the routes feel professional (data complete, interactions polished, loading states present) is out of scope here. Each is a candidate per-page polish sortie using the `smartout-page-polish` skill workflow (8 phases: speed-test, bottleneck fix, re-test, UI/UX pass, telemetry registration, page instructions, harness-tool descriptions, site-map registration).
7. **i18n debt: hardcoded Norwegian labels in sidebar-config.ts.** When the i18n migration sortie runs, swap `label:` strings → `i18nKey:` lookups. Out of scope here.

## Next steps

1. Pontus runs `close-feature.sh` from `~/dev/smartout.ai-ui-shell-wt-1` — merges `feat/ui-shell-sidebar-reorg` → `campaign/ui-shell` and syncs `development` into `campaign/ui-shell`.
2. Optional immediate follow-up: `/start-feature sidebar-testids` from the campaign worktree — adds 11 `data-testid` attrs and upgrades S12 protocol gates.
3. Per-orphan-route polish sorties as Pontus prioritizes — use `smartout-page-polish` skill.
4. Campaign-level milestone PR `campaign/ui-shell` → `development` whenever Pontus decides the campaign has shipped enough value (campaigns merge via merge-commit per ADR-0213, never squash).

## Mobile parity check (ADR-0133)

This sortie deliberately stays web-only. The data layer (`sidebar-config.ts`) is pure data — no React, no DOM. If a future sortie wants a mobile companion sidebar, the config can be reused, but the canonical mobile pattern remains the 5-tab Approve/Execute layout, not sidebar.
