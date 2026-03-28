---
title: "SwipeTaskReview — WalkAI Arena Task Cleanup Tool"
status: approved
updated: 2026-03-28
created: 2026-03-28
module: walkAi
tags: [walkai, tasks, swipe, session-task, botsson, arena]
council: "2026-03-28 — APPROVE WITH CHANGES (steward, supervisor, agent-coord)"
---

# SwipeTaskReview — WalkAI Arena Task Cleanup Tool

> **Origin:** Orphaned `SwipeReconciliation` component repurposed as a WalkAI arena view for task cleanup.
>
> **Approach:** Botsson detects pending session_tasks, offers cleanup, expands arena with swipe interface. User swipes right (done) or left (skip). Botsson summarizes results.
>
> **Council review:** 2026-03-28. Verdict: APPROVE WITH CHANGES. Tool placement moved from base to bridge. sendData() replaced with promise-based callback. Compliance task guard added. TrialBanner removed (separate task).

---

## 1. Problem Statement

Leaders accumulate pending `session_task` records from session hooks, daily operations, and compliance requirements. There is no fast, mobile-friendly way to batch-process these. The existing TaskCard component in HMS requires individual clicks with expand/collapse for each task.

---

## 2. User Flow

1. User navigates to a page with task context (HMS, operations, or dashboard)
2. Task-review bridge mounts, registers tools with WalkAI
3. Botsson calls `get_pending_task_count` → detects 5+ pending tasks
4. Botsson says: "Du har [N] oppgaver som venter. Skal vi rense opp?"
5. User accepts (voice or text)
6. Botsson calls `open_task_review` client tool
7. Arena expands to "arena" density, switches to `task-review` view
8. User sees swipe cards: right = completed, left = skipped
9. Compliance tasks (`is_compliance_required`) show lock badge — swipe-left triggers confirmation dialog instead of silent skip
10. When all swiped, tool's promise resolves with summary string
11. Botsson speaks: "Ferdig! [X] fullfort, [Y] hoppet over."
12. Arena stays on task-review view until user navigates away or says "lukk"

---

## 3. Technical Design

### 3.1 New ContentViewType

Add `"task-review"` to the `ContentViewType` union in `apps/web/src/app/walkAi/_components/types.ts`.

Add `"task-review": "Oppgaveoversikt"` to `VIEW_TITLES` in `WalkAiArena.tsx`.

### 3.2 TaskReviewView Component

**Location:** `apps/web/src/app/walkAi/_components/views/TaskReviewView.tsx`

New component (not a rename of SwipeReconciliation — card content and data model are different). Reuses swipe gesture mechanics (drag physics, AnimatePresence, progress bar, completion screen) from SwipeReconciliation.

**Props:**

```typescript
type TaskReviewViewProps = {
  tasks: SessionTask[];
  onComplete: (taskId: string) => void;
  onSkip: (taskId: string) => void;
  onAllDone: (summary: { completed: number; skipped: number }) => void;
};
```

**Card content:**

- Title (bold)
- Description (truncated 2 lines)
- Compliance badge (if `is_compliance_required` — orange shield icon)
- Hook type badge with color (pre_open=blue, open=green, scheduled=yellow, pre_close=orange, close=red)
- Created time

**Swipe behavior:**

- Right = completed (green "FULLFORT" overlay)
- Left = skipped (gray "HOPPET OVER" overlay)
- Compliance tasks: swipe-left shows confirmation dialog "Denne oppgaven er obligatorisk. Hopp over likevel?" with Ja/Nei buttons. If confirmed, skips with status `skipped` + emits escalation-flagged telemetry event.

**Always dark mode** — arena context is always dark.

### 3.3 Task Review Tools Bridge

**Location:** `apps/web/src/app/dashboard/hms/_components/TaskReviewToolsBridge.tsx`

Follows the established pattern from `schedule-voice-tools-bridge.tsx`:

```typescript
export function TaskReviewToolsBridge() {
  const tools = useTaskReviewTools();
  useRegisterTools("task-review", tools);
  return null; // side-effect only
}
```

Mount in HMS page layout (or operations page) where session task context exists.

### 3.4 Task Review Tools Hook

**Location:** `apps/web/src/app/dashboard/hms/_hooks/use-task-review-tools.ts`

Returns `ClientToolKit` with two tools:

#### `get_pending_task_count`

```typescript
{
  temporaryTool: {
    modelToolName: "get_pending_task_count",
    description: "Get the count of pending daily operations tasks (session_task) for today. Use to check if there are drift tasks to review before offering the task review swipe interface. This is NOT the same as show_tasks which shows the user's personal task list.",
    dynamicParameters: [],
    client: {},
  }
}
```

**Implementation:** Reads from `useSessionTasksForToday()` hook data (cached). Returns count as string: "Det er 12 ventende driftsoppgaver i dag."

#### `open_task_review`

```typescript
{
  temporaryTool: {
    modelToolName: "open_task_review",
    description: "Open the task review swipe interface for daily operations tasks (session_task). Use when the user wants to quickly review and complete/skip pending drift tasks. Shows tasks as swipeable cards — right to complete, left to skip. This is NOT the same as show_tasks which shows the user's personal task list.",
    dynamicParameters: [],
    client: {},
  }
}
```

**Implementation:**

1. Call `viewActions.expandArena()` if not already expanded
2. Call `viewActions.switchView("task-review")`
3. Return a **promise** that resolves when swiping is complete
4. The promise resolves with summary string: "Oppgaveoversikt ferdig: 8 fullfort, 4 hoppet over."
5. Botsson receives the string as tool result and speaks it

The promise is resolved by the `onAllDone` callback from `TaskReviewView`, connected via a shared ref in the bridge.

### 3.5 Cross-Session Query Hook

**Location:** `apps/web/src/app/dashboard/hms/_hooks/use-session-tasks-today.ts`

New hook — `useSessionTasks` only takes a single `sessionId`.

```typescript
export function useSessionTasksForToday(workspaceId: string) {
  return useQuery({
    queryKey: ["hms", "session-tasks-today", workspaceId],
    queryFn: async () => {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("session_task")
        .select("*, department_session!inner(session_date, status)")
        .eq("department_session.session_date", today)
        .in("department_session.status", ["upcoming", "active", "pending_signoff"])
        .in("status", ["pending", "available"])
        .order("created_at");
      return data ?? [];
    },
  });
}
```

RLS: `session_task` is workspace-scoped. Existing JWT RLS policies cover this read pattern via `get_workspace_ids_for_user(auth.uid())`.

### 3.6 Completion Callback (Promise-Based)

When all tasks are swiped, `TaskReviewView` calls `onAllDone({ completed, skipped })`. The bridge holds a ref to a promise resolver:

```typescript
// In bridge/hook:
const resolverRef = useRef<((result: string) => void) | null>(null);

// open_task_review implementation:
const openTaskReview = () => {
  viewActions.expandArena();
  viewActions.switchView("task-review");
  return new Promise<string>((resolve) => {
    resolverRef.current = resolve;
  });
};

// onAllDone callback (passed to TaskReviewView via context or prop):
const handleAllDone = ({ completed, skipped }) => {
  const summary = `Oppgaveoversikt ferdig: ${completed} fullfort, ${skipped} hoppet over.`;
  resolverRef.current?.(summary);
  resolverRef.current = null;
};
```

### 3.7 Arena View Registration

In `WalkAiArena.tsx`:

```typescript
const TaskReviewView = dynamic(() =>
  import("./views/TaskReviewView").then((m) => ({ default: m.TaskReviewView }))
);

// In VIEW_COMPONENTS map:
"task-review": TaskReviewView,

// In VIEW_TITLES map:
"task-review": "Oppgaveoversikt",
```

### 3.8 Telemetry

Every task status mutation must emit:

| Event                    | Trigger     | Destinations                          |
| ------------------------ | ----------- | ------------------------------------- |
| `session task_completed` | Swipe right | PostHog, activity_trail, engine_event |
| `session task_skipped`   | Swipe left  | PostHog, activity_trail, engine_event |

Register `session task_skipped` in `packages/telemetry/src/registry.ts`.

Use existing `useCompleteTask` mutation for completed. Create `useSkipTask` mutation (or generalize to `useUpdateTaskStatus`) for skipped — must include `emit()` in `onSuccess`.

---

## 4. Data Flow

```
User on HMS page → TaskReviewToolsBridge mounts → useRegisterTools("task-review", tools)
  ↓
Botsson calls → get_pending_task_count → reads useSessionTasksForToday cache → "12 pending"
Botsson offers → "Skal vi rense?"
User: "ja"
Botsson calls → open_task_review
  → expandArena() + switchView("task-review") + returns promise
  → TaskReviewView mounts with tasks from useSessionTasksForToday
  → User swipes each card
  → Each swipe: useCompleteTask / useSkipTask mutation → emit() → query invalidation
  → All done: onAllDone resolves promise with summary
Botsson speaks → "8 fullfort, 4 hoppet over"
```

---

## 5. Component Reuse

| From SwipeReconciliation                              | In TaskReviewView                           |
| ----------------------------------------------------- | ------------------------------------------- |
| Swipe gesture (drag, AnimatePresence, spring physics) | Keep identical                              |
| Progress bar (X / N reviewed)                         | Keep identical                              |
| Completion screen                                     | Keep, adapt text                            |
| `ShiftForReview` type                                 | Replace with `SessionTask`                  |
| Employee name + role + time                           | Task title + description + compliance badge |
| Department color circle                               | Hook type color                             |
| Approve/reject overlays                               | "FULLFORT" / "HOPPET OVER" overlays         |

---

## 6. Files to Create/Modify

| File                                                                   | Action                                    |
| ---------------------------------------------------------------------- | ----------------------------------------- |
| `apps/web/src/app/walkAi/_components/types.ts`                         | Add `"task-review"` to ContentViewType    |
| `apps/web/src/app/walkAi/_components/views/TaskReviewView.tsx`         | NEW — swipe task component                |
| `apps/web/src/app/walkAi/_components/WalkAiArena.tsx`                  | Register in VIEW_COMPONENTS + VIEW_TITLES |
| `apps/web/src/app/dashboard/hms/_components/TaskReviewToolsBridge.tsx` | NEW — tool bridge                         |
| `apps/web/src/app/dashboard/hms/_hooks/use-task-review-tools.ts`       | NEW — tool definitions + implementations  |
| `apps/web/src/app/dashboard/hms/_hooks/use-session-tasks-today.ts`     | NEW — cross-session query                 |
| `apps/web/src/app/dashboard/hms/_hooks/use-skip-task.ts`               | NEW — skip mutation with emit()           |
| `packages/telemetry/src/registry.ts`                                   | Register `session task_skipped` event     |
| `apps/web/src/components/dashboard/SwipeReconciliation.tsx`            | DELETE after migration                    |

---

## 7. Out of Scope

- Proactive Botsson trigger (auto-detecting task count) — needs prompt engineering
- Filtering by department or hook type — v2
- Undo swipe — v2
- Evidence collection during swipe (photo, notes) — v2
- TrialBanner wiring — separate task (council decision)
- Authority gating for client tools — acceptable v1 for read-only, revisit for write tools
