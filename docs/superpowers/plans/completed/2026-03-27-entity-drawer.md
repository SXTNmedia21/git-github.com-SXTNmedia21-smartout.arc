# Entity Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hybrid sheet/pin entity drawer to DashboardShell with compact cascade task rows, supporting Department and Cascade Task entity types in Phase 1.

**Architecture:** Separate `EntityDrawerProvider` wraps the content area of DashboardShell (not in DashboardContext). The drawer uses Framer Motion for sheet/pin animations with Nordic Split glassmorphism. Compact task rows replace current cards, opening the drawer instead of navigating. Each entity type provides its own tab configuration.

**Tech Stack:** React 19, Framer Motion, shadcn/ui primitives, TanStack Query v5, `@smartout/telemetry`, `@smartout/i18n`, design tokens from `packages/design-tokens`

**Spec:** `docs/superpowers/specs/2026-03-27-entity-drawer-design.md`

---

## File Map

| File                                                                           | Action | Responsibility                                      |
| ------------------------------------------------------------------------------ | ------ | --------------------------------------------------- |
| `packages/telemetry/src/registry.ts`                                           | Modify | Register 4 drawer events                            |
| `packages/i18n/locales/nb/dashboard.json`                                      | Modify | Drawer i18n keys                                    |
| `packages/i18n/locales/en/dashboard.json`                                      | Modify | Drawer i18n keys                                    |
| `apps/web/src/components/dashboard/entity-drawer/EntityDrawerContext.tsx`      | Create | Provider + useEntityDrawer hook                     |
| `apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx`             | Create | Drawer shell: sheet/pin modes, header, tab renderer |
| `apps/web/src/components/dashboard/entity-drawer/tabs/CascadeTaskTab.tsx`      | Create | Task context + description + action button          |
| `apps/web/src/components/dashboard/entity-drawer/tabs/DepartmentDetailTab.tsx` | Create | Department summary: status, manager, hours, stats   |
| `apps/web/src/components/dashboard/DashboardShell.tsx`                         | Modify | Wrap content area in EntityDrawerProvider           |
| `apps/web/src/app/dashboard/_components/todo/TodoTaskCard.tsx`                 | Modify | Compact row + openDrawer on click                   |
| `apps/web/src/app/dashboard/_components/todo/TodoGroupSection.tsx`             | Modify | Adjust spacing for compact rows                     |

---

### Task 1: Telemetry — Register drawer events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add 4 event interfaces**

After the `TaskSurfaceClicked` interface (around line 1797), add:

```typescript
// ─── Entity Drawer Events ───────────────────────
export interface EntityDrawerOpened extends BaseEvent {
  event: "entity_drawer opened";
  properties: {
    data: { entity_type: string; entity_id: string; source: string };
  };
}

export interface EntityDrawerClosed extends BaseEvent {
  event: "entity_drawer closed";
  properties: {
    data: { entity_type: string; entity_id: string; duration_ms: number };
  };
}

export interface EntityDrawerPinned extends BaseEvent {
  event: "entity_drawer pinned";
  properties: {
    data: { entity_type: string; entity_id: string };
  };
}

export interface EntityDrawerTabSwitched extends BaseEvent {
  event: "entity_drawer tab_switched";
  properties: {
    data: { entity_type: string; entity_id: string; from_tab: string; to_tab: string };
  };
}
```

- [ ] **Step 2: Add to SmartoutEvent union**

Find `| TaskSurfaceClicked` and add after it:

```typescript
  | EntityDrawerOpened
  | EntityDrawerClosed
  | EntityDrawerPinned
  | EntityDrawerTabSwitched
```

- [ ] **Step 3: Add to registry map**

After the `"task_surface clicked"` entry, add:

```typescript
  "entity_drawer opened": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "entity_drawer closed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "entity_drawer pinned": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "entity_drawer tab_switched": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
```

- [ ] **Step 4: Add `"entity_drawer"` to EntityType union**

Find the `EntityType` string union (around line 80) and add `"entity_drawer"` to the list.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter telemetry exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register entity drawer events"
```

---

### Task 2: i18n — Add drawer translation keys

**Files:**

- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Add Norwegian keys**

Add a new top-level `"entity_drawer"` object to `nb/dashboard.json`:

```json
  "entity_drawer": {
    "open_full_page": "Apne full side",
    "pin": "Fest panel",
    "unpin": "Loslipp panel",
    "close": "Lukk",
    "tab_details": "Detaljer",
    "tab_tasks": "Oppgaver",
    "tab_employees": "Ansatte",
    "tab_hours": "Timer",
    "tab_settings": "Innstillinger",
    "tab_context": "Kontekst",
    "tab_action": "Handling",
    "task_why": "Hvorfor dette er viktig",
    "task_go_to": "Ga til",
    "task_dimension": "Dimensjon",
    "task_urgency": "Prioritet",
    "urgency_critical": "Kritisk",
    "urgency_should": "Bor gjores",
    "urgency_can_wait": "Kan vente",
    "department_status": "Status",
    "department_manager": "Leder",
    "department_hours": "Apningstider",
    "department_employees": "Ansatte",
    "department_positions": "Stillinger",
    "active": "Aktiv",
    "inactive": "Inaktiv"
  }
```

- [ ] **Step 2: Add English keys**

Add matching `"entity_drawer"` object to `en/dashboard.json`:

```json
  "entity_drawer": {
    "open_full_page": "Open full page",
    "pin": "Pin panel",
    "unpin": "Unpin panel",
    "close": "Close",
    "tab_details": "Details",
    "tab_tasks": "Tasks",
    "tab_employees": "Employees",
    "tab_hours": "Hours",
    "tab_settings": "Settings",
    "tab_context": "Context",
    "tab_action": "Action",
    "task_why": "Why this matters",
    "task_go_to": "Go to",
    "task_dimension": "Dimension",
    "task_urgency": "Priority",
    "urgency_critical": "Critical",
    "urgency_should": "Should do",
    "urgency_can_wait": "Can wait",
    "department_status": "Status",
    "department_manager": "Manager",
    "department_hours": "Opening hours",
    "department_employees": "Employees",
    "department_positions": "Positions",
    "active": "Active",
    "inactive": "Inactive"
  }
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "feat(i18n): add entity drawer translation keys"
```

---

### Task 3: Core — Create EntityDrawerContext

**Files:**

- Create: `apps/web/src/components/dashboard/entity-drawer/EntityDrawerContext.tsx`

- [ ] **Step 1: Create the context and provider**

```typescript
"use client";

/**
 * EntityDrawerContext — isolated state for the entity drawer.
 * Lives outside DashboardContext to avoid re-rendering 170+ consumers
 * on every drawer open/close.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type EntityType =
  | "department"
  | "profile"
  | "team"
  | "shift"
  | "day_session"
  | "shift_template"
  | "cascade_task";

export type DrawerState = {
  isOpen: boolean;
  isPinned: boolean;
  entityType: EntityType | null;
  entityId: string | null;
  activeTab: string | null;
};

type EntityDrawerContextValue = {
  state: DrawerState;
  openDrawer: (type: EntityType, id: string, tab?: string) => void;
  closeDrawer: () => void;
  pinDrawer: () => void;
  unpinDrawer: () => void;
  setActiveTab: (tab: string) => void;
};

const CLOSED_STATE: DrawerState = {
  isOpen: false,
  isPinned: false,
  entityType: null,
  entityId: null,
  activeTab: null,
};

const PIN_STORAGE_KEY = "smartout:entity-drawer-pinned";
const MOBILE_BREAKPOINT = 768;

const EntityDrawerCtx = createContext<EntityDrawerContextValue | null>(null);

export function EntityDrawerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<DrawerState>(CLOSED_STATE);
  const openedAtRef = useRef<number>(0);

  /** Restore pin preference from localStorage on mount */
  useEffect(() => {
    const saved = localStorage.getItem(PIN_STORAGE_KEY);
    if (saved === "true" && window.innerWidth >= MOBILE_BREAKPOINT) {
      setState((prev) => ({ ...prev, isPinned: true }));
    }
  }, []);

  /** Close drawer on route change */
  useEffect(() => {
    setState(CLOSED_STATE);
  }, [pathname]);

  /** Auto-unpin on mobile resize */
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        setState((prev) => (prev.isPinned ? { ...prev, isPinned: false } : prev));
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openDrawer = useCallback((type: EntityType, id: string, tab?: string) => {
    openedAtRef.current = Date.now();
    setState((prev) => ({
      ...prev,
      isOpen: true,
      entityType: type,
      entityId: id,
      activeTab: tab ?? null,
    }));
  }, []);

  const closeDrawer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      entityType: null,
      entityId: null,
      activeTab: null,
    }));
  }, []);

  const pinDrawer = useCallback(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) return;
    localStorage.setItem(PIN_STORAGE_KEY, "true");
    setState((prev) => ({ ...prev, isPinned: true }));
  }, []);

  const unpinDrawer = useCallback(() => {
    localStorage.setItem(PIN_STORAGE_KEY, "false");
    setState((prev) => ({ ...prev, isPinned: false }));
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const value = useMemo<EntityDrawerContextValue>(
    () => ({ state, openDrawer, closeDrawer, pinDrawer, unpinDrawer, setActiveTab }),
    [state, openDrawer, closeDrawer, pinDrawer, unpinDrawer, setActiveTab],
  );

  return <EntityDrawerCtx.Provider value={value}>{children}</EntityDrawerCtx.Provider>;
}

export function useEntityDrawer(): EntityDrawerContextValue {
  const ctx = useContext(EntityDrawerCtx);
  if (!ctx) throw new Error("useEntityDrawer must be used within EntityDrawerProvider");
  return ctx;
}

/** Expose openedAt timestamp for duration telemetry */
export function useDrawerOpenedAt(): number {
  return 0; // Placeholder — the ref is internal. Duration is computed in EntityDrawer on close.
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/entity-drawer/EntityDrawerContext.tsx
git commit -m "feat(drawer): create EntityDrawerContext with isolated state"
```

---

### Task 4: Core — Create EntityDrawer component

**Files:**

- Create: `apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx`

This is the main drawer component: header, tabs, content area, footer. Uses Framer Motion for sheet/pin animation.

- [ ] **Step 1: Create the component**

```typescript
"use client";

/**
 * EntityDrawer — hybrid sheet/pin panel for entity inspection.
 * Sheet mode: overlay from right with backdrop.
 * Pinned mode: persistent split-panel, main content narrows.
 * Mobile: fullscreen takeover.
 */

import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Pin, PinOff, X, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@smartout/i18n";
import { emit } from "@smartout/telemetry";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useEntityDrawer, type EntityType } from "./EntityDrawerContext";
import { CascadeTaskTab } from "./tabs/CascadeTaskTab";
import { DepartmentDetailTab } from "./tabs/DepartmentDetailTab";
import { motion as motionTokens } from "@smartout/design-tokens";

const panelSpring = {
  type: "spring" as const,
  stiffness: motionTokens.spring.stiffness,
  damping: motionTokens.spring.damping,
  mass: motionTokens.spring.mass,
};

const swapSpring = {
  type: "spring" as const,
  stiffness: motionTokens.springSnappy.stiffness,
  damping: motionTokens.springSnappy.damping,
  mass: motionTokens.springSnappy.mass,
};

type TabDef = {
  value: string;
  labelKey: string;
  badge?: number;
  content: React.ReactNode;
};

function getTabsForEntity(
  type: EntityType,
  entityId: string,
  t: (key: string) => string,
): TabDef[] {
  switch (type) {
    case "cascade_task":
      return [
        {
          value: "context",
          labelKey: "entity_drawer.tab_context",
          content: <CascadeTaskTab taskId={entityId} />,
        },
      ];
    case "department":
      return [
        {
          value: "details",
          labelKey: "entity_drawer.tab_details",
          content: <DepartmentDetailTab departmentId={entityId} />,
        },
      ];
    default:
      return [
        {
          value: "details",
          labelKey: "entity_drawer.tab_details",
          content: <div className="text-muted-foreground p-4 text-sm">Coming soon</div>,
        },
      ];
  }
}

function getEntityHref(type: EntityType, id: string): string | null {
  switch (type) {
    case "department":
      return `/dashboard/organization/departments/${id}`;
    case "profile":
      return `/dashboard/people/${id}`;
    case "team":
      return `/dashboard/organization/teams/${id}`;
    default:
      return null;
  }
}

export function EntityDrawer() {
  const { state, closeDrawer, pinDrawer, unpinDrawer, setActiveTab } = useEntityDrawer();
  const { isOpen, isPinned, entityType, entityId, activeTab } = state;
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id ?? null;
  const shouldReduceMotion = useReducedMotion();
  const openedAtRef = useRef<number>(0);
  const triggerRef = useRef<HTMLElement | null>(null);

  /** Track open time for duration telemetry */
  useEffect(() => {
    if (isOpen) {
      openedAtRef.current = Date.now();
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    const duration = Date.now() - openedAtRef.current;
    if (entityType && entityId) {
      void emit({
        event: "entity_drawer closed",
        workspace_id: wsId,
        actor_id: "",
        properties: {
          data: { entity_type: entityType, entity_id: entityId, duration_ms: duration },
        },
      });
    }
    closeDrawer();
    triggerRef.current?.focus();
  }, [closeDrawer, entityType, entityId, wsId]);

  const handlePin = useCallback(() => {
    if (isPinned) {
      unpinDrawer();
    } else {
      pinDrawer();
      if (entityType && entityId) {
        void emit({
          event: "entity_drawer pinned",
          workspace_id: wsId,
          actor_id: "",
          properties: { data: { entity_type: entityType, entity_id: entityId } },
        });
      }
    }
  }, [isPinned, pinDrawer, unpinDrawer, entityType, entityId, wsId]);

  const handleTabSwitch = useCallback(
    (tab: string) => {
      const fromTab = activeTab;
      setActiveTab(tab);
      if (entityType && entityId && fromTab) {
        void emit({
          event: "entity_drawer tab_switched",
          workspace_id: wsId,
          actor_id: "",
          properties: {
            data: { entity_type: entityType, entity_id: entityId, from_tab: fromTab, to_tab: tab },
          },
        });
      }
    },
    [setActiveTab, activeTab, entityType, entityId, wsId],
  );

  const handleOpenFullPage = useCallback(() => {
    if (!entityType || !entityId) return;
    const href = getEntityHref(entityType, entityId);
    if (href) {
      closeDrawer();
      router.push(href);
    }
  }, [entityType, entityId, closeDrawer, router]);

  /** Escape key closes sheet mode */
  useEffect(() => {
    if (!isOpen || isPinned) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isPinned, handleClose]);

  if (!isOpen || !entityType || !entityId) return null;

  const tabs = getTabsForEntity(entityType, entityId, t);
  const currentTab = activeTab ?? tabs[0]?.value ?? "details";
  const currentTabContent = tabs.find((tab) => tab.value === currentTab)?.content ?? null;
  const fullPageHref = getEntityHref(entityType, entityId);

  const drawerContent = (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      role={isPinned ? "complementary" : "dialog"}
      aria-modal={!isPinned}
      aria-label={`${entityType} details`}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-8 -right-5 h-[120px] w-[120px] rounded-full opacity-[0.08]"
        style={{
          background: `radial-gradient(circle, oklch(0.45 0.18 40), transparent 70%)`,
          filter: "blur(60px)",
        }}
      />

      {/* Noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "64px 64px",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 border-b border-white/[0.07] px-4 pt-4 pb-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-content-center rounded-[10px] text-sm font-bold text-white"
          style={{
            background: "linear-gradient(135deg, oklch(0.5 0.18 25), oklch(0.6 0.22 40))",
            boxShadow: "0 2px 8px oklch(0.5 0.18 25 / 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {entityType === "cascade_task" ? "!" : entityId.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{entityId}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {entityType.replace("_", " ")}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handlePin}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
              isPinned
                ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                : "border-white/10 text-white/40 hover:bg-white/[0.06] hover:text-white/60"
            }`}
            title={isPinned ? t("entity_drawer.unpin") : t("entity_drawer.pin")}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all hover:bg-white/[0.06] hover:text-white/60"
            title={t("entity_drawer.close")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div
          className="relative z-10 flex gap-0 overflow-x-auto border-b border-white/[0.07] px-4"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={currentTab === tab.value}
              aria-controls={`tabpanel-${tab.value}`}
              onClick={() => handleTabSwitch(tab.value)}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                currentTab === tab.value
                  ? "border-orange-500 font-semibold text-white"
                  : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              {t(tab.labelKey)}
              {tab.badge && tab.badge > 0 ? (
                <span className="ml-1.5 text-[9px] font-bold text-red-400">{tab.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div
        id={`tabpanel-${currentTab}`}
        role="tabpanel"
        className="relative z-10 min-h-0 flex-1 overflow-y-auto"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={shouldReduceMotion ? { opacity: 0.8 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0.8 } : { opacity: 0, y: -8 }}
            transition={shouldReduceMotion ? { duration: 0.1 } : swapSpring}
          >
            {currentTabContent}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      {fullPageHref && (
        <div className="relative z-10 border-t border-white/[0.07] p-3">
          <button
            onClick={handleOpenFullPage}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/10 bg-transparent py-2 text-[11px] text-white/50 transition-all hover:bg-white/[0.06] hover:text-white/70"
          >
            {t("entity_drawer.open_full_page")}
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );

  /** Sheet mode — overlay from right */
  if (!isPinned) {
    return (
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[29] bg-black/50"
          onClick={handleClose}
        />
        {/* Sheet */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
          animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
          transition={shouldReduceMotion ? { duration: 0.15 } : { ...panelSpring }}
          className="fixed top-0 right-0 bottom-0 z-[30] w-[380px] max-w-[90vw] rounded-l-2xl border-l border-white/[0.07] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]"
          style={{
            background: "oklch(0.18 0.03 50)",
            backdropFilter: "blur(20px)",
          }}
        >
          {drawerContent}
        </motion.div>
      </>
    );
  }

  /** Pinned mode — inline panel */
  return (
    <motion.div
      layout
      transition={shouldReduceMotion ? { duration: 0 } : panelSpring}
      className="h-full w-[380px] shrink-0 rounded-2xl border border-white/[0.07] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]"
      style={{
        background: "oklch(0.18 0.03 50)",
        backdropFilter: "blur(20px)",
      }}
    >
      {drawerContent}
    </motion.div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: May fail due to missing tab components — that's expected, proceed to Task 5.

- [ ] **Step 3: Commit (if typecheck passes, otherwise commit after Task 5)**

```bash
git add apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx
git commit -m "feat(drawer): create EntityDrawer shell with sheet/pin modes"
```

---

### Task 5: Tabs — Create CascadeTaskTab and DepartmentDetailTab

**Files:**

- Create: `apps/web/src/components/dashboard/entity-drawer/tabs/CascadeTaskTab.tsx`
- Create: `apps/web/src/components/dashboard/entity-drawer/tabs/DepartmentDetailTab.tsx`

- [ ] **Step 1: Create CascadeTaskTab**

```typescript
"use client";

/**
 * Drawer tab showing cascade task context: why it matters, dimension, urgency, and action button.
 * Data comes from the already-fetched useCascadeTasks() — no extra query needed.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, Info, ExternalLink } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useCascadeTasks } from "@/app/dashboard/_hooks/use-cascade-tasks";
import { resolveKey, interpolateParams } from "@/app/dashboard/_components/todo/translate-todo";
import type { CascadeTask, TaskUrgency } from "@smartout/types";
import { useEntityDrawer } from "../EntityDrawerContext";

const urgencyIcons: Record<TaskUrgency, typeof AlertCircle> = {
  critical: AlertCircle,
  should: Clock,
  can_wait: Info,
};

const urgencyColors: Record<TaskUrgency, string> = {
  critical: "text-destructive",
  should: "text-warning",
  can_wait: "text-muted-foreground",
};

export function CascadeTaskTab({ taskId }: { taskId: string }) {
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const { closeDrawer } = useEntityDrawer();
  const { data } = useCascadeTasks();

  const task: CascadeTask | undefined = data?.groups
    .flatMap((g) => g.tasks)
    .find((t) => t.id === taskId);

  const handleNavigate = useCallback(() => {
    if (!task) return;
    closeDrawer();
    router.push(task.href);
  }, [task, closeDrawer, router]);

  if (!task) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-white/30">
        Task not found
      </div>
    );
  }

  const Icon = urgencyIcons[task.urgency];
  const iconColor = urgencyColors[task.urgency];

  return (
    <div className="space-y-4 p-4">
      {/* Title + urgency */}
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
        <div>
          <h3 className="text-sm font-bold text-white">
            {interpolateParams(t(resolveKey(task.title_key)), task.title_params)}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">
              {t("entity_drawer.task_urgency")}
            </span>
            <span className={`text-[10px] font-bold ${iconColor}`}>
              {t(`entity_drawer.urgency_${task.urgency}`)}
            </span>
          </div>
        </div>
      </div>

      {/* Description — why it matters */}
      <div className="rounded-xl bg-white/[0.04] p-3">
        <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-white/30">
          {t("entity_drawer.task_why")}
        </div>
        <p className="text-xs leading-relaxed text-white/60">
          {interpolateParams(t(resolveKey(task.description_key)), task.description_params)}
        </p>
      </div>

      {/* Dimension badge */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">
          {t("entity_drawer.task_dimension")}
        </span>
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-white/50">
          {task.dimension}
        </span>
      </div>

      {/* Action button */}
      <button
        onClick={handleNavigate}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-orange-500 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_2px_8px_oklch(0.65_0.22_40/0.25)] transition-all hover:brightness-110"
      >
        {t("entity_drawer.task_go_to")}
        <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create DepartmentDetailTab**

```typescript
"use client";

/**
 * Drawer tab showing department summary: status, manager, hours, employee count.
 * Reads from existing department queries — no new data hooks.
 */

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

export function DepartmentDetailTab({ departmentId }: { departmentId: string }) {
  const { t } = useTranslation("dashboard");
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const { data, isLoading } = useQuery({
    queryKey: ["entity-drawer", "department", wsId, departmentId],
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
          .from("workspace_operating_hours")
          .select("day_of_week, open_time, close_time, is_closed")
          .eq("workspace_id", wsId!),
      ]);

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
    enabled: !!wsId && !!departmentId,
    staleTime: 30_000,
  });

  if (isLoading || !data?.department) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" />
      </div>
    );
  }

  const dept = data.department;
  const weekdayHours = data.hours.find((h) => h.day_of_week === 1 && !h.is_closed);

  return (
    <div className="space-y-4 p-4">
      {/* Status */}
      <div>
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
          {t("entity_drawer.department_status")}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
            dept.is_active
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-white/[0.06] text-white/40"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${dept.is_active ? "bg-emerald-500" : "bg-white/30"}`}
          />
          {dept.is_active ? t("entity_drawer.active") : t("entity_drawer.inactive")}
        </span>
      </div>

      {/* Manager */}
      {data.managerName && (
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
            {t("entity_drawer.department_manager")}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-[9px] font-bold text-white/60">
              {data.managerName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <span className="text-[13px] text-white/80">{data.managerName}</span>
          </div>
        </div>
      )}

      {/* Hours */}
      {weekdayHours && (
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
            {t("entity_drawer.department_hours")}
          </div>
          <span className="font-mono text-[13px] text-white/80">
            {weekdayHours.open_time?.substring(0, 5)} – {weekdayHours.close_time?.substring(0, 5)}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[10px] border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="font-mono text-lg font-bold text-white">{data.employeeCount}</div>
          <div className="text-[10px] text-white/30">{t("entity_drawer.department_employees")}</div>
        </div>
        <div className="rounded-[10px] border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="font-mono text-lg font-bold text-white" style={{ color: dept.color ?? undefined }}>
            {dept.name.charAt(0)}
          </div>
          <div className="text-[10px] text-white/30">{dept.name}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors (all components and their dependencies are now created)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/entity-drawer/tabs/CascadeTaskTab.tsx apps/web/src/components/dashboard/entity-drawer/tabs/DepartmentDetailTab.tsx
git commit -m "feat(drawer): add CascadeTask and Department tab components"
```

---

### Task 6: Integration — Wire EntityDrawer into DashboardShell

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Add imports**

At the top of DashboardShell.tsx, add:

```typescript
import { EntityDrawerProvider } from "./entity-drawer/EntityDrawerContext";
import { EntityDrawer } from "./entity-drawer/EntityDrawer";
```

- [ ] **Step 2: Wrap content area with EntityDrawerProvider**

Find the content area (around line 1916-1927). The current structure is:

```tsx
<DashboardContext.Provider value={dashboardContextValue}>
  <GlobalSearchPalette />
  {isDocumentMode ? (
    <DocumentModeShell isDark={isDark} />
  ) : (
    <div className="scroll-overlay flex min-h-0 flex-1 flex-col overflow-hidden p-6 md:p-8 ...">
      {isAdminMode && isDashboardPage && (
        <>
          <div className="mb-4 flex-shrink-0">
            <ActionStrip isDark={isDark} />
          </div>
        </>
      )}
      {children}
    </div>
  )}
</DashboardContext.Provider>
```

Wrap the non-document-mode content in `EntityDrawerProvider` and add the drawer alongside children. Change the inner div to a flex row when drawer is pinned:

Replace the `{isDocumentMode ? ... : ...}` block with:

```tsx
{
  isDocumentMode ? (
    <DocumentModeShell isDark={isDark} />
  ) : (
    <EntityDrawerProvider>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="scroll-overlay flex min-h-0 flex-1 flex-col overflow-hidden p-6 md:p-8 print:block print:h-auto print:overflow-visible print:p-0">
          {isAdminMode && isDashboardPage && (
            <>
              <div className="mb-4 flex-shrink-0">
                <ActionStrip isDark={isDark} />
              </div>
            </>
          )}
          {children}
        </div>
        <AnimatePresence>
          <EntityDrawer />
        </AnimatePresence>
      </div>
    </EntityDrawerProvider>
  );
}
```

Make sure `AnimatePresence` is already imported (it should be — DashboardShell uses framer-motion).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(drawer): integrate EntityDrawer into DashboardShell"
```

---

### Task 7: Todo — Make TodoTaskCard open drawer instead of navigating

**Files:**

- Modify: `apps/web/src/app/dashboard/_components/todo/TodoTaskCard.tsx`
- Modify: `apps/web/src/app/dashboard/_components/todo/TodoGroupSection.tsx`

- [ ] **Step 1: Update TodoTaskCard to compact row with drawer**

In `TodoTaskCard.tsx`:

1. Add import at top:

```typescript
import { useEntityDrawer } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
```

2. Inside the component, add:

```typescript
const { openDrawer } = useEntityDrawer();
```

3. Replace the `handleClick` callback. Change `router.push(task.href)` to open the drawer:

```typescript
const handleClick = useCallback(() => {
  void emit({
    event: "task_surface clicked",
    workspace_id: wsId,
    actor_id: profileId ?? "",
    properties: {
      entity: { entity_type: "task_surface", entity_id: task.id },
      data: {
        group: task.group,
        dimension: task.dimension,
        urgency: task.urgency,
      },
    },
  });
  void emit({
    event: "entity_drawer opened",
    workspace_id: wsId,
    actor_id: profileId ?? "",
    properties: {
      data: { entity_type: "cascade_task", entity_id: task.id, source: "todo_list" },
    },
  });
  openDrawer("cascade_task", task.id);
}, [openDrawer, task, wsId, profileId]);
```

4. Replace the JSX return with a compact row. Replace the entire `return (` block:

```tsx
return (
  <motion.div
    layout
    variants={cardVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    custom={index}
    role="button"
    tabIndex={0}
    onClick={handleClick}
    onKeyDown={handleKeyDown}
    className={`focus-visible:ring-ring flex cursor-pointer items-center gap-2.5 rounded-[10px] border-l-[3px] px-3 py-2 transition-all duration-200 hover:translate-x-0.5 focus-visible:ring-2 focus-visible:outline-none ${borderClass} hover:bg-card/40 bg-transparent`}
  >
    <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
    <span className="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
      {interpolateParams(t(resolveKey(task.title_key)), task.title_params)}
    </span>
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${
        task.urgency === "critical"
          ? "bg-destructive/10 text-destructive"
          : task.urgency === "should"
            ? "bg-warning/10 text-warning"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {t(`entity_drawer.urgency_${task.urgency}`)}
    </span>
    <span className="sr-only">
      {task.urgency === "critical"
        ? "High urgency"
        : task.urgency === "should"
          ? "Medium urgency"
          : "Low urgency"}
    </span>
    <ChevronRight className="text-muted-foreground h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
  </motion.div>
);
```

- [ ] **Step 2: Update TodoGroupSection spacing**

In `TodoGroupSection.tsx`, change the task list container padding and gap. Find `className="space-y-2 overflow-hidden pl-8"` and change to:

```tsx
className = "space-y-0.5 overflow-hidden pl-8";
```

- [ ] **Step 3: Remove unused imports from TodoTaskCard**

Remove `useRouter` import (no longer navigating directly). Keep all other imports.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/_components/todo/TodoTaskCard.tsx apps/web/src/app/dashboard/_components/todo/TodoGroupSection.tsx
git commit -m "feat(todo): compact task rows with entity drawer integration"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm turbo typecheck`
Expected: all packages pass

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no new errors

- [ ] **Step 3: Manual smoke test**

1. Open dashboard → "A gjore" tab
2. Verify compact task rows (~36px height, title + badge)
3. Click a task row → drawer slides in from right
4. Verify drawer shows task context (title, description, urgency, dimension, action button)
5. Click "Ga til" → navigates to full page, drawer closes
6. Click pin button → drawer pins, main content narrows
7. Click unpin → drawer returns to sheet mode
8. Press Escape → drawer closes
9. Navigate to another page → drawer closes automatically
10. Resize to mobile width → drawer auto-unpins

- [ ] **Step 4: Commit any fixes from smoke test**
