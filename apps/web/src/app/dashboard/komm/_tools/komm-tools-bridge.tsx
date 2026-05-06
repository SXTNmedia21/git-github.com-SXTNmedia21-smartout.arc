"use client";

/**
 * komm-tools-bridge.tsx — registers Botsson tools for the komm
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
 * Action wiring:
 *  - sendMessage  → useSendMessage(activeChannelId, profileId).mutateAsync
 *  - createChat   → useCreateChannel(profileId).mutateAsync (type='direct')
 *  - joinCall     → getLiveKitToken + useActiveCall().joinCall (LiveKit)
 *
 * Mounting:
 *  - One bridge per surface. KanalerClient mounts with surface="channels",
 *    ChatClient mounts with surface="chat". Both register under the same
 *    "komm" source key, so the registry holds the active surface's tools
 *    only — switching surfaces overwrites cleanly.
 */

import { useCallback } from "react";
import { createClient } from "@smartout/supabase/client";
import { getLiveKitToken } from "@smartout/walkie-talkie";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useWorkspace } from "@/lib/workspace-context";
import { useActiveCall } from "@/components/dashboard/ActiveCallProvider";
import { useChannels } from "../_hooks/use-channels";
import { useChannelMessages } from "../_hooks/use-channel-messages";
import { useUnreadCounts } from "../_hooks/use-unread-counts";
import { useMyHelpdeskCount } from "../_hooks/use-my-helpdesk-count";
import { useSendMessage } from "../_hooks/use-send-message";
import { useCreateChannel } from "../_hooks/use-create-channel";
import { gateKommAction } from "../_actions/gate-komm-action";

import { useKommTools, type KommActionResult } from "./use-komm-tools";

type Props = {
  profileId: string;
  surface: "channels" | "chat";
  activeChannelId: string | null;
  /**
   * ADR-0078: channel hint from the parent surface. When "voice", the
   * sendMessage + createChat tool executors will reject immediately before
   * calling any mutation. Undefined = unknown = guard skipped (safe degraded
   * mode when the parent does not propagate this). Wired by KanalerClient /
   * ChatClient, which receive the session channel from BotssonProvider context.
   */
  sessionChannel?: "voice" | "chat";
};

export function KommToolsBridge({ profileId, surface, activeChannelId, sessionChannel }: Props) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  const channelsQ = useChannels();
  const messagesQ = useChannelMessages(activeChannelId);
  const unreadQ = useUnreadCounts();
  const helpdeskQ = useMyHelpdeskCount(profileId);

  const sendMessageM = useSendMessage(activeChannelId, profileId);
  const createChannelM = useCreateChannel(profileId);
  const { joinCall } = useActiveCall();

  const onSendMessage = useCallback(
    async ({
      content,
      replyToId,
    }: {
      content: string;
      replyToId?: string;
    }): Promise<KommActionResult> => {
      const gate = await gateKommAction({
        capability: "komm.send_message",
        channel: sessionChannel ?? "chat",
        entityId: activeChannelId ?? undefined,
      });
      if (!gate.allow) {
        return { ok: false, reason: gate.reason };
      }
      try {
        const result = await sendMessageM.mutateAsync({ content, replyToId });
        return { ok: true, message_id: result.id, channel_id: activeChannelId ?? "" };
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : "send-message feilet" };
      }
    },
    [sendMessageM, activeChannelId, sessionChannel],
  );

  const onCreateChat = useCallback(
    async ({
      otherProfileId,
      name,
    }: {
      otherProfileId: string;
      name?: string;
    }): Promise<KommActionResult> => {
      const gate = await gateKommAction({
        capability: "komm.create_channel",
        channel: sessionChannel ?? "chat",
      });
      if (!gate.allow) {
        return { ok: false, reason: gate.reason };
      }
      try {
        const result = await createChannelM.mutateAsync({
          channelType: "direct",
          name,
          memberProfileIds: [otherProfileId],
        });
        return { ok: true, channel_id: result.channel_id, created: result.created };
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : "create-channel feilet" };
      }
    },
    [createChannelM, sessionChannel],
  );

  const onJoinCall = useCallback(
    async ({
      channelId,
      withVideo,
    }: {
      channelId?: string;
      withVideo?: boolean;
    }): Promise<KommActionResult> => {
      const targetId = channelId ?? activeChannelId;
      if (!targetId) {
        return { ok: false, reason: "Ingen kanal valgt." };
      }
      const channel =
        (channelsQ.data ?? []).flatMap((g) => g.channels).find((c) => c.channel_id === targetId) ??
        null;
      if (!channel) {
        return { ok: false, reason: "Fant ikke kanalen i listen." };
      }
      try {
        const supabase = createClient();
        const { token, serverUrl } = await getLiveKitToken(supabase, {
          channelId: targetId,
          workspaceId,
        });
        joinCall({
          channelId: targetId,
          channelName: channel.name ?? channel.other_member_name ?? "",
          serverUrl,
          token,
          audioPolicy: channel.audio_policy,
          startWithVideo: withVideo === true,
        });
        return { ok: true, channel_id: targetId, withVideo: withVideo === true };
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : "LiveKit auth feilet" };
      }
    },
    [activeChannelId, channelsQ.data, joinCall, workspaceId],
  );

  // Flatten infinite-query pages into a single newest-first message list.
  const activeChannelMessages = (messagesQ.data?.pages ?? []).flat();

  const tools = useKommTools({
    surface,
    channelGroups: channelsQ.data ?? [],
    activeChannelId,
    activeChannelMessages,
    unreadCounts: unreadQ.data ?? [],
    myHelpdeskCount: helpdeskQ.data ?? 0,
    sessionChannel,
    onSendMessage,
    onCreateChat,
    onJoinCall,
  });

  useRegisterTools("komm", tools);

  return null;
}
