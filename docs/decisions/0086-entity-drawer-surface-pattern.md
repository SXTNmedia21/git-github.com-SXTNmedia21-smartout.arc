---
title: "ADR-0086: Entity Drawer Surface Pattern"
status: accepted
updated: 2026-04-13
created: 2026-03-28
module: dashboard
tags: [entity-drawer, architecture, UI]
---

# ADR-0086: Entity Drawer Surface Pattern

## Context

The dashboard needs a way to inspect entities (departments, shifts, profiles, sessions) without navigating away from the current page. DashboardShell has 2,111 lines with 28 context fields and 170+ consumers — adding drawer state to DashboardContext would re-render the entire dashboard on every open/close.

Separately, the schedule page has deep write-heavy surfaces (DayControlSheet with 7 tabs, shift-modal for creation/editing). The boundary between lightweight inspection and deep editing must be clear.

## Decision

### 1. Isolated EntityDrawerProvider

The entity drawer has its own React context (`EntityDrawerProvider`), separate from `DashboardContext`. Only components that call `useEntityDrawer()` subscribe to drawer state changes. The provider wraps the outermost shell div so both page content and EmmaOverlay can access it.

### 2. Read-Only Inspection Surface

The entity drawer is a **read-only inspection surface**. It shows entity details inline with no mutations. Actions are limited to navigation ("Go to schedule", "View profile", "Open day control"). Deep editing, approval workflows, session lifecycle transitions, and cascade-triggering mutations belong on full pages.

**Boundary rule:** If a mutation triggers downstream cascade re-derivation or requires C4 governance gates, it belongs on a full page, not in the drawer.

### 3. Declarative Entity Registry

Entity types are configured in `entity-config.ts` — a declarative record mapping each `EntityType` to its tabs, icon, accent color, href pattern, and label key. Adding a new entity type requires: (1) a tab component, (2) a registry entry, (3) i18n keys. No changes to `EntityDrawer.tsx` itself.

### 4. Universal Tab Contract

All drawer tab components accept `{ entityId: string }` as their only prop. Data fetching is owned by the tab (via TanStack Query hooks in `dashboard/_hooks/`). Lazy loading via `React.lazy()` + `Suspense` with `DrawerSkeleton` fallback.

### 5. Agent Bridge via WalkAi Client Tool

Emma opens drawers via the `open_entity_drawer` Ultravox client tool (same pattern as `navigate_to_page`). No WebSocket bridge needed — the tool runs client-side and calls `openDrawer()` directly through the context.

## Consequences

- New entity types are mechanical to add (config + tab + hook + i18n)
- DashboardContext is never polluted by drawer state
- Schedule-specific surfaces (DayControlSheet, shift-modal) remain the deep editing path
- Agent can open drawers without additional infrastructure
- Phase 3 can add Insights tabs and mutations without changing the architecture
