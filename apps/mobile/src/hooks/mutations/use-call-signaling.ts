/**
 * Call signaling hook for mobile — subscribes to personal and channel-level
 * Realtime Broadcast channels for call invites and announcements.
 * Wraps shared functions from @smartout/walkie-talkie.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  subscribeToPersonalCalls,
  subscribeToChannelCalls,
  type CallSignalingEvent,
  type IncomingCall,
} from "@smartout/walkie-talkie";

type UseCallSignalingParams = {
  workspaceId: string | null;
  profileId: string | null;
  channelId: string | null;
  onIncomingCall?: (call: IncomingCall) => void;
  onCallAccepted?: (callSessionId: string) => void;
  onCallRejected?: (callSessionId: string) => void;
  onCallCancelled?: (callSessionId: string) => void;
  onCallEnded?: (callSessionId: string) => void;
  onGroupCallStarted?: (payload: {
    callSessionId: string;
    initiatorName: string;
    roomName: string;
    participantCount: number;
  }) => void;
};

export function useCallSignaling({
  workspaceId,
  profileId,
  channelId,
  onIncomingCall,
  onCallAccepted,
  onCallRejected,
  onCallCancelled,
  onCallEnded,
  onGroupCallStarted,
}: UseCallSignalingParams) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  // Use refs for callbacks to avoid re-subscribing on every render
  const callbacksRef = useRef({
    onIncomingCall,
    onCallAccepted,
    onCallRejected,
    onCallCancelled,
    onCallEnded,
    onGroupCallStarted,
  });
  callbacksRef.current = {
    onIncomingCall,
    onCallAccepted,
    onCallRejected,
    onCallCancelled,
    onCallEnded,
    onGroupCallStarted,
  };

  const handlePersonalEvent = useCallback((event: CallSignalingEvent) => {
    switch (event.type) {
      case "call_invite":
        setIncomingCall(event.payload);
        callbacksRef.current.onIncomingCall?.(event.payload);
        break;
      case "call_accepted":
        callbacksRef.current.onCallAccepted?.(event.payload.callSessionId);
        break;
      case "call_rejected":
        callbacksRef.current.onCallRejected?.(event.payload.callSessionId);
        break;
      case "call_cancelled":
        setIncomingCall(null);
        callbacksRef.current.onCallCancelled?.(event.payload.callSessionId);
        break;
      case "call_ended":
        setIncomingCall(null);
        callbacksRef.current.onCallEnded?.(event.payload.callSessionId);
        break;
    }
  }, []);

  const handleChannelEvent = useCallback((event: CallSignalingEvent) => {
    if (event.type === "group_call_started") {
      callbacksRef.current.onGroupCallStarted?.(event.payload);
    }
  }, []);

  // Subscribe to personal call signaling
  useEffect(() => {
    if (!workspaceId || !profileId) return;

    const channel: RealtimeChannel = subscribeToPersonalCalls(
      supabase,
      workspaceId,
      profileId,
      handlePersonalEvent,
    );

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, profileId, handlePersonalEvent]);

  // Subscribe to channel call announcements
  useEffect(() => {
    if (!workspaceId || !channelId) return;

    const channel: RealtimeChannel = subscribeToChannelCalls(
      supabase,
      workspaceId,
      channelId,
      handleChannelEvent,
    );

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, channelId, handleChannelEvent]);

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  return { incomingCall, dismissIncomingCall };
}
