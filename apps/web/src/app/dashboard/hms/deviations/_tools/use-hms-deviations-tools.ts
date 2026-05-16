"use client";

/**
 * use-hms-deviations-tools.ts — Botsson tools for /dashboard/hms/deviations.
 *
 * Five tools: 3 read, 2 view-control.
 *   getDeviationsOverview     — counts by status + severity + day-blocking
 *   listOpenDeviations        — active deviations (open|acknowledged|escalated)
 *   getDeviationDetail        — single deviation by id (full row)
 *   setDeviationsViewMode     — switch kanban|list (admin only)
 *   openDeviationDetail       — open detail drawer for a specific deviation id
 *
 * Admin/employee split:
 *   When isAdminMode = false, the surface renders DeviationForm (single
 *   report-create form). View tools still report shape via "mode: form".
 *
 * ADR-0151: workspace_id auth-derived. No write-mutation tools — deviation
 * resolution requires multi-field workflow; reporting goes through
 * DeviationForm submit. Botsson navigates + reads, humans mutate.
 * ADR-0238: page does not own a domain chat surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { DeviationRow } from "@smartout/hms";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type HmsDeviationsToolInput = {
  isAdminMode: boolean;
  loading: boolean;
  deviations: DeviationRow[];
  viewMode: "kanban" | "list";
  selectedDeviationId: string | null;
  setViewMode: (mode: "kanban" | "list") => void;
  openDetail: (deviationId: string) => void;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useHmsDeviationsTools(input: HmsDeviationsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getDeviationsOverview",
          description:
            "Get a counts summary of all deviations — totals broken down by status (open/acknowledged/resolved/escalated), severity (low/medium/high/critical), and how many block day-approval. Use as the first tool when the user asks 'hvor mange avvik har vi?', 'hva er åpne avvik?', 'er det noe kritisk?', or wants a top-level deviation health read.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listOpenDeviations",
          description:
            "List deviations that are currently active — status in (open, acknowledged, escalated). Returns id, title, severity, status, domain, department name, blocks_day_approval flag, created_at. Use when the user asks 'vis åpne avvik', 'hvilke avvik venter?', or 'hvilke blokkerer dagsavslutning?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getDeviationDetail",
          description:
            "Get the full detail for a single deviation by id — title, description, severity, status, domain, department, reporter, resolver, resolution notes, timestamps, and day-approval blocking flag. Use when the user asks about a specific deviation by id or after listing.",
          dynamicParameters: [
            {
              name: "deviationId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the deviation row to read.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "setDeviationsViewMode",
          description:
            "Switch the deviations list between Kanban (board grouped by status) and List (flat sortable table) views. Admin-only. Use when the user says 'vis som kanban', 'bytt til liste', or 'jeg vil ha tavle-visning'.",
          dynamicParameters: [
            {
              name: "mode",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["kanban", "list"],
                description: "Which view to render.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openDeviationDetail",
          description:
            "Open the detail drawer for a specific deviation so the user can inspect or act on it. Use when the user says 'åpne avvik [id]', 'vis meg avviket om [tittel]', or after they've asked about a specific deviation.",
          dynamicParameters: [
            {
              name: "deviationId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the deviation row to open in the drawer.",
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
      getDeviationsOverview: () => {
        const d = dataRef.current;
        if (!d.isAdminMode) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              mode: "form",
              hint: "Du er i avviksrapportering-modus. Bruk skjemaet for å rapportere et nytt avvik.",
            }),
          );
        }
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const list = d.deviations;
        const byStatus: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        let blocking = 0;
        for (const row of list) {
          byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
          bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
          if (row.blocksDayApproval) blocking += 1;
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            mode: "admin",
            total: list.length,
            byStatus,
            bySeverity,
            blocksDayApproval: blocking,
            viewMode: d.viewMode,
          }),
        );
      },

      listOpenDeviations: () => {
        const d = dataRef.current;
        if (!d.isAdminMode) {
          return Promise.resolve(JSON.stringify({ ok: true, mode: "form", available: false }));
        }
        const open = d.deviations.filter(
          (row) =>
            row.status === "open" || row.status === "acknowledged" || row.status === "escalated",
        );
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: open.length,
            deviations: open.map((row) => ({
              id: row.deviationId,
              title: row.title,
              severity: row.severity,
              status: row.status,
              domain: row.domain,
              department: row.departmentName,
              blocksDayApproval: row.blocksDayApproval,
              createdAt: row.createdAt,
            })),
          }),
        );
      },

      getDeviationDetail: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const id = String(params.deviationId ?? "");
        if (!id) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "deviationId required" }));
        }
        const row = d.deviations.find((r) => r.deviationId === id);
        if (!row) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "deviation not found", id }));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            deviation: {
              id: row.deviationId,
              title: row.title,
              description: row.description,
              severity: row.severity,
              status: row.status,
              domain: row.domain,
              department: row.departmentName,
              reporter: row.reporterName,
              resolver: row.resolverName,
              resolvedAt: row.resolvedAt,
              resolutionNotes: row.resolutionNotes,
              blocksDayApproval: row.blocksDayApproval,
              requiresAction: row.requiresAction,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            },
          }),
        );
      },

      setDeviationsViewMode: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        if (!d.isAdminMode) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "admin-only" }));
        }
        const mode = params.mode === "list" ? "list" : "kanban";
        d.setViewMode(mode);
        return Promise.resolve(JSON.stringify({ ok: true, viewMode: mode }));
      },

      openDeviationDetail: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        if (!d.isAdminMode) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "admin-only" }));
        }
        const id = String(params.deviationId ?? "");
        if (!id) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "deviationId required" }));
        }
        const exists = d.deviations.some((r) => r.deviationId === id);
        if (!exists) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "deviation not found", id }));
        }
        d.openDetail(id);
        return Promise.resolve(JSON.stringify({ ok: true, opened: id }));
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
