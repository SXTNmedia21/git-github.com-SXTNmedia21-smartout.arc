---
title: "HANDOFF — workspace-status-context"
status: done
feature: workspace-status-context
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [handoff, ui-shell, context, harness, debt, campaign-ui-shell]
---

# HANDOFF — workspace-status-context

> Sub-sortie inside `campaign/ui-shell`. Closes 1 documented LOW debt item from commit `ccb794dca` TODO.

## Summary

Threaded `workspace.is_active` (boolean from `public.workspace` DB column) end-to-end through `WorkspaceData` → `resolve-page-context` → `/dashboard/admin/pos-accounts` page → `PosAccountsList` → `getPosActionState` Botsson tool.

Pre-this-sortie: `PosAccountsList` hardcoded `workspaceIsActive={true}` with a TODO referring to "needs WorkspaceData extension". Botsson's `getPosActionState` tool always returned `canConnect: true` regardless of DB state.

Post-this-sortie: Botsson reads truth from DB. Inactive workspace surfaces `canConnect: false` + Norwegian hint "POS er ikke tilgjengelig for inaktive workspaces" from the existing tool body.

## Files Changed

5 files, 11 insertions / 6 deletions:

- `apps/web/src/lib/workspace-context.tsx` — `WorkspaceData.is_active: boolean` added
- `apps/web/src/app/dashboard/_data/queries.ts` — `WORKSPACE_SELECT` constant extended with `is_active` (single choke-point used by `getWorkspaceBySlug` + `getWorkspaceById`; no change needed to `resolve-page-context.ts` itself)
- `apps/web/src/app/dashboard/layout.tsx` — `SHOWCASE_WORKSPACE` dev/demo fixture got `is_active: true`
- `apps/web/src/app/dashboard/admin/pos-accounts/_components/PosAccountsList.tsx` — props type extended, hardcoded `true` replaced with prop value, 3-line TODO comment removed
- `apps/web/src/app/dashboard/admin/pos-accounts/page.tsx` — passes `workspace.is_active` to PosAccountsList

## Decisions

No new ADRs. The change is mechanical type-threading, not architectural.

## Learnings

**L-NEW (candidate): `new-feature.sh` echoes "Ready!" decoupled from `git worktree add` failure.**

Worktree creation script can leave an orphan directory (no `.git` file, no branch, not in `git worktree list`) while the final echo still reports success. Observed once on 2026-05-16. Recovery pattern (councilled, 9-step):

1. Verify backup parity via `diff -rq`
2. Inspect git's view: `ls .git/worktrees/` + `worktree list`
3. `git worktree prune -v` (idempotent)
4. **`mv` orphan to `/tmp/wsc-orphan-$(date +%s)`, NOT `rm -rf`** — preserves diagnostic surface (L-0147 6th precedent, supervisor reversibility argument)
5. Re-run with `bash -x | tee` for stderr capture
6. Tripwire: `test -e <wt>/.git` before continuing
7. Restore from backup, commit, continue normal flow

Root cause not yet diagnosed (script ran clean on retry without intervention). If recurs, escalate to script-fix sortie: add explicit `git worktree add` exit-code check + final verification block before "Ready!" echo.

Same class as L-0177 (silent fallback on `?.workspace_id`) and L-0175/L-0176 (docstring-vs-body drift): success signal and truth signal decoupled.

**L-confirmed: WORKSPACE_SELECT constant is the right choke-point.**

When threading a new workspace column into `WorkspaceData`, edit the shared `WORKSPACE_SELECT` constant at `apps/web/src/app/dashboard/_data/queries.ts:11` — both `getWorkspaceBySlug` and `getWorkspaceById` use it. `resolve-page-context.ts` itself delegates, no edit needed.

**L-confirmed: Only 1 other WorkspaceData builder exists.**

Grep found `SHOWCASE_WORKSPACE` literal in `dashboard/layout.tsx:29`. A `WorkspaceData` type also exists in `platform-admin/workspaces/[id]/_components/tabs/OverviewTab.tsx` but it's a locally-scoped type for the platform-admin area, distinct from the dashboard context type. No cross-impact.

## Known Issues / Debt

None introduced. One legacy data risk noted in journey error-paths section: if a workspace row pre-dates the `is_active` column being added (unlikely; column has DB default), the value falls through DB default (typically `true`). No code-level handling needed.

## Next Steps

- Sub-sortie ready for `close-feature.sh` — all gates green
- Optional follow-up: E2E spec covering inactive-workspace path in `apps/web/e2e/admin-pos-accounts/` (deferred — out of this sub-sortie scope per PLAN)
- Optional follow-up: write up L-NEW formally as a learning if `new-feature.sh` orphan recurs

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0, 52 routes valid
- `grep TODO apps/web/src/app/dashboard/admin/pos-accounts/` → 0 hits
- `grep is_active apps/web/src/lib/workspace-context.tsx` → 1 hit (type field)
- `grep is_active apps/web/src/app/dashboard/_data/queries.ts` → 1 hit (WORKSPACE_SELECT)
- `grep workspaceIsActive apps/web/src/app/dashboard/admin/pos-accounts/_components/PosAccountsList.tsx` → 3 hits (destructure, type, prop pass-through to ToolsBridge)
- Journey Guardian frontmatter (`status: verified`, `feature: workspace-status-context`) → satisfied
- Husky pre-commit lint-staged → green
