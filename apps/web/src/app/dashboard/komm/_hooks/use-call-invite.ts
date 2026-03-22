"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { respondToInvite } from "@smartout/walkie-talkie";
import { channelKeys } from "./channel-keys";
import { toast } from "sonner";

type RespondParams = {
  callSessionId: string;
  channelId: string;
  responseAction: "accept" | "reject" | "cancel";
  targetProfileId?: string;
  profileId: string;
};

export function useCallInvite() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({
      callSessionId,
      channelId,
      responseAction,
      targetProfileId,
    }: RespondParams) => {
      const supabase = createClient();
      await respondToInvite(supabase, {
        callSessionId,
        workspaceId,
        channelId,
        responseAction,
        targetProfileId,
      });
      return { responseAction };
    },

    onSuccess: (data, variables) => {
      const eventMap = {
        accept: "channel.call.invite_accepted",
        reject: "channel.call.invite_rejected",
        cancel: "channel.call.invite_rejected",
      } as const;

      void emit({
        event: eventMap[data.responseAction],
        workspace_id: workspaceId,
        actor_id: variables.profileId,
        properties: {
          channel_id: variables.channelId,
          call_session_id: variables.callSessionId,
        },
        entity: {
          entity_type: "channel",
          entity_id: variables.channelId,
        },
      });

      queryClient.invalidateQueries({
        queryKey: channelKeys.callStatus(workspaceId, variables.channelId),
      });
    },

    onError: () => {
      toast.error("Kunne ikke svare på samtale");
    },
  });
}
