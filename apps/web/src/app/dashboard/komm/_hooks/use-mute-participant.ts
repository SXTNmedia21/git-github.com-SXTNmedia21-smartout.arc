"use client";

import { useMutation } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { muteParticipant } from "@smartout/walkie-talkie";
import { toast } from "sonner";

type MuteParams = {
  channelId: string;
  targetIdentity: string;
  trackSid?: string;
  muted?: boolean;
};

export function useMuteParticipant() {
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
    onError: () => {
      toast.error("Kunne ikke dempe deltaker");
    },
  });
}
