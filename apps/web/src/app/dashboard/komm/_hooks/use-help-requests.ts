"use client";

/**
 * use-help-requests.ts — Helpdesk query hooks.
 *
 * ADR-0173 frozen-4: all writes go through the helpdesk_query capability,
 * never directly to deprecated tables. `useCreateHelpRequest` delegates to
 * the `openPrivateTicket` Server Action (helpdesk-channel-actions.ts) which
 * owns gate_action + telemetry per ADR-0099 + ADR-0134.
 *
 * Read path: engine_state (process_id='helpdesk_query_lifecycle') is the
 * canonical ticket store per ADR-0161 + ADR-0165. The deprecated help_request
 * table is no longer queried here.
 *
 * Schema mapping note (BUG-20 / BUG-SIM-05):
 *   - `title` → `summary` (3-200 chars, required).
 *   - `description` has no counterpart in openPrivateTicket. The form field
 *     is retained in HelpDesk.tsx for UX but its value is prepended to
 *     summary (truncated to fit 200 chars) when present, so the information
 *     is not silently dropped.
 *   - `desk_channel_id` is required by the capability tool. HelpDesk.tsx
 *     must supply it via the `deskChannelId` prop; submit is disabled when
 *     missing (orphan-component guard).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useTranslation } from "@smartout/i18n";
import { toast } from "sonner";
import { openPrivateTicket } from "../_actions/helpdesk-channel-actions";

// ── Read shape ────────────────────────────────────────────────────────────

/**
 * Ticket read shape derived from engine_state (ADR-0161 canonical model).
 * Maps engine_state fields to the display surface HelpDesk.tsx expects.
 * `status` values: 'waiting' → 'open', 'active' → 'in_progress',
 * 'complete' → 'resolved', 'error' → 'closed'.
 */
export type HelpRequest = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  resolver_name?: string | null;
};

/**
 * Map engine_state.status → legacy HelpRequest.status values so HelpDesk.tsx
 * display logic needs no changes. 'error' engine states surface as 'closed'
 * since the lifecycle has terminated without resolution.
 */
function mapEngineStatus(status: string): string {
  switch (status) {
    case "waiting":
      return "open";
    case "active":
      return "in_progress";
    case "complete":
      return "resolved";
    default:
      return "closed";
  }
}

// ── useHelpRequests ───────────────────────────────────────────────────────

/**
 * Reads the current profile's helpdesk tickets from engine_state.
 *
 * Replaces the deprecated `help_request` table read per ADR-0161 + ADR-0165.
 * Ticket = engine_state with process_id='helpdesk_query_lifecycle'.
 * `summary` from context becomes the display title; description is derived
 * from context as well (nullable — legacy rows may not carry it).
 */
export function useHelpRequests(profileId: string) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["help-requests", workspaceId, profileId],
    staleTime: 30_000,
    queryFn: async (): Promise<HelpRequest[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("engine_state")
        .select("id, status, context, started_at, completed_at, assignee_id")
        .eq("workspace_id", workspaceId)
        .eq("process_id", "helpdesk_query_lifecycle")
        // Show tickets the current profile opened (as requester), not assignee.
        // context->>requester_profile_id is a JSONB path filter supported by
        // PostgREST via the .eq("column->>key", value) pattern.
        .eq("context->>requester_profile_id", profileId)
        .order("started_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      return (data ?? []).map((row) => {
        const ctx = (row.context as Record<string, unknown> | null) ?? {};
        const summary = (ctx.summary as string | undefined) ?? "Henvendelse";
        return {
          id: row.id,
          title: summary,
          description: null, // openPrivateTicket carries no separate description column
          status: mapEngineStatus(row.status ?? ""),
          resolved_by: (ctx.resolved_by as string | null) ?? null,
          resolved_at: row.completed_at ?? null,
          created_at: row.started_at ?? new Date().toISOString(),
        };
      });
    },
  });
}

// ── useCreateHelpRequest ──────────────────────────────────────────────────

/**
 * Opens a new helpdesk ticket via the `openPrivateTicket` Server Action.
 *
 * ADR-0173: never writes directly to help_request or any table outside the
 * capability tool chain. `openPrivateTicket` owns gate_action + emit().
 *
 * `deskChannelId` is the parent helpdesk-enabled channel ID. If undefined,
 * the mutation is a no-op (HelpDesk.tsx disables the submit button when it
 * has no channel to route to).
 *
 * Schema mapping:
 *   title + description → summary (concatenated, truncated to 200 chars).
 *   requester_profile_id is derived server-side by the Server Action from
 *   the session JWT (ADR-0151 forgery defence) and cross-checked against
 *   the `profileId` param passed here from the client component.
 */
export function useCreateHelpRequest(profileId: string, deskChannelId: string | undefined) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const { t } = useTranslation("komm");

  return useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string }) => {
      if (!deskChannelId) {
        throw new Error("Ingen helpdesk-skranke konfigurert for dette workspace.");
      }

      // Build summary: concatenate title + description (if present), truncate
      // to openPrivateTicket schema max of 200 chars. This preserves the
      // description information rather than silently dropping it.
      const rawSummary = description?.trim()
        ? `${title.trim()} — ${description.trim()}`
        : title.trim();
      const summary = rawSummary.slice(0, 200);

      const result = await openPrivateTicket({
        parent_channel_id: deskChannelId,
        summary,
        requester_profile_id: profileId,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return { id: result.ticket_id };
    },
    onSuccess: () => {
      toast.success(t("helpdesk.create_success"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["help-requests", workspaceId, profileId] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : t("helpdesk.create_error");
      toast.error(message);
    },
  });
}
