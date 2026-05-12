"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace-context";
import { emit, nonEmpty } from "@smartout/telemetry";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { channelKeys } from "./channel-keys";
import { pinMessageAction } from "../_actions/pin-message-action";

type PinInput = {
  messageId: string;
  channelId: string;
  pin: boolean;
  profileId: string;
};

export function usePinMessage() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const { t } = useTranslation("komm");

  return useMutation({
    mutationFn: async ({ messageId, pin }: PinInput) => {
      const result = await pinMessageAction({ messageId, workspaceId, pin });
      if (!result.ok) throw new Error(result.reason);
      return result;
    },

    onSuccess: (_result, variables) => {
      toast.success(variables.pin ? t("nyheter.pin_success") : t("nyheter.unpin_success"));
      void emit({
        event: variables.pin ? "channel.message.pinned" : "channel.message.unpinned",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(variables.profileId, "actor_id"),
        properties: {
          channel_id: variables.channelId,
          message_id: variables.messageId,
        },
        entity: {
          entity_type: "channel_message",
          entity_id: variables.messageId,
        },
      });
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.messages(workspaceId, variables.channelId),
      });
    },

    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("nyheter.pin_error"));
    },
  });
}
