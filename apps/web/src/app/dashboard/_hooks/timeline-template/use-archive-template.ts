"use client";

/**
 * useArchiveTemplate — mutation hook for soft-archiving a timeline template.
 *
 * Calls PATCH /api/timeline-template/<id> with body { is_archived: true }.
 * On success:
 *   - Invalidates all list queries for the scope so SavedTimelinesDropdown
 *     refetches (the archived template disappears from the active list).
 *   - Shows a sonner toast "Arkivert".
 * On error: shows a descriptive toast.
 *
 * Client-side emit(): NOT called here — the capability tool body (archive_template)
 * owns gate_action + UPDATE + emit per ADR-0287.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Archive flow
 * ADR ref:  ADR-0134, ADR-0334
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { timelineTemplateKeys } from "./keys";

export type ArchiveTemplateVars = {
  templateId: string;
  /** Scope context — needed to target the correct list query for invalidation. */
  workspaceId: string;
  scopeType: "team" | "department" | "location" | "shift";
  scopeId: string;
};

export function useArchiveTemplate() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ArchiveTemplateVars>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/timeline-template/${vars.templateId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: true }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
    },

    onSuccess: (_result, vars) => {
      // Invalidate both active and archived list variants for this scope.
      void queryClient.invalidateQueries({
        queryKey: timelineTemplateKeys.list(vars.workspaceId, vars.scopeType, vars.scopeId, false),
      });
      void queryClient.invalidateQueries({
        queryKey: timelineTemplateKeys.list(vars.workspaceId, vars.scopeType, vars.scopeId, true),
      });
      toast.success("Arkivert");
    },

    onError: (err) => {
      toast.error(err.message || "Kunne ikke arkivere mal");
    },
  });
}
