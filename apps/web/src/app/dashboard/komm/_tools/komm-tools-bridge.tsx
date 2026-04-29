"use client";

/**
 * komm-tools-bridge.tsx — registers Botsson read tools for the komm
 * (channels + chat) surface inside the harness registry.
 *
 * Why a bridge:
 *  - Keeps KanalerClient + ChatClient free from voice-tool registration
 *    bookkeeping.
 *  - Mounts ONLY when a profileId is resolved and the surface is rendered;
 *    when the user navigates away, useRegisterTools auto-unregisters.
 *
 * Data sourcing:
 *  - Re-uses the same TanStack hooks the clients already call (useChannels,
 *    useChannelMessages, useUnreadCounts, useMyHelpdeskCount). Query-key
 *    dedup means there is no extra network cost — the bridge reads from
 *    the same cache entries.
 *
 * Mounting:
 *  - One bridge per surface. KanalerClient mounts with surface="channels",
 *    ChatClient mounts with surface="chat". Both register under the same
 *    "komm" source key, so the registry holds the active surface's tools
 *    only — switching surfaces overwrites cleanly.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useChannels } from "../_hooks/use-channels";
import { useChannelMessages } from "../_hooks/use-channel-messages";
import { useUnreadCounts } from "../_hooks/use-unread-counts";
import { useMyHelpdeskCount } from "../_hooks/use-my-helpdesk-count";

import { useKommTools } from "./use-komm-tools";

type Props = {
  profileId: string;
  surface: "channels" | "chat";
  activeChannelId: string | null;
};

export function KommToolsBridge({ profileId, surface, activeChannelId }: Props) {
  const channelsQ = useChannels();
  const messagesQ = useChannelMessages(activeChannelId);
  const unreadQ = useUnreadCounts();
  const helpdeskQ = useMyHelpdeskCount(profileId);

  // Flatten infinite-query pages into a single newest-first message list.
  const activeChannelMessages = (messagesQ.data?.pages ?? []).flat();

  const tools = useKommTools({
    surface,
    channelGroups: channelsQ.data ?? [],
    activeChannelId,
    activeChannelMessages,
    unreadCounts: unreadQ.data ?? [],
    myHelpdeskCount: helpdeskQ.data ?? 0,
  });

  useRegisterTools("komm", tools);

  return null;
}
