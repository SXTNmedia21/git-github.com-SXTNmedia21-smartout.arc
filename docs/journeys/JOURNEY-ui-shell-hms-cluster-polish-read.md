---
title: "Journey — HMS read-heavy routes ship production polish"
status: verified
feature: hms-cluster-polish-read
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, polish, hms, council-verified, campaign-ui-shell, M5]
---

# Journey — HMS read-heavy routes ship production polish

> Sub-sortie: `hms-cluster-polish-read`. M5 Sortie 3 of 4. Council-verified 2026-05-17.

## Journey: Admin lands on /dashboard/hms during slow network — streaming skeleton renders, then content

**Precondition:** Admin signed in. Slow 3G or backend cold-start latency.

1. Admin navigates to `/dashboard/hms` → Server Component shell starts → `withPagePerf` instrumentation begins
2. Suspense fallback `HmsLoading` renders → SkeletonEntrance with Nordic Split tokens (`bg-muted`, `border-border`, no hardcoded grays)
3. Server-side `resolveDashboardContext()` resolves → handoff to `<HmsPageClient />`
4. Client renders OversiktDashboard / OversiktEmployee per role → 5 parallel TanStack queries fire
5. KPI cards populate with semantic tokens — readinessPercent green/warning/destructive via semantic class, NOT `bg-green-50 text-green-700`
6. SubNav remains visible across all 6 tabs; click → route changes → per-sub-route loading.tsx renders (4 new sub-route loading.tsx added by this sortie)
7. Drift sub-route renders DriftFocusCard, DriftInsightStrip, DriftSessionTable, DriftTaskList, DriftTimeline — all Nordic Split tokens

**Postcondition:** First-load experience matches contracts/cost/billing polish patterns. No layout shift. No hardcoded palette.

**Error paths:**
- Server context fails to resolve → root `error.tsx` (or hms `error.tsx`) catches, shows Norwegian retry button "Prøv igjen" with semantic destructive accent
- TanStack query fails mid-load → per-tab error boundary surfaces

## Journey: Network failure on /dashboard/hms/drift — error.tsx catches

**Precondition:** Admin on `/dashboard/hms/drift`. Backend returns 500 mid-query.

1. TanStack query throws → React error boundary cascades up
2. Nearest `error.tsx` (drift sub-route, NEW this sortie) renders
3. Norwegian copy: heading "Drift kunne ikke lastes", body "En feil oppsto. Prøv igjen eller kontakt support.", retry button
4. Retry button = `reset()` from Next.js error boundary; click → re-mount + re-fetch
5. Semantic destructive token visible on icon/border (`text-destructive`, `border-destructive` — not `text-red-600`)
6. aria-label on retry button, keyboard-focusable

**Postcondition:** Admin self-recovers without page reload. Error path UX matches umbrella + other polished routes.

## Journey: Admin asks Botsson "hvor mange protokoller er forfalt" on HMS umbrella

**Precondition:** Admin on `/dashboard/hms`, opens chat. Post-Sortie 2, only 4 tools available in `hms` scope: `getHmsOverview`, `listOverdueProtocols`, `switchHmsTab`, `focusDeviation` (listOpenDeviations + getDriftStatus moved to sub-tab scopes).

1. LLM resolves `listOverdueProtocols` (single owner = `hms` umbrella) — no ambiguity, post-Sortie-2
2. Bridge tool fires with `dataRef.current.overdueProtocolCount`
3. Returns count + Norwegian note if > 0
4. UI re-renders. Telemetry event `hms.overdue_protocols_queried` (or similar) registered + emitted (server-side awaited per ADR-0134)

**Postcondition:** Tool description refinement (if applied) is precise enough that LLM picks the right tool without route navigation. Phantom-contract risk avoided (L-0287) because tool description doesn't promise behavior outside L1 client-side data scope.

## Verification

- `pnpm turbo typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0
- `pnpm lint:tool-collisions` → exit 0 (ratchet allowlist unchanged from Sortie 2)
- `ls apps/web/src/app/dashboard/hms/{,training,drift,documents,governance}/error.tsx` → 5 files
- `ls apps/web/src/app/dashboard/hms/{training,drift,documents,governance}/loading.tsx` → 4 files
- `grep -E 'bg-(green|amber|red|yellow|orange)-[0-9]' apps/web/src/app/dashboard/hms/_components/{DriftFocusCard,DriftInsightStrip,CompetenceMatrix,DepartmentReadiness,DriftSessionTable,DriftTaskList,DriftTimeline,DocumentBrowser,DocumentViewer,LearnFlow}.tsx` → 0 hits
- `grep -nE 'supabase\.from\(.+\)\.(insert|update|delete)' apps/web/src/app/dashboard/hms/_components/` → 0 hits (no direct mutations in read-heavy components)
- Norwegian retry button: `grep "Prøv igjen" apps/web/src/app/dashboard/hms/{,training,drift,documents,governance}/error.tsx` → ≥ 5 hits

## E2E (recommended)

S12 protocol covers HTTP < 500 for these routes already (M1 sidebar-reorg). Per-route error.tsx render test deferred to follow-up E2E sortie.

## Council learning ref

- L-0286 (Polish PRs gild half-converted patterns) — Sortie 1 closed prereq; this sortie clean
- L-0287 (Bridge tool description = phantom amplifier) — defers tool surface expansion
- ADR-0360 ratchet — `pnpm lint:tool-collisions` exit 0 mandatory
