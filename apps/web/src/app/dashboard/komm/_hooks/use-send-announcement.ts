"use client";

/**
 * useSendAnnouncement — Posts an announcement-type message to a news channel.
 *
 * Wave A extension: accepts audience targeting payload (targetProfileIds,
 * visibilityScope, audienceKind, audienceLabel) and writes them into
 * the channel_message INSERT. Also fixes pre-existing entity_id bug where
 * channelId was passed instead of the returned message id.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { channelKeys } from "./channel-keys";
import { toast } from "sonner";

type AnnouncementInput = {
  channelId: string;
  content: string;
  profileId: string;
  targetProfileIds?: string[];
  visibilityScope?: "all_members" | "targeted_members";
  audienceKind: "all" | "on_duty" | "department" | "role" | "individuals";
  audienceLabel: string;
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
    }: AnnouncementInput) => {
      const supabase = createClient();
      const clientMessageId = crypto.randomUUID();
      const isTargeted =
        (visibilityScope ?? "all_members") === "targeted_members" &&
        Array.isArray(targetProfileIds) &&
        targetProfileIds.length > 0;

      const { data, error } = await supabase
        .from("channel_message")
        .insert({
          channel_id: channelId,
          workspace_id: workspaceId,
          sender_id: profileId,
          content,
          message_type: "announcement",
          client_message_id: clientMessageId,
          visibility_scope: isTargeted ? "targeted_members" : "all_members",
          target_profile_ids: isTargeted ? targetProfileIds : null,
          system_data: {
            audience_kind: audienceKind,
            audience_label: audienceLabel,
          },
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data, variables) => {
      toast.success(t("nyheter.publish_success"));
      // Fix pre-existing bug: entity_id was channelId, must be the new message id
      const messageId = (data as { id: string } | null)?.id ?? variables.channelId;
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
          notification_mode: "work",
        },
        entity: {
          entity_type: "channel_message",
          entity_id: messageId,
        },
      });
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
