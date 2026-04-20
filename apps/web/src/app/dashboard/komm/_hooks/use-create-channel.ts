"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useTranslation } from "@smartout/i18n";
import { emit } from "@smartout/telemetry";
import { channelKeys } from "./channel-keys";
import type { ChannelType } from "./channel-types";
import { toast } from "sonner";

type CreateChannelParams = {
  channelType: ChannelType;
  name?: string;
  memberProfileIds?: string[];
};

export function useCreateChannel(profileId: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const { t } = useTranslation("komm");

  return useMutation({
    mutationFn: async ({ channelType, name, memberProfileIds }: CreateChannelParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_channel", {
        p_workspace_id: workspaceId,
        p_channel_type: channelType,
        p_name: name,
        p_created_by: profileId,
        p_member_profile_ids: memberProfileIds,
      });
      if (error) throw error;
      return data as { channel_id: string; created: boolean };
    },

    onSuccess: (result, variables) => {
      void emit({
        event: "channel.created",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          channel_type: variables.channelType,
          name: variables.name ?? null,
        },
        entity: {
          entity_type: "channel",
          entity_id: result.channel_id,
        },
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.list(workspaceId),
      });
    },

    onError: (error) => {
      const msg = error instanceof Error ? error.message : t("create.error");
      toast.error(msg);
    },
  });
}
