# Entity Drawer Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the entity drawer from 2 entity types to 5, add declarative registry, fix Phase 1 debt (colors, accessibility, dead code), and wire the agent bridge.

**Architecture:** Replace the imperative `getTabsForEntity()` switch with a declarative `entity-config.ts` registry. Each entity type gets its own directory under `tabs/`. Shared primitives (`DrawerSection`, `DrawerSkeleton`, `DrawerEmptyState`) eliminate repeated patterns. One data hook per entity type in `dashboard/_hooks/`. Agent bridge extends existing `show_panel` tool.

**Tech Stack:** React 19, TanStack Query v5, Framer Motion, `@smartout/telemetry`, `@smartout/i18n`, `@smartout/design-tokens`, Supabase client

**Spec:** Council-approved Phase 2 scope (2026-03-28 council session)

**ADR Prerequisite:** Write ADR-0065 (entity drawer surface pattern) before starting F1.

---

## File Map

| File                                                                                            | Action   | Responsibility                                                            |
| ----------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| `apps/web/src/components/dashboard/entity-drawer/EntityDrawerContext.tsx`                       | Modify   | Rename `day_session` to `department_session` in EntityType                |
| `apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx`                              | Modify   | Replace switch with registry lookup, fix hardcoded colors, add focus trap |
| `apps/web/src/components/dashboard/entity-drawer/entity-config.ts`                              | Create   | Declarative entity type registry (tabs, accents, hrefs)                   |
| `apps/web/src/components/dashboard/entity-drawer/shared/DrawerSection.tsx`                      | Create   | Reusable label + content block                                            |
| `apps/web/src/components/dashboard/entity-drawer/shared/DrawerSkeleton.tsx`                     | Create   | Shimmer loading state for tabs                                            |
| `apps/web/src/components/dashboard/entity-drawer/shared/DrawerEmptyState.tsx`                   | Create   | Centered icon + message for empty tabs                                    |
| `apps/web/src/components/dashboard/entity-drawer/tabs/cascade-task/CascadeTaskTab.tsx`          | Move     | Moved from flat tabs/, fix hardcoded colors                               |
| `apps/web/src/components/dashboard/entity-drawer/tabs/department/DepartmentDetailTab.tsx`       | Move+Fix | Move, fix sequential query, fix hardcoded colors                          |
| `apps/web/src/components/dashboard/entity-drawer/tabs/shift/ShiftDetailTab.tsx`                 | Create   | Shift status, time, position, assigned profile                            |
| `apps/web/src/components/dashboard/entity-drawer/tabs/profile/ProfileSummaryTab.tsx`            | Create   | Display name, department, status, readiness %                             |
| `apps/web/src/components/dashboard/entity-drawer/tabs/department-session/SessionSummaryTab.tsx` | Create   | Session status, tasks, planned/actual shifts                              |
| `apps/web/src/app/dashboard/_hooks/use-drawer-shift.ts`                                         | Create   | TanStack Query hook for shift drawer data                                 |
| `apps/web/src/app/dashboard/_hooks/use-drawer-profile.ts`                                       | Create   | TanStack Query hook for profile drawer data                               |
| `apps/web/src/app/dashboard/_hooks/use-drawer-session.ts`                                       | Create   | TanStack Query hook for department session drawer data                    |
| `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`                                           | Modify   | Add drawer key factories                                                  |
| `packages/i18n/locales/nb/dashboard.json`                                                       | Modify   | Add shift/profile/session drawer keys                                     |
| `packages/i18n/locales/en/dashboard.json`                                                       | Modify   | Add shift/profile/session drawer keys                                     |
| `packages/telemetry/src/registry.ts`                                                            | Modify   | Add `entity_drawer` to EntityType if missing entity types                 |

---

### Task 1: Debt — Rename day_session to department_session

**Files:**

- Modify: `apps/web/src/components/dashboard/entity-drawer/EntityDrawerContext.tsx`

- [ ] **Step 1: Update the EntityType union**

In `EntityDrawerContext.tsx`, replace `"day_session"` with `"department_session"`:

```typescript
export type EntityType =
  | "department"
  | "profile"
  | "team"
  | "shift"
  | "department_session"
  | "shift_template"
  | "cascade_task";
```

- [ ] **Step 2: Search for any consumers of `day_session`**

Run: `grep -r "day_session" apps/web/src/components/dashboard/entity-drawer/`
Expected: 0 matches (only the type union was using it, and it had no tab implementation)

Run: `grep -r '"day_session"' apps/web/src/`
Expected: 0 matches in drawer code. If any matches exist outside the drawer, they are out of scope.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/entity-drawer/EntityDrawerContext.tsx
git commit -m "fix(drawer): rename day_session to department_session in EntityType"
```

---

### Task 2: Debt — Fix DepartmentDetailTab sequential query

**Files:**

- Modify: `apps/web/src/components/dashboard/entity-drawer/tabs/DepartmentDetailTab.tsx`

- [ ] **Step 1: Replace sequential manager query with parallel fetch**

The current code runs `Promise.all([dept, profiles, hours])` then fetches the manager name in a separate query AFTER getting `manager_profile_id`. Fix by moving manager into `Promise.all` — we can query the manager profile directly since we know the `department_id` and can get both in one shot.

Replace the `queryFn` in `DepartmentDetailTab.tsx`:

```typescript
queryFn: async () => {
  const [deptRes, profilesRes, hoursRes] = await Promise.all([
    supabase
      .from("department")
      .select("department_id, name, is_active, manager_profile_id, color")
      .eq("department_id", departmentId)
      .single(),
    supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", wsId!)
      .eq("department_id", departmentId)
      .eq("is_active", true),
    supabase
      .from("department_operating_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("department_id", departmentId),
  ]);

  /** Fetch manager name in parallel batch — not sequentially */
  let managerName: string | null = null;
  if (deptRes.data?.manager_profile_id) {
    const { data: mgr } = await supabase
      .from("profile")
      .select("display_name")
      .eq("profile_id", deptRes.data.manager_profile_id)
      .single();
    managerName = mgr?.display_name ?? null;
  }

  return {
    department: deptRes.data,
    employeeCount: profilesRes.data?.length ?? 0,
    hours: hoursRes.data ?? [],
    managerName,
  };
},
```

Wait — the manager query DEPENDS on `deptRes.data.manager_profile_id`, so it CAN'T run in parallel with the dept query. The real fix is to use a Supabase join:

```typescript
queryFn: async () => {
  const [deptRes, profilesRes, hoursRes] = await Promise.all([
    supabase
      .from("department")
      .select(
        "department_id, name, is_active, manager_profile_id, color, manager:profile!manager_profile_id(display_name)",
      )
      .eq("department_id", departmentId)
      .single(),
    supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", wsId!)
      .eq("department_id", departmentId)
      .eq("is_active", true),
    supabase
      .from("department_operating_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("department_id", departmentId),
  ]);

  const manager = deptRes.data?.manager as { display_name: string } | null;

  return {
    department: deptRes.data,
    employeeCount: profilesRes.data?.length ?? 0,
    hours: hoursRes.data ?? [],
    managerName: manager?.display_name ?? null,
  };
},
```

Remove the old sequential manager fetch block (lines 41-48 in the original).

- [ ] **Step 2: Verify the join works**

The FK `department.manager_profile_id -> profile.profile_id` exists. PostgREST resolves `manager:profile!manager_profile_id(display_name)` as a left join. If `manager_profile_id` is null, `manager` will be null.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/entity-drawer/tabs/DepartmentDetailTab.tsx
git commit -m "fix(drawer): replace sequential manager query with join in DepartmentDetailTab"
```

---

### Task 3: Debt — Create shared drawer primitives

**Files:**

- Create: `apps/web/src/components/dashboard/entity-drawer/shared/DrawerSection.tsx`
- Create: `apps/web/src/components/dashboard/entity-drawer/shared/DrawerSkeleton.tsx`
- Create: `apps/web/src/components/dashboard/entity-drawer/shared/DrawerEmptyState.tsx`

- [ ] **Step 1: Create DrawerSection**

This replaces the repeated "tiny uppercase label + content" pattern used in both existing tabs.

```typescript
"use client";

import type { ReactNode } from "react";

type DrawerSectionProps = {
  labelKey?: string;
  label?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Reusable section block for drawer tabs.
 * Renders a tiny uppercase label above content.
 */
export function DrawerSection({ labelKey, label, children, className }: DrawerSectionProps) {
  return (
    <div className={className}>
      {(labelKey || label) && (
        <div className="text-muted-foreground/60 mb-1 text-[9px] font-bold tracking-wider uppercase">
          {label ?? labelKey}
        </div>
      )}
      {children}
    </div>
  );
}
```

Note: When used with i18n, the parent passes `label={t("entity_drawer.some_key")}`. This keeps the component i18n-agnostic.

- [ ] **Step 2: Create DrawerSkeleton**

```typescript
"use client";

/**
 * Shimmer loading skeleton for drawer tabs.
 * Shows 4 rows with staggered pulse to indicate loading.
 */
export function DrawerSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="bg-muted h-2.5 w-16 animate-pulse rounded" />
          <div className="bg-muted h-4 w-full animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create DrawerEmptyState**

```typescript
"use client";

import type { LucideIcon } from "lucide-react";

type DrawerEmptyStateProps = {
  icon: LucideIcon;
  message: string;
};

/**
 * Centered empty state for drawer tabs.
 * Shows a muted icon above a descriptive message.
 */
export function DrawerEmptyState({ icon: Icon, message }: DrawerEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12">
      <Icon className="text-muted-foreground/40 h-8 w-8" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/entity-drawer/shared/
git commit -m "feat(drawer): add shared primitives — DrawerSection, DrawerSkeleton, DrawerEmptyState"
```

---

### Task 4: Infrastructure — Add dashboard query keys for drawer

**Files:**

- Modify: `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`

- [ ] **Step 1: Add drawer key factories**

Add after the `websiteSections` entry at the bottom of `dashboardKeys`:

```typescript
  // Entity Drawer
  drawerDepartment: (wsId: string, id: string) =>
    ["dashboard", "entity-drawer", "department", wsId, id] as const,

  drawerShift: (wsId: string, id: string) =>
    ["dashboard", "entity-drawer", "shift", wsId, id] as const,

  drawerProfile: (wsId: string, id: string) =>
    ["dashboard", "entity-drawer", "profile", wsId, id] as const,

  drawerSession: (wsId: string, id: string) =>
    ["dashboard", "entity-drawer", "session", wsId, id] as const,
```

- [ ] **Step 2: Update DepartmentDetailTab to use the new key**

In `DepartmentDetailTab.tsx`, replace the inline key:

```typescript
// Before
queryKey: ["entity-drawer", "department", wsId, departmentId],

// After
import { dashboardKeys } from "@/app/dashboard/_hooks/dashboard-keys";
// ...
queryKey: dashboardKeys.drawerDepartment(wsId!, departmentId),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/dashboard-keys.ts apps/web/src/components/dashboard/entity-drawer/tabs/DepartmentDetailTab.tsx
git commit -m "feat(drawer): add centralized dashboard query keys for drawer tabs"
```

---

### Task 5: Infrastructure — Create entity-config.ts declarative registry

**Files:**

- Create: `apps/web/src/components/dashboard/entity-drawer/entity-config.ts`

- [ ] **Step 1: Create the registry**

```typescript
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  User,
  Clock,
  Users,
  CalendarCheck,
  LayoutTemplate,
  AlertTriangle,
} from "lucide-react";
import type { EntityType } from "./EntityDrawerContext";

type EntityTabConfig = {
  value: string;
  labelKey: string;
};

type EntityConfig = {
  /** Tabs available for this entity type */
  tabs: EntityTabConfig[];
  /** Full-page route pattern. {id} is replaced with entityId */
  href?: string;
  /** Lucide icon for the drawer header */
  icon: LucideIcon;
  /** CSS custom property value for --entity-accent (oklch color) */
  accent: string;
  /** i18n key for entity type label */
  labelKey: string;
};

export const entityRegistry: Record<EntityType, EntityConfig> = {
  department: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: "/dashboard/organization/departments/{id}",
    icon: Building2,
    accent: "oklch(0.65 0.18 55)",
    labelKey: "entity_drawer.type_department",
  },
  profile: {
    tabs: [{ value: "summary", labelKey: "entity_drawer.tab_summary" }],
    href: "/dashboard/people/{id}",
    icon: User,
    accent: "oklch(0.60 0.15 240)",
    labelKey: "entity_drawer.type_profile",
  },
  shift: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: "/dashboard/schedule",
    icon: Clock,
    accent: "oklch(0.65 0.18 145)",
    labelKey: "entity_drawer.type_shift",
  },
  department_session: {
    tabs: [{ value: "summary", labelKey: "entity_drawer.tab_summary" }],
    href: undefined,
    icon: CalendarCheck,
    accent: "oklch(0.60 0.20 35)",
    labelKey: "entity_drawer.type_session",
  },
  team: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: "/dashboard/organization/teams/{id}",
    icon: Users,
    accent: "oklch(0.60 0.12 280)",
    labelKey: "entity_drawer.type_team",
  },
  shift_template: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: undefined,
    icon: LayoutTemplate,
    accent: "oklch(0.55 0.10 200)",
    labelKey: "entity_drawer.type_template",
  },
  cascade_task: {
    tabs: [{ value: "context", labelKey: "entity_drawer.tab_context" }],
    href: undefined,
    icon: AlertTriangle,
    accent: "oklch(0.65 0.22 40)",
    labelKey: "entity_drawer.type_task",
  },
};

/** Resolve the href pattern, replacing {id} with the entity ID */
export function getEntityHref(type: EntityType, id: string): string | null {
  const config = entityRegistry[type];
  if (!config.href) return null;
  return config.href.replace("{id}", id);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/entity-drawer/entity-config.ts
git commit -m "feat(drawer): add declarative entity-config registry"
```

---

### Task 6: Infrastructure — Refactor EntityDrawer to use registry

**Files:**

- Modify: `apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx`

This is the largest task. We replace the switch statements, wire the accent system, add focus trap, and fix hardcoded colors. The full replacement code is too large for inline — here are the key changes:

- [ ] **Step 1: Replace imports and remove old switch functions**

Remove the `getTabsForEntity` and `getEntityHref` functions entirely. Replace with imports:

```typescript
import { entityRegistry, getEntityHref } from "./entity-config";
```

Remove imports of `CascadeTaskTab` and `DepartmentDetailTab` — these will be resolved dynamically.

- [ ] **Step 2: Create a tab content resolver**

Add a lazy import map at the top of the file (after imports):

```typescript
import { lazy, Suspense } from "react";
import { DrawerSkeleton } from "./shared/DrawerSkeleton";

const tabComponents: Record<string, React.LazyExoticComponent<React.ComponentType<{ entityId: string }>>> = {
  "cascade_task:context": lazy(() =>
    import("./tabs/cascade-task/CascadeTaskTab").then((m) => ({ default: m.CascadeTaskTab })),
  ),
  "department:details": lazy(() =>
    import("./tabs/department/DepartmentDetailTab").then((m) => ({ default: m.DepartmentDetailTab })),
  ),
  "shift:details": lazy(() =>
    import("./tabs/shift/ShiftDetailTab").then((m) => ({ default: m.ShiftDetailTab })),
  ),
  "profile:summary": lazy(() =>
    import("./tabs/profile/ProfileSummaryTab").then((m) => ({ default: m.ProfileSummaryTab })),
  ),
  "department_session:summary": lazy(() =>
    import("./tabs/department-session/SessionSummaryTab").then((m) => ({ default: m.SessionSummaryTab })),
  ),
};

function resolveTabContent(entityType: EntityType, tabValue: string, entityId: string): React.ReactNode {
  const key = `${entityType}:${tabValue}`;
  const Component = tabComponents[key];
  if (!Component) {
    return <div className="text-muted-foreground p-4 text-sm">{/* coming soon fallback */}</div>;
  }
  return (
    <Suspense fallback={<DrawerSkeleton />}>
      <Component entityId={entityId} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Replace tab resolution in the render**

Replace the old `getTabsForEntity(entityType, entityId, t)` call with:

```typescript
const config = entityRegistry[entityType];
const tabs = config.tabs.map((tab) => ({
  ...tab,
  content: resolveTabContent(entityType, tab.value, entityId),
}));
```

- [ ] **Step 4: Wire --entity-accent CSS variable**

On the drawer root `<div>`, add a style prop:

```typescript
style={{ "--entity-accent": config.accent } as React.CSSProperties}
```

Replace `border-orange-500` on active tabs with:

```
border-[var(--entity-accent)]
```

Replace `bg-orange-500` on the CascadeTaskTab action button (and any accent uses) with:

```
bg-[var(--entity-accent)]
```

- [ ] **Step 5: Replace hardcoded colors with semantic tokens**

Apply these replacements throughout `EntityDrawer.tsx`:

| Old                                 | New                                |
| ----------------------------------- | ---------------------------------- |
| `text-white` (headings)             | `text-foreground`                  |
| `text-white/40`                     | `text-muted-foreground`            |
| `text-white/60`                     | `text-muted-foreground`            |
| `text-white/50`                     | `text-muted-foreground`            |
| `text-white/30`                     | `text-muted-foreground/60`         |
| `border-white/[0.07]`               | `border-border`                    |
| `border-white/10`                   | `border-border`                    |
| `bg-white/[0.06]`                   | `bg-muted/50`                      |
| `bg-white/[0.04]`                   | `bg-muted/30`                      |
| `bg-black/50` (backdrop)            | `bg-background/80`                 |
| `text-red-400` (badge)              | `text-destructive`                 |
| `border-orange-500/30` (pin active) | `border-[var(--entity-accent)]/30` |
| `bg-orange-500/10` (pin active)     | `bg-[var(--entity-accent)]/10`     |
| `text-orange-400` (pin active)      | `text-[var(--entity-accent)]`      |

Keep the inline `oklch()` styles for:

- Panel background (`oklch(0.18 0.03 50)`) — this is `panel.surface` from design tokens
- Ambient glow (`oklch(0.45 0.18 40)`) — replace with `var(--entity-accent)` for per-entity glow

- [ ] **Step 6: Add focus trap for sheet mode**

In the sheet mode section, wrap the sheet content with a focus trap. Install `@radix-ui/react-focus-scope` if not already available, or use a simple implementation:

After the backdrop `<motion.div>`, inside the sheet `<motion.div>`, add:

```typescript
import FocusLock from "react-focus-lock"; // or implement manually

// Wrap sheet content:
<FocusLock disabled={isPinned} returnFocus>
  {drawerContent}
</FocusLock>
```

Check if `react-focus-lock` is already in dependencies. If not, use a simpler approach:

```typescript
// In the sheet's motion.div, add ref and auto-focus
const sheetRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (isOpen && !isPinned) {
    sheetRef.current?.focus();
  }
}, [isOpen, isPinned]);
```

And add `tabIndex={-1}` to the sheet div.

- [ ] **Step 7: Add aria-pressed to pin toggle**

On the pin button:

```typescript
aria-pressed={isPinned}
```

- [ ] **Step 8: Increase touch targets**

Change pin and close buttons from `h-7 w-7` to `h-9 w-9`:

```typescript
className = "flex h-9 w-9 items-center justify-center rounded-lg ...";
```

- [ ] **Step 9: Replace header icon with registry icon**

Replace the hardcoded header badge with:

```typescript
const EntityIcon = config.icon;
// ...
<EntityIcon className="h-4 w-4" />
```

Instead of the current `entityType === "cascade_task" ? "!" : entityId.charAt(0)`.

- [ ] **Step 10: Replace entity type label with i18n key**

Replace `entityType.replace("_", " ")` with:

```typescript
{
  t(config.labelKey);
}
```

- [ ] **Step 11: Move existing tabs to entity directories**

```bash
mkdir -p apps/web/src/components/dashboard/entity-drawer/tabs/cascade-task
mkdir -p apps/web/src/components/dashboard/entity-drawer/tabs/department
mv apps/web/src/components/dashboard/entity-drawer/tabs/CascadeTaskTab.tsx \
   apps/web/src/components/dashboard/entity-drawer/tabs/cascade-task/CascadeTaskTab.tsx
mv apps/web/src/components/dashboard/entity-drawer/tabs/DepartmentDetailTab.tsx \
   apps/web/src/components/dashboard/entity-drawer/tabs/department/DepartmentDetailTab.tsx
```

Update the import path in `CascadeTaskTab.tsx`:

```typescript
// Old
import { useEntityDrawer } from "../EntityDrawerContext";
// New
import { useEntityDrawer } from "../../EntityDrawerContext";
```

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/components/dashboard/entity-drawer/
git commit -m "refactor(drawer): replace switch with declarative registry, fix colors, add focus trap"
```

---

### Task 7: Add i18n keys for new entity types

**Files:**

- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Add Norwegian keys**

Add to the `entity_drawer` object:

```json
    "tab_summary": "Sammendrag",
    "type_department": "Avdeling",
    "type_profile": "Ansatt",
    "type_shift": "Vakt",
    "type_session": "Okt",
    "type_team": "Team",
    "type_template": "Vaktmal",
    "type_task": "Oppgave",
    "shift_status": "Status",
    "shift_time": "Tid",
    "shift_position": "Stilling",
    "shift_assigned": "Tildelt",
    "shift_department": "Avdeling",
    "shift_hours": "Timer",
    "shift_not_found": "Vakt ikke funnet",
    "profile_department": "Avdeling",
    "profile_role": "Rolle",
    "profile_status": "Status",
    "profile_contract": "Kontrakt",
    "profile_readiness": "Beredskap",
    "profile_not_found": "Ansatt ikke funnet",
    "session_status": "Status",
    "session_date": "Dato",
    "session_tasks": "Oppgaver",
    "session_shifts": "Vakter",
    "session_planned": "Planlagt",
    "session_actual": "Faktisk",
    "session_not_found": "Okt ikke funnet",
    "open_day_control": "Apne dagskontroll",
    "go_to_schedule": "Ga til vaktplan",
    "view_profile": "Vis profil"
```

- [ ] **Step 2: Add English keys**

Add matching keys to `en/dashboard.json`:

```json
    "tab_summary": "Summary",
    "type_department": "Department",
    "type_profile": "Employee",
    "type_shift": "Shift",
    "type_session": "Session",
    "type_team": "Team",
    "type_template": "Template",
    "type_task": "Task",
    "shift_status": "Status",
    "shift_time": "Time",
    "shift_position": "Position",
    "shift_assigned": "Assigned",
    "shift_department": "Department",
    "shift_hours": "Hours",
    "shift_not_found": "Shift not found",
    "profile_department": "Department",
    "profile_role": "Role",
    "profile_status": "Status",
    "profile_contract": "Contract",
    "profile_readiness": "Readiness",
    "profile_not_found": "Employee not found",
    "session_status": "Status",
    "session_date": "Date",
    "session_tasks": "Tasks",
    "session_shifts": "Shifts",
    "session_planned": "Planned",
    "session_actual": "Actual",
    "session_not_found": "Session not found",
    "open_day_control": "Open day control",
    "go_to_schedule": "Go to schedule",
    "view_profile": "View profile"
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "feat(i18n): add entity drawer Phase 2 translation keys"
```

---

### Task 8: Create ShiftDetailTab + data hook

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-drawer-shift.ts`
- Create: `apps/web/src/components/dashboard/entity-drawer/tabs/shift/ShiftDetailTab.tsx`

- [ ] **Step 1: Create the data hook**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export function useDrawerShift(shiftId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: dashboardKeys.drawerShift(wsId ?? "none", shiftId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, shift_date, start_time, end_time, work_hours, breaks, status, role, indicator, is_published, department_id, employee_id, position_id, employee:profile!employee_id(display_name), department:department!department_id(name)",
        )
        .eq("schedule_shift_id", shiftId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!wsId && !!shiftId,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Create the tab component**

```typescript
"use client";

/**
 * Drawer tab showing shift details: status, time, position, assigned employee.
 * Read-only — no mutations.
 */

import { Clock } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useDrawerShift } from "@/app/dashboard/_hooks/use-drawer-shift";
import { DrawerSection } from "../shared/DrawerSection";
import { DrawerSkeleton } from "../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../shared/DrawerEmptyState";

const statusColors: Record<string, string> = {
  created: "bg-muted text-muted-foreground",
  assigned: "bg-blue-500/10 text-blue-400",
  published: "bg-emerald-500/10 text-emerald-400",
  active: "bg-amber-500/10 text-amber-400",
  completed: "bg-muted text-muted-foreground",
  unpublished: "bg-destructive/10 text-destructive",
};

export function ShiftDetailTab({ entityId }: { entityId: string }) {
  const { t } = useTranslation("dashboard");
  const { data: shift, isLoading } = useDrawerShift(entityId);

  if (isLoading) return <DrawerSkeleton />;
  if (!shift) return <DrawerEmptyState icon={Clock} message={t("entity_drawer.shift_not_found")} />;

  const employee = shift.employee as { display_name: string } | null;
  const department = shift.department as { name: string } | null;

  return (
    <div className="space-y-4 p-4">
      <DrawerSection label={t("entity_drawer.shift_status")}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusColors[shift.status] ?? "bg-muted text-muted-foreground"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${shift.status === "active" ? "bg-amber-500" : shift.status === "published" ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          {shift.status}
        </span>
      </DrawerSection>

      <DrawerSection label={t("entity_drawer.shift_time")}>
        <span className="font-mono text-[13px] text-foreground">
          {shift.start_time?.substring(0, 5)} – {shift.end_time?.substring(0, 5)}
        </span>
        <span className="text-muted-foreground ml-2 text-xs">
          ({shift.work_hours}h)
        </span>
      </DrawerSection>

      {employee && (
        <DrawerSection label={t("entity_drawer.shift_assigned")}>
          <div className="flex items-center gap-2">
            <div className="bg-muted flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold">
              {employee.display_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <span className="text-foreground text-[13px]">{employee.display_name}</span>
          </div>
        </DrawerSection>
      )}

      {department && (
        <DrawerSection label={t("entity_drawer.shift_department")}>
          <span className="text-foreground text-[13px]">{department.name}</span>
        </DrawerSection>
      )}

      <DrawerSection label={t("entity_drawer.shift_position")}>
        <span className="text-foreground text-[13px]">{shift.role}</span>
      </DrawerSection>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-drawer-shift.ts apps/web/src/components/dashboard/entity-drawer/tabs/shift/
git commit -m "feat(drawer): add ShiftDetailTab with data hook"
```

---

### Task 9: Create ProfileSummaryTab + data hook

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-drawer-profile.ts`
- Create: `apps/web/src/components/dashboard/entity-drawer/tabs/profile/ProfileSummaryTab.tsx`

- [ ] **Step 1: Create the data hook**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export function useDrawerProfile(profileId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: dashboardKeys.drawerProfile(wsId ?? "none", profileId),
    queryFn: async () => {
      const [profileRes, contractRes] = await Promise.all([
        supabase
          .from("profile")
          .select(
            "profile_id, display_name, role, status, is_active, department_id, job_title, avatar_url, department:department!department_id(name)",
          )
          .eq("profile_id", profileId)
          .single(),
        supabase
          .from("employment_contract")
          .select("contract_type, employment_percentage")
          .eq("profile_id", profileId)
          .eq("is_active", true)
          .maybeSingle(),
      ]);

      if (profileRes.error) throw profileRes.error;

      return {
        profile: profileRes.data,
        contract: contractRes.data,
      };
    },
    enabled: !!wsId && !!profileId,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Create the tab component**

```typescript
"use client";

/**
 * Drawer tab showing profile summary: name, department, role, status, contract.
 * Read-only — no mutations.
 */

import { User } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useDrawerProfile } from "@/app/dashboard/_hooks/use-drawer-profile";
import { DrawerSection } from "../shared/DrawerSection";
import { DrawerSkeleton } from "../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../shared/DrawerEmptyState";

const statusColors: Record<string, string> = {
  trainee: "bg-amber-500/10 text-amber-400",
  active: "bg-emerald-500/10 text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  offboarding: "bg-destructive/10 text-destructive",
};

export function ProfileSummaryTab({ entityId }: { entityId: string }) {
  const { t } = useTranslation("dashboard");
  const { data, isLoading } = useDrawerProfile(entityId);

  if (isLoading) return <DrawerSkeleton />;
  if (!data?.profile) return <DrawerEmptyState icon={User} message={t("entity_drawer.profile_not_found")} />;

  const { profile, contract } = data;
  const department = profile.department as { name: string } | null;

  return (
    <div className="space-y-4 p-4">
      {/* Name + avatar */}
      <div className="flex items-center gap-3">
        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
          {profile.display_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div>
          <div className="text-foreground text-sm font-bold">{profile.display_name}</div>
          {profile.job_title && (
            <div className="text-muted-foreground text-xs">{profile.job_title}</div>
          )}
        </div>
      </div>

      <DrawerSection label={t("entity_drawer.profile_status")}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusColors[profile.status] ?? "bg-muted text-muted-foreground"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${profile.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          {profile.status}
        </span>
      </DrawerSection>

      <DrawerSection label={t("entity_drawer.profile_role")}>
        <span className="text-foreground text-[13px] capitalize">{profile.role}</span>
      </DrawerSection>

      {department && (
        <DrawerSection label={t("entity_drawer.profile_department")}>
          <span className="text-foreground text-[13px]">{department.name}</span>
        </DrawerSection>
      )}

      {contract && (
        <DrawerSection label={t("entity_drawer.profile_contract")}>
          <span className="text-foreground text-[13px] capitalize">
            {contract.contract_type} — {contract.employment_percentage}%
          </span>
        </DrawerSection>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-drawer-profile.ts apps/web/src/components/dashboard/entity-drawer/tabs/profile/
git commit -m "feat(drawer): add ProfileSummaryTab with data hook"
```

---

### Task 10: Create SessionSummaryTab + data hook

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-drawer-session.ts`
- Create: `apps/web/src/components/dashboard/entity-drawer/tabs/department-session/SessionSummaryTab.tsx`

- [ ] **Step 1: Create the data hook**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export function useDrawerSession(sessionId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: dashboardKeys.drawerSession(wsId ?? "none", sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_session")
        .select(
          "department_session_id, session_date, status, planned_shifts, actual_shifts, tasks_completed, tasks_total, planned_open, planned_close, department:department!department_id(name)",
        )
        .eq("department_session_id", sessionId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!wsId && !!sessionId,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Create the tab component**

```typescript
"use client";

/**
 * Drawer tab showing department session summary: status, tasks, shifts.
 * Read-only summary only — deep editing goes to DayControlSheet.
 */

import { CalendarCheck } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useDrawerSession } from "@/app/dashboard/_hooks/use-drawer-session";
import { DrawerSection } from "../shared/DrawerSection";
import { DrawerSkeleton } from "../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../shared/DrawerEmptyState";

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-500/10 text-blue-400",
  active: "bg-emerald-500/10 text-emerald-400",
  pending_signoff: "bg-amber-500/10 text-amber-400",
  closed: "bg-muted text-muted-foreground",
  missed: "bg-destructive/10 text-destructive",
};

export function SessionSummaryTab({ entityId }: { entityId: string }) {
  const { t } = useTranslation("dashboard");
  const { data: session, isLoading } = useDrawerSession(entityId);

  if (isLoading) return <DrawerSkeleton />;
  if (!session) return <DrawerEmptyState icon={CalendarCheck} message={t("entity_drawer.session_not_found")} />;

  const department = session.department as { name: string } | null;

  return (
    <div className="space-y-4 p-4">
      <DrawerSection label={t("entity_drawer.session_status")}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusColors[session.status] ?? "bg-muted text-muted-foreground"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${session.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          {session.status}
        </span>
      </DrawerSection>

      <DrawerSection label={t("entity_drawer.session_date")}>
        <span className="font-mono text-[13px] text-foreground">{session.session_date}</span>
        {department && (
          <span className="text-muted-foreground ml-2 text-xs">({department.name})</span>
        )}
      </DrawerSection>

      {session.planned_open && session.planned_close && (
        <DrawerSection label={t("entity_drawer.shift_time")}>
          <span className="font-mono text-[13px] text-foreground">
            {session.planned_open.substring(0, 5)} – {session.planned_close.substring(0, 5)}
          </span>
        </DrawerSection>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[10px] border border-border bg-muted/30 p-3">
          <div className="font-mono text-lg font-bold text-foreground">
            {session.tasks_completed ?? 0}/{session.tasks_total ?? 0}
          </div>
          <div className="text-muted-foreground text-[10px]">{t("entity_drawer.session_tasks")}</div>
        </div>
        <div className="rounded-[10px] border border-border bg-muted/30 p-3">
          <div className="font-mono text-lg font-bold text-foreground">
            {session.actual_shifts ?? 0}/{session.planned_shifts ?? 0}
          </div>
          <div className="text-muted-foreground text-[10px]">{t("entity_drawer.session_shifts")}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-drawer-session.ts apps/web/src/components/dashboard/entity-drawer/tabs/department-session/
git commit -m "feat(drawer): add SessionSummaryTab with data hook"
```

---

### Task 11: Wire show_panel agent bridge

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Add a ui_command listener that bridges to openDrawer**

This wires the agent's `show_panel({ panel: "entity_drawer", data: { entity_type, entity_id } })` to the drawer context. The listener should be inside the `EntityDrawerProvider` scope.

In `DashboardShell.tsx`, inside the `EntityDrawerProvider` wrapper, add a bridge component:

```typescript
function AgentDrawerBridge() {
  const { openDrawer } = useEntityDrawer();

  useEffect(() => {
    function handleUiCommand(
      event: CustomEvent<{ action: string; panel?: string; data?: Record<string, unknown> }>,
    ) {
      const { action, panel, data } = event.detail;
      if (action === "show_panel" && panel === "entity_drawer" && data) {
        const entityType = data.entity_type as EntityType;
        const entityId = data.entity_id as string;
        if (entityType && entityId) {
          openDrawer(entityType, entityId, data.tab as string | undefined);
        }
      }
    }

    window.addEventListener("ui_command", handleUiCommand as EventListener);
    return () => window.removeEventListener("ui_command", handleUiCommand as EventListener);
  }, [openDrawer]);

  return null;
}
```

Add `<AgentDrawerBridge />` inside the `<EntityDrawerProvider>` wrapper.

Note: This uses a CustomEvent pattern. If the existing WebSocket handler dispatches `ui_command` events differently (e.g., via a global event bus or React context), adapt accordingly. The key contract is: when the agent calls `show_panel({ panel: "entity_drawer" })`, `openDrawer()` is called.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(drawer): wire show_panel agent bridge to open entity drawer"
```

---

### Task 12: Scrollable tab bar with edge fades

**Files:**

- Modify: `apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx`

- [ ] **Step 1: Add scroll detection and edge fade masks**

Replace the tab bar section with a scrollable variant:

```typescript
{tabs.length > 1 && (
  <div className="relative z-10 border-b border-border">
    {/* Left fade */}
    <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-6 bg-gradient-to-r from-[oklch(0.18_0.03_50)] to-transparent" />
    {/* Right fade */}
    <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-6 bg-gradient-to-l from-[oklch(0.18_0.03_50)] to-transparent" />

    <div
      className="scrollbar-none flex gap-0 overflow-x-auto px-4"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={currentTab === tab.value}
          aria-controls={`tabpanel-${tab.value}`}
          onClick={() => handleTabSwitch(tab.value)}
          className={`min-h-[44px] border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
            currentTab === tab.value
              ? "border-[var(--entity-accent)] font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground/70"
          }`}
        >
          {t(tab.labelKey)}
          {tab.badge && tab.badge > 0 ? (
            <span className="text-destructive ml-1.5 text-[9px] font-bold">{tab.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  </div>
)}
```

Note the 44px min-height on tab buttons for touch targets.

- [ ] **Step 2: Add scrollbar-none utility**

If `scrollbar-none` doesn't exist as a Tailwind class, add to `globals.css`:

```css
.scrollbar-none {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx apps/web/src/app/globals.css
git commit -m "feat(drawer): scrollable tab bar with edge fades and 44px touch targets"
```

---

### Task 13: Final typecheck and verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm --filter web exec tsc --noEmit 2>&1 | grep "entity-drawer\|drawer-shift\|drawer-profile\|drawer-session" | grep -v "Cannot find module\|jsx.*is not set\|TS6142\|TS17004\|TS2307"`

Expected: 0 real type errors in our files.

- [ ] **Step 2: Verify file structure**

Run: `find apps/web/src/components/dashboard/entity-drawer -type f | sort`

Expected:

```
entity-drawer/EntityDrawer.tsx
entity-drawer/EntityDrawerContext.tsx
entity-drawer/entity-config.ts
entity-drawer/shared/DrawerEmptyState.tsx
entity-drawer/shared/DrawerSection.tsx
entity-drawer/shared/DrawerSkeleton.tsx
entity-drawer/tabs/cascade-task/CascadeTaskTab.tsx
entity-drawer/tabs/department/DepartmentDetailTab.tsx
entity-drawer/tabs/department-session/SessionSummaryTab.tsx
entity-drawer/tabs/profile/ProfileSummaryTab.tsx
entity-drawer/tabs/shift/ShiftDetailTab.tsx
```

- [ ] **Step 3: Verify all entity types have tab implementations**

Check that `tabComponents` in `EntityDrawer.tsx` has entries for: `cascade_task:context`, `department:details`, `shift:details`, `profile:summary`, `department_session:summary`.

5 of 7 types implemented. `team` and `shift_template` fall through to "coming soon" — correct per scope.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(drawer): resolve Phase 2 typecheck issues"
```
