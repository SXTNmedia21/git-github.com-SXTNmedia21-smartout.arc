"use client";

import { useMutation } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { muteParticipant } from "@smartout/walkie-talkie";
import { toast } from "sonner";

type MuteParams = {
  channelId: string;
  targetIdentity: string;
  trackSid?: string;
  muted?: boolean;
};

export function useMuteParticipant(profileId: string) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({ channelId, targetIdentity, trackSid, muted }: MuteParams) => {
      const supabase = createClient();
      return muteParticipant(supabase, {
        workspaceId,
        channelId,
        targetIdentity,
        trackSid,
        muted,
      });
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "channel.call.participant_muted",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          channel_id: variables.channelId,
          target_identity: variables.targetIdentity,
          muted: variables.muted ?? true,
        },
        entity: {
          entity_type: "channel",
          entity_id: variables.channelId,
        },
      });
    },
    onError: () => {
      toast.error("Kunne ikke dempe deltaker");
    },
  });
}
