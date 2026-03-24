"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { subscribeToPersonalCalls, subscribeToChannelCalls } from "@smartout/walkie-talkie";
import type { CallSignalingEvent, IncomingCall } from "@smartout/walkie-talkie";

export function useCallSignaling(profileId: string | null, channelId: string | null) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const callbackRef = useRef<((event: CallSignalingEvent) => void) | null>(null);

  const handleEvent = useCallback((event: CallSignalingEvent) => {
    switch (event.type) {
      case "call_invite":
        setIncomingCall(event.payload);
        break;
      case "call_accepted":
      case "call_rejected":
      case "call_cancelled":
      case "call_ended":
        setIncomingCall(null);
        break;
      case "group_call_started":
        // Handled by call-realtime (postgres changes), but signal is useful for toast
        break;
    }
  }, []);

  callbackRef.current = handleEvent;

  // Personal signaling (1:1 invites)
  useEffect(() => {
    if (!profileId) return;
    const supabase = createClient();
    const channel = subscribeToPersonalCalls(supabase, workspaceId, profileId, (event) =>
      callbackRef.current?.(event),
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, profileId]);

  // Channel-level signaling (group call announcements)
  useEffect(() => {
    if (!channelId) return;
    const supabase = createClient();
    const channel = subscribeToChannelCalls(supabase, workspaceId, channelId, (event) =>
      callbackRef.current?.(event),
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, channelId]);

  const dismissIncoming = useCallback(() => setIncomingCall(null), []);

  return { incomingCall, dismissIncoming };
}
