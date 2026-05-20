---
title: "Journey — WorkspaceData exposes is_active; Botsson gets real workspace status"
status: verified
feature: workspace-status-context
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [journey, ui-shell, context, harness, debt, campaign-ui-shell]
---

# Journey — WorkspaceData.is_active threading

> Sub-sortie: `ui-shell-workspace-status-context`. Closes ccb794dca TODO debt on PosAccountsList.

## Journey: Botsson reads real workspace_is_active

**Precondition:** `workspace` row exists in DB with `is_active` boolean column. Admin signed-in, on `/dashboard/admin/pos-accounts`. Pre-this-sortie, `getPosActionState` always returned `canConnect: true` regardless of workspace state because `workspaceIsActive` was hardcoded `true`.

1. `resolveDashboardContext()` runs server-side → workspace `.select()` now includes `is_active` → `WorkspaceData` value has real boolean
2. `/dashboard/admin/pos-accounts/page.tsx` receives `{ workspace }` with real `is_active` → passes to `<PosAccountsList workspaceIsActive={workspace.is_active} ... />`
3. Bridge input receives real value → `getPosActionState` tool returns `canConnect: false` + Norwegian hint "POS er ikke tilgjengelig for inaktive workspaces" when admin queries from suspended workspace
4. For an active workspace, behavior identical to pre-sortie (`canConnect: true`)

**Postcondition:** Tool response truthfully reflects DB state. TODO comment removed. Code review LOW debt closed.

**Error paths:**
- Workspace row missing `is_active` (legacy data) → DB default kicks in (typically `true`), Botsson still answers based on stored value
- Type drift between WorkspaceData and DB schema → typecheck catches at build time

## Verification

- `grep "is_active" apps/web/src/lib/workspace-context.tsx` → 1+ hit (type field)
- `grep "is_active" apps/web/src/app/dashboard/_data/resolve-page-context.ts` → 1+ hit (select call)
- `grep "workspaceIsActive=" apps/web/src/app/dashboard/admin/pos-accounts/_components/PosAccountsList.tsx` → 1 hit, with real variable not literal `true`
- `grep "TODO" apps/web/src/app/dashboard/admin/pos-accounts/` → 0 hits
- `pnpm turbo typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0

## E2E (recommended)

Unit-level: `apps/web/e2e/admin-pos-accounts/` can extend admin-overview.spec.ts with mock workspace `is_active=false` and assert Botsson returns inactive-hint when queried. Out of scope for this sub-sortie.
