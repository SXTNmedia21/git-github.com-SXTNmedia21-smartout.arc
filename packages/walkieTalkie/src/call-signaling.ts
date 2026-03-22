import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import type { CallSignalingEvent, IncomingCall } from "./call-types";

type SignalingCallback = (event: CallSignalingEvent) => void;

/** Subscribe to personal call signaling channel (1:1 invites) */
export function subscribeToPersonalCalls(
  supabase: SupabaseClient,
  workspaceId: string,
  profileId: string,
  onEvent: SignalingCallback,
): RealtimeChannel {
  const channel = supabase.channel(`profile:${workspaceId}:${profileId}:calls`);

  channel.on("broadcast", { event: "call_invite" }, ({ payload }) => {
    onEvent({ type: "call_invite", payload: payload as IncomingCall });
  });

  channel.on("broadcast", { event: "call_accepted" }, ({ payload }) => {
    onEvent({ type: "call_accepted", payload: payload as { callSessionId: string } });
  });

  channel.on("broadcast", { event: "call_rejected" }, ({ payload }) => {
    onEvent({ type: "call_rejected", payload: payload as { callSessionId: string } });
  });

  channel.on("broadcast", { event: "call_cancelled" }, ({ payload }) => {
    onEvent({ type: "call_cancelled", payload: payload as { callSessionId: string } });
  });

  channel.on("broadcast", { event: "call_ended" }, ({ payload }) => {
    onEvent({ type: "call_ended", payload: payload as { callSessionId: string } });
  });

  channel.subscribe();
  return channel;
}

/** Subscribe to channel-level call announcements (group calls) */
export function subscribeToChannelCalls(
  supabase: SupabaseClient,
  workspaceId: string,
  channelId: string,
  onEvent: SignalingCallback,
): RealtimeChannel {
  const channel = supabase.channel(`channel:${workspaceId}:${channelId}:calls`);

  channel.on("broadcast", { event: "group_call_started" }, ({ payload }) => {
    onEvent({
      type: "group_call_started",
      payload: payload as {
        callSessionId: string;
        initiatorName: string;
        roomName: string;
        participantCount: number;
      },
    });
  });

  channel.subscribe();
  return channel;
}
