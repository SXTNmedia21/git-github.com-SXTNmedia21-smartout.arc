"use client";

/**
 * useSendAnnouncement — Posts an announcement-type message to a news channel.
 * Used by the ComposeAnnouncement sheet in the Nyheter page.
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
};

export function useSendAnnouncement() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const { t } = useTranslation("komm");

  return useMutation({
    mutationFn: async ({ channelId, content, profileId }: AnnouncementInput) => {
      const supabase = createClient();
      const clientMessageId = crypto.randomUUID();

      const { data, error } = await supabase
        .from("channel_message")
        .insert({
          channel_id: channelId,
          workspace_id: workspaceId,
          sender_id: profileId,
          content,
          message_type: "announcement",
          client_message_id: clientMessageId,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (_data, variables) => {
      toast.success(t("nyheter.publish_success"));
      void emit({
        event: "channel.message.sent",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(variables.profileId, "actor_id"),
        properties: {
          channel_id: variables.channelId,
          origin_type: "human",
          message_type: "announcement",
        },
        entity: {
          entity_type: "channel_message",
          entity_id: variables.channelId,
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
