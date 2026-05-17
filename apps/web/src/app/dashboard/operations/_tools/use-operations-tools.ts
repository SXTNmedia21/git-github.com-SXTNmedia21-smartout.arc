"use client";

/**
 * use-operations-tools.ts — Botsson tools for /dashboard/operations.
 *
 * Five read tools covering the live KPI surface:
 *
 *   getOperationsOverview    — summary of all metric cards for today
 *   getStressBreakdown       — per-department staff capacity breakdown
 *   getActiveDeviations      — open/acknowledged deviation list with severity
 *   getTaskStatus            — session task progress (done / overdue / active / upcoming)
 *   getHourlyChart           — revenue vs labor cost for today's chart window
 *
 * No write tools — the only mutation on this page is DeviationDialog (user-driven
 * form). Botsson can direct the user to "Registrer avvik"-knappen but does not
 * submit the form itself. This avoids partial-submit risk on a live operational
 * surface. Proposal pattern does not apply here (no sheet to pre-fill via JS API).
 *
 * Pattern follows use-calendar-tools.ts (stable useMemo defs, dataRef for fresh
 * values, JSON.stringify result, useRegisterTools at bridge layer).
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { OperationsData } from "../_hooks/use-operations-data";

// ─── Input shape ───────────────────────────────────────────────────────────

export type OperationsToolInput = {
  /** Live data from useOperationsData() — null while loading. */
  data: OperationsData | null | undefined;
  /** Whether the department stress breakdown panel is visible. */
  showDeptBreakdown: boolean;
  /** Per-department capacity metrics — populated by DepartmentBreakdown component. */
  deptMetrics: Array<{
    departmentId: string;
    departmentName: string;
    staffPresent: number;
    staffExpected: number;
    capacityPct: number;
  }>;
};

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useOperationsTools(input: OperationsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getOperationsOverview",
          description:
            "Get the live operational overview for today — task completion %, stress level, staff present vs expected, overdue and upcoming task counts, HACCP temperature status, cleaning checklist progress, and open deviation count. Call first when manager asks any operations or drift question.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getStressBreakdown",
          description:
            "Get per-department staff capacity breakdown — each department's present vs expected headcount and capacity percentage. Use when manager asks 'hvilken avdeling er mest underbemant?', 'hvor er stressnivået høyest?', or wants to drill into the stress card.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getActiveDeviations",
          description:
            "Get today's open and acknowledged deviations with severity breakdown (critical / high / medium / low). Use when manager asks 'hvilke avvik er åpne i dag?', 'er det kritiske avvik nå?', or wants to assess operational risk.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getTaskStatus",
          description:
            "Get today's session task progress — how many tasks are done, overdue, in progress, and upcoming. Use when manager asks 'er vi på schedule?', 'hva gjenstår i dag?', or wants a task-by-task status summary.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getHourlyChart",
          description:
            "Get today's hourly revenue vs labor cost data — each hour bucket with revenue estimate, labor cost, and whether it is in the past or future. Use when manager asks 'hva er lønnskostnad vs omsetning hittil i dag?' or wants cost efficiency data.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getOperationsOverview: () => {
        const { data } = dataRef.current;
        if (!data) {
          return JSON.stringify({
            error: "Operasjonsoversikt ikke tilgjengelig ennå — prøv igjen om noen sekunder.",
          });
        }
        return JSON.stringify({
          today: new Date().toISOString().split("T")[0],
          taskCompletion: data.taskCompletion,
          stressLevel: data.stressLevel,
          staffPresent: {
            present: data.staffPresent.present,
            expected: data.staffPresent.expected,
            names: data.staffPresent.names,
          },
          overdueTasks: data.overdueTasks,
          upcomingTasks: data.upcomingTasks,
          activeTasks: data.activeTasks,
          openDeviations: data.openDeviations,
          haccpStatus: data.haccpStatus,
          lastHaccpTime: data.lastHaccpTime,
          cleaningStatus: data.cleaningStatus,
          laborCostEstimated: data.laborCostEstimated,
        });
      },

      getStressBreakdown: () => {
        const { data, showDeptBreakdown, deptMetrics } = dataRef.current;
        if (!data) {
          return JSON.stringify({ error: "Data ikke tilgjengelig." });
        }
        return JSON.stringify({
          overall: data.stressLevel,
          breakdownPanelVisible: showDeptBreakdown,
          departments:
            deptMetrics.length > 0
              ? deptMetrics.map((d) => ({
                  name: d.departmentName,
                  present: d.staffPresent,
                  expected: d.staffExpected,
                  capacityPct: d.capacityPct,
                  status: d.capacityPct >= 90 ? "ok" : d.capacityPct >= 70 ? "medium" : "low",
                }))
              : "Klikk på stresskort-panelet for å laste avdelingsfordeling.",
        });
      },

      getActiveDeviations: () => {
        const { data } = dataRef.current;
        if (!data) {
          return JSON.stringify({ error: "Data ikke tilgjengelig." });
        }
        const bd = data.deviationBreakdown;
        return JSON.stringify({
          total: bd.total,
          critical: bd.critical,
          high: bd.high,
          medium: bd.medium,
          low: bd.low,
          riskLevel:
            bd.critical > 0 ? "critical" : bd.high > 0 ? "high" : bd.total > 0 ? "medium" : "clear",
        });
      },

      getTaskStatus: () => {
        const { data } = dataRef.current;
        if (!data) {
          return JSON.stringify({ error: "Data ikke tilgjengelig." });
        }
        const tc = data.taskCompletion;
        return JSON.stringify({
          done: tc.done,
          total: tc.total,
          completionPct: tc.pct,
          overdue: data.overdueTasks,
          inProgress: data.activeTasks,
          upcoming: data.upcomingTasks,
          onTrack: data.overdueTasks === 0,
        });
      },

      getHourlyChart: () => {
        const { data } = dataRef.current;
        if (!data) {
          return JSON.stringify({ error: "Data ikke tilgjengelig." });
        }
        const pastHours = data.hourlyData.filter((h) => !h.isFuture);
        const totalRevenue = pastHours.reduce((sum, h) => sum + h.revenue, 0);
        const totalCost = pastHours.reduce((sum, h) => sum + h.cost, 0);
        return JSON.stringify({
          laborCostEstimated: data.laborCostEstimated,
          summary: {
            totalRevenue: Math.round(totalRevenue),
            totalLaborCost: Math.round(totalCost),
            revenueToday: `Kr ${Math.round(totalRevenue).toLocaleString("nb-NO")}`,
            laborCostToday: `Kr ${Math.round(totalCost).toLocaleString("nb-NO")}`,
          },
          hours: data.hourlyData.map((h) => ({
            time: h.time,
            revenue: h.revenue,
            cost: h.cost,
            isFuture: h.isFuture,
          })),
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
