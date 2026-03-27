---
title: "User Journeys — Entity Drawer"
status: done
updated: 2026-03-27
created: 2026-03-27
module: dashboard
tags: [entity-drawer, journeys]
---

# User Journeys — Entity Drawer

## Journey: Admin inspects cascade task via drawer

**Precondition:** Admin is on the dashboard with cascade tasks visible in the todo list.

1. Admin sees compact task rows in the todo section with urgency indicators (border color + badge)
2. Admin clicks a task row -> System emits `task_surface clicked` + `entity_drawer opened` telemetry -> Drawer slides in from right (sheet mode, 380px)
3. Admin sees task context: title, urgency, dimension badge, description ("Why this matters"), and "Go to" action button
4. Admin clicks "Go to" -> System closes drawer -> Navigates to the relevant page

**Postcondition:** Admin has inspected task context without losing their place in the dashboard.

**Error paths:**

- Task data not found (stale cache) -> Drawer shows "Task not found" message
- Entity type has no tab implementation -> Drawer shows "Coming soon" placeholder

## Journey: Admin inspects department via drawer

**Precondition:** A component calls `openDrawer("department", departmentId)`.

1. Drawer opens showing department details tab
2. Admin sees: status (active/inactive), manager name with avatar initials, weekday opening hours, employee count, department color badge
3. Admin clicks "Open full page" footer button -> Navigates to `/dashboard/organization/departments/{id}`

**Postcondition:** Admin reviewed department summary without navigating away.

**Error paths:**

- Department loading -> Spinner shown
- Department not found or no data -> Loading spinner persists (query stays in loading state)

## Journey: Admin pins drawer for persistent split-panel

**Precondition:** Drawer is open in sheet mode (overlay). Viewport is >= 768px.

1. Admin clicks pin button -> System emits `entity_drawer pinned` telemetry -> Drawer transitions to inline panel, main content narrows
2. Pin preference saved to localStorage
3. Admin navigates to another page -> Drawer closes but pin preference preserved
4. Admin opens another entity -> Drawer opens directly in pinned mode

**Postcondition:** Drawer is persistently pinned as a split-panel layout preference.

**Error paths:**

- Viewport resizes below 768px -> Drawer auto-unpins to prevent fullscreen stuck state
- Pin button clicked on mobile -> No effect (mobile pinning blocked)

## Journey: Admin closes drawer

**Precondition:** Drawer is open.

1. Sheet mode: Admin clicks X button OR clicks backdrop OR presses Escape -> System emits `entity_drawer closed` with duration_ms -> Drawer closes
2. Pinned mode: Admin clicks X button -> Drawer closes (pin preference preserved)
3. Route change: Drawer closes automatically

**Postcondition:** Drawer is closed, focus returns to main content.

## Journey: Admin switches tabs in drawer

**Precondition:** Drawer is open for an entity with multiple tabs.

1. Admin clicks a different tab -> System emits `entity_drawer tab_switched` with from_tab and to_tab -> Tab content animates (fade + slide)
2. Active tab has orange border indicator

**Postcondition:** New tab content is displayed.
