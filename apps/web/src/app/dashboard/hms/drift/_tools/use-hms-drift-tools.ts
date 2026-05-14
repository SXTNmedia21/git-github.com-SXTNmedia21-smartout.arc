"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-hms-drift-tools.ts — Botsson tools for /dashboard/hms/drift.
 *
 * Three tools: 1 read, 2 surface-status.
 *   getDriftStatus     — admin|employee mode + date in scope
 *   getDriftInsights   — admin-only — sessions counts, task completion %, deviations
 *   getDriftBlockers   — admin-only — what blocks day approval (blocking deviations + missed + overdue)
 *
 * Admin/employee split:
 *   Employee mode renders DriftTaskList (their own session tasks, fetched
 *   internally). Page does not own that data so tools report status only.
 *   Admin mode owns insights via useDriftInsights — full read.
 *
 * ADR-0151: workspace_id resolved by useDriftInsights server-side.
 * ADR-0238: page does not own a domain chat surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { DriftInsights } from "../../_hooks/use-drift-insights";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type HmsDriftToolInput = {
  isAdminMode: boolean;
  date: string;
  loading: boolean;
  insights: DriftInsights | null;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useHmsDriftTools(input: HmsDriftToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getDriftStatus",
          description:
            "Get the drift surface state — admin or employee mode, and which date is in scope. Use as the first tool when the user asks 'hva ser jeg på drift?', 'hvilken dato vises?', or any orienting question.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getDriftInsights",
          description:
            "Get the admin drift insights — total/active/closed/missed/pending_signoff session counts, task completion percent, total/completed tasks, open deviations, blocking deviations, and overdue tasks. Admin-only. Use when the user asks 'hva er status på drift i dag?', 'hvor mange aktive vakter har vi?', 'er det noe forsinket?', or wants a day-level operational read.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getDriftBlockers",
          description:
            "Get just the items blocking day-approval — count of deviations that block, missed sessions, sessions pending signoff, and overdue tasks. Admin-only. Use when the user asks 'hva blokkerer dagsavslutning?', 'hva må fikses før dagen lukkes?', or 'kan jeg lukke dagen?'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getDriftStatus: () => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            mode: d.isAdminMode ? "admin" : "employee",
            date: d.date,
            loading: d.loading,
            hint: d.isAdminMode
              ? "Admin: ser insights-stripen + sesjonstabellen."
              : "Ansatt: ser kun egen oppgaveliste.",
          }),
        );
      },

      getDriftInsights: () => {
        const d = dataRef.current;
        if (!d.isAdminMode) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "admin-only" }));
        }
        if (d.loading || !d.insights) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            date: d.date,
            insights: d.insights,
          }),
        );
      },

      getDriftBlockers: () => {
        const d = dataRef.current;
        if (!d.isAdminMode) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "admin-only" }));
        }
        if (d.loading || !d.insights) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const i = d.insights;
        const totalBlockers =
          i.blockingDeviations + i.missedSessions + i.pendingSignoffSessions + i.overdueTasks;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            date: d.date,
            totalBlockers,
            canCloseDay: totalBlockers === 0,
            blockers: {
              blockingDeviations: i.blockingDeviations,
              missedSessions: i.missedSessions,
              pendingSignoffSessions: i.pendingSignoffSessions,
              overdueTasks: i.overdueTasks,
            },
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
