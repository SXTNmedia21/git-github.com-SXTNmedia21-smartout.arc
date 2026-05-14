"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-cost-tools.ts — Botsson tools for the /dashboard/cost surface.
 *
 * Four read tools — no write tools (cost page is analytics-only):
 *
 *   getCostOverview          — total planned/actual costs, variance, hours for current view
 *   getLaborCostByPeriod     — per-week cost summary with navigation hint
 *   getMarginAnalysis        — variance % by department, flags over-budget departments
 *   getCostBreakdownByDepartment — detailed per-department breakdown for a named department
 *
 * dataRef pattern keeps definitions stable while reading live state per invocation.
 * ADR-0151: no workspace_id in input — resolved server-side; tools read data from the
 *   live hook snapshot passed in as input props.
 * ADR-0238: owns_chat_surface=false — cost does not declare chat ownership.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { DepartmentCostSummary, CostTotals } from "../_hooks/use-cost-overview";

/* ━━━ Input shape ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type CostToolInput = {
  /** Per-department breakdown for the currently visible week. */
  byDepartment: DepartmentCostSummary[];
  /** Aggregated totals for the currently visible week. */
  totals: CostTotals;
  /** ISO date string: Monday of the visible week (YYYY-MM-DD). */
  dateFrom: string;
  /** ISO date string: Sunday of the visible week (YYYY-MM-DD). */
  dateTo: string;
  /** Human-readable week label shown in the header, e.g. "5. mai – 11. mai". */
  weekLabel: string;
  /** Navigate to adjacent week: -1 = previous, +1 = next, 0 = this week. */
  navigateWeek: (offset: number) => void;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useCostTools(input: CostToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getCostOverview",
          description:
            "Get an overview of labor costs for the currently visible week: total planned cost, actual cost, variance (NOK + %), and total hours. Use when user asks 'hva koster det denne uken?', 'hva er lønnskostnaden?', or 'er vi over budsjett?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getLaborCostByPeriod",
          description:
            "Get cost data for a specific week by navigating: 'current' stays on this week, 'previous' goes one week back, 'next' goes one week forward. Use when user asks about a different week's costs or wants to compare periods.",
          dynamicParameters: [
            {
              name: "period",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["current", "previous", "next"],
                description:
                  "Which week to navigate to. 'current' returns this week's data without navigating.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getMarginAnalysis",
          description:
            "Analyse cost variance across all departments: which departments are over budget, by how much, and what the total overage is. Use when user asks 'hvilke avdelinger er over budsjett?', 'hvor er avviket størst?', or 'kan du analysere kostnadene?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getCostBreakdownByDepartment",
          description:
            "Get a detailed cost breakdown for a specific department by name: planned, actual, variance, hours, and shift count. Use when user asks 'hva koster [avdeling]?', 'vis meg kostnad for kjøkkenet', or references a specific department.",
          dynamicParameters: [
            {
              name: "departmentName",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Partial or full name of the department (case-insensitive match). E.g. 'kjøkken', 'bar', 'sal'.",
              },
              required: true,
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
      getCostOverview: () => {
        const { totals, dateFrom, dateTo, weekLabel } = dataRef.current;
        return JSON.stringify({
          week: weekLabel,
          dateFrom,
          dateTo,
          plannedCostNOK: totals.plannedCost,
          actualCostNOK: totals.actualCost,
          varianceNOK: totals.variance,
          variancePercent: totals.variancePercent,
          isOverBudget: totals.variance > 0,
          totalHours: totals.totalHours,
          totalShifts: totals.shiftCount,
        });
      },

      getLaborCostByPeriod: (params: Record<string, unknown>) => {
        const { totals, dateFrom, dateTo, weekLabel, navigateWeek } = dataRef.current;
        const period = params.period as string | undefined;

        if (period === "previous") {
          navigateWeek(-1);
          return JSON.stringify({
            ok: true,
            action: "navigated",
            direction: "previous",
            note: "Navigated to previous week. Data will update shortly.",
          });
        }

        if (period === "next") {
          navigateWeek(1);
          return JSON.stringify({
            ok: true,
            action: "navigated",
            direction: "next",
            note: "Navigated to next week. Data will update shortly.",
          });
        }

        // "current" — return present data without navigating
        return JSON.stringify({
          ok: true,
          action: "current",
          week: weekLabel,
          dateFrom,
          dateTo,
          plannedCostNOK: totals.plannedCost,
          actualCostNOK: totals.actualCost,
          varianceNOK: totals.variance,
          variancePercent: totals.variancePercent,
          totalHours: totals.totalHours,
        });
      },

      getMarginAnalysis: () => {
        const { byDepartment, weekLabel } = dataRef.current;

        const overBudget = byDepartment
          .filter((d) => d.variance > 0)
          .sort((a, b) => b.variance - a.variance);

        const underBudget = byDepartment
          .filter((d) => d.variance < 0)
          .sort((a, b) => a.variance - b.variance);

        const totalOverage = overBudget.reduce((sum, d) => sum + d.variance, 0);
        const totalSaving = underBudget.reduce((sum, d) => sum + Math.abs(d.variance), 0);

        return JSON.stringify({
          week: weekLabel,
          departmentCount: byDepartment.length,
          overBudgetCount: overBudget.length,
          underBudgetCount: underBudget.length,
          totalOverageNOK: totalOverage,
          totalSavingNOK: totalSaving,
          overBudgetDepartments: overBudget.map((d) => ({
            name: d.departmentName,
            varianceNOK: d.variance,
            variancePercent: d.variancePercent,
          })),
          underBudgetDepartments: underBudget.map((d) => ({
            name: d.departmentName,
            varianceNOK: d.variance,
            variancePercent: d.variancePercent,
          })),
        });
      },

      getCostBreakdownByDepartment: (params: Record<string, unknown>) => {
        const { byDepartment, weekLabel } = dataRef.current;
        const query = (params.departmentName as string | undefined)?.toLowerCase().trim();

        if (!query) {
          return JSON.stringify({ ok: false, reason: "departmentName is required" });
        }

        const dept = byDepartment.find((d) => d.departmentName.toLowerCase().includes(query));

        if (!dept) {
          const available = byDepartment.map((d) => d.departmentName);
          return JSON.stringify({
            ok: false,
            reason: `No department matching '${query}' found in current view.`,
            availableDepartments: available,
          });
        }

        return JSON.stringify({
          ok: true,
          week: weekLabel,
          departmentId: dept.departmentId,
          departmentName: dept.departmentName,
          plannedCostNOK: dept.plannedCost,
          actualCostNOK: dept.actualCost,
          varianceNOK: dept.variance,
          variancePercent: dept.variancePercent,
          isOverBudget: dept.variance > 0,
          totalHours: dept.totalHours,
          shiftCount: dept.shiftCount,
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
