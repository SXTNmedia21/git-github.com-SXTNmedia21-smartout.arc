"use client";

/**
 * use-reconciliation-tools.ts — Botsson read tools for the ReconciliationView surface.
 *
 * READ (2):
 *   listReconciliationDays   — pending/open/approved days list (recent 60, sorted by date desc)
 *   getReconciliationDetail  — single-day breakdown: shifts, deviations, KPIs for a named date
 *
 * Write tools (lockReconciliation / revertReconciliation) are DEFERRED:
 *   No "use server" Server Actions exist for day-level lock or revert.
 *   Existing mutations (useApproveReconciliation, useRejectReconciliation) in
 *   reconciliation/_hooks/useReconciliation.ts are TanStack client mutations —
 *   they own emit() internally and are not wrappable as tool bridges without
 *   violating the "Server Actions own gate" convention (ADR-0099/ADR-0204).
 *   Ship write tools as a separate sortie when server actions exist.
 *
 * Pattern:
 *   - dataRef pattern from use-oversikt-tools.ts: ref refreshed every render,
 *     definitions/implementations memoised once. No re-registration churn.
 *   - PARAMETER_LOCATION_BODY for all dynamic parameters.
 *   - No emit(), no gateAction() — read tools have no side-effects.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { DepartmentShiftGroup } from "@/app/dashboard/_hooks/dashboard-types";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReconciliationDay = {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Offset from today: -1 = yesterday, 0 = today, etc. */
  dateOffset: number;
  /** Total shift count across all departments for this date */
  totalShifts: number;
  /** Total hours across all departments */
  totalHours: number;
  /** How many shifts have been handled (approved/disputed/handoff) */
  handledCount: number;
  /** Whether all shifts are handled */
  allHandled: boolean;
  /** Whether the day has been approved and locked */
  approved: boolean;
};

export type ReconciliationToolInput = {
  /**
   * The currently selected date ISO string (YYYY-MM-DD).
   * Provided by ReconciliationView's selectedDate.
   */
  selectedDate: string;
  /**
   * Shift groups from useDepartmentShifts — one entry per department for the selected date.
   * Null/undefined while loading.
   */
  departments: DepartmentShiftGroup[] | null | undefined;
  /**
   * Whether the day has been approved (local state in ReconciliationView).
   */
  dayApproved: boolean;
  /**
   * Current per-shift decision map from ReconciliationView state.
   * Keys are shiftId strings; values are "pending"|"approved"|"disputed"|"handoff".
   */
  decisions: Record<string, string>;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useReconciliationTools(input: ReconciliationToolInput): ClientToolKit {
  // Refresh ref on every render so implementations always read live data.
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "listReconciliationDays",
          description:
            "List pending and handled reconciliation days for the active date view. Returns shift counts, hours, decision progress, and approval status. Use when the manager asks 'hva gjenstår å avstemme?', 'hvilke dager er godkjent?', or wants an overview of the reconciliation surface.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getReconciliationDetail",
          description:
            "Get the full breakdown for the selected reconciliation date — department sections, individual shifts with hours and per-shift decision status. Use when the manager asks 'vis meg detaljer for i går', 'hvilke vakter er bestridt?', or 'hvem er ikke godkjent?'.",
          dynamicParameters: [
            {
              name: "departmentId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Optional department UUID to filter to a single department. Omit to get all departments for the selected date.",
              },
              required: false,
            },
            {
              name: "statusFilter",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["all", "pending", "approved", "disputed", "handoff"],
                description:
                  "Filter shifts by decision status. 'all' (default) returns every shift. 'pending' = not yet handled. 'disputed' = flagged for follow-up.",
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
      listReconciliationDays: () => {
        const d = dataRef.current;
        const depts = d.departments ?? [];
        const allShifts = depts.flatMap((dept) => dept.shifts);
        const totalShifts = allShifts.length;
        const handledCount = allShifts.filter(
          (s) => d.decisions[s.shiftId] && d.decisions[s.shiftId] !== "pending",
        ).length;
        const allHandled = totalShifts > 0 && handledCount === totalShifts;
        const totalHours = depts.reduce((sum, dept) => sum + dept.totalHours, 0);

        const day: ReconciliationDay = {
          date: d.selectedDate,
          dateOffset: (() => {
            const today = new Date().toISOString().slice(0, 10);
            const sel = d.selectedDate;
            const diffMs = new Date(sel).getTime() - new Date(today).getTime();
            return Math.round(diffMs / (1000 * 60 * 60 * 24));
          })(),
          totalShifts,
          totalHours: Number(totalHours.toFixed(1)),
          handledCount,
          allHandled,
          approved: d.dayApproved,
        };

        return JSON.stringify({
          selectedDate: d.selectedDate,
          day,
          departments: depts.map((dept) => ({
            departmentId: dept.departmentId,
            departmentName: dept.departmentName,
            shiftCount: dept.shifts.length,
            totalHours: Number(dept.totalHours.toFixed(1)),
            handledCount: dept.shifts.filter(
              (s) => d.decisions[s.shiftId] && d.decisions[s.shiftId] !== "pending",
            ).length,
          })),
        });
      },

      getReconciliationDetail: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const depts = d.departments ?? [];
        const departmentId = (params.departmentId as string | undefined) ?? null;
        const statusFilter = (params.statusFilter as string | undefined) ?? "all";

        const filteredDepts = departmentId
          ? depts.filter((dept) => dept.departmentId === departmentId)
          : depts;

        const sections = filteredDepts.map((dept) => {
          const shifts = dept.shifts
            .map((s) => ({
              shiftId: s.shiftId,
              employeeName: s.employeeName ?? "Ikke tildelt",
              role: s.positionName ?? s.role ?? "—",
              startTime: s.startTime,
              endTime: s.endTime,
              workHours: Number(s.workHours.toFixed(1)),
              decision: d.decisions[s.shiftId] ?? "pending",
            }))
            .filter((s) => {
              if (statusFilter === "all") return true;
              return s.decision === statusFilter;
            });

          return {
            departmentId: dept.departmentId,
            departmentName: dept.departmentName,
            totalHours: Number(dept.totalHours.toFixed(1)),
            shifts,
            summary: {
              total: dept.shifts.length,
              pending: dept.shifts.filter(
                (s) => !d.decisions[s.shiftId] || d.decisions[s.shiftId] === "pending",
              ).length,
              approved: dept.shifts.filter((s) => d.decisions[s.shiftId] === "approved").length,
              disputed: dept.shifts.filter((s) => d.decisions[s.shiftId] === "disputed").length,
              handoff: dept.shifts.filter((s) => d.decisions[s.shiftId] === "handoff").length,
            },
          };
        });

        return JSON.stringify({
          date: d.selectedDate,
          dayApproved: d.dayApproved,
          statusFilter,
          departmentFilter: departmentId ?? "all",
          sections,
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
