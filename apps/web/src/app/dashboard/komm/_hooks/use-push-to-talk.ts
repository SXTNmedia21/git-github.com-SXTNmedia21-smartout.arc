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

  const connectPTT = useCallback(() => {
    dispatch("connect");
    // The caller should call this after LiveKit room connects
    dispatch("connected");
  }, []);

  const disconnectPTT = useCallback(() => {
    dispatch("disconnect");
  }, []);

  const onPressStart = useCallback(async () => {
    dispatch("press");
    await setMicEnabled(true);

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
    await setMicEnabled(false);

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

  // Handle keyboard shortcut (Space bar for PTT)
  useEffect(() => {
    if (pttState === "idle" || pttState === "connecting") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && pttState === "connected_muted") {
        e.preventDefault();
        void onPressStart();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && pttState === "talking") {
        e.preventDefault();
        void onPressEnd();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [pttState, onPressStart, onPressEnd]);

  return { pttState, onPressStart, onPressEnd, connectPTT, disconnectPTT };
}
