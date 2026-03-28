---
title: "User Journeys — Season Operations Loop"
status: done
updated: 2026-03-28
created: 2026-03-28
module: dashboard
tags: [entity-drawer, season-operations, journeys]
---

# User Journeys — Season Operations Loop

> Note: This branch primarily implemented Entity Drawer Phase 2 (expanding from 2 to 5 entity types with declarative registry) and the Emma agent bridge.

## Journey: Admin inspects a shift via entity drawer

**Precondition:** Admin is on any dashboard page with Emma active or a component that calls `openDrawer("shift", shiftId)`.

1. Drawer opens showing ShiftDetailTab
2. Admin sees: shift status badge (created/assigned/published/active/completed), time range with hours, assigned employee with avatar initials, department name, position/role
3. Admin clicks "Open full page" footer -> Navigates to schedule page

**Postcondition:** Admin reviewed shift context without leaving current page.

**Error paths:**

- Shift not found -> DrawerEmptyState with Clock icon + "Vakt ikke funnet"
- Loading -> DrawerSkeleton shimmer

## Journey: Admin inspects an employee profile via entity drawer

**Precondition:** A component calls `openDrawer("profile", profileId)`.

1. Drawer opens showing ProfileSummaryTab
2. Admin sees: display name + avatar initials, job title, status badge (trainee/active/inactive/offboarding), role (employee/manager/admin/owner), department name, contract info (employment_category + percentage)
3. Admin clicks "Open full page" -> Navigates to `/dashboard/people/{id}`

**Postcondition:** Admin reviewed employee summary inline.

**Error paths:**

- Profile not found -> DrawerEmptyState with User icon + "Ansatt ikke funnet"

## Journey: Admin inspects a department session via entity drawer

**Precondition:** A component calls `openDrawer("department_session", sessionId)`.

1. Drawer opens showing SessionSummaryTab
2. Admin sees: session status badge (upcoming/active/pending_signoff/closed/missed), date + department name, planned open/close times, stats grid (tasks completed/total, actual/planned shifts)
3. No "Open full page" footer (department_session has no href)

**Postcondition:** Admin reviewed session summary. Deep editing goes to DayControlSheet.

**Error paths:**

- Session not found -> DrawerEmptyState with CalendarCheck icon + "Økt ikke funnet"

## Journey: Emma opens entity drawer via voice command

**Precondition:** Emma is active in the dashboard (WalkAi overlay). User asks about an entity.

1. User says "vis meg kjøkkenet" or "show me the kitchen department"
2. Emma calls `open_entity_drawer({ entity_type: "department", entity_id: "<uuid>" })`
3. WalkAi tool validates entity_type against VALID_ENTITY_TYPES set
4. Tool calls `actions.openEntityDrawer()` which calls `openDrawer()` from EntityDrawerContext
5. Drawer slides open with entity details
6. Emma confirms: "Opened entity drawer for department [id]"

**Postcondition:** User sees entity details without manual navigation.

**Error paths:**

- Invalid entity type -> Emma gets "Unknown entity type" response
- Missing entity_id -> Emma gets "entity_id is required" response
- EntityDrawerProvider not available -> Emma gets "Entity drawer not available" response

## Journey: Developer adds a new entity type to the drawer

**Precondition:** Developer wants to add a new entity type (e.g., "team").

1. Create tab component in `tabs/team/TeamOverviewTab.tsx` with `{ entityId: string }` prop
2. Create data hook in `dashboard/_hooks/use-drawer-team.ts` with TanStack Query
3. Add query key to `dashboard-keys.ts`
4. Add entry to `entityRegistry` in `entity-config.ts` (tabs, icon, accent, href, labelKey)
5. Add lazy import to `tabComponents` map in `EntityDrawer.tsx`
6. Add i18n keys to nb/en dashboard.json
7. Add entity type to `VALID_ENTITY_TYPES` in `walkai-tools.ts` (if Emma should open it)

**Postcondition:** New entity type works in drawer with accent color, loading states, and agent bridge.
