/**
 * Push-to-talk hook for React Native.
 * Wraps the pure PTT state machine from @smartout/walkie-talkie.
 * Provides press/release handlers with haptic feedback for Pressable components.
 */
import { useCallback, useReducer, useRef } from "react";
import * as Haptics from "expo-haptics";
import { pttReducer, createPTTTelemetryDebouncer, type PTTState } from "@smartout/walkie-talkie";

type UsePushToTalkParams = {
  onMicEnable: () => Promise<void>;
  onMicDisable: () => Promise<void>;
  onTelemetryActivate?: () => void;
  onTelemetryDeactivate?: () => void;
};

export function usePushToTalk({
  onMicEnable,
  onMicDisable,
  onTelemetryActivate,
  onTelemetryDeactivate,
}: UsePushToTalkParams) {
  const [pttState, dispatch] = useReducer(pttReducer, "idle" as PTTState);
  const telemetryDebouncerRef = useRef(createPTTTelemetryDebouncer());

  const connect = useCallback(() => {
    dispatch("connect");
  }, []);

  const onConnected = useCallback(() => {
    dispatch("connected");
  }, []);

  const disconnect = useCallback(() => {
    dispatch("disconnect");
  }, []);

  const onPressIn = useCallback(async () => {
    if (pttState !== "connected_muted") return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dispatch("press");
    await onMicEnable();

    if (telemetryDebouncerRef.current()) {
      onTelemetryActivate?.();
    }
  }, [pttState, onMicEnable, onTelemetryActivate]);

  const onPressOut = useCallback(async () => {
    if (pttState !== "talking") return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch("release");
    await onMicDisable();

    if (telemetryDebouncerRef.current()) {
      onTelemetryDeactivate?.();
    }
  }, [pttState, onMicDisable, onTelemetryDeactivate]);

  return {
    pttState,
    connect,
    onConnected,
    disconnect,
    onPressIn,
    onPressOut,
    isTalking: pttState === "talking",
    isConnected: pttState === "connected_muted" || pttState === "talking",
  };
}
