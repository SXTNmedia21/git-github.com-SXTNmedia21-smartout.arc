---
title: "SwipeTaskReview Implementation Plan"
status: draft
updated: 2026-04-08
created: 2026-03-28
module: hms, walkai
tags: [plan, walkai, hms, swipe, tools]
---

# SwipeTaskReview Implementation Plan

> **Status 2026-04-08:** Draft. Not shipped. References WalkAI tool registry — architecture since evolved into Botsson. Revisit scope before implementing.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a swipe-based task review view to the WalkAI arena so Botsson can offer fast batch cleanup of pending session tasks.

**Architecture:** New arena view type `task-review` with a page-specific tool bridge on the HMS page. Tools registered via `useRegisterTools()` (not base toolkit). Promise-based completion callback returns summary to Botsson.

**Tech Stack:** React, Framer Motion (swipe), TanStack Query (data), Supabase (mutations), WalkAI tool registry, telemetry emit()

**Spec:** `docs/superpowers/specs/2026-03-28-swipe-task-review-design.md`

---

## File Map

| File                                                                   | Action | Responsibility                                 |
| ---------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| `packages/telemetry/src/registry.ts`                                   | Modify | Register `session task_skipped` event + type   |
| `apps/web/src/app/dashboard/hms/_hooks/use-skip-task.ts`               | Create | Skip mutation with emit()                      |
| `apps/web/src/app/dashboard/hms/_hooks/use-session-tasks-today.ts`     | Create | Cross-session pending tasks query              |
| `apps/web/src/app/walkAi/_components/types.ts`                         | Modify | Add `"task-review"` to ContentViewType         |
| `apps/web/src/app/walkAi/_components/WalkAiArena.tsx`                  | Modify | Register view in VIEW_TITLES + VIEW_COMPONENTS |
| `apps/web/src/app/walkAi/_components/views/TaskReviewView.tsx`         | Create | Swipe card component                           |
| `apps/web/src/app/dashboard/hms/_hooks/use-task-review-tools.ts`       | Create | Tool definitions + implementations             |
| `apps/web/src/app/dashboard/hms/_components/TaskReviewToolsBridge.tsx` | Create | Bridge component mounting tools                |
| `apps/web/src/app/dashboard/hms/page.tsx`                              | Modify | Mount bridge                                   |
| `apps/web/src/components/dashboard/SwipeReconciliation.tsx`            | Delete | Replaced by TaskReviewView                     |

---

### Task 1: Register telemetry event + skip mutation

**Files:**

- Modify: `packages/telemetry/src/registry.ts`
- Create: `apps/web/src/app/dashboard/hms/_hooks/use-skip-task.ts`

- [ ] **Step 1: Add `SessionTaskSkipped` type to registry**

In `packages/telemetry/src/registry.ts`, after the `SessionTaskCompleted` interface (line ~453), add:

```typescript
export interface SessionTaskSkipped extends BaseEvent {
  event: "session task_skipped";
  properties: {
    data: {
      task_id: string;
      profile_id: string;
      is_compliance_required: boolean;
    };
  };
}
```

Add `SessionTaskSkipped` to the `SmartoutEvent` union type (find the union and add it).

- [ ] **Step 2: Register event in routing table**

In the `EVENT_REGISTRY` object (line ~2218 area), after `"session task_completed"`, add:

```typescript
"session task_skipped": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "operations",
},
```

- [ ] **Step 3: Create useSkipTask hook**

Create `apps/web/src/app/dashboard/hms/_hooks/use-skip-task.ts`:

```typescript
"use client";

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";

type SkipTaskInput = {
  taskId: string;
  isComplianceRequired: boolean;
};

export function useSkipTask() {
  const { profileId } = useContext(DashboardContext);
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId }: SkipTaskInput) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("session_task")
        .update({ status: "skipped" as const })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "session task_skipped",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          data: {
            task_id: variables.taskId,
            profile_id: profileId ?? "",
            is_compliance_required: variables.isComplianceRequired,
          },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["hms", "session-tasks-today"] });
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "hms" && q.queryKey[1] === "session-tasks",
      });
    },
  });
}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts apps/web/src/app/dashboard/hms/_hooks/use-skip-task.ts
git commit -m "feat(hms): add session task_skipped telemetry event and useSkipTask hook"
```

---

### Task 2: Create cross-session query hook

**Files:**

- Create: `apps/web/src/app/dashboard/hms/_hooks/use-session-tasks-today.ts`

- [ ] **Step 1: Create useSessionTasksForToday hook**

Create `apps/web/src/app/dashboard/hms/_hooks/use-session-tasks-today.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import type { SessionTask } from "./use-session-tasks";

/**
 * Fetches all pending/available session tasks across today's active department sessions.
 * Used by the WalkAI task review bridge to power the swipe cleanup interface.
 * Unlike useSessionTasks (single session), this queries across all sessions for today.
 */
export function useSessionTasksForToday(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["hms", "session-tasks-today", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<SessionTask[]> => {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0]!;

      const { data, error } = await supabase
        .from("session_task")
        .select("*, department_session!inner(session_date, status)")
        .eq("department_session.session_date", today)
        .in("department_session.status", ["upcoming", "active", "pending_signoff"])
        .in("status", ["pending", "available"])
        .order("created_at");

      if (error) throw error;

      return (data ?? []).map((t) => ({
        id: t.id,
        workspaceId: t.workspace_id,
        departmentSessionId: t.department_session_id,
        sessionHookId: t.session_hook_id,
        title: t.title,
        description: t.description,
        status: t.status,
        assignedTo: t.assigned_to,
        completedBy: t.completed_by,
        completedAt: t.completed_at,
        evidence: t.evidence as Record<string, unknown> | null,
        isComplianceRequired: t.is_compliance_required,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
    },
  });
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/hms/_hooks/use-session-tasks-today.ts
git commit -m "feat(hms): add useSessionTasksForToday cross-session query hook"
```

---

### Task 3: Add task-review to WalkAI arena types and registry

**Files:**

- Modify: `apps/web/src/app/walkAi/_components/types.ts`
- Modify: `apps/web/src/app/walkAi/_components/WalkAiArena.tsx`

- [ ] **Step 1: Add `"task-review"` to ContentViewType**

In `apps/web/src/app/walkAi/_components/types.ts`, add `"task-review"` to the union:

```typescript
export type ContentViewType =
  | "chat"
  | "form"
  | "video"
  | "visualizer"
  | "notepad"
  | "calculator"
  | "settings"
  | "tasks"
  | "log"
  | "memory"
  | "history"
  | "task-review";
```

- [ ] **Step 2: Add VIEW_TITLES entry**

In `apps/web/src/app/walkAi/_components/WalkAiArena.tsx` line 47, add before the closing `}`:

```typescript
  history: "Historikk",
  "task-review": "Oppgaveoversikt",
};
```

- [ ] **Step 3: Add placeholder VIEW_COMPONENTS entry**

In `WalkAiArena.tsx` at the `VIEW_COMPONENTS` map (line ~2152), add the dynamic import and entry. At the top of the view registry section add:

```typescript
const TaskReviewView = dynamic(
  () => import("./views/TaskReviewView").then((m) => ({ default: m.TaskReviewView })),
  { ssr: false },
);
```

And in the `VIEW_COMPONENTS` record, add:

```typescript
  history: HistoryView,
  "task-review": TaskReviewView,
};
```

- [ ] **Step 4: Create a minimal stub for TaskReviewView to avoid import error**

Create `apps/web/src/app/walkAi/_components/views/TaskReviewView.tsx`:

```typescript
"use client";

export function TaskReviewView() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="text-muted-foreground text-sm">Task review loading...</p>
    </div>
  );
}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/walkAi/_components/types.ts apps/web/src/app/walkAi/_components/WalkAiArena.tsx apps/web/src/app/walkAi/_components/views/TaskReviewView.tsx
git commit -m "feat(walkai): register task-review view type in arena"
```

---

### Task 4: Build TaskReviewView component

**Files:**

- Modify: `apps/web/src/app/walkAi/_components/views/TaskReviewView.tsx`

- [ ] **Step 1: Replace stub with full swipe component**

Replace `apps/web/src/app/walkAi/_components/views/TaskReviewView.tsx` with the full implementation. The component reuses swipe gesture mechanics from SwipeReconciliation but with SessionTask data model:

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  type PanInfo,
} from "framer-motion";
import { Check, X, Clock, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionTask } from "@/app/dashboard/hms/_hooks/use-session-tasks";

type ReviewDecision = "completed" | "skipped";

type TaskReviewViewProps = {
  tasks: SessionTask[];
  onComplete: (taskId: string) => void;
  onSkip: (taskId: string, isCompliance: boolean) => void;
  onAllDone: (summary: { completed: number; skipped: number }) => void;
};

const HOOK_COLORS: Record<string, string> = {
  pre_open: "#3b82f6",
  open: "#22c55e",
  scheduled: "#eab308",
  pre_close: "#f97316",
  close: "#ef4444",
};

function hookColor(hookId: string | null): string {
  if (!hookId) return "#6b7280";
  for (const [key, color] of Object.entries(HOOK_COLORS)) {
    if (hookId.includes(key)) return color;
  }
  return "#6b7280";
}

export function TaskReviewView({ tasks, onComplete, onSkip, onAllDone }: TaskReviewViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Map<string, ReviewDecision>>(new Map());
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const [showComplianceConfirm, setShowComplianceConfirm] = useState(false);
  const allDoneFired = useRef(false);

  const currentTask = tasks[currentIndex] ?? null;
  const totalReviewed = decisions.size;
  const completedCount = Array.from(decisions.values()).filter((d) => d === "completed").length;
  const skippedCount = Array.from(decisions.values()).filter((d) => d === "skipped").length;
  const isComplete = totalReviewed >= tasks.length;

  const advance = useCallback(() => {
    setExitDirection(null);
    setCurrentIndex((i) => {
      const next = Math.min(i + 1, tasks.length);
      if (next >= tasks.length && !allDoneFired.current) {
        allDoneFired.current = true;
        const c = Array.from(decisions.values()).filter((d) => d === "completed").length;
        const s = Array.from(decisions.values()).filter((d) => d === "skipped").length;
        // +1 for the current decision not yet in state
        onAllDone({ completed: c, skipped: s });
      }
      return next;
    });
  }, [tasks.length, decisions, onAllDone]);

  const handleDecision = useCallback(
    (decision: ReviewDecision) => {
      if (!currentTask) return;

      if (decision === "skipped" && currentTask.isComplianceRequired) {
        setShowComplianceConfirm(true);
        return;
      }

      setDecisions((prev) => {
        const next = new Map(prev);
        next.set(currentTask.id, decision);
        return next;
      });

      if (decision === "completed") {
        onComplete(currentTask.id);
      } else {
        onSkip(currentTask.id, currentTask.isComplianceRequired);
      }

      setExitDirection(decision === "completed" ? "right" : "left");
      setTimeout(advance, 200);
    },
    [currentTask, onComplete, onSkip, advance],
  );

  const confirmComplianceSkip = useCallback(() => {
    if (!currentTask) return;
    setShowComplianceConfirm(false);
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(currentTask.id, "skipped");
      return next;
    });
    onSkip(currentTask.id, true);
    setExitDirection("left");
    setTimeout(advance, 200);
  }, [currentTask, onSkip, advance]);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 p-12">
        <div className="text-center">
          <Check className="mx-auto mb-3 h-8 w-8 text-emerald-500 opacity-60" />
          <p className="text-sm font-semibold text-white/60">Ingen ventende oppgaver</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15"
        >
          <Check className="h-10 w-10 text-emerald-400" />
        </motion.div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-white">Alle oppgaver gjennomgatt</h3>
          <p className="mt-1 text-sm text-white/50">
            {completedCount} fullfort, {skippedCount} hoppet over
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 py-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white/50">
          {totalReviewed} / {tasks.length}
        </span>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={false}
            animate={{ width: `${(totalReviewed / tasks.length) * 100}%` }}
            transition={{ type: "spring", damping: 20 }}
          />
        </div>
      </div>

      {/* Card stack */}
      <div className="relative flex h-[280px] w-full max-w-sm items-center justify-center">
        {currentIndex + 1 < tasks.length && (
          <div className="absolute inset-x-4 top-4 h-[240px] rounded-2xl border border-zinc-800 bg-zinc-900/50" />
        )}
        <AnimatePresence mode="popLayout">
          {currentTask && !exitDirection && (
            <SwipeCard
              key={currentTask.id}
              task={currentTask}
              onDecision={handleDecision}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => handleDecision("skipped")}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-zinc-600/30 text-zinc-400 transition-colors hover:bg-zinc-800/50"
          aria-label="Hopp over oppgave"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          onClick={() => handleDecision("completed")}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500/30 text-emerald-400 transition-colors hover:bg-emerald-500/10"
          aria-label="Fullfar oppgave"
        >
          <Check className="h-6 w-6" />
        </button>
      </div>

      {/* Compliance confirmation dialog */}
      {showComplianceConfirm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="mx-4 max-w-sm rounded-2xl border border-orange-500/30 bg-zinc-900 p-6">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
              <h4 className="font-bold text-white">Obligatorisk oppgave</h4>
            </div>
            <p className="mb-4 text-sm text-white/60">
              Denne oppgaven er merket som obligatorisk. Er du sikker pa at du vil hoppe over den?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComplianceConfirm(false)}
                className="flex-1 border-zinc-700 text-white"
              >
                Avbryt
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmComplianceSkip}
                className="flex-1"
              >
                Hopp over likevel
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ━━━ Swipe Card ━━━ */

function SwipeCard({
  task,
  onDecision,
}: {
  task: SessionTask;
  onDecision: (decision: ReviewDecision) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const completeOpacity = useTransform(x, [0, 100], [0, 1]);
  const skipOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100) onDecision("completed");
    else if (info.offset.x < -100) onDecision("skipped");
  };

  return (
    <motion.div
      className="absolute h-[240px] w-full max-w-sm cursor-grab rounded-2xl border border-zinc-700 bg-[#0c0c0e] p-6 shadow-2xl active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: 300, opacity: 0, transition: { duration: 0.2 } }}
      transition={{ type: "spring", damping: 20 }}
    >
      {/* Complete overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10"
        style={{ opacity: completeOpacity }}
      >
        <span className="rounded-xl bg-emerald-500/20 px-6 py-2 text-xl font-black text-emerald-500">
          FULLFORT
        </span>
      </motion.div>

      {/* Skip overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-zinc-500/50 bg-zinc-500/10"
        style={{ opacity: skipOpacity }}
      >
        <span className="rounded-xl bg-zinc-500/20 px-6 py-2 text-xl font-black text-zinc-400">
          HOPPET OVER
        </span>
      </motion.div>

      {/* Card content */}
      <div className="relative flex h-full flex-col justify-between">
        <div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-white">{task.title}</h3>
            <div className="flex items-center gap-1.5">
              {task.isComplianceRequired && (
                <Shield className="h-4 w-4 text-orange-400" />
              )}
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: hookColor(task.sessionHookId) }}
              />
            </div>
          </div>
          {task.description && (
            <p className="line-clamp-2 text-sm leading-relaxed text-white/50">
              {task.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-white/30">
          <Clock className="h-3 w-3" />
          <span>{new Date(task.createdAt).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        <p className="mt-auto pt-2 text-center text-[11px] font-medium tracking-wider text-white/20 uppercase">
          Sveip hoyre for a fullfare, venstre for a hoppe over
        </p>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/walkAi/_components/views/TaskReviewView.tsx
git commit -m "feat(walkai): build TaskReviewView swipe component"
```

---

### Task 5: Create task review tools and bridge

**Files:**

- Create: `apps/web/src/app/dashboard/hms/_hooks/use-task-review-tools.ts`
- Create: `apps/web/src/app/dashboard/hms/_components/TaskReviewToolsBridge.tsx`
- Modify: `apps/web/src/app/dashboard/hms/page.tsx`

- [ ] **Step 1: Create tool definitions and implementations hook**

Create `apps/web/src/app/dashboard/hms/_hooks/use-task-review-tools.ts`:

```typescript
"use client";

import { useRef, useCallback, useMemo } from "react";
import type {
  ClientToolKit,
  ClientToolDefinition,
  ClientToolImplementation,
} from "@smartout/agent-sdk";
import type { ViewActions } from "@/app/walkAi/_components/walkai-tools";
import type { SessionTask } from "./use-session-tasks";

/* ━━━ Tool Definitions ━━━ */

const GET_PENDING_TASK_COUNT: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "get_pending_task_count",
    description:
      "Get the count of pending daily operations tasks (session_task) for today. " +
      "Use to check if there are drift tasks to review before offering the task review swipe interface. " +
      "This is NOT the same as show_tasks which shows the user's personal task list.",
    dynamicParameters: [],
    client: {},
  },
};

const OPEN_TASK_REVIEW: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "open_task_review",
    description:
      "Open the task review swipe interface for daily operations tasks (session_task). " +
      "Use when the user wants to quickly review and complete/skip pending drift tasks. " +
      "Shows tasks as swipeable cards — right to complete, left to skip. " +
      "Returns a summary when all tasks are reviewed. " +
      "This is NOT the same as show_tasks which shows the user's personal task list.",
    dynamicParameters: [],
    client: {},
  },
};

/* ━━━ Hook ━━━ */

type UseTaskReviewToolsInput = {
  tasks: SessionTask[];
  viewActionsRef: React.MutableRefObject<ViewActions | null>;
};

export function useTaskReviewTools({
  tasks,
  viewActionsRef,
}: UseTaskReviewToolsInput): ClientToolKit {
  const resolverRef = useRef<((result: string) => void) | null>(null);

  const handleAllDone = useCallback((summary: { completed: number; skipped: number }) => {
    const msg = `Oppgaveoversikt ferdig: ${summary.completed} fullfort, ${summary.skipped} hoppet over.`;
    resolverRef.current?.(msg);
    resolverRef.current = null;
  }, []);

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      get_pending_task_count: () => {
        const count = tasks.length;
        if (count === 0) return "Ingen ventende driftsoppgaver i dag.";
        return `Det er ${count} ventende driftsoppgaver i dag.`;
      },
      open_task_review: () => {
        const actions = viewActionsRef.current;
        if (!actions) return "Kunne ikke apne oppgaveoversikten. Prov igjen.";
        if (tasks.length === 0) return "Ingen ventende oppgaver a gjennomga.";

        if (actions.getDensity() !== "arena" && actions.getDensity() !== "immersive") {
          actions.expandArena();
        }
        actions.switchView("task-review");

        return new Promise<string>((resolve) => {
          resolverRef.current = resolve;
        }) as unknown as string;
      },
    }),
    [tasks, viewActionsRef],
  );

  return useMemo(
    () => ({
      definitions: [GET_PENDING_TASK_COUNT, OPEN_TASK_REVIEW],
      implementations,
      _meta: { handleAllDone, tasks },
    }),
    [implementations, handleAllDone, tasks],
  ) as ClientToolKit & { _meta: { handleAllDone: typeof handleAllDone; tasks: SessionTask[] } };
}
```

- [ ] **Step 2: Create bridge component**

Create `apps/web/src/app/dashboard/hms/_components/TaskReviewToolsBridge.tsx`:

```typescript
"use client";

import { useContext } from "react";
import { useRegisterTools } from "@/app/walkAi/_components/tool-registry";
import { useSessionTasksForToday } from "../_hooks/use-session-tasks-today";
import { useTaskReviewTools } from "../_hooks/use-task-review-tools";
import { useCompleteTask } from "../_hooks/use-complete-task";
import { useSkipTask } from "../_hooks/use-skip-task";
import { useWorkspace } from "@/lib/workspace-context";
import { useWalkAi } from "@/app/walkAi/_components/WalkAiProvider";
import { TaskReviewView } from "@/app/walkAi/_components/views/TaskReviewView";

/**
 * Bridges HMS task data into WalkAI tool registration.
 * Mounts as side-effect component in HMS page.
 * Registers open_task_review + get_pending_task_count tools.
 */
export function TaskReviewToolsBridge() {
  const { workspace } = useWorkspace();
  const { data: tasks = [] } = useSessionTasksForToday(workspace?.workspace_id);
  const { viewActionsRef } = useWalkAi();
  const completeTask = useCompleteTask();
  const skipTask = useSkipTask();

  const toolKit = useTaskReviewTools({ tasks, viewActionsRef });

  useRegisterTools("task-review", toolKit);

  return null;
}
```

- [ ] **Step 3: Mount bridge in HMS page**

In `apps/web/src/app/dashboard/hms/page.tsx`, add the bridge:

```typescript
"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { OversiktDashboard } from "./_components/OversiktDashboard";
import { OversiktEmployee } from "./_components/OversiktEmployee";
import { TaskReviewToolsBridge } from "./_components/TaskReviewToolsBridge";

export default function HmsOversiktPage() {
  const { isAdminMode } = useContext(DashboardContext);

  return (
    <>
      <TaskReviewToolsBridge />
      {isAdminMode ? <OversiktDashboard /> : <OversiktEmployee />}
    </>
  );
}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

Note: `useWalkAi` must export `viewActionsRef`. If it doesn't, check `WalkAiProvider.tsx` for the correct export name and adjust the bridge accordingly.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/hms/_hooks/use-task-review-tools.ts apps/web/src/app/dashboard/hms/_components/TaskReviewToolsBridge.tsx apps/web/src/app/dashboard/hms/page.tsx
git commit -m "feat(hms): add task review tools bridge for WalkAI integration"
```

---

### Task 6: Wire TaskReviewView to bridge data + delete SwipeReconciliation

**Files:**

- Modify: `apps/web/src/app/walkAi/_components/views/TaskReviewView.tsx` (if props wiring needed)
- Modify: `apps/web/src/app/dashboard/hms/_components/TaskReviewToolsBridge.tsx` (connect mutations)
- Delete: `apps/web/src/components/dashboard/SwipeReconciliation.tsx`

- [ ] **Step 1: Verify the full flow works**

Open the dashboard at `http://localhost:3060/dashboard/hms`. Open WalkAI arena. If seed data has session_tasks, ask Botsson "hvor mange oppgaver har jeg?" — should trigger `get_pending_task_count`. Then "la oss rense dem" — should trigger `open_task_review` and show swipe cards.

If no seed tasks exist, verify the tools register by checking the browser console for WalkAI tool registration logs.

- [ ] **Step 2: Delete SwipeReconciliation**

```bash
rm apps/web/src/components/dashboard/SwipeReconciliation.tsx
```

- [ ] **Step 3: Verify no imports remain**

Run: `grep -r "SwipeReconciliation" apps/web/src/`

Expected: no results (the orphaned-preview page was already deleted).

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(walkai): wire task review end-to-end, delete SwipeReconciliation"
```

---

## Post-Implementation Checklist

- [ ] All tasks swiped right emit `session task_completed` telemetry
- [ ] All tasks swiped left emit `session task_skipped` telemetry
- [ ] Compliance tasks show confirmation dialog before skip
- [ ] Arena expands and shows "Oppgaveoversikt" title
- [ ] Promise resolves with summary string when all tasks done
- [ ] Tools only registered when on HMS page (not globally)
- [ ] `SwipeReconciliation.tsx` deleted, no dangling imports
