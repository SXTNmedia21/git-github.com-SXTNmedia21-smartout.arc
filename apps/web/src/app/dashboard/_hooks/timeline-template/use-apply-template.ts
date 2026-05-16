"use client";

/**
 * useApplyTemplate — mutation hook for applying a template to a target date.
 *
 * Calls POST /api/timeline-template/apply with TimelineTemplateApplySchema body.
 * On success:
 *   - Invalidates the day-timeline-events query for the target date + scope so
 *     the TimelineTab (Dagslinjen) refetches and shows the newly materialized rows.
 *   - Shows a sonner toast with materialized count breakdown.
 * On error: shows a descriptive toast.
 *
 * Day-timeline invalidation key:
 *   The existing hook use-day-timeline-events.ts uses queryKey starting with
 *   ["day-control", "timeline-events", wsId, ...]. We invalidate the entire
 *   day-control/timeline-events slice for the target date by invalidating
 *   the first 4 segments — this catches all scope variants for that date.
 *   (Safe: staleTime on that hook is 30s — a refetch is cheap and correct.)
 *
 * Client-side emit(): NOT called here — the capability tool body (apply_template)
 * owns gate_action + D6 INSERTs + all emits per ADR-0287.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Apply flow
 * ADR ref:  ADR-0134, ADR-0334
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TimelineTemplateApplyBodyT } from "@smartout/types";

export type ApplyTemplateVars = TimelineTemplateApplyBodyT & {
  /** workspaceId + departmentId/scope needed to build the invalidation key. */
  workspaceId: string;
  departmentId: string | null;
  sessionId: string | null;
};

export type ApplyTemplateResult = {
  ok: true;
  materialized: Record<string, number>;
  errors: { code: string; message: string }[];
};

export function useApplyTemplate() {
  const queryClient = useQueryClient();

  return useMutation<ApplyTemplateResult, Error, ApplyTemplateVars>({
    mutationFn: async (vars) => {
      const res = await fetch("/api/timeline-template/apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: vars.template_id,
          target_date: vars.target_date,
          freeform_mapping: vars.freeform_mapping ?? {},
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        materialized?: Record<string, number>;
        errors?: { code: string; message: string }[];
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      return {
        ok: true,
        materialized: data.materialized ?? {},
        errors: data.errors ?? [],
      };
    },

    onSuccess: (result, vars) => {
      // Invalidate day-timeline-events for the target date + scope so Dagslinjen
      // refetches and shows the materialized D6 rows.
      // Key structure from use-day-timeline-events.ts:
      //   ["day-control", "timeline-events", wsId, departmentId, sessionId, dateISO, ...]
      // We invalidate with a partial prefix to catch all scope variants for that date.
      void queryClient.invalidateQueries({
        queryKey: [
          "day-control",
          "timeline-events",
          vars.workspaceId,
          vars.departmentId,
          vars.sessionId,
          vars.target_date,
        ],
        exact: false,
      });

      // Build a human-readable count summary for the toast.
      const entries = Object.entries(result.materialized);
      const summary =
        entries.length > 0
          ? entries.map(([kind, count]) => `${count} ${kind.replace("_", " ")}`).join(", ")
          : "0 elementer";

      toast.success(`Mal brukt — ${summary} opprettet`);
    },

    onError: (err) => {
      toast.error(err.message || "Kunne ikke bruke malen");
    },
  });
}
