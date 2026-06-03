import { Suspense } from "react";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { withPagePerf } from "@/lib/page-perf";
import { TasksPageClient } from "./_components/TasksPageClient";

/**
 * /dashboard/tasks — unified task list (cascade task surface).
 *
 * Server Component shell per ADR-0115. Resolves workspace + profile
 * context server-side (zero extra DB hits — layout has already resolved
 * and cached these values). Client boundary in TasksPageClient owns the
 * TanStack query for resolve_cascade_tasks (no migration, no new RPC).
 *
 * Telemetry: task_surface viewed + task_surface snapshot emitted by
 * TodoTaskView on mount (already registered in packages/telemetry).
 * Botsson tools: TodoToolsBridge registers listTodos when data is ready.
 */
export default withPagePerf(async function TasksPage() {
  await resolveDashboardContext();

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-3 px-1 py-1.5">
                <div className="bg-muted h-5 w-5 animate-pulse rounded" />
                <div className="bg-muted h-4 w-32 animate-pulse rounded" />
              </div>
              <div className="space-y-2 pl-8">
                <div className="border-border bg-card/70 flex items-start gap-3 rounded-lg border p-4">
                  <div className="bg-muted mt-0.5 h-4 w-4 animate-pulse rounded" />
                  <div className="flex-1 space-y-1.5">
                    <div className="bg-muted h-3.5 w-48 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-64 animate-pulse rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      }
    >
      <TasksPageClient />
    </Suspense>
  );
});
