---
title: Entity Drawer — Hybrid Sheet/Pin Context Panel
status: review
updated: 2026-03-27
created: 2026-03-27
module: dashboard
tags: [entity-drawer, UI, cascade-tasks, nordic-split, DashboardShell]
---

# Entity Drawer — Hybrid Sheet/Pin Context Panel

## Problem

Clicking a cascade task card navigates away to a full page. The user loses context of the task list. Cards are too large (~60px). There is no quick-inspect pattern — every entity interaction requires full-page navigation.

## Solution

A reusable EntityDrawer in DashboardShell that shows entity details inline with dynamic tabs. Starts as a sheet (overlay from right), can be pinned as a persistent split-panel. Compact task rows (~36px) replace current cards, opening the drawer instead of navigating.

## Architecture

### Separate Context — Not in DashboardContext

DashboardShell is 2,111 lines with 28 context fields and 170 consumers. The drawer gets its own context:

```
DashboardShell
  └─ DashboardContext.Provider (UNTOUCHED)
       ├─ Sidebar (no re-render on drawer open)
       ├─ Topbar (no re-render on drawer open)
       └─ EntityDrawerProvider (NEW — isolated context)
            ├─ {children} (page content)
            └─ EntityDrawer (conditional render)
```

`useEntityDrawer()` returns `{ openDrawer, closeDrawer, pinDrawer, unpinDrawer, drawerState }` from its own context. Only components that call `useEntityDrawer()` subscribe to state changes.

A single `isDrawerPinned` boolean is exposed to DashboardShell for layout adjustment (flex narrowing).

### Drawer Modes

| Mode            | Trigger                 | Width | Behavior                                   |
| --------------- | ----------------------- | ----- | ------------------------------------------ |
| Sheet (default) | Click task row / entity | 380px | Overlay from right, backdrop, focus trap   |
| Pinned          | Click pin button        | 380px | Persistent split, main narrows, no overlay |
| Mobile (<768px) | Automatic               | 100%  | Fullscreen takeover, back button           |

**Pin state:** Persisted in localStorage. Auto-unpins below 768px breakpoint to prevent stuck fullscreen.

### Drawer Behavior on Navigation

- **Route change:** Drawer closes. `focusedEntity` clears.
- **AdminView change** (e.g., Aktivitet → Å gjøre): Drawer closes.
- **Browser back:** Drawer closes (no history entry for drawer open).

### State

```typescript
type EntityType = "department" | "profile" | "team" | "shift" | "day_session" | "shift_template" | "cascade_task";

type DrawerState = {
  isOpen: boolean;
  isPinned: boolean;
  entityType: EntityType | null;
  entityId: string | null;
  activeTab: string | null;
};

// Hook API
openDrawer(type: EntityType, id: string, tab?: string): void;
closeDrawer(): void;
pinDrawer(): void;
unpinDrawer(): void;
setActiveTab(tab: string): void;
```

## Phase 1 Entity Types (build now)

Only entity types with actual consumers and existing tables:

| Entity       | Tabs                               | Consumer                        |
| ------------ | ---------------------------------- | ------------------------------- |
| Cascade Task | Kontekst, Handling                 | TodoTaskCard compact rows       |
| Department   | Detaljer, Oppgaver, Ansatte, Timer | TodoTaskCard + future org links |

### Removed from Phase 1

| Entity                              | Reason                                        |
| ----------------------------------- | --------------------------------------------- |
| Reservation                         | No `reservation` table exists                 |
| Shift "Tillegg" tab                 | No `shift_supplement` table exists            |
| Profile, Team, Shift, Day, Template | No consumer yet — add when entry points exist |

Entity types are added incrementally when an actual consumer needs them.

## Compact Task Rows

Replace current TodoTaskCard rendering (not a full rewrite — additive enhancement):

**Current:** ~60px card with title + description + noise overlay + border + padding.
**New:** ~36px row with title only, urgency border-left (3px) + urgency badge + chevron.

### Behavior

- Click → `openDrawer("cascade_task", task.id)` (shows context in drawer)
- Drawer "Ga til" button → `router.push(task.href)` (full page navigation preserved)
- Existing telemetry (`task_surface clicked`) fires on row click
- i18n, accessibility, framer-motion entrance preserved

### Touch targets

- Desktop: 36px acceptable (8px+ gap between rows)
- Mobile: `min-h-[44px]` with vertical padding

### Urgency indicators

- Border-left 3px in urgency color (visual)
- Badge text: "Kritisk" / "Bor" / "Kan vente" (non-color indicator)
- `sr-only` span with urgency level for screen readers

## Visual Design (Nordic Split)

### Drawer panel

- Background: `bg-panel` token (oklch(0.18 0.03 50)) — verify in `tokens.ts`, add if missing
- Glassmorphism: `backdrop-blur-[20px]`, `border-white/10`
- Noise overlay: pre-rendered 64x64 PNG, tiled, 2% opacity, mix-blend-mode overlay (no live SVG filter for performance)
- Ambient glow: 120px brand-glow orb, blur 60px, 8% opacity, top-right corner
- Border radius: `rounded-2xl` (16px)
- Shadow: tokenized `--shadow-drawer` (0 8px 40px -12px oklch(0 0 0 / 0.5)) + inner highlight

### Animation

| Animation      | Config                                                                  | Notes                                  |
| -------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| Sheet open     | `panelSpring` (stiffness: 35, damping: 22, mass: 2.2)                   | translateX 100% → 0                    |
| Sheet close    | 300ms exit                                                              | Above 250ms minimum, suits large panel |
| Pin transition | `panelSpring` on flex layout                                            | Main content narrows smoothly          |
| Tab switch     | `swapSpring` (stiffness: 45, damping: 24, mass: 2)                      | Content crossfade                      |
| Task row hover | 200ms `cubic-bezier(0.25, 0.1, 0.25, 1)` on transform, background-color | translateX(2px)                        |

**`prefers-reduced-motion`:** All springs collapse to instant (opacity fade only for sheet, no translateX). Use Framer Motion `useReducedMotion` hook.

### Typography

| Element           | Size | Weight                       | Font       |
| ----------------- | ---- | ---------------------------- | ---------- |
| Entity name       | 14px | 700                          | Geist Sans |
| Entity type label | 10px | 600                          | Geist Sans |
| Tab label         | 13px | 500 (inactive), 600 (active) | Geist Sans |
| Field label       | 9px  | 700                          | Geist Sans |
| Field value       | 13px | 400                          | Geist Sans |
| Data/stats        | 18px | 700                          | Geist Mono |
| Task row title    | 12px | 500                          | Geist Sans |
| Urgency badge     | 9px  | 700                          | Geist Sans |

### Accessibility

- Sheet mode: `role="dialog"`, `aria-modal="true"`, `aria-label` from entity name
- Pinned mode: `role="complementary"`, `aria-label` from entity name (not modal)
- Focus trap in sheet mode (release on pin)
- Focus return to trigger element on close
- Tabs: `role="tablist"` / `role="tab"` / `role="tabpanel"`, arrow key nav, `aria-selected`
- Urgency: `sr-only` text alongside color border

### z-index

| Layer                 | z-index |
| --------------------- | ------- |
| Main content          | 0       |
| Entity drawer (sheet) | 30      |
| Backdrop overlay      | 29      |
| Modal dialogs         | 50      |
| Toast notifications   | 60      |

## Telemetry

Register in `packages/telemetry/src/registry.ts`:

| Event                        | When          | Properties                                     |
| ---------------------------- | ------------- | ---------------------------------------------- |
| `entity_drawer opened`       | Drawer opens  | `{ entity_type, entity_id, source }`           |
| `entity_drawer closed`       | Drawer closes | `{ entity_type, entity_id, duration_ms }`      |
| `entity_drawer pinned`       | User pins     | `{ entity_type, entity_id }`                   |
| `entity_drawer tab_switched` | Tab change    | `{ entity_type, entity_id, from_tab, to_tab }` |

All route to: PostHog, Logger, activity_trail. Category: "navigation".

## i18n

All tab labels and drawer text use i18n keys. Add `entity_drawer` namespace to `packages/i18n/locales/{nb,en}/dashboard.json`.

## Data Hooks

Tab content data hooks go in `packages/` (not `apps/web/`) per mobile parity requirement. Tab components in `apps/web/` compose shared hooks with web-specific UI.

For Phase 1:

- Cascade Task tab: data already available from `useCascadeTasks()` (no new hook needed)
- Department tab: reuse existing queries from department detail page

## Phase 2 (future — not in this spec)

| Item                                                | Trigger                                |
| --------------------------------------------------- | -------------------------------------- |
| Profile, Team, Shift, Day, Template entity types    | When consumers exist                   |
| Inline editing in drawer tabs                       | When C4 authority integration is ready |
| `open_entity_drawer` AI tool in UI capability       | Agent integration sprint               |
| `focusedEntity` in VoiceSessionContext              | Agent integration sprint               |
| WebSocket broadcast of drawer state to Stage Engine | Agent integration sprint               |
| Keyboard shortcuts (Esc to close, Cmd+P to pin)     | Polish sprint                          |
| Deep links (notifications opening drawer)           | Notification system sprint             |

## Files

| Action | File                                                                           | Responsibility                                 |
| ------ | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| Create | `apps/web/src/components/dashboard/entity-drawer/EntityDrawerContext.tsx`      | Provider + useEntityDrawer hook                |
| Create | `apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx`             | Sheet/pin wrapper, header, tab renderer        |
| Create | `apps/web/src/components/dashboard/entity-drawer/tabs/CascadeTaskTab.tsx`      | Task context + action button                   |
| Create | `apps/web/src/components/dashboard/entity-drawer/tabs/DepartmentDetailTab.tsx` | Department summary for drawer                  |
| Modify | `apps/web/src/components/dashboard/DashboardShell.tsx`                         | Wrap content area in EntityDrawerProvider      |
| Modify | `apps/web/src/app/dashboard/_components/todo/TodoTaskCard.tsx`                 | Compact row + openDrawer on click              |
| Modify | `apps/web/src/app/dashboard/_components/todo/TodoGroupSection.tsx`             | Adjust spacing for compact rows                |
| Modify | `packages/telemetry/src/registry.ts`                                           | Register 4 drawer events                       |
| Modify | `packages/i18n/locales/nb/dashboard.json`                                      | Drawer i18n keys                               |
| Modify | `packages/i18n/locales/en/dashboard.json`                                      | Drawer i18n keys                               |
| Modify | `packages/design-tokens/src/tokens.ts`                                         | Add `panel`, `shadow-drawer` tokens if missing |

## Council Review

Reviewed 2026-03-27. Agents: System Steward, Supervisor, Agent Coordinator, Frontend Designer.
Verdict: APPROVE WITH CONDITIONS (all conditions addressed in this spec).

Key decisions:

- Separate EntityDrawerProvider (Supervisor + Steward consensus)
- Phase 1 limited to 2 entity types (Supervisor recommendation, all agreed)
- Additive enhancement to TodoTaskCard, not rewrite (Supervisor)
- Voice/agent integration deferred to Phase 2 (Agent Coordinator)
- Focus trap + ARIA + reduced motion mandatory (Frontend Designer)
