---
title: "Emma Persistence & Task Management"
status: draft
created: 2026-03-17
updated: 2026-03-17
module: walkAi
tags: [emma, voice, tasks, navigation, persistence]
---

# Emma Persistence & Task Management — Design Spec

## Problem

Two issues with Emma (WalkAi voice agent):

1. **Navigation kills session** — `navigate_to_page` tool uses `window.location.href` (full page reload), which destroys the Ultravox voice session and all WalkAi client state. EmmaOverlay already lives inside DashboardShell (persists across routes), but the hard reload bypasses Next.js client-side routing.

2. **Limited task management** — Emma can create tasks and users can complete them via click, but there's no voice control for task operations (complete, prioritize, reorder, set deadlines) and the existing TasksView lacks drag-and-drop reordering and priority display.

## Approach

**Approach A (selected):** Fix navigation in-place + extend existing TasksView and voice tools. No new pages, no new packages. Minimal surface area.

## Design

### 1. Persistence — Client-Side Navigation

**Files changed:**

- `apps/web/src/app/walkAi/_components/walkai-tools.ts` — ViewActions type + navigate_to_page implementation
- `apps/web/src/app/walkAi/_components/WalkAiProvider.tsx` — wire router.push via ref

**Changes:**

Add `navigateTo` to `ViewActions`:

```ts
export type ViewActions = {
  // ... existing fields ...
  navigateTo: (path: string) => void;
};
```

In `WalkAiProvider`, add import and wire to Next.js router:

```ts
import { useRouter } from "next/navigation";

// Inside WalkAiProvider:
const router = useRouter();
const routerRef = useRef(router);
useEffect(() => { routerRef.current = router; }, [router]);

// In viewActionsRef assignment:
navigateTo: (path: string) => routerRef.current.push(path),
```

In `navigate_to_page` implementation, replace:

```ts
// Before:
window.location.href = page.path;

// After:
const actions = actionsRef.current;
if (actions?.navigateTo) {
  actions.navigateTo(page.path);
} else if (typeof window !== "undefined") {
  window.location.href = page.path; // fallback for playground
}
```

### 2. Task Model — Extended ScheduledTask

**File changed:** `apps/web/src/app/walkAi/_components/walkai-tools.ts`

```ts
export type TaskPriority = "high" | "medium" | "low";

export type ScheduledTask = {
  id: string;
  title: string;
  description: string;
  dueAt: string | null; // ISO 8601
  status: "pending" | "done";
  priority?: TaskPriority; // optional — defaults to "medium"
  position?: number; // optional — defaults to tasks.length
  createdAt: number;
};
```

- `priority` and `position` are optional on the type to avoid breaking existing construction sites
- Defaults are applied in the provider's `scheduleTask` function:
  ```ts
  const withDefaults = {
    ...task,
    priority: task.priority ?? "medium",
    position: task.position ?? tasks.length,
  };
  ```
- Existing `schedule_task` tool gains optional `priority` and `position` parameters
- `handleAddTask` in `TasksView` (WalkAiArena.tsx) needs no changes — defaults handle it

### 3. TasksView Enhancements

**File changed:** `apps/web/src/app/walkAi/_components/WalkAiArena.tsx` (existing `TasksView` function)

**Additions:**

- **Drag-and-drop reordering** — HTML5 drag API (no extra library). Each task row gets a drag handle. On drop, recalculate `position` values for all pending tasks.
- **Priority badge** — Colored dot/badge per task:
  - High: brand-orange
  - Medium: yellow/amber
  - Low: muted-foreground
- **Inline deadline edit** — Click on deadline area opens a simple datetime input
- **Priority toggle** — Click on priority badge cycles through high → medium → low

### 4. New Voice Tools

**File changed:** `apps/web/src/app/walkAi/_components/walkai-tools.ts`

All task-manipulation tools use fuzzy title matching (case-insensitive `includes()`) to find the target task. If multiple matches, operate on the first match and confirm which task was affected.

Each new tool needs both a `ClientToolDefinition` constant (e.g. `showTasksDef`) following the existing `temporaryTool` pattern AND an entry in the `implementations` record AND inclusion in the `definitions` array.

#### show_tasks

- Definition: `showTasksDef: ClientToolDefinition` (same shape as `showVisualizerDef`)
- Description: "Show the tasks/to-do list view"
- Parameters: none
- Implementation: `switchView("tasks")`

#### complete_task

- Description: "Mark a task as done"
- Parameters: `title` (string, required) — partial match OK
- Implementation: Find matching pending task → `completeTask(task.id)`
- Response: "Fullført: {title}" or "Fant ingen oppgave med '{title}'"

#### set_task_priority

- Description: "Set priority on a task"
- Parameters: `title` (string, required), `priority` ("high" | "medium" | "low", required)
- Implementation: Find matching task → update priority via new `updateTask` provider function
- Response: "Satt prioritet {priority} på '{title}'"

#### set_task_deadline

- Description: "Set or change deadline on a task"
- Parameters: `title` (string, required), `deadline` (string, required — ISO 8601 or "HH:MM")
- Implementation: Same time parsing as existing `schedule_task`, then `updateTask`
- Response: "Frist satt til {time} på '{title}'"

#### reorder_task

- Description: "Move a task to a new position in the list"
- Parameters: `title` (string, required), `position` (number, required — 1-based for voice UX)
- Implementation: Find matching task → remove from array → insert at position-1 → recalculate all positions
- Response: "Flyttet '{title}' til posisjon {position}"

### 5. Provider Changes

**File changed:** `apps/web/src/app/walkAi/_components/WalkAiProvider.tsx`

New function exposed via context. Must be added to:

1. The `WalkAiContextValue` type definition
2. The `value` useMemo object
3. The useMemo dependency array

```ts
// Type:
updateTask: (taskId: string, updates: Partial<Pick<ScheduledTask, "priority" | "dueAt" | "position">>) => void

// Implementation:
const updateTask = useCallback((taskId: string, updates: Partial<Pick<ScheduledTask, "priority" | "dueAt" | "position">>) => {
  setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
}, []);
```

Also persist updates via `PATCH /api/emma/tasks` (fire-and-forget, same pattern as existing task creation).

### 6. API Changes

**File changed:** `apps/web/src/app/api/emma/tasks/route.ts`

- `POST` — add `priority` and `position` to create payload
- `PATCH` (new) — update task fields: `{ task_id, priority?, due_at?, position? }`
- `GET` — return `priority` and `position` in response

The `emma_task` DB table currently lacks `priority` and `position` columns. A migration is **required** before the API changes work.

**Migration file:** `supabase/migrations/YYYYMMDDHHMMSS_emma_task_priority_position.sql`

```sql
ALTER TABLE emma_task
  ADD COLUMN priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  ADD COLUMN position integer NOT NULL DEFAULT 0;
```

### 7. Fuzzy Title Matching

Shared helper used by all task-manipulation tools:

```ts
function findTaskByTitle(tasks: ScheduledTask[], query: string): ScheduledTask | null {
  const q = query.toLowerCase().trim();
  // Exact match first
  const exact = tasks.find((t) => t.title.toLowerCase() === q);
  if (exact) return exact;
  // Partial match
  const partial = tasks.find((t) => t.title.toLowerCase().includes(q));
  return partial ?? null;
}
```

Only searches pending tasks (not done).

## Files Summary

| File                                                                 | Change                                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/YYYYMMDDHHMMSS_emma_task_priority_position.sql` | Add `priority` and `position` columns to `emma_task`                                                     |
| `walkai-tools.ts`                                                    | Extended ScheduledTask type, navigateTo in ViewActions, 5 new tool defs + implementations, fuzzy matcher |
| `WalkAiProvider.tsx`                                                 | `useRouter` import + ref, navigateTo wiring, updateTask function + WalkAiContextValue type + useMemo     |
| `WalkAiArena.tsx`                                                    | TasksView: drag-and-drop, priority badge, deadline edit, priority toggle                                 |
| `api/emma/tasks/route.ts`                                            | PATCH handler, extended POST/GET with priority + position                                                |

## Out of Scope

- Separate `/dashboard/tasks` page
- Task categories/tags
- Recurring tasks
- Task assignments to other users
