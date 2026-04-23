"use client";

/**
 * Main orchestrator for the cascade task surface ("Å gjøre" tab).
 * Fetches all cascade tasks via RPC, renders groups sorted by completeness/urgency,
 * and shows empty state when all tasks are resolved.
 */

import { useContext, useEffect, useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { Button } from "@/components/ui/button";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useCascadeTasks } from "../../_hooks/use-cascade-tasks";
import { TodoGroupSection } from "./TodoGroupSection";
import { TodoEmptyState } from "./TodoEmptyState";
import type { TaskGroupSummary, TaskUrgency } from "@smartout/types";

/** Returns the highest urgency among a group's tasks (for sorting) */
function highestUrgency(group: TaskGroupSummary): number {
  const urgencyOrder: Record<TaskUrgency, number> = {
    critical: 0,
    should: 1,
    can_wait: 2,
  };
  if (group.tasks.length === 0) return 3; // completed groups go last
  return Math.min(...group.tasks.map((t) => urgencyOrder[t.urgency]));
}

/** Skeleton placeholder while data is loading */
function TodoSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, groupIdx) => (
        <div key={groupIdx} className="space-y-3">
          {/* Group header skeleton */}
          <div className="flex items-center gap-3 px-1 py-1.5">
            <div className="bg-muted h-5 w-5 animate-pulse rounded" />
            <div className="bg-muted h-4 w-32 animate-pulse rounded" />
            <div className="flex-1" />
            <div className="bg-muted h-3 w-12 animate-pulse rounded font-mono" />
            <div className="bg-muted h-1.5 w-16 animate-pulse rounded-full" />
          </div>
          {/* Card skeletons */}
          <div className="space-y-2 pl-8">
            {Array.from({ length: 2 }).map((_, cardIdx) => (
              <div
                key={cardIdx}
                className="border-border border-l-muted bg-card/70 flex items-start gap-3 rounded-lg border border-l-4 p-4"
              >
                <div className="bg-muted mt-0.5 h-4 w-4 animate-pulse rounded" />
                <div className="flex-1 space-y-1.5">
                  <div className="bg-muted h-3.5 w-48 animate-pulse rounded" />
                  <div className="bg-muted h-3 w-64 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TodoTaskView() {
  const { t } = useTranslation("dashboard");
  const { data, isLoading, error, refetch } = useCascadeTasks();
  const { profileId } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id ?? null;

  /** Emit telemetry when the view mounts with data */
  useEffect(() => {
    if (data) {
      void emit({
        event: "task_surface viewed",
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "task_surface", entity_id: "cascade-tasks" },
          data: {
            total_tasks: data.total_tasks,
            critical_count: data.critical_count,
          },
        },
      });
      void emit({
        event: "task_surface snapshot",
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "task_surface", entity_id: "cascade-tasks" },
          data: {
            total_tasks: data.total_tasks,
            critical_count: data.critical_count,
            should_count: data.should_count,
          },
        },
      });
    }
  }, [data, wsId, profileId]);

  /** Sort groups: incomplete first (by highest urgency), completed last */
  const sortedGroups = useMemo(() => {
    if (!data?.groups) return [];
    return [...data.groups].sort((a, b) => highestUrgency(a) - highestUrgency(b));
  }, [data?.groups]);

  if (isLoading) {
    return <TodoSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="text-destructive h-10 w-10" />
        <p className="text-muted-foreground mt-4 text-sm">{t("todo.error_loading")}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          {t("todo.error_retry")}
        </Button>
      </div>
    );
  }

  if (!data || data.total_tasks === 0) {
    return <TodoEmptyState />;
  }

  return (
    <div className="space-y-4" aria-live="polite" aria-label={t("todo.task_list_label")}>
      {sortedGroups.map((group, index) => (
        <TodoGroupSection key={group.group} group={group} index={index} />
      ))}
    </div>
  );
}
