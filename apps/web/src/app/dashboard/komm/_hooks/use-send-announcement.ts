"use client";

/**
 * useSendAnnouncement — Posts an announcement-type message to a news channel.
 *
 * V2 RPC migration: delegates to publish_announcement_atomic RPC (Track C M4)
 * which handles channel_message insert + announcement_meta sidecar atomically.
 * Accepts 5 new V2 fields: kind, tier, tags, linkedEntityType, linkedEntityId.
 *
 * Wave A extension preserved: audience targeting payload (targetProfileIds,
 * visibilityScope, audienceKind, audienceLabel) passed through to RPC.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { channelKeys } from "./channel-keys";
import { toast } from "sonner";

type AnnouncementKind =
  | "staff_event"
  | "system_message"
  | "celebration"
  | "workspace_news"
  | "external_link";

type AnnouncementTier = "social" | "work" | "external";

type AnnouncementLinkedEntityType =
  | "staff_event"
  | "session_task"
  | "engine_process"
  | "channel"
  | "url";

type AnnouncementInput = {
  channelId: string;
  content: string;
  profileId: string;
  targetProfileIds?: string[];
  visibilityScope?: "all_members" | "targeted_members";
  audienceKind: "all" | "on_duty" | "department" | "role" | "individuals";
  audienceLabel: string;
  // V2 fields
  kind?: AnnouncementKind;
  tier?: AnnouncementTier;
  tags?: string[];
  linkedEntityType?: AnnouncementLinkedEntityType;
  linkedEntityId?: string;
};

export function useSendAnnouncement() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const { t } = useTranslation("komm");

  return useMutation({
    mutationFn: async ({
      channelId,
      content,
      profileId,
      targetProfileIds,
      visibilityScope,
      audienceKind,
      audienceLabel,
      kind,
      tier,
      tags,
      linkedEntityType,
      linkedEntityId,
    }: AnnouncementInput) => {
      const supabase = createClient();
      const clientMessageId = crypto.randomUUID();
      const isTargeted =
        (visibilityScope ?? "all_members") === "targeted_members" &&
        Array.isArray(targetProfileIds) &&
        targetProfileIds.length > 0;

      // V2: delegate to publish_announcement_atomic RPC (Track C M4).
      // Atomically inserts channel_message + announcement_meta sidecar in one
      // transaction — avoids partial writes if either insert fails.
      const { data, error } = await supabase.rpc("publish_announcement_atomic", {
        p_workspace_id: workspaceId,
        p_actor_profile_id: profileId,
        p_channel_id: channelId,
        p_content: content,
        p_visibility_scope: isTargeted ? "targeted_members" : "all_members",
        p_target_profile_ids: isTargeted ? (targetProfileIds ?? []) : [],
        p_system_data: { audience_kind: audienceKind, audience_label: audienceLabel },
        p_kind: kind ?? "workspace_news",
        p_tier: tier ?? "work",
        p_tags: tags ?? [],
        p_linked_entity_type: linkedEntityType ?? null,
        p_linked_entity_id: linkedEntityId ?? null,
        p_client_message_id: clientMessageId,
      });

      if (error) throw error;
      return { id: data as string };
    },

    onSuccess: (data, variables) => {
      toast.success(t("nyheter.publish_success"));
      void emit({
        event: "channel.message.sent",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(variables.profileId, "actor_id"),
        properties: {
          channel_id: variables.channelId,
          origin_type: "human",
          message_type: "announcement",
          visibility_scope:
            (variables.visibilityScope ?? "all_members") === "targeted_members" &&
            (variables.targetProfileIds?.length ?? 0) > 0
              ? "targeted_members"
              : "all_members",
          target_profile_count: variables.targetProfileIds?.length ?? 0,
          audience_kind: variables.audienceKind,
          notification_priority: 1,
          // V2 extended properties
          notification_mode: variables.tier ?? "work",
          announcement_kind: variables.kind ?? "workspace_news",
          announcement_tier: variables.tier ?? "work",
          has_entity_link: !!(variables.linkedEntityType && variables.linkedEntityId),
          tag_count: (variables.tags ?? []).length,
        },
        entity: {
          entity_type: "channel_message",
          entity_id: data.id,
        },
      });
      // TODO(Track F): add secondary emit for `announcement.published` once
      // telemetry registry is extended with that event (Track F deliverable).
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.messages(workspaceId, variables.channelId),
      });
      queryClient.invalidateQueries({
        queryKey: channelKeys.list(workspaceId),
      });
    },

    onError: () => {
      toast.error(t("nyheter.publish_error"));
    },
  });
}
