---
title: "Emma Persistence & Task Management — Implementation Plan"
status: draft
created: 2026-03-17
updated: 2026-03-17
module: walkAi
tags: [emma, voice, tasks, navigation, persistence]
---

# Emma Persistence & Task Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Emma's navigation persistence (client-side routing instead of full page reload) and extend her task management with priority, ordering, drag-and-drop, and voice tools.

**Architecture:** Two independent changes: (1) rewire `navigate_to_page` from `window.location.href` to Next.js `router.push()` via a ref in `ViewActions`, (2) extend `ScheduledTask` with `priority` and `position`, add 5 new voice tools, enhance existing `TasksView` with drag-and-drop and priority UI. DB migration adds columns to `emma_task`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Ultravox client tools, Supabase (PostgreSQL), HTML5 Drag API

**Spec:** `docs/superpowers/specs/2026-03-17-emma-persistence-and-tasks-design.md`

---

## File Structure

| File                                                                 | Action | Responsibility                                                                    |
| -------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| `supabase/migrations/20260317120000_emma_task_priority_position.sql` | Create | DB migration — add `priority` + `position` columns                                |
| `apps/web/src/app/walkAi/_components/walkai-tools.ts`                | Modify | Extended types, navigateTo, 5 new tool defs + impls, fuzzy matcher                |
| `apps/web/src/app/walkAi/_components/WalkAiProvider.tsx`             | Modify | useRouter ref, navigateTo wiring, updateTask + reorderTask, scheduleTask defaults |
| `apps/web/src/app/walkAi/_components/WalkAiArena.tsx`                | Modify | TasksView: drag-and-drop, priority badge, deadline edit, priority toggle          |
| `apps/web/src/app/api/emma/tasks/route.ts`                           | Modify | PATCH handler, extended POST/GET with priority + position                         |

---

## Task 1: DB Migration — Add priority and position to emma_task

**Files:**

- Create: `supabase/migrations/20260317120000_emma_task_priority_position.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add priority and position columns to emma_task for task management
ALTER TABLE emma_task
  ADD COLUMN priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  ADD COLUMN position integer NOT NULL DEFAULT 0;

-- Index for ordering tasks by position within a profile
CREATE INDEX idx_emma_task_profile_position
  ON emma_task (profile_id, position)
  WHERE status IN ('pending', 'triggered');
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260317120000_emma_task_priority_position.sql
```

Expected: `ALTER TABLE` and `CREATE INDEX` with no errors.

- [ ] **Step 3: Regenerate types**

```bash
cd /home/sxtnl/dev/smartout.ai && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

Expected: `database.types.ts` now includes `priority: string` and `position: number` in `emma_task.Row`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260317120000_emma_task_priority_position.sql packages/supabase/src/database.types.ts
git commit -m "feat(emma): add priority and position columns to emma_task"
```

---

## Task 2: Persistence — Client-Side Navigation

**Files:**

- Modify: `apps/web/src/app/walkAi/_components/walkai-tools.ts` (ViewActions type at line 20, navigate_to_page impl at line 318-335)
- Modify: `apps/web/src/app/walkAi/_components/WalkAiProvider.tsx` (imports at line 1-36, viewActionsRef at line 437-450)

- [ ] **Step 1: Add navigateTo to ViewActions type**

In `walkai-tools.ts`, add `navigateTo` to the `ViewActions` type (around line 20-31):

```ts
export type ViewActions = {
  switchView: (type: ContentViewType, props?: Record<string, unknown>) => void;
  currentView: () => ContentViewType;
  appendNotepad: (text: string, topic?: string) => void;
  getNotepadContent: () => string;
  scheduleTask: (task: ScheduledTask) => void;
  getCurrentPage: () => string;
  getWorkspaceId?: () => string | null;
  /** Client-side navigation via Next.js router — preserves Emma's session */
  navigateTo: (path: string) => void;
};
```

- [ ] **Step 2: Update navigate_to_page implementation**

In `walkai-tools.ts`, replace the `navigate_to_page` implementation (around line 318-335). Change from `window.location.href` to using `actions.navigateTo`:

```ts
navigate_to_page: (params) => {
  const pageKey = String(params.page ?? "")
    .toLowerCase()
    .trim();
  const page = DASHBOARD_PAGES[pageKey];

  if (!page) {
    const available = Object.keys(DASHBOARD_PAGES).join(", ");
    return `Unknown page "${pageKey}". Available: ${available}`;
  }

  const actions = actionsRef.current;
  if (actions?.navigateTo) {
    actions.navigateTo(page.path);
  } else if (typeof window !== "undefined") {
    window.location.href = page.path;
  }

  return `Navigating to ${page.label} (${page.path}). The page will load shortly.`;
},
```

- [ ] **Step 3: Wire useRouter in WalkAiProvider**

In `WalkAiProvider.tsx`, add the import at the top:

```ts
import { useRouter } from "next/navigation";
```

Inside the `WalkAiProvider` function body, add after the existing state declarations (around line 191):

```ts
const router = useRouter();
const routerRef = useRef(router);
useEffect(() => {
  routerRef.current = router;
}, [router]);
```

- [ ] **Step 4: Add navigateTo to viewActionsRef**

In `WalkAiProvider.tsx`, in the `useEffect` that sets `viewActionsRef.current` (around line 437-450), add `navigateTo`:

```ts
useEffect(() => {
  viewActionsRef.current = {
    switchView,
    currentView: () => activeView,
    appendNotepad: (text: string, topic?: string) => {
      createNoteRef.current(topic ?? "Notat", text);
    },
    getNotepadContent: () => notepadRef.current,
    scheduleTask: (task) => scheduleTaskRef.current(task),
    getCurrentPage: () => (typeof window !== "undefined" ? window.location.pathname : "/"),
    getWorkspaceId: () => workspaceId ?? null,
    navigateTo: (path: string) => routerRef.current.push(path),
  };
}, [switchView, activeView, workspaceId]);
```

- [ ] **Step 5: Verify typecheck passes**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck --filter=web
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/walkAi/_components/walkai-tools.ts apps/web/src/app/walkAi/_components/WalkAiProvider.tsx
git commit -m "fix(walk-ai): use client-side navigation to preserve Emma session"
```

---

## Task 3: Extended Task Model + Provider Functions

**Files:**

- Modify: `apps/web/src/app/walkAi/_components/walkai-tools.ts` (ScheduledTask type at line 33-40)
- Modify: `apps/web/src/app/walkAi/_components/WalkAiProvider.tsx` (scheduleTask at line 207, context type at line 99-149, value at line 472-560)

- [ ] **Step 1: Add TaskPriority type and extend ScheduledTask**

In `walkai-tools.ts`, replace the `ScheduledTask` type (around line 33-40):

```ts
export type TaskPriority = "high" | "medium" | "low";

export type ScheduledTask = {
  id: string;
  title: string;
  description: string;
  dueAt: string | null;
  status: "pending" | "done";
  priority?: TaskPriority;
  position?: number;
  createdAt: number;
};
```

- [ ] **Step 2: Update scheduleTask in WalkAiProvider to apply defaults**

In `WalkAiProvider.tsx`, update the `scheduleTask` callback (around line 207-210):

```ts
const scheduleTask = useCallback((task: ScheduledTask) => {
  setTasks((prev) => {
    const withDefaults = {
      ...task,
      priority: task.priority ?? "medium",
      position: task.position ?? prev.length,
    };
    return [withDefaults, ...prev];
  });
  setUnreadCount((c) => c + 1);
}, []);
```

- [ ] **Step 3: Add updateTask and reorderTask to WalkAiProvider**

In `WalkAiProvider.tsx`, add after the `completeTask` callback (around line 212-214):

```ts
const updateTask = useCallback(
  (taskId: string, updates: Partial<Pick<ScheduledTask, "priority" | "dueAt" | "position">>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));

    // Persist to DB — fire and forget
    void fetch("/api/emma/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: taskId,
        priority: updates.priority,
        due_at: updates.dueAt,
        position: updates.position,
      }),
    }).catch(() => {
      /* Silent — local state is primary */
    });
  },
  [],
);

const reorderTask = useCallback((taskId: string, newPosition: number) => {
  setTasks((prev) => {
    const pending = prev.filter((t) => t.status === "pending");
    const done = prev.filter((t) => t.status !== "pending");
    const taskIdx = pending.findIndex((t) => t.id === taskId);
    if (taskIdx === -1) return prev;

    const [task] = pending.splice(taskIdx, 1);
    const clampedPos = Math.max(0, Math.min(newPosition, pending.length));
    pending.splice(clampedPos, 0, task!);

    // Recalculate positions
    const reordered = pending.map((t, i) => ({ ...t, position: i }));
    return [...reordered, ...done];
  });
}, []);
```

- [ ] **Step 4: Add updateTask and reorderTask to WalkAiContextValue type**

In `WalkAiProvider.tsx`, add to the `WalkAiContextValue` type (around line 136-137, after `completeTask`):

```ts
updateTask: (taskId: string, updates: Partial<Pick<ScheduledTask, "priority" | "dueAt" | "position">>) => void;
reorderTask: (taskId: string, newPosition: number) => void;
```

- [ ] **Step 5: Add to value useMemo and dependency array**

In `WalkAiProvider.tsx`, add `updateTask` and `reorderTask` to the `value` object in `useMemo` (around line 486, after `completeTask`) and to the dependency array (around line 550, after `completeTask`).

- [ ] **Step 6: Verify typecheck passes**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck --filter=web
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/walkAi/_components/walkai-tools.ts apps/web/src/app/walkAi/_components/WalkAiProvider.tsx
git commit -m "feat(walk-ai): extend task model with priority and position"
```

---

## Task 4: Voice Tools — show_tasks, complete_task, set_task_priority, set_task_deadline, reorder_task

**Files:**

- Modify: `apps/web/src/app/walkAi/_components/walkai-tools.ts` (tool defs after line 265, implementations in buildWalkAiToolKit, definitions array at line 421-431)

- [ ] **Step 1: Add fuzzy title matcher helper**

In `walkai-tools.ts`, add before `buildWalkAiToolKit` (around line 267):

```ts
/* ━━━ Fuzzy task title matching for voice tools ━━━ */

function findTaskByTitle(tasks: ScheduledTask[], query: string): ScheduledTask | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const pending = tasks.filter((t) => t.status === "pending");
  const exact = pending.find((t) => t.title.toLowerCase() === q);
  if (exact) return exact;
  const partial = pending.find((t) => t.title.toLowerCase().includes(q));
  return partial ?? null;
}
```

- [ ] **Step 2: Add ViewActions fields for task operations**

In `walkai-tools.ts`, extend the `ViewActions` type to include task operation callbacks:

```ts
export type ViewActions = {
  // ... existing fields including navigateTo ...
  /** Complete a task by ID */
  completeTask: (taskId: string) => void;
  /** Update task fields */
  updateTask: (
    taskId: string,
    updates: Partial<Pick<ScheduledTask, "priority" | "dueAt" | "position">>,
  ) => void;
  /** Reorder a task to a new position */
  reorderTask: (taskId: string, newPosition: number) => void;
  /** Get all current tasks (for fuzzy matching) */
  getTasks: () => ScheduledTask[];
};
```

- [ ] **Step 3: Wire new ViewActions in WalkAiProvider**

In `WalkAiProvider.tsx`, add refs for the new functions (near the existing `scheduleTaskRef` around line 423-435):

```ts
const completeTaskRef = useRef(completeTask);
const updateTaskRef = useRef(updateTask);
const reorderTaskRef = useRef(reorderTask);
const tasksRef = useRef(tasks);
useEffect(() => {
  completeTaskRef.current = completeTask;
}, [completeTask]);
useEffect(() => {
  updateTaskRef.current = updateTask;
}, [updateTask]);
useEffect(() => {
  reorderTaskRef.current = reorderTask;
}, [reorderTask]);
useEffect(() => {
  tasksRef.current = tasks;
}, [tasks]);
```

Then update the **full** `viewActionsRef.current` assignment in the `useEffect` (around line 437-450). Replace the entire object — do NOT just add lines, because TypeScript requires all `ViewActions` fields to be present:

```ts
useEffect(() => {
  viewActionsRef.current = {
    switchView,
    currentView: () => activeView,
    appendNotepad: (text: string, topic?: string) => {
      createNoteRef.current(topic ?? "Notat", text);
    },
    getNotepadContent: () => notepadRef.current,
    scheduleTask: (task) => scheduleTaskRef.current(task),
    getCurrentPage: () => (typeof window !== "undefined" ? window.location.pathname : "/"),
    getWorkspaceId: () => workspaceId ?? null,
    navigateTo: (path: string) => routerRef.current.push(path),
    completeTask: (taskId: string) => completeTaskRef.current(taskId),
    updateTask: (taskId: string, updates) => updateTaskRef.current(taskId, updates),
    reorderTask: (taskId: string, newPos: number) => reorderTaskRef.current(taskId, newPos),
    getTasks: () => tasksRef.current,
  };
}, [switchView, activeView, workspaceId]);
```

- [ ] **Step 4: Add 5 tool definition constants**

In `walkai-tools.ts`, after the existing `scheduleTaskDef` (around line 265), add:

```ts
/* ━━━ Task management tools ━━━━━━━━━━━━━━━ */

const showTasksDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "show_tasks",
    description:
      "Show the tasks/to-do list view. Use when the user says 'vis oppgavene mine', " +
      "'vis gjøremål', 'hva har jeg å gjøre', or similar.",
    dynamicParameters: [],
    client: {},
  },
};

const completeTaskDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "complete_task",
    description:
      "Mark a task as done. Use when the user says 'fullfør oppgaven', 'den er ferdig', " +
      "'marker som ferdig', or similar. Matches by partial title.",
    dynamicParameters: [
      {
        name: "title",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "The task title or a partial match, e.g. 'presentasjon'",
        },
        required: true,
      },
    ],
    client: {},
  },
};

const setTaskPriorityDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "set_task_priority",
    description:
      "Set priority on a task. Use when the user says 'sett høy prioritet på', " +
      "'den er viktig', 'nedprioritér', or similar.",
    dynamicParameters: [
      {
        name: "title",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Task title or partial match" },
        required: true,
      },
      {
        name: "priority",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Priority level: 'high', 'medium', or 'low'",
        },
        required: true,
      },
    ],
    client: {},
  },
};

const setTaskDeadlineDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "set_task_deadline",
    description:
      "Set or change the deadline on a task. Use when the user says 'sett frist', " +
      "'den må være ferdig innen', 'deadline er', or similar.",
    dynamicParameters: [
      {
        name: "title",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Task title or partial match" },
        required: true,
      },
      {
        name: "deadline",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Deadline as ISO 8601, 'HH:MM' (today), or natural like 'i morgen 09:00'",
        },
        required: true,
      },
    ],
    client: {},
  },
};

const reorderTaskDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "reorder_task",
    description:
      "Move a task to a new position in the list. Use when the user says 'flytt til toppen', " +
      "'legg den først', 'flytt ned', or similar. Position is 1-based (1 = first).",
    dynamicParameters: [
      {
        name: "title",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Task title or partial match" },
        required: true,
      },
      {
        name: "position",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "number",
          description: "New position (1 = first in list)",
        },
        required: true,
      },
    ],
    client: {},
  },
};
```

- [ ] **Step 5: Add 5 tool implementations**

In `walkai-tools.ts`, inside the `implementations` record in `buildWalkAiToolKit` (after the existing `schedule_task` implementation around line 417), add:

```ts
show_tasks: () => switchView("tasks"),

complete_task: (params) => {
  const actions = actionsRef.current;
  if (!actions) return "View system not ready";
  const title = String(params.title ?? "");
  const tasks = actions.getTasks();
  const task = findTaskByTitle(tasks, title);
  if (!task) return `Fant ingen ventende oppgave med "${title}".`;
  actions.completeTask(task.id);
  return `Fullført: "${task.title}". Bekreft kort til brukeren.`;
},

set_task_priority: (params) => {
  const actions = actionsRef.current;
  if (!actions) return "View system not ready";
  const title = String(params.title ?? "");
  const priority = String(params.priority ?? "medium") as TaskPriority;
  if (!["high", "medium", "low"].includes(priority)) {
    return `Invalid priority "${priority}". Use: high, medium, low.`;
  }
  const tasks = actions.getTasks();
  const task = findTaskByTitle(tasks, title);
  if (!task) return `Fant ingen ventende oppgave med "${title}".`;
  actions.updateTask(task.id, { priority });
  const labels: Record<TaskPriority, string> = { high: "høy", medium: "middels", low: "lav" };
  return `Satt prioritet ${labels[priority]} på "${task.title}". Bekreft kort.`;
},

set_task_deadline: (params) => {
  const actions = actionsRef.current;
  if (!actions) return "View system not ready";
  const title = String(params.title ?? "");
  const deadlineRaw = String(params.deadline ?? "");
  if (!deadlineRaw) return "Deadline mangler.";

  let dueAt: string | null = null;
  if (/^\d{2}:\d{2}$/.test(deadlineRaw)) {
    const today = new Date();
    const [h, m] = deadlineRaw.split(":").map(Number);
    today.setHours(h!, m!, 0, 0);
    dueAt = today.toISOString();
  } else {
    const parsed = new Date(deadlineRaw);
    if (!isNaN(parsed.getTime())) dueAt = parsed.toISOString();
  }
  if (!dueAt) return `Kunne ikke tolke frist: "${deadlineRaw}".`;

  const tasks = actions.getTasks();
  const task = findTaskByTitle(tasks, title);
  if (!task) return `Fant ingen ventende oppgave med "${title}".`;
  actions.updateTask(task.id, { dueAt });
  const timeStr = new Date(dueAt).toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" });
  return `Frist satt til ${timeStr} på "${task.title}". Bekreft kort.`;
},

reorder_task: (params) => {
  const actions = actionsRef.current;
  if (!actions) return "View system not ready";
  const title = String(params.title ?? "");
  const position = Number(params.position ?? 1);
  if (isNaN(position) || position < 1) return "Posisjon må være minst 1.";

  const tasks = actions.getTasks();
  const task = findTaskByTitle(tasks, title);
  if (!task) return `Fant ingen ventende oppgave med "${title}".`;
  actions.reorderTask(task.id, position - 1); // Convert 1-based to 0-based
  return `Flyttet "${task.title}" til posisjon ${position}. Bekreft kort.`;
},
```

- [ ] **Step 6: Add new defs to definitions array**

In `walkai-tools.ts`, update the `definitions` array in the return statement (around line 421-431) to include all new tools:

```ts
return {
  definitions: [
    showVisualizerDef,
    showNotepadDef,
    writeNotepadDef,
    showCalculatorDef,
    showChatDef,
    navigatePageDef,
    saveMemoryDef,
    scheduleTaskDef,
    showTasksDef,
    completeTaskDef,
    setTaskPriorityDef,
    setTaskDeadlineDef,
    reorderTaskDef,
  ],
  implementations,
};
```

- [ ] **Step 7: Verify typecheck passes**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck --filter=web
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/walkAi/_components/walkai-tools.ts apps/web/src/app/walkAi/_components/WalkAiProvider.tsx
git commit -m "feat(walk-ai): add 5 voice tools for task management"
```

---

## Task 5: TasksView UI Enhancements — Priority Badge, Drag-and-Drop, Deadline Edit

**Files:**

- Modify: `apps/web/src/app/walkAi/_components/WalkAiArena.tsx` (TasksView function at lines 1689-1942)

- [ ] **Step 1: Update TasksView to consume new context functions**

Replace the destructured values at the top of `TasksView` (line 1690):

```ts
function TasksView() {
  const { tasks, completeTask, scheduleTask, updateTask, reorderTask } = useWalkAi();
```

- [ ] **Step 2: Sort pending tasks by position**

Replace the `pending` filter (line 1695):

```ts
const pending = tasks
  .filter((t) => t.status === "pending")
  .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
const done = tasks.filter((t) => t.status === "done");
```

- [ ] **Step 3: Add drag-and-drop state and handlers**

Add after `inputRef` (line 1693):

```ts
const [dragId, setDragId] = useState<string | null>(null);
const [dragOverId, setDragOverId] = useState<string | null>(null);

const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
  setDragId(taskId);
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", taskId);
}, []);

const handleDragOver = useCallback((e: React.DragEvent, taskId: string) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  setDragOverId(taskId);
}, []);

const handleDrop = useCallback(
  (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragId(null);
    setDragOverId(null);
    if (!dragId || dragId === targetId) return;
    const targetIdx = pending.findIndex((t) => t.id === targetId);
    if (targetIdx !== -1) reorderTask(dragId, targetIdx);
  },
  [dragId, pending, reorderTask],
);

const handleDragEnd = useCallback(() => {
  setDragId(null);
  setDragOverId(null);
}, []);
```

- [ ] **Step 4: Add PriorityBadge inline component**

Add inside `TasksView`, after the drag handlers:

```ts
const priorityColors: Record<string, string> = {
  high: "bg-brand-orange/80",
  medium: "bg-amber-400/60",
  low: "bg-muted-foreground/30",
};

const priorityLabels: Record<string, string> = {
  high: "Høy",
  medium: "Middels",
  low: "Lav",
};

const cyclePriority = useCallback(
  (taskId: string, current: string) => {
    const order: TaskPriority[] = ["high", "medium", "low"];
    const idx = order.indexOf(current as TaskPriority);
    const next = order[(idx + 1) % order.length]!;
    updateTask(taskId, { priority: next });
  },
  [updateTask],
);
```

Import `TaskPriority` at the top of the file from `walkai-tools`:

```ts
import type { ScheduledTask, TaskPriority } from "./walkai-tools";
```

- [ ] **Step 5: Replace pending task rendering with enhanced version**

Replace the pending task map block (lines 1864-1902) with:

```tsx
{
  pending.map((task, i) => (
    <div
      key={task.id}
      draggable
      onDragStart={(e) => handleDragStart(e, task.id)}
      onDragOver={(e) => handleDragOver(e, task.id)}
      onDrop={(e) => handleDrop(e, task.id)}
      onDragEnd={handleDragEnd}
      className={[
        "group border-border/20 bg-card/50 hover:border-brand-orange/20 hover:bg-brand-orange/[0.03]",
        "relative flex w-full animate-[walkai-fade-in_200ms_ease-out_forwards] items-start gap-3",
        "overflow-hidden rounded-xl border px-3.5 py-3 text-left opacity-0 transition-all duration-150",
        dragId === task.id && "opacity-40",
        dragOverId === task.id && dragId !== task.id && "border-brand-orange/40 bg-brand-orange/5",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ animationDelay: `${i * 40}ms`, cursor: "grab" }}
    >
      {/* Left accent bar — colored by priority */}
      <div
        className={[
          "absolute top-0 bottom-0 left-0 w-[3px] rounded-l-xl transition-colors",
          task.priority === "high"
            ? "bg-brand-orange/60 group-hover:bg-brand-orange"
            : task.priority === "low"
              ? "bg-muted-foreground/20 group-hover:bg-muted-foreground/40"
              : "bg-amber-400/40 group-hover:bg-amber-400/60",
        ].join(" ")}
      />

      {/* Checkbox — click to complete */}
      <button
        onClick={() => completeTask(task.id)}
        className="border-border/40 group-hover:border-brand-orange/50 mt-0.5 h-5 w-5 flex-shrink-0 rounded-md border-2 transition-colors"
        aria-label={`Fullfør ${task.title}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-foreground truncate text-sm font-medium">{task.title}</p>
          {/* Priority badge — click to cycle */}
          <button
            onClick={() => cyclePriority(task.id, task.priority ?? "medium")}
            className={[
              "flex h-4 items-center rounded-full px-1.5 text-[9px] font-medium text-white/90 transition-all hover:scale-110",
              priorityColors[task.priority ?? "medium"],
            ].join(" ")}
            title={`Prioritet: ${priorityLabels[task.priority ?? "medium"]}. Klikk for å endre.`}
          >
            {priorityLabels[task.priority ?? "medium"]}
          </button>
        </div>
        {task.description && (
          <p className="text-muted-foreground/50 mt-1 line-clamp-2 text-[11px] leading-relaxed">
            {task.description}
          </p>
        )}
        {task.dueAt && (
          <span className="bg-brand-orange/8 border-brand-orange/15 text-brand-orange/70 mt-1.5 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M8 5V8.5L10.5 10"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            {new Date(task.dueAt).toLocaleString("nb-NO", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  ));
}
```

- [ ] **Step 6: Add inline deadline edit**

Add a `DeadlineEditor` inline component inside `TasksView`, after the priority helpers:

```tsx
const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);

const handleDeadlineChange = useCallback(
  (taskId: string, value: string) => {
    if (!value) {
      updateTask(taskId, { dueAt: null });
    } else {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        updateTask(taskId, { dueAt: parsed.toISOString() });
      }
    }
    setEditingDeadlineId(null);
  },
  [updateTask],
);
```

Then in the task rendering (Step 5), replace the read-only deadline `<span>` with a clickable element. Replace the `{task.dueAt && (` block with:

```tsx
{
  /* Deadline — click to edit */
}
<div className="mt-1.5 flex items-center gap-1">
  {editingDeadlineId === task.id ? (
    <input
      type="datetime-local"
      defaultValue={task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : ""}
      onBlur={(e) => handleDeadlineChange(task.id, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleDeadlineChange(task.id, e.currentTarget.value);
        if (e.key === "Escape") setEditingDeadlineId(null);
      }}
      autoFocus
      className="bg-card border-border/40 text-foreground rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
    />
  ) : (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setEditingDeadlineId(task.id);
      }}
      className={[
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors",
        task.dueAt
          ? "bg-brand-orange/8 border-brand-orange/15 text-brand-orange/70 hover:bg-brand-orange/15"
          : "border-border/20 text-muted-foreground/30 hover:border-border/40 hover:text-muted-foreground/50",
      ].join(" ")}
      title="Klikk for å sette/endre frist"
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 5V8.5L10.5 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {task.dueAt
        ? new Date(task.dueAt).toLocaleString("nb-NO", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Sett frist"}
    </button>
  )}
</div>;
```

- [ ] **Step 7: Verify typecheck passes**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck --filter=web
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/walkAi/_components/WalkAiArena.tsx
git commit -m "feat(walk-ai): add priority, drag-and-drop, and deadline edit to TasksView"
```

---

## Task 6: API — PATCH Handler + Extended POST/GET

**Files:**

- Modify: `apps/web/src/app/api/emma/tasks/route.ts`

- [ ] **Step 1: Extend POST to include priority and position**

In `route.ts`, update the POST body type (around line 57-64) to add `priority` and `position`:

```ts
const body = (await req.json()) as {
  workspace_id: string;
  title: string;
  description?: string;
  due_at?: string | null;
  priority?: string;
  position?: number;
  context?: Record<string, Json | undefined>;
  mission?: string;
};
```

And update the insert call (around line 84-94) to include the new fields:

```ts
const { data, error } = await supabase
  .from("emma_task")
  .insert({
    workspace_id: body.workspace_id,
    profile_id: profileId,
    title: body.title,
    description: body.description ?? "",
    due_at: body.due_at ?? null,
    priority: body.priority ?? "medium",
    position: body.position ?? 0,
    context: body.context ?? {},
    mission: body.mission ?? null,
  })
  .select("id, title, due_at, status, priority, position")
  .single();
```

- [ ] **Step 2: Extend GET to return priority and position**

Update the `.select()` in the GET handler (around line 34):

```ts
.select("id, title, description, context, mission, due_at, triggered_at, priority, position")
```

- [ ] **Step 3: Add PATCH handler**

Add after the `POST` export (at the end of the file):

```ts
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await getProfileId(supabase, user.id);
  if (!profileId) return NextResponse.json({ error: "No profile found" }, { status: 400 });

  const body = (await req.json()) as {
    task_id: string;
    priority?: string;
    due_at?: string | null;
    position?: number;
  };

  if (!body.task_id) {
    return NextResponse.json({ error: "task_id required" }, { status: 400 });
  }

  const updates: { priority?: string; due_at?: string | null; position?: number } = {};
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.due_at !== undefined) updates.due_at = body.due_at;
  if (body.position !== undefined) updates.position = body.position;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("emma_task")
    .update(updates)
    .eq("id", body.task_id)
    .eq("profile_id", profileId)
    .select("id, title, priority, position, due_at, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}
```

- [ ] **Step 4: Verify typecheck passes**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck --filter=web
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/emma/tasks/route.ts
git commit -m "feat(emma): add PATCH handler and priority/position to task API"
```

---

## Task 7: Final Typecheck + Update schedule_task Tool

**Files:**

- Modify: `apps/web/src/app/walkAi/_components/walkai-tools.ts` (schedule_task tool definition and implementation)

- [ ] **Step 1: Add priority and position params to schedule_task tool definition**

In `walkai-tools.ts`, update the `scheduleTaskDef` dynamicParameters array (around line 239-264) to include two new optional params:

```ts
{
  name: "priority",
  location: "PARAMETER_LOCATION_BODY",
  schema: {
    type: "string",
    description: "Priority: 'high', 'medium', or 'low'. Default: medium.",
  },
  required: false,
},
{
  name: "position",
  location: "PARAMETER_LOCATION_BODY",
  schema: {
    type: "number",
    description: "Position in the task list (1 = first). Default: last.",
  },
  required: false,
},
```

- [ ] **Step 2: Update schedule_task implementation to pass priority and position**

In the `schedule_task` implementation (around line 386-394), add priority and position to the task object:

```ts
const priority = String(params.priority ?? "medium") as TaskPriority;
const position = params.position !== undefined ? Number(params.position) - 1 : undefined;

actions.scheduleTask({
  id: `task-${Date.now()}`,
  title,
  description,
  dueAt,
  status: "pending",
  priority: ["high", "medium", "low"].includes(priority) ? priority : "medium",
  position: position !== undefined && !isNaN(position) ? position : undefined,
  createdAt: Date.now(),
});
```

Also update the POST body to include priority/position:

```ts
body: JSON.stringify({
  workspace_id: workspaceId,
  title,
  description,
  due_at: dueAt,
  priority,
  position,
}),
```

- [ ] **Step 3: Full typecheck**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck
```

Expected: 0 errors across entire monorepo.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/walkAi/_components/walkai-tools.ts
git commit -m "feat(walk-ai): add priority and position to schedule_task tool"
```
