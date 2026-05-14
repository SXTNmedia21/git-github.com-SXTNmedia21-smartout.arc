"use client";

/**
 * use-todo-tools.ts — Botsson read tools for the "Å gjøre" cascade task surface.
 *
 * Exposes 1 read tool (listTodos) backed by useCascadeTasks data.
 *
 * No write tools: cascade tasks (session_task / resolve_cascade_tasks RPC output)
 * have no dedicated Server Action for assignment or completion that targets the
 * cascade surface. Session-task mutations exist in toggle-session-task-action.ts
 * and complete-session-task-action.ts but those operate on session_task rows
 * (day-control Oppgaver), not cascade-derived CascadeTask items. Defer write
 * tools until a cascade-specific assignment/completion action is created.
 *
 * Pattern mirrors use-oversikt-tools.ts:
 *  - Stable definitions in useMemo([], [])
 *  - dataRef refreshed every render — implementations always read live data
 *  - Zod params with PARAMETER_LOCATION_BODY as const
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { CascadeTask, CascadeTasksResult, TaskUrgency } from "@smartout/types";

export type TodoToolInput = {
  /** Full cascade tasks result from useCascadeTasks. */
  cascadeResult: CascadeTasksResult | undefined;
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function summarizeCounts(tasks: CascadeTask[]) {
  return {
    total: tasks.length,
    critical: tasks.filter((t) => t.urgency === "critical").length,
    should: tasks.filter((t) => t.urgency === "should").length,
    can_wait: tasks.filter((t) => t.urgency === "can_wait").length,
  };
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useTodoTools(input: TodoToolInput): ClientToolKit {
  // Refresh ref on every render — implementations close over dataRef.current
  // so they always read live data without forcing tool re-registration.
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "listTodos",
          description:
            "List all cascade-derived to-do items for the workspace, grouped by dimension (D1–D6, C1–C4) and urgency. Returns critical, should, and can_wait tasks with their group, dimension, title key, and navigation href. Use when the manager asks 'hva må jeg gjøre?', 'hvilke saker haster?', or 'vis alle gjøremål'.",
          dynamicParameters: [
            {
              name: "urgency",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["critical", "should", "can_wait", "all"],
                description:
                  "Filter by urgency level: 'critical', 'should', 'can_wait', or 'all'. Defaults to 'all'.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      listTodos: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        if (!d.cascadeResult) {
          return JSON.stringify({ available: false, reason: "Laster gjøremål..." });
        }

        const urgencyFilter = (params.urgency as TaskUrgency | "all" | undefined) ?? "all";
        const allTasks = d.cascadeResult.groups.flatMap((g) => g.tasks);

        const filtered =
          urgencyFilter === "all" ? allTasks : allTasks.filter((t) => t.urgency === urgencyFilter);

        return JSON.stringify({
          available: true,
          summary: {
            ...summarizeCounts(filtered),
            total_in_result: d.cascadeResult.total_tasks,
            critical_total: d.cascadeResult.critical_count,
            should_total: d.cascadeResult.should_count,
          },
          groups: d.cascadeResult.groups
            .map((g) => {
              const groupTasks =
                urgencyFilter === "all"
                  ? g.tasks
                  : g.tasks.filter((t) => t.urgency === urgencyFilter);
              if (groupTasks.length === 0) return null;
              return {
                group: g.group,
                dimension: g.dimension,
                label_key: g.label_key,
                done: g.done,
                total: g.total,
                tasks: groupTasks.map((t) => ({
                  id: t.id,
                  urgency: t.urgency,
                  dimension: t.dimension,
                  title_key: t.title_key,
                  description_key: t.description_key,
                  href: t.href,
                  entity_type: t.entity_type ?? null,
                  entity_id: t.entity_id ?? null,
                })),
              };
            })
            .filter(Boolean),
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
