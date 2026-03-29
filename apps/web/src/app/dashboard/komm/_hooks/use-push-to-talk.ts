"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";
import { pttReducer, createPTTTelemetryDebouncer } from "@smartout/walkie-talkie";
import type { PTTState } from "@smartout/walkie-talkie";
import { emit } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";

type UsePushToTalkReturn = {
  pttState: PTTState;
  onPressStart: () => void;
  onPressEnd: () => void;
  connectPTT: () => void;
  disconnectPTT: () => void;
};

export function usePushToTalk(
  channelId: string | null,
  profileId: string | null,
  setMicEnabled: (enabled: boolean) => Promise<void>,
): UsePushToTalkReturn {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const [pttState, dispatch] = useReducer(pttReducer, "idle" as PTTState);
  const debouncerRef = useRef(createPTTTelemetryDebouncer());

  // H6: Track desired mic state to prevent race conditions on rapid press/release.
  // Each toggle increments the counter; stale operations are discarded.
  const micOpCounterRef = useRef(0);

  const connectPTT = useCallback(() => {
    dispatch("connect");
    dispatch("connected");
  }, []);

  const disconnectPTT = useCallback(() => {
    dispatch("disconnect");
  }, []);

  const onPressStart = useCallback(async () => {
    dispatch("press");
    const opId = ++micOpCounterRef.current;
    try {
      await setMicEnabled(true);
    } catch {
      // If mic enable failed, revert state only if this is still the latest op
      if (micOpCounterRef.current === opId) {
        dispatch("release");
      }
      return;
    }

    if (debouncerRef.current() && channelId && profileId) {
      void emit({
        event: "channel.call.ptt_activated",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: { channel_id: channelId },
        entity: { entity_type: "channel", entity_id: channelId },
      });
    }
  }, [setMicEnabled, channelId, profileId, workspaceId]);

  const onPressEnd = useCallback(async () => {
    dispatch("release");
    const opId = ++micOpCounterRef.current;
    try {
      await setMicEnabled(false);
    } catch {
      if (micOpCounterRef.current === opId) {
        dispatch("press");
      }
      return;
    }

    if (debouncerRef.current() && channelId && profileId) {
      void emit({
        event: "channel.call.ptt_deactivated",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: { channel_id: channelId },
        entity: { entity_type: "channel", entity_id: channelId },
      });
    }
  }, [setMicEnabled, channelId, profileId, workspaceId]);

  // Keyboard shortcut (Space bar for PTT)
  // Use refs for handlers to avoid re-registering listeners on state change (H6: prevents missed keyup)
  const onPressStartRef = useRef(onPressStart);
  const onPressEndRef = useRef(onPressEnd);
  onPressStartRef.current = onPressStart;
  onPressEndRef.current = onPressEnd;

  const pttStateRef = useRef(pttState);
  pttStateRef.current = pttState;

  useEffect(() => {
    if (pttState === "idle" || pttState === "connecting") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && pttStateRef.current === "connected_muted") {
        e.preventDefault();
        void onPressStartRef.current();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && pttStateRef.current === "talking") {
        e.preventDefault();
        void onPressEndRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [pttState === "idle" || pttState === "connecting"]); // Only re-register when entering/leaving PTT mode

  return { pttState, onPressStart, onPressEnd, connectPTT, disconnectPTT };
}
