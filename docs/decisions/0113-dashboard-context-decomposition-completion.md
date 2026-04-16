---
title: "DashboardContext Decomposition Completion"
id: ADR_0113
status: proposed
layer: decision
created: 2026-04-16
updated: 2026-04-16
---

# ADR-0113: DashboardContext Decomposition Completion — Facade Hook, Theme Hoist, Botsson Placement

## Context and Problem Statement

`apps/web/src/components/dashboard/DashboardShell.tsx` is 2320 lines with a single `DashboardContext` exposing ~29 fields spanning theme, admin mode, schedule state, workspace, setup, and cross-route header callbacks. Previous work already extracted `EntityDrawerContext`, `VoiceToolsProvider`, and `ChatPanelProvider` as separate providers — this is a **decomposition in progress**, not a greenfield split.

Every DashboardContext field mutation re-renders every consumer. Performance audit (2026-04-16) found 8 `useEffect` chains re-firing on every route change, and consumers at 155 distinct call sites across `apps/web/src/`. Splitting naively would break the dashboard header (reads `scheduleDraftCount` and `onPublishAll` that schedule pushes UP to the shell) and risk a one-frame flash on theme toggle (if theme state flows through React render instead of synchronous `data-theme` attribute).

## Decision Drivers

- Performance: eliminate cross-route rerenders caused by single-context subscriptions
- Agent architecture: `BotssonProvider` voice sessions must survive page navigation (Agent Coordinator, 2026-04-16)
- Design: theme toggle must be flash-free (Frontend Designer, 2026-04-16 — Nordic Split invariant)
- Migration safety: 155 consumers cannot be refactored atomically
- Framing correction: "split monolith" is the wrong mental model; "complete ongoing decomposition" is correct

## Considered Options

1. **Full atomic split** — Break DashboardContext into 4 new contexts, update all 155 consumers in one PR. Rejected: high merge-conflict risk, impossible to bisect regressions.
2. **Facade hook with gradual migration** — Keep `useDashboard()` as compatibility surface returning a merged view over new contexts. Consumers migrate one-by-one to targeted hooks (`useTheme()`, `useScheduleCoordination()`, etc.). Chosen.
3. **Defer decomposition** — Ship Sprint 2 RSC migration first. Rejected: rerender problem affects every Sprint 2 route.

## Decision Outcome

**Chosen: Option 2 — Facade hook with gradual migration.**

### New context structure

| Context | Scope | Consumers | Lives |
|---|---|---|---|
| `ThemeContext` | `isDark`, `theme`, `toggleTheme` | Wide — every styled component | **Highest in tree** (root layout or just inside body, above `LocaleProvider`) |
| `WorkspaceContext` | `workspaceData`, `profileId`, `isSetupMode`, `activeDepartment`, `setActiveDepartment` | Dashboard-scoped | Inside `dashboard/layout.tsx`, below `ThemeContext` |
| `AdminContext` | `isAdminMode`, `adminView` | Dashboard-scoped | Inside `WorkspaceContext` |
| `ScheduleCoordinationContext` | Cross-route schedule fields: `scheduleDraftCount`, `onPublishAll`, plus publish callback registration | Dashboard-scoped (header + schedule) | Inside `AdminContext` |
| `ScheduleRouteContext` *(new, route-local)* | `scheduleLayout`, `scheduleView`, `scheduleDateOffset`, `scheduleCompactMode`, `weeklyPeriodCount` | Route-only | Inside `/dashboard/schedule/_components/` |

### Rules

- `useDashboard()` facade hook remains exported from `components/dashboard/DashboardShell.tsx` with the same return shape until migration is complete. It reads from the new contexts and merges. New code MUST NOT use `useDashboard()` — it MUST use the targeted hook.
- Theme toggle flips `document.documentElement.dataset.theme` synchronously inside `setTheme()`, THEN updates React state. Prevents one-frame flash (Designer binding rule).
- `BotssonProvider` mounts ABOVE the dashboard shell refactor boundary (at `dashboard/layout.tsx` level, not inside any split context). Voice sessions must survive route changes.
- `EntityDrawerContext`, `VoiceToolsProvider`, `ChatPanelProvider`, `DocumentModeProvider` remain unchanged — they are already correctly scoped.
- `MEMORY.md` entry `learning_walkai_provider_deps.md` (2026-03-28) is OUTDATED and will be rewritten as part of this work — `useEntityDrawerOptional` already exists and BotssonProvider degrades gracefully.

### Migration sequence

1. Introduce new contexts + facade hook (one PR, no consumer changes)
2. Migrate header consumers first (they bridge cross-route state)
3. Migrate schedule-route consumers (they are the densest cluster)
4. Migrate remaining consumers route-by-route
5. Delete facade hook once consumer count = 0

ESLint rule `no-restricted-imports` added in step 1 to warn on new `useDashboard()` uses. Upgrades to error in step 5.

## Rules & Consequences

- **Good, because** facade pattern makes 155-consumer migration tractable; each PR touches one route or feature area, is independently reviewable, and any regression is bisectable.
- **Good, because** theme hoist + synchronous `data-theme` flip eliminates theme-toggle flash — preserves Nordic Split brand invariant.
- **Good, because** BotssonProvider placement above the shell preserves voice session continuity (Agent Trust Gate).
- **Good, because** route-local `ScheduleRouteContext` removes cross-route rerender coupling for the densest state cluster.
- **Bad, because** facade hook exists as temporary technical debt until migration completes; risk of "facade forever" if step 5 isn't enforced.
- **Bad, because** split requires an explicit "cross-route state" (`ScheduleCoordinationContext`) that straddles the header and the schedule route — this is an architectural concession, not a clean boundary.
- **Agent Impact:** Agents and developers MUST use targeted hooks (`useTheme()`, `useScheduleCoordination()`, etc.) in new code. `useDashboard()` is deprecated on arrival of this ADR. BotssonProvider placement rule is load-bearing — any refactor that moves it below the shell split breaks voice session continuity.

### Prerequisites

- NordicSkeleton primitive (ADR-0115) — not strictly required for this ADR but shipped in parallel sprint
- Memory `learning_walkai_provider_deps.md` rewrite or deletion before step 1

### Related ADRs

- ADR-0007 — Dashboard App Layout & Navigation State (this ADR extends it)
- ADR-0021 — Subdomain-Based Workspace Routing (workspace context continues to honor `x-workspace-slug`)
- ADR-0032 — Schedule Local-State Architecture (this ADR introduces `ScheduleRouteContext` consistent with 0032)
- ADR-0089 — WalkAi Bridge Architecture (BotssonProvider placement rule honors bridge model)

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
