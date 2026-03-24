"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { startCall, getLiveKitToken } from "@smartout/walkie-talkie";
import type { CallType } from "@smartout/walkie-talkie";
import { channelKeys } from "./channel-keys";
import { toast } from "sonner";

type StartCallParams = {
  channelId: string;
  callType: CallType;
  calleeProfileId?: string;
  profileId: string;
};

export function useStartCall() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({ channelId, callType, calleeProfileId }: StartCallParams) => {
      const supabase = createClient();

      const session = await startCall(supabase, {
        channelId,
        workspaceId,
        callType,
        calleeProfileId,
      });

      const token = await getLiveKitToken(supabase, { channelId, workspaceId });

      return { ...session, ...token };
    },

    onSuccess: (data, variables) => {
      void emit({
        event: "channel.call.started",
        workspace_id: workspaceId,
        actor_id: variables.profileId,
        properties: {
          channel_id: variables.channelId,
          call_type: variables.callType,
          call_session_id: data.callSessionId,
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
      toast.error("Kunne ikke starte samtale");
    },
  });
}
