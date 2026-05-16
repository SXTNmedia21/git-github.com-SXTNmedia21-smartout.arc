---
title: "Journey — Admin reviews labor cost overview week-by-week"
status: verified
feature: cost-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, cost, polish, campaign-ui-shell]
---

# Journey — Admin reviews labor cost overview

> Sub-sortie: `ui-shell-cost-polish`. Primary journey closing S12 step 6 (`/dashboard/cost`).

## Journey: Admin navigates to /dashboard/cost and reads variance for the week

**Precondition:** Admin signed in, on dashboard shell. Workspace has at least one `shift_cost_snapshot` row for the current ISO-week. Sidebar M1 surfaced the route via "Administrasjon > Kostnader".

1. Admin clicks "Kostnader" in sidebar → browser navigates to `/dashboard/cost`
2. Route streams via Suspense → existing `loading.tsx` shows 3-card + table skeleton aligned with Nordic Split tokens → no layout shift
3. CostOverview client island mounts → `useCostOverview()` queries `shift_cost_snapshot` joined to schedule_shift+department+profile
4. Page header renders — `font-heading` h1 "Kostnader", Norwegian page instructions explain week-navigation + variance reading (planned vs actual + over/under-budget interpretation)
5. Cards render — total planned, total actual, variance (NOK + %) using Nordic Split `text-foreground` / `text-success` / `text-destructive` for variance sign
6. Per-department table renders — name, planned, actual, variance, hours, shift count
7. Telemetry fires once on mount — `cost.overview.viewed` to posthog + logger + activity_trail with workspace_id + actor_id resolved via DashboardContext (fail-fast per ADR-0134)
8. Admin clicks "Forrige uke" → week navigator updates client-side state → table re-queries → telemetry does NOT re-fire (openedRef guard)
9. Empty state — if zero cost-snapshots for week, table shows Norwegian copy "Ingen kostnadsdata for valgt periode"
10. Botsson page-tool kit registered via `useRegisterTools('cost', kit)` — admin can ask Botsson "vis variansen for forrige uke" + tool answers from query result

**Postcondition:** Admin sees production-grade cost overview. First paint < 1s on local dev. No console errors. Telemetry visible in `activity_trail` for workspace. Botsson tool kit discoverable.

**Error paths:**
- Query failure → new `error.tsx` renders Norwegian message + retry button (no white screen)
- RLS denies → cards/table render zero-state, no error surface
- Missing workspace_id or profile_id from DashboardContext → emit() guarded by `nonEmpty()`, fires zero events rather than corrupt one (ADR-0134 fail-fast)

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0 (route already registered per T0 — F not needed)
- `ls apps/web/src/app/dashboard/cost/error.tsx` → exists
- `grep "cost.overview.viewed" packages/telemetry/src/registry.ts apps/web/src/app/dashboard/cost/_components/CostOverview.tsx` → 2+ hits
- `grep -E "bg-(zinc|slate|gray|blue|green|red|amber)-(50|100|200|700)" apps/web/src/app/dashboard/cost/` → 0 hits
- Dev server `/dashboard/cost` → loads under 1s, no console errors, Nordic Split tokens applied

## E2E (recommended)

S12 protocol step 6 verifies route returns < 500 — sufficient for orphan-coverage. Per-journey Playwright deferred (not in M4 scope; covered by `apps/e2e/protocols/p-sidebar-orphan-coverage.ts`).
