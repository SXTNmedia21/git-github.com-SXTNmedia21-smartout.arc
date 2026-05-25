"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { channelKeys } from "./channel-keys";
import { pinMessageAction } from "../_actions/pin-message-action";

type PinInput = {
  messageId: string;
  channelId: string;
  pin: boolean;
};

export function usePinMessage() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const { t } = useTranslation("komm");

  return useMutation({
    mutationFn: async ({ messageId, channelId, pin }: PinInput) => {
      const result = await pinMessageAction({ messageId, channelId, workspaceId, pin });
      if (!result.ok) throw new Error(result.reason);
      return result;
    },

    onSuccess: (_result, variables) => {
      // Emit is now co-located in the pin_message capability tool body (ADR-0415 Path A).
      // Removed fire-and-forget void emit() here — it raced with page unload (BUG-3).
      toast.success(variables.pin ? t("nyheter.pin_success") : t("nyheter.unpin_success"));
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
