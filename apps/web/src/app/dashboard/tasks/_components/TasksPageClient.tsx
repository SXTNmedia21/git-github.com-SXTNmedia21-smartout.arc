"use client";

/**
 * TasksPageClient — thin client boundary for /dashboard/tasks.
 *
 * Mounts the existing TodoTaskView (cascade task surface) unchanged.
 * TodoTaskView owns its own data fetch (resolve_cascade_tasks RPC via
 * useCascadeTasks), loading skeleton, empty state, and telemetry
 * (task_surface viewed + task_surface snapshot on mount).
 *
 * TodoToolsBridge mounts the Botsson read tools for this surface.
 * Query-key dedup ensures a single network call even if both components
 * call useCascadeTasks.
 *
 * No new events registered here — task_surface viewed + task_surface
 * snapshot are already in the registry and emitted by TodoTaskView.
 */

import { TodoTaskView } from "@/app/dashboard/_components/todo/TodoTaskView";
import { TodoToolsBridge } from "@/app/dashboard/_components/todo/todo-tools-bridge";

export function TasksPageClient() {
  return (
    <div className="flex h-full flex-col">
      {/* Bridge registers Botsson read tools when tasks are loaded */}
      <TodoToolsBridge />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <TodoTaskView />
        </div>
      </div>
    </div>
  );
}
