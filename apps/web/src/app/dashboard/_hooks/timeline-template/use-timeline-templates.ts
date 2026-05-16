"use client";

/**
 * useTimelineTemplates — list timeline templates for a workspace + scope.
 *
 * Fetches GET /api/timeline-template?scope_type=...&scope_id=...&include_archived=...
 * Returns the TanStack query object. Callers access `.data` for the templates
 * array, `.isLoading` for the loading state.
 *
 * Key shape (L-stale-tanstack-shape-collision guard):
 *   ["timeline-template", "list", workspaceId, scopeType, scopeId, includeArchived]
 *   This shape is distinct from the "day-control" key family used by
 *   use-day-timeline-events.ts — no cache collision possible.
 *
 * Mobile parity note:
 *   This hook calls the web BFF via fetch(). Mobile can reuse this hook
 *   inside a React-native app that is wrapped in a TanStack QueryClientProvider
 *   and has fetch available (Expo managed workflow). The hook does not use any
 *   web-only API.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Data hooks
 * ADR ref:  ADR-0334
 */

import { useQuery } from "@tanstack/react-query";
import { timelineTemplateKeys } from "./keys";
import type { TimelineTemplateRow } from "@smartout/types";

export type UseTimelineTemplatesArgs = {
  workspaceId: string | null | undefined;
  scopeType: "team" | "department" | "location" | "shift" | null | undefined;
  scopeId: string | null | undefined;
  /** Show archived templates alongside active ones. Default: false. */
  includeArchived?: boolean;
};

export function useTimelineTemplates({
  workspaceId,
  scopeType,
  scopeId,
  includeArchived = false,
}: UseTimelineTemplatesArgs) {
  return useQuery({
    queryKey: timelineTemplateKeys.list(
      workspaceId ?? "",
      scopeType ?? "",
      scopeId ?? "",
      includeArchived,
    ),
    enabled: !!workspaceId && !!scopeType && !!scopeId,
    staleTime: 30_000,
    queryFn: async (): Promise<TimelineTemplateRow[]> => {
      if (!workspaceId || !scopeType || !scopeId) return [];

      const qs = new URLSearchParams({
        scope_type: scopeType,
        scope_id: scopeId,
        include_archived: String(includeArchived),
      });

      const res = await fetch(`/api/timeline-template?${qs.toString()}`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { ok: boolean; templates: TimelineTemplateRow[] };
      return data.templates ?? [];
    },
  });
}
