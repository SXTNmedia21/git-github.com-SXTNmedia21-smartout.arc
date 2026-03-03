---
title: Operations UI Redesign Implementation Plan
status: done
updated: 2026-03-03
created: 2026-03-03
module: operations
tags: [plan, operations, department-session, ui-redesign]
---

# Operations UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Operations page from a single mock dashboard into a dual-view system (Analytical + Action-based) with department session timeline, view/edit modes, staff attendance, and broadcast reminders.

**Architecture:** The current operations page (`apps/web/src/app/dashboard/operations/page.tsx`, 238 lines, mock-only) becomes a view router. Two top-level views — AnalyticalView (polished version of current dashboard) and ActionView (department session timeline) — are toggled via ActionBar controls in DashboardShell. The ActionView contains a department sidebar, session timeline with hooks, task cards, and a view/edit mode toggle. All data is mock for now (no DB tables exist yet), but hooks and types are structured for easy migration when `department_session`, `session_hook`, `session_task` tables are created.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui, TanStack Query v5, lucide-react

**Key files to understand before starting:**

- Current page: `apps/web/src/app/dashboard/operations/page.tsx`
- DashboardShell + Context: `apps/web/src/components/dashboard/DashboardShell.tsx`
- SignalCard: `apps/web/src/components/dashboard/SignalCard.tsx`
- Dashboard types: `apps/web/src/app/dashboard/_hooks/dashboard-types.ts`
- Module spec: `docs/modules/SMARTOUT_MODULE_4_OPERATIONS.md`
- Schedule page (reference pattern): `apps/web/src/app/dashboard/schedule/page.tsx`

---

## Task 1: Add Operations View Toggle to DashboardShell

**Goal:** Add `operationsView` state to DashboardContext and render an "Analytisk / Aksjon" toggle in the ActionBar when on `/dashboard/operations`.

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

**Step 1: Add operationsView to DashboardContext**

Add a new type and state to DashboardContext. After the existing `ScheduleViewMode` type (line ~39):

```typescript
export type OperationsViewMode = "analytical" | "action";
```

Add to the DashboardContext default (after `scheduleDraftCount` entries around line 83):

```typescript
operationsView: "analytical" as OperationsViewMode,
setOperationsView: (_val: OperationsViewMode) => { void _val; },
```

**Step 2: Add useState in DashboardShell component**

Inside the DashboardShell function body, alongside the other useState calls:

```typescript
const [operationsView, setOperationsView] = useState<OperationsViewMode>("analytical");
```

Add `operationsView` and `setOperationsView` to the context value object (the `useMemo` that builds the context value).

**Step 3: Add ActionBar toggle for Operations page**

In the ActionBar section of DashboardShell (after the Dashboard page Tactical/Strategic toggle, around line 773), add a new conditional block:

```tsx
{
  pathname === "/dashboard/operations" && isAdminMode && (
    <div
      className={`hidden rounded-xl border p-1 shadow-sm md:flex ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-zinc-100"} mr-2`}
    >
      <button
        onClick={() => setOperationsView("analytical")}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
          operationsView === "analytical"
            ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]"
            : isDark
              ? "text-zinc-500 hover:text-white"
              : "text-zinc-500 hover:text-zinc-900"
        }`}
      >
        Analytisk
      </button>
      <button
        onClick={() => setOperationsView("action")}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
          operationsView === "action"
            ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]"
            : isDark
              ? "text-zinc-500 hover:text-white"
              : "text-zinc-500 hover:text-zinc-900"
        }`}
      >
        Aksjon
      </button>
    </div>
  );
}
```

**Step 4: Verify**

Run: `pnpm turbo typecheck`
Expected: 0 errors. DashboardContext now exposes `operationsView` and `setOperationsView`.

**Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(operations): add operationsView toggle to DashboardShell ActionBar"
```

---

## Task 2: Create Operations Types and Mock Data

**Goal:** Define TypeScript types for department sessions, session hooks, session tasks, and staff attendance. Create a mock data module that mirrors the planned DB schema from MODULE_04.

**Files:**

- Create: `apps/web/src/app/dashboard/operations/_types/operations-types.ts`
- Create: `apps/web/src/app/dashboard/operations/_data/mock-operations.ts`

**Step 1: Create types file**

```typescript
// operations-types.ts

export type SessionStatus = "upcoming" | "active" | "pending_signoff" | "closed" | "missed";

export type HookType = "pre_open" | "open" | "scheduled" | "pre_close" | "close" | "custom";

export type TaskStatus =
  | "pending"
  | "available"
  | "in_progress"
  | "completed"
  | "skipped"
  | "overdue";

export type TaskSourceType = "hook" | "ad_hoc" | "inherited" | "routine";

export type TaskPriority = "critical" | "high" | "normal" | "low";

export type AssignedToType = "profile" | "position" | "team" | "location" | "zone" | "any_on_shift";

export type DepartmentSession = {
  session_id: string;
  department_id: string;
  department_name: string;
  department_icon: string;
  workspace_id: string;
  date: string;
  status: SessionStatus;
  open_time: string;
  close_time: string;
  signed_off_by: string | null;
  signoff_notes: string | null;
  total_tasks: number;
  tasks_completed: number;
  tasks_overdue: number;
  staff_expected: number;
  staff_present: number;
};

export type SessionHook = {
  hook_id: string;
  session_id: string;
  hook_type: HookType;
  label: string;
  trigger_time: string;
  tasks: SessionTask[];
};

export type SessionTask = {
  task_id: string;
  session_id: string;
  hook_id: string | null;
  source_type: TaskSourceType;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to_name: string | null;
  assigned_to_type: AssignedToType;
  category: string | null;
  completed_at: string | null;
  due_at: string | null;
};

export type StaffAttendance = {
  profile_id: string;
  name: string;
  position: string;
  department_id: string;
  scheduled_start: string;
  actual_start: string | null;
  is_present: boolean;
};

export type OperationsMetrics = {
  completionPercent: number;
  tasksCompleted: number;
  tasksTotal: number;
  stressLevel: "low" | "medium" | "high" | "critical";
  capacityPercent: number;
  staffShort: number;
  overdueCount: number;
  upcomingCount: number;
  staffPresent: number;
  staffExpected: number;
  tasksOut: number;
};
```

**Step 2: Create mock data file**

Create `mock-operations.ts` with realistic Norwegian restaurant data. Include:

- 3 departments: Kjøkken (kitchen), Sal & Service (dining), Bar
- Each with an active session, 3-5 hooks with tasks
- 8-12 staff members across departments
- Realistic timestamps for today

The mock data should be a function `getMockSessions()` returning `DepartmentSession[]`, `getMockHooksForSession(sessionId: string)` returning `SessionHook[]`, `getMockStaffAttendance(departmentId: string)` returning `StaffAttendance[]`, and `getMockMetrics(sessions: DepartmentSession[])` returning `OperationsMetrics`.

**Step 3: Verify**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/operations/_types/ apps/web/src/app/dashboard/operations/_data/
git commit -m "feat(operations): add types and mock data for department sessions"
```

---

## Task 3: Restructure Operations Page as View Router

**Goal:** Replace the current monolithic operations page with a thin router that dispatches to AnalyticalView or ActionView based on `operationsView` context. Extract the current mock dashboard into AnalyticalView.

**Files:**

- Modify: `apps/web/src/app/dashboard/operations/page.tsx`
- Create: `apps/web/src/app/dashboard/operations/_components/AnalyticalView.tsx`

**Step 1: Create AnalyticalView component**

Move the entire current page content (metric cards + revenue chart) into `AnalyticalView.tsx`. Changes:

- Replace the inline `MetricCard` with the shared `SignalCard` from `@/components/dashboard/SignalCard.tsx` for the top metrics row
- Keep the Revenue vs Staff Cost chart as-is
- Add a new "Staff Attendance" section below the chart — a card showing who's present with check-in times (mock data)
- Accept `isDark: boolean` as prop

Structure:

```tsx
"use client";

import { SignalCard } from "@/components/dashboard/SignalCard";
import { getMockMetrics, getMockSessions, getMockStaffAttendance } from "../_data/mock-operations";
// ... icons

export function AnalyticalView({ isDark }: { isDark: boolean }) {
  const sessions = getMockSessions();
  const metrics = getMockMetrics(sessions);

  return (
    <div className="z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
      {/* Header */}
      {/* SignalCard grid (6 cards) */}
      {/* Revenue vs Staff Cost chart */}
      {/* Staff Attendance card — new */}
    </div>
  );
}
```

The Staff Attendance card shows a table/list:

- Name | Position | Department | Scheduled | Checked In | Status
- Green dot for present, red for missing, orange for late
- This addresses the "se når folk stempler inn" requirement from the notes

**Step 2: Rewrite page.tsx as router**

```tsx
"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { AnalyticalView } from "./_components/AnalyticalView";

export default function OperationsPage() {
  const { isDark, operationsView } = useContext(DashboardContext);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      {operationsView === "analytical" ? (
        <AnalyticalView isDark={isDark} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-zinc-500">
          Action view — next task
        </div>
      )}
    </div>
  );
}
```

**Step 3: Verify**

Run: `pnpm turbo typecheck`
Expected: 0 errors. Navigate to `/dashboard/operations` — should show the polished Analytical view with SignalCards and attendance section.

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/operations/
git commit -m "feat(operations): restructure as view router, extract AnalyticalView with SignalCards + attendance"
```

---

## Task 4: Build the Action View — Department Sidebar + Session Header

**Goal:** Create the ActionView with a left department sidebar (Kjøkken, Sal & Service, Bar) and a session header showing the selected department's status metrics.

**Files:**

- Create: `apps/web/src/app/dashboard/operations/_components/ActionView.tsx`
- Create: `apps/web/src/app/dashboard/operations/_components/DepartmentSidebar.tsx`
- Create: `apps/web/src/app/dashboard/operations/_components/SessionHeader.tsx`
- Modify: `apps/web/src/app/dashboard/operations/page.tsx` (wire up ActionView)

**Step 1: Create DepartmentSidebar**

A narrow vertical sidebar listing departments with active sessions. Matches the landing page demo layout (Dagens Flyt section).

```tsx
"use client";

import type { DepartmentSession } from "../_types/operations-types";

type Props = {
  isDark: boolean;
  sessions: DepartmentSession[];
  selectedId: string | null;
  onSelect: (departmentId: string) => void;
};

export function DepartmentSidebar({ isDark, sessions, selectedId, onSelect }: Props) {
  // Department icons/emojis: 🔥 Kjøkken, 🍽 Sal & Service, 🍸 Bar
  // Each item shows: icon, name, status badge (LIVE / upcoming time), task count
  // Selected department gets orange left border + highlighted background
  // Bottom section: "Alle Oppgaver" link, "Økt-Godkjenninger" link
}
```

**Step 2: Create SessionHeader**

Compact header showing selected session's summary: date, status badge, 3 key metrics (tasks done/total, overdue, staff present).

```tsx
export function SessionHeader({
  isDark,
  session,
}: {
  isDark: boolean;
  session: DepartmentSession;
}) {
  // Layout: [Department icon + name] [date] [status badge: LIVE/upcoming]
  // Below: 3 mini metric cells — OPPGAVER FULLFØRT | FORFALT | ANSATTE INN.
}
```

**Step 3: Create ActionView shell**

```tsx
export function ActionView({ isDark }: { isDark: boolean }) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const sessions = getMockSessions();

  // Auto-select first active session
  useEffect(() => { ... }, [sessions]);

  const selectedSession = sessions.find(s => s.department_id === selectedDepartmentId);

  return (
    <div className="flex h-full min-h-0 flex-1">
      <DepartmentSidebar isDark={isDark} sessions={sessions} selectedId={selectedDepartmentId} onSelect={setSelectedDepartmentId} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedSession && <SessionHeader isDark={isDark} session={selectedSession} />}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Timeline — next task */}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Wire ActionView into page.tsx**

Replace the placeholder in the action branch:

```tsx
import { ActionView } from "./_components/ActionView";
// ...
) : (
  <ActionView isDark={isDark} />
)}
```

**Step 5: Verify**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/operations/
git commit -m "feat(operations): add ActionView with DepartmentSidebar and SessionHeader"
```

---

## Task 5: Build the Session Timeline with Hooks and Task Cards

**Goal:** The core of the Action view — a vertical timeline showing session hooks (Før-Åpning 08:00, Åpning 10:00, etc.) with expandable task cards under each hook. This is the "Daglig Økt-flyt" from the design notes.

**Files:**

- Create: `apps/web/src/app/dashboard/operations/_components/SessionTimeline.tsx`
- Create: `apps/web/src/app/dashboard/operations/_components/HookSection.tsx`
- Create: `apps/web/src/app/dashboard/operations/_components/TaskCard.tsx`
- Modify: `apps/web/src/app/dashboard/operations/_components/ActionView.tsx` (add timeline)

**Step 1: Create TaskCard**

Individual task card within a hook section. Shows: status icon (checkbox), title, time, assigned person, category badge.

```tsx
type Props = {
  isDark: boolean;
  task: SessionTask;
  isEditMode: boolean;
  onToggleStatus?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
};

export function TaskCard({ isDark, task, isEditMode, onToggleStatus, onRemove }: Props) {
  // Card layout:
  // [status icon] [title]                              [time]
  // [assigned to: name (position)]  [category badge]
  //
  // Status icons: ✅ completed, ⏰ overdue (pulse), ○ pending, ● in_progress
  // If isEditMode: show drag handle on left, delete button on right
  // Priority: critical = red left border, high = orange, normal = none, low = dashed
}
```

**Step 2: Create HookSection**

A timeline node with tasks grouped underneath. Vertical line connects hooks.

```tsx
type Props = {
  isDark: boolean;
  hook: SessionHook;
  isActive: boolean; // current time is within this hook's window
  isPast: boolean;
  isEditMode: boolean;
  onToggleTask?: (taskId: string) => void;
  onRemoveTask?: (taskId: string) => void;
};

export function HookSection({
  isDark,
  hook,
  isActive,
  isPast,
  isEditMode,
  onToggleTask,
  onRemoveTask,
}: Props) {
  // Layout:
  // ● [time]  [Hook Label]          ← timeline dot + label
  // │  ┌──────────────────┐
  // │  │ TaskCard          │
  // │  └──────────────────┘
  // │  ┌──────────────────┐
  // │  │ TaskCard          │
  // │  └──────────────────┘
  // │
  //
  // Active hook: orange dot with glow, orange timeline line
  // Past hook: emerald dot, dimmed slightly
  // Future hook: zinc dot, full opacity
  // isEditMode: show "+" button to add ad-hoc task at bottom of section
}
```

**Step 3: Create SessionTimeline**

Assembles all hooks for the selected session into a vertical timeline.

```tsx
export function SessionTimeline({ isDark, hooks, isEditMode }: Props) {
  const now = new Date();

  // Determine which hook is currently active based on trigger_time vs now
  // Render HookSections in time order with connecting vertical line
  // Scroll to active hook on mount (useRef + scrollIntoView)
}
```

**Step 4: Wire into ActionView**

Add SessionTimeline to the content area of ActionView, below SessionHeader.

```tsx
const hooks = getMockHooksForSession(selectedSession.session_id);

return (
  // ...
  <SessionTimeline isDark={isDark} hooks={hooks} isEditMode={false} />
);
```

**Step 5: Verify**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/operations/_components/
git commit -m "feat(operations): add SessionTimeline with HookSections and TaskCards"
```

---

## Task 6: Add View/Edit Mode Toggle

**Goal:** Add a toggle in the ActionView command area that switches between View mode (read-only) and Edit mode (add/remove/reorder tasks). Edit mode requires manager+ role. This addresses the "Edit Mode vs View Mode" requirement from the design notes.

**Files:**

- Modify: `apps/web/src/app/dashboard/operations/_components/ActionView.tsx`
- Modify: `apps/web/src/app/dashboard/operations/_components/TaskCard.tsx` (already has isEditMode prop)
- Modify: `apps/web/src/app/dashboard/operations/_components/HookSection.tsx` (already has isEditMode prop)

**Step 1: Add edit mode state and toggle to ActionView**

```tsx
const [isEditMode, setIsEditMode] = useState(false);

// In the top-right area of the ActionView, after SessionHeader:
<div className="flex items-center gap-2 border-b px-6 py-3 ...">
  <span className="text-xs font-bold text-zinc-500 uppercase">
    {isEditMode ? "Redigeringsmodus" : "Visningsmodus"}
  </span>
  <button
    onClick={() => setIsEditMode(!isEditMode)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      isEditMode ? "bg-orange-500" : isDark ? "bg-zinc-700" : "bg-zinc-300"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        isEditMode ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
</div>;
```

Or use shadcn Switch component if available.

**Step 2: Wire edit mode to timeline**

Pass `isEditMode` down to SessionTimeline, HookSection, and TaskCard. When `isEditMode` is true:

- TaskCard shows a remove button (X icon, top-right)
- TaskCard shows a drag handle (grip icon, left side) — visual only for now
- HookSection shows a "+" (add task) button at the bottom of each section
- Clicking "+" opens a simple inline form: task name input + assign to dropdown + "Legg til" button

**Step 3: Mock add/remove handlers**

In ActionView, use local state to track added/removed tasks:

```tsx
const [localTasks, setLocalTasks] = useState<Record<string, SessionTask[]>>({});
const [removedTaskIds, setRemovedTaskIds] = useState<Set<string>>(new Set());

const handleRemoveTask = (taskId: string) => {
  setRemovedTaskIds((prev) => new Set(prev).add(taskId));
};

const handleAddTask = (hookId: string, task: SessionTask) => {
  setLocalTasks((prev) => ({
    ...prev,
    [hookId]: [...(prev[hookId] ?? []), task],
  }));
};
```

**Step 4: Verify**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/operations/_components/
git commit -m "feat(operations): add view/edit mode toggle with task add/remove"
```

---

## Task 7: Add Broadcast Reminder Panel

**Goal:** Add a "Send påminnelse" (send reminder) capability to the Action view. A button in the session header opens a sheet/drawer where managers can compose a message and send it to all on-shift staff in the selected department. Uses mock handler for now.

**Files:**

- Create: `apps/web/src/app/dashboard/operations/_components/ReminderSheet.tsx`
- Modify: `apps/web/src/app/dashboard/operations/_components/SessionHeader.tsx` (add trigger button)
- Modify: `apps/web/src/app/dashboard/operations/_components/ActionView.tsx` (sheet state)

**Step 1: Create ReminderSheet**

Uses shadcn Sheet component (side panel from right).

```tsx
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { StaffAttendance } from "../_types/operations-types";

type Props = {
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
  departmentName: string;
  staff: StaffAttendance[];
};

export function ReminderSheet({ isDark, isOpen, onClose, departmentName, staff }: Props) {
  // Content:
  // 1. Header: "Send påminnelse — {departmentName}"
  // 2. Recipients list: checkboxes for each present staff member (default: all checked)
  // 3. Textarea for message
  // 4. Priority selector: Normal / Viktig / Kritisk
  // 5. Send button: "Send til N ansatte"
  // 6. On send: toast notification (sonner), close sheet
}
```

**Step 2: Add trigger button to SessionHeader**

Add a "Påminnelse" button with Bell icon in the session header, next to the status badge.

**Step 3: Wire sheet state in ActionView**

```tsx
const [isReminderOpen, setIsReminderOpen] = useState(false);
// Pass setIsReminderOpen to SessionHeader as onReminder prop
// Render ReminderSheet at the bottom of ActionView
```

**Step 4: Verify**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/operations/_components/
git commit -m "feat(operations): add broadcast reminder sheet for on-shift staff"
```

---

## Task 8: Polish and Visual Coherence Pass

**Goal:** Final polish pass ensuring both views match the dashboard design language. Animations, responsive behavior, dark/light mode consistency, and visual details.

**Files:**

- Modify: `apps/web/src/app/dashboard/operations/_components/AnalyticalView.tsx`
- Modify: `apps/web/src/app/dashboard/operations/_components/ActionView.tsx`
- Modify: `apps/web/src/app/dashboard/operations/_components/SessionTimeline.tsx`
- Modify: `apps/web/src/app/dashboard/operations/_components/DepartmentSidebar.tsx`
- Modify: `apps/web/src/app/dashboard/operations/_components/TaskCard.tsx`

**Step 1: Add entry animations**

Use the established pattern from TacticalView:

```tsx
className = "animate-in fade-in slide-in-from-bottom-4 duration-500";
```

Apply to: SignalCard grid, timeline sections, sidebar items (staggered with `fill-mode-backwards` and `delay-*`).

**Step 2: Responsive layout**

- AnalyticalView: SignalCard grid — 2 cols mobile, 3 cols md, 6 cols xl (already matching)
- ActionView: DepartmentSidebar collapses to icon-only (w-16) on mobile, full (w-56) on lg+
- SessionTimeline: full width on mobile, constrained max-width on desktop
- ReminderSheet: side="right" on desktop, side="bottom" on mobile

**Step 3: Dark/light mode audit**

Every component must use the `isDark` ternary pattern consistently:

- Backgrounds: `isDark ? "bg-zinc-950" : "bg-white"` or `"bg-[#0c0c0e]"` / `"bg-white"`
- Borders: `isDark ? "border-zinc-800" : "border-zinc-200"`
- Text: `isDark ? "text-zinc-100" : "text-zinc-900"` (headings), `"text-zinc-400"` / `"text-zinc-500"` (secondary)
- No hardcoded colors that ignore isDark

**Step 4: Timeline visual details**

- Active hook dot: pulsing orange glow (`animate-pulse`)
- Connecting vertical line: gradient from zinc-700 (past) to zinc-800 (future) in dark mode
- Current time indicator: horizontal dashed line crossing the timeline at exact current position
- Completed tasks: strikethrough title, green checkmark, slightly reduced opacity

**Step 5: Verify**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

Manual check: Toggle between Analytisk/Aksjon in both dark and light mode. All elements render correctly, no layout jumps, animations smooth.

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/operations/
git commit -m "feat(operations): visual polish, animations, responsive layout, dark/light audit"
```

---

## Task 9: Final — Typecheck, WORKLOG, Decision/Learning Logs

**Goal:** Ensure the feature passes all quality gates and is documented.

**Files:**

- Create: `docs/worklogs/WORKLOG-operations-ui-redesign.md`
- Modify: `docs/decisions/0000-decision-log.md` (register any ADRs)
- Modify: `docs/learnings/0000-learning-log.md` (register any learnings)

**Step 1: Run full typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors across all 18 packages.

**Step 2: Create WORKLOG**

Standard format with YAML frontmatter, status tracking, all tasks logged.

**Step 3: Register decisions**

If any ADRs were created during implementation (e.g., "Operations uses local state for edit mode rather than DashboardContext"), register them in the decision log.

**Step 4: Register learnings**

Document any learnings discovered during implementation.

**Step 5: Commit**

```bash
git add docs/
git commit -m "docs(operations): add worklog, register decisions and learnings"
```

---

## Summary

| Task | Component                    | Deliverable                                                  |
| ---- | ---------------------------- | ------------------------------------------------------------ |
| 1    | DashboardShell               | `operationsView` state + ActionBar toggle                    |
| 2    | Types + Mock Data            | `operations-types.ts` + `mock-operations.ts`                 |
| 3    | Page Router + AnalyticalView | View routing + polished analytical dashboard with attendance |
| 4    | ActionView Shell             | Department sidebar + session header                          |
| 5    | Session Timeline             | Vertical timeline with hooks + task cards                    |
| 6    | View/Edit Mode               | Toggle + add/remove tasks in edit mode                       |
| 7    | Broadcast Reminders          | Reminder sheet for on-shift staff                            |
| 8    | Polish Pass                  | Animations, responsive, dark/light, visual details           |
| 9    | Docs + Typecheck             | WORKLOG, decision log, learning log, 0 typecheck errors      |

**Total new files:** ~10 component files + 2 data/type files + 1 worklog
**Modified files:** DashboardShell.tsx, operations/page.tsx
**No database changes** — all mock data, ready for migration when tables are created.
