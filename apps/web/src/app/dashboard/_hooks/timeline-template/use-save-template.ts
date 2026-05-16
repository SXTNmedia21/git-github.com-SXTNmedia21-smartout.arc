"use client";

/**
 * useSaveTemplate — mutation hook for saving a new timeline template.
 *
 * Calls POST /api/timeline-template with the TimelineTemplateSaveSchema body.
 * On success:
 *   - Invalidates the list query for the saved scope so SavedTimelinesDropdown
 *     refetches immediately.
 *   - Shows a sonner toast "Lagret".
 * On error: shows a descriptive toast.
 *
 * Client-side emit(): NOT called here — the BFF delegates to the capability
 * tool body (save_template) which owns gate_action + INSERT + emit per
 * ADR-0287. No double-emit risk.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Save flow
 * ADR ref:  ADR-0134, ADR-0334
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { timelineTemplateKeys } from "./keys";
import type { TimelineTemplateSaveBodyT } from "@smartout/types";

export type SaveTemplateVars = TimelineTemplateSaveBodyT & {
  /** Needed for list invalidation after save. */
  workspaceId: string;
};

export type SaveTemplateResult = {
  ok: true;
  template_id: string;
};

export function useSaveTemplate() {
  const queryClient = useQueryClient();

  return useMutation<SaveTemplateResult, Error, SaveTemplateVars>({
    mutationFn: async (vars) => {
      const res = await fetch("/api/timeline-template", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: vars.name,
          scope_type: vars.scope_type,
          scope_id: vars.scope_id,
          items_json: vars.items_json,
          notes: vars.notes ?? null,
        }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string; template_id?: string };

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      return { ok: true, template_id: data.template_id! };
    },

    onSuccess: (_result, vars) => {
      // Invalidate the list for this exact scope so the dropdown refetches.
      void queryClient.invalidateQueries({
        queryKey: timelineTemplateKeys.list(
          vars.workspaceId,
          vars.scope_type,
          vars.scope_id,
          false, // invalidate both active and archived variants
        ),
      });
      // Also invalidate the archived variant so "Vis arkiverte" is fresh.
      void queryClient.invalidateQueries({
        queryKey: timelineTemplateKeys.list(vars.workspaceId, vars.scope_type, vars.scope_id, true),
      });
      toast.success("Lagret");
    },

    onError: (err) => {
      toast.error(err.message || "Kunne ikke lagre mal");
    },
  });
}
