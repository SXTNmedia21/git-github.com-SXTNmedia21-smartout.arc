"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-reconciliation-tools.ts — Botsson tools for /dashboard/reconciliation.
 *
 * Six tools — five read, one navigation:
 *
 *   getReconciliationState   — current view state: list or detail, selected id, counters
 *   listReconciliationDays   — paginated list of reconciliation rows with status + KPIs
 *   getReconciliationDetail  — full detail for a selected reconciliation_id
 *   listPendingHours         — shift approvals awaiting timegodkjenning for a reconciliation
 *   listDeviationsForDay     — deviations (incl. blocking status) for a reconciliation
 *   switchDate               — navigate to a specific reconciliation_id (open detail view)
 *
 * Write tools (lockReconciliation, revertReconciliation, confirmHours) are deferred:
 * the approval + lock mutations in _hooks/useReconciliation.ts go through
 * useApproveReconciliation → /api/engine-dispatch, and the lock mutation in
 * DayDetail writes direct via supabase client-side. Both paths require UI state
 * (profileId from DashboardContext, toast feedback) that is not safe to invoke
 * from Botsson outside the owner component. Proposal pattern would add a write
 * tool that opens the approve-panel UI focus — deferred as write-tool debt.
 *
 * ADR-0238: /dashboard/reconciliation has no in-page chat surface →
 * owns_chat_surface: false. No <DomainChatOwnership> declaration needed.
 *
 * Pattern follows use-calendar-tools.ts:
 *   - useReconciliationTools(input): ClientToolKit
 *   - Stable useMemo([], []) definitions — implementations refreshed via dataRef
 *   - dataRef = useRef(input), refreshed each render via useEffect
 *   - Return JSON.stringify({ ok, ... }) from every implementation
 *   - dynamicParameters use "PARAMETER_LOCATION_BODY" as const
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/** View state the bridge passes in — matches what ReconciliationPageClient holds. */
export type ReconciliationToolInput = {
  /** Whether a reconciliation row is currently selected (detail view open). */
  selectedId: string | null;
  /** All reconciliation rows from useReconciliationList (last 60, desc). */
  rows: Array<{
    reconciliation_id: string;
    reconciliation_date: string;
    status: string;
    revenue_total: number | null;
    total_actual_hours: number | null;
    total_labor_cost: number | null;
    labor_percentage: number | null;
    locked_at?: string | null;
    department_session: {
      department_session_id?: string;
      department: { name: string };
      duty_leader?: { display_name: string | null } | null;
      opened_at?: string | null;
      closed_at?: string | null;
      shift_approval?: Array<{
        approval_id: string;
        status: string;
        planned_hours: number;
        approved_hours: number | null;
      }> | null;
      deviation?: Array<{
        deviation_id: string;
        title: string;
        status: string;
        severity: string;
        blocks_day_approval: boolean;
      }> | null;
    } | null;
  }>;
  /** UI action — open a reconciliation in detail view. */
  uiActions: {
    selectId: (id: string | null) => void;
  };
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function isValidUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function isValidISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    open: "Åpen",
    submitted: "Innsendt",
    awaiting_approval: "Venter godkjenning",
    approved: "Godkjent",
    locked: "Låst",
    missed: "Ikke åpnet",
  };
  return map[status] ?? status;
}

function summarizeRow(r: ReconciliationToolInput["rows"][number]) {
  return {
    reconciliation_id: r.reconciliation_id,
    date: r.reconciliation_date,
    status: r.status,
    status_label: statusLabel(r.status),
    department: r.department_session?.department?.name ?? null,
    revenue_total: r.revenue_total,
    labor_percentage: r.labor_percentage !== null ? Number(r.labor_percentage.toFixed(1)) : null,
    total_actual_hours: r.total_actual_hours,
    locked: !!r.locked_at,
  };
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useReconciliationTools(input: ReconciliationToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getReconciliationState",
          description:
            "Get the current reconciliation page state — whether a day is open in detail view, its id, and summary counters (venter oppgjør, klar til å låse, låst). Call first when manager asks any open-ended question about avstemming.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listReconciliationDays",
          description:
            "List reconciliation days with status, omsetning, and labor %. Use when manager asks 'hvilke dager venter oppgjør?', 'vis forrige ukes avstemminger', or wants an overview of recent days. Optionally filter by status or date range.",
          dynamicParameters: [
            {
              name: "status",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Filter by status: 'open' | 'submitted' | 'awaiting_approval' | 'approved' | 'locked'. Omit for all.",
              },
            },
            {
              name: "date_from",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Start date YYYY-MM-DD. Optional." },
            },
            {
              name: "date_to",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "End date YYYY-MM-DD. Optional." },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getReconciliationDetail",
          description:
            "Get full detail for a specific reconciliation_id — revenue breakdown, labor %, session info, preflight blocker count. Use when manager asks 'hva er status på lørdag?' and a reconciliation is already selected, or call after switchDate.",
          dynamicParameters: [
            {
              name: "reconciliation_id",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "UUID of the reconciliation row. If omitted, uses the currently selected id.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listPendingHours",
          description:
            "List shift approvals still waiting for timegodkjenning for a reconciliation. Use when manager asks 'hvilke vakter mangler godkjenning?' or 'er det timer som ikke er godkjent?'.",
          dynamicParameters: [
            {
              name: "reconciliation_id",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the reconciliation row. Defaults to currently selected id.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listDeviationsForDay",
          description:
            "List deviations for a reconciliation — status, severity, whether they block approval. Use when manager asks 'hvilke avvik blokkerer godkjenning?' or 'vis avvik for denne dagen'.",
          dynamicParameters: [
            {
              name: "reconciliation_id",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the reconciliation row. Defaults to currently selected id.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "switchDate",
          description:
            "Open a specific reconciliation in detail view by id or date. Use when manager says 'åpne oppgjøret for fredag', 'gå til lørdag', or names a specific day. Resolves by date if date given, by id if UUID given.",
          dynamicParameters: [
            {
              name: "reconciliation_id",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the reconciliation row. Required if date not given.",
              },
            },
            {
              name: "date",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Date YYYY-MM-DD. Resolve relative dates ('i dag', 'fredag') to ISO before calling. Required if reconciliation_id not given.",
              },
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
      getReconciliationState: () => {
        const d = dataRef.current;
        const rows = d.rows;
        let venter = 0;
        let klar = 0;
        let laast = 0;
        for (const r of rows) {
          if (r.status === "open" || r.status === "submitted" || r.status === "awaiting_approval") {
            venter += 1;
          } else if (r.status === "approved") {
            klar += 1;
          } else if (r.status === "locked") {
            laast += 1;
          }
        }
        return JSON.stringify({
          view: d.selectedId ? "detail" : "list",
          selected_reconciliation_id: d.selectedId,
          total_rows_loaded: rows.length,
          counters: { venter_oppgjor: venter, klar_til_lasing: klar, laast: laast },
        });
      },

      listReconciliationDays: (params) => {
        const d = dataRef.current;
        let rows = d.rows;

        const statusFilter =
          typeof params.status === "string" && params.status.length > 0 ? params.status : null;
        const dateFrom = isValidISODate(params.date_from) ? params.date_from : null;
        const dateTo = isValidISODate(params.date_to) ? params.date_to : null;

        if (statusFilter) {
          rows = rows.filter((r) => r.status === statusFilter);
        }
        if (dateFrom) {
          rows = rows.filter((r) => r.reconciliation_date >= dateFrom);
        }
        if (dateTo) {
          rows = rows.filter((r) => r.reconciliation_date <= dateTo);
        }

        return JSON.stringify({
          count: rows.length,
          filters: { status: statusFilter, date_from: dateFrom, date_to: dateTo },
          rows: rows.map(summarizeRow),
        });
      },

      getReconciliationDetail: (params) => {
        const d = dataRef.current;
        const id = isValidUUID(params.reconciliation_id) ? params.reconciliation_id : d.selectedId;
        if (!id) {
          return JSON.stringify({
            error: "Ingen valgt oppgjør. Bruk switchDate for å velge en dag.",
          });
        }
        const row = d.rows.find((r) => r.reconciliation_id === id);
        if (!row) {
          return JSON.stringify({
            error: `Fant ikke oppgjør med id ${id}. Sjekk at det er lastet inn (siste 60 dager).`,
          });
        }
        const session = row.department_session;
        const approvals = session?.shift_approval ?? [];
        const deviations = session?.deviation ?? [];
        const pendingShiftCount = approvals.filter((a) => a.status === "pending").length;
        const blockingDeviations = deviations.filter(
          (dv) => dv.blocks_day_approval && dv.status === "open",
        ).length;

        return JSON.stringify({
          reconciliation_id: row.reconciliation_id,
          date: row.reconciliation_date,
          status: row.status,
          status_label: statusLabel(row.status),
          department: session?.department?.name ?? null,
          duty_leader: session?.duty_leader?.display_name ?? null,
          session_opened_at: session?.opened_at ?? null,
          session_closed_at: session?.closed_at ?? null,
          revenue_total: row.revenue_total,
          labor_percentage: row.labor_percentage,
          total_actual_hours: row.total_actual_hours,
          total_labor_cost: row.total_labor_cost,
          locked: !!row.locked_at,
          preflight: {
            pending_shift_approvals: pendingShiftCount,
            blocking_deviations: blockingDeviations,
            can_approve: pendingShiftCount === 0 && blockingDeviations === 0,
          },
        });
      },

      listPendingHours: (params) => {
        const d = dataRef.current;
        const id = isValidUUID(params.reconciliation_id) ? params.reconciliation_id : d.selectedId;
        if (!id) {
          return JSON.stringify({ error: "Ingen valgt oppgjør." });
        }
        const row = d.rows.find((r) => r.reconciliation_id === id);
        if (!row) {
          return JSON.stringify({ error: `Fant ikke oppgjør med id ${id}.` });
        }
        const approvals = row.department_session?.shift_approval ?? [];
        const pending = approvals.filter((a) => a.status === "pending");
        return JSON.stringify({
          reconciliation_id: id,
          total_approvals: approvals.length,
          pending_count: pending.length,
          pending: pending.map((a) => ({
            approval_id: a.approval_id,
            planned_hours: a.planned_hours,
            approved_hours: a.approved_hours,
            status: a.status,
          })),
        });
      },

      listDeviationsForDay: (params) => {
        const d = dataRef.current;
        const id = isValidUUID(params.reconciliation_id) ? params.reconciliation_id : d.selectedId;
        if (!id) {
          return JSON.stringify({ error: "Ingen valgt oppgjør." });
        }
        const row = d.rows.find((r) => r.reconciliation_id === id);
        if (!row) {
          return JSON.stringify({ error: `Fant ikke oppgjør med id ${id}.` });
        }
        const deviations = row.department_session?.deviation ?? [];
        const blocking = deviations.filter((dv) => dv.blocks_day_approval && dv.status === "open");
        return JSON.stringify({
          reconciliation_id: id,
          total_deviations: deviations.length,
          blocking_count: blocking.length,
          deviations: deviations.map((dv) => ({
            deviation_id: dv.deviation_id,
            title: dv.title,
            status: dv.status,
            severity: dv.severity,
            blocks_approval: dv.blocks_day_approval,
          })),
        });
      },

      switchDate: (params) => {
        const d = dataRef.current;

        // Try by UUID first
        if (isValidUUID(params.reconciliation_id)) {
          const row = d.rows.find((r) => r.reconciliation_id === params.reconciliation_id);
          if (!row) {
            return JSON.stringify({
              error: `Fant ikke oppgjør med id ${params.reconciliation_id}.`,
            });
          }
          d.uiActions.selectId(row.reconciliation_id);
          return JSON.stringify({
            ok: true,
            reconciliation_id: row.reconciliation_id,
            date: row.reconciliation_date,
            department: row.department_session?.department?.name ?? null,
          });
        }

        // Try by date
        if (isValidISODate(params.date)) {
          const row = d.rows.find((r) => r.reconciliation_date === params.date);
          if (!row) {
            return JSON.stringify({
              error: `Ingen oppgjør funnet for ${params.date}. Sjekk at datoen er innenfor siste 60 dager.`,
            });
          }
          d.uiActions.selectId(row.reconciliation_id);
          return JSON.stringify({
            ok: true,
            reconciliation_id: row.reconciliation_id,
            date: row.reconciliation_date,
            department: row.department_session?.department?.name ?? null,
          });
        }

        return JSON.stringify({
          error: "Oppgi enten reconciliation_id (UUID) eller date (YYYY-MM-DD).",
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
