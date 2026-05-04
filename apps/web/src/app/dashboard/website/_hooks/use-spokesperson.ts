"use client";

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { websiteKeys } from "./website-keys";
import { emit, nonEmpty } from "@smartout/telemetry";
import {
  assignSpokesperson,
  revokeSpokesperson,
  respondToSpokesperson,
  getSpokespersonForSection,
} from "../_actions/spokesperson-actions";
import type { SpokespersonRow } from "../_actions/spokesperson-actions";
import type { ContentTask } from "@smartout/website";
import { toast } from "sonner";

export type { SpokespersonRow };

/**
 * Fetches the active spokesperson for a section and exposes assign, revoke,
 * and respond mutations.
 *
 * Query is disabled when sectionId is empty (section not yet persisted).
 */
export function useSpokesperson(sectionId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: websiteKeys.spokesperson(sectionId),
    queryFn: () => getSpokespersonForSection(sectionId),
    enabled: !!sectionId,
    staleTime: 60 * 1000, // 1 minute — approval status changes infrequently
  });

  // ── Assign ──────────────────────────────────────────────────────

  const assign = useMutation({
    mutationFn: async ({
      websiteId,
      newProfileId,
      roleTitle,
      contentTasks,
    }: {
      websiteId: string;
      newProfileId: string;
      roleTitle: string;
      contentTasks: ContentTask[];
    }) => {
      const result = await assignSpokesperson(
        websiteId,
        sectionId,
        newProfileId,
        roleTitle,
        contentTasks,
      );
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "website spokesperson_assigned",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "website_spokesperson",
            entity_id: sectionId,
            entity_label: variables.roleTitle,
          },
          data: { profile_id: variables.newProfileId, role_title: variables.roleTitle },
        },
      });
      queryClient.invalidateQueries({ queryKey: websiteKeys.spokesperson(sectionId) });
      toast.success("Talsperson tilordnet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke tilordne talsperson: ${error.message}`);
    },
  });

  // ── Revoke ──────────────────────────────────────────────────────

  const revoke = useMutation({
    mutationFn: async ({
      websiteId,
      spokespersonId,
    }: {
      websiteId: string;
      spokespersonId: string;
    }) => {
      const result = await revokeSpokesperson(websiteId, spokespersonId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "website spokesperson_revoked",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "website_spokesperson",
            entity_id: sectionId,
          },
          data: { spokesperson_id: variables.spokespersonId },
        },
      });
      queryClient.invalidateQueries({ queryKey: websiteKeys.spokesperson(sectionId) });
      toast.success("Talsperson tilbakekalt");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke tilbakekalle talsperson: ${error.message}`);
    },
  });

  // ── Respond ─────────────────────────────────────────────────────

  const respond = useMutation({
    mutationFn: async ({
      spokespersonId,
      approve,
      declineReason,
    }: {
      spokespersonId: string;
      approve: boolean;
      declineReason?: string;
    }) => {
      const result = await respondToSpokesperson(spokespersonId, approve, declineReason);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_data, variables) => {
      if (variables.approve) {
        void emit({
          event: "website spokesperson_approved",
          workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity: { entity_type: "website_spokesperson", entity_id: sectionId },
            data: { profile_id: profileId ?? "" },
          },
        });
      } else {
        void emit({
          event: "website spokesperson_declined",
          workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity: { entity_type: "website_spokesperson", entity_id: sectionId },
            data: { profile_id: profileId ?? "", reason: variables.declineReason },
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: websiteKeys.spokesperson(sectionId) });
      toast.success(variables.approve ? "Forespørsel godtatt" : "Forespørsel avslått");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke svare på forespørsel: ${error.message}`);
    },
  });

  return {
    spokesperson: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    assign,
    revoke,
    respond,
    // Expose wsId so consumers can pass it to mutations without re-fetching
    wsId: wsId ?? null,
    profileId: profileId ?? null,
  };
}
