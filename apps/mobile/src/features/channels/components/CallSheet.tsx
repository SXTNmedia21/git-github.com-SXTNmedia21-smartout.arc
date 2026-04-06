/**
 * CallSheet — Full-screen bottom sheet shown when the user taps the CallBar.
 *
 * Composed of three sections:
 *   Header  — channel name, live indicator + elapsed timer, participant count, minimize button
 *   Body    — ParticipantGrid fed by useCallTracks(room)
 *   Footer  — CallControls with all policy and callback props
 *
 * The sheet always snaps to 95% of screen height so it feels immersive while
 * leaving the status bar visible. Dismissing (pan-down or minimize button) fires
 * onClose, which the parent uses to hide the sheet without ending the call.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { ChevronDown } from "lucide-react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { createStyles, useTheme } from "@/theme";
import { strings } from "@/constants/strings";
import { useCallTracks } from "@/hooks/use-call-tracks";
import { ParticipantGrid } from "./ParticipantGrid";
import { CallControls } from "./CallControls";
import type { AudioPolicy, VideoPolicy, PTTState } from "@smartout/walkie-talkie";
import type { Room } from "livekit-client";

// Snap to near-full-screen so the sheet feels immersive
const SNAP_POINTS = ["95%"];

type Props = {
  room: Room | null;
  channelName: string;
  channelId: string;
  audioPolicy: AudioPolicy;
  videoPolicy: VideoPolicy;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  /** ISO timestamp of when the call started — used to compute elapsed duration */
  callStartedAt: string;
  pttState?: PTTState;
  isTalking?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onPttPressIn?: () => void;
  onPttPressOut?: () => void;
  onEndCall: () => void;
  /** Called when the sheet is dismissed WITHOUT ending the call (minimize / pan-down) */
  onClose: () => void;
};

export function CallSheet({
  room,
  channelName,
  audioPolicy,
  videoPolicy,
  isMicEnabled,
  isCameraEnabled,
  callStartedAt,
  pttState,
  isTalking,
  onToggleMic,
  onToggleCamera,
  onPttPressIn,
  onPttPressOut,
  onEndCall,
  onClose,
}: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const sheetRef = useRef<GorhomBottomSheet>(null);

  // Track data comes from the LiveKit room — returns empty state when room is null (web)
  const { participants, activeSpeakerIdentity, hasAnyVideo } = useCallTracks(room);

  // --- Elapsed call duration (MM:SS) ---
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startMs = new Date(callStartedAt).getTime();

    // Tick every second and recalculate from the original start time so we
    // never drift due to setInterval skew.
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000));
    };

    tick(); // immediate first tick so the display doesn't start at 0
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callStartedAt]);

  const formattedDuration = formatDuration(elapsedSeconds);

  // BottomSheet fires onClose when the sheet pans below index 0 (enablePanDownToClose)
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Calls require native WebRTC — not supported in the web/PWA beta.
  // All hooks above have already run unconditionally (Rules of Hooks compliant).
  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 16, color: "#666", textAlign: "center" }}>
          Samtaler er ikke tilgjengelig i nettleseren.{"\n"}
          Bruk Smartout-appen for video og walkie-talkie.
        </Text>
      </View>
    );
  }

  return (
    <BottomSheet ref={sheetRef} index={0} snapPoints={SNAP_POINTS} onClose={handleClose}>
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Channel name */}
          <Text style={styles.channelName} numberOfLines={1}>
            {channelName}
          </Text>

          {/* Live indicator + duration */}
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.durationText}>{formattedDuration}</Text>
          </View>

          {/* Participant count */}
          <Text style={styles.participantCount}>
            {participants.length} {strings.call.participants}
          </Text>
        </View>

        {/* Minimize button — 48dp target, tapping collapses the sheet */}
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.minimizeButton, pressed && styles.minimizePressed]}
          accessibilityRole="button"
          accessibilityLabel={strings.call.minimize}
          hitSlop={8}
        >
          <ChevronDown size={24} color={theme.colors.foreground} />
        </Pressable>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Body — participant grid fills all available space                   */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.body}>
        <ParticipantGrid
          participants={participants}
          activeSpeakerIdentity={activeSpeakerIdentity}
          hasAnyVideo={hasAnyVideo}
        />
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Footer — call controls                                              */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.footer}>
        <CallControls
          audioPolicy={audioPolicy}
          videoPolicy={videoPolicy}
          isMicEnabled={isMicEnabled}
          isCameraEnabled={isCameraEnabled}
          pttState={pttState}
          isTalking={isTalking}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onPttPressIn={onPttPressIn}
          onPttPressOut={onPttPressOut}
          onEndCall={onEndCall}
        />
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Pure helper — converts total seconds to "MM:SS"
// ---------------------------------------------------------------------------

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = createStyles((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.tight,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flex: 1,
    gap: theme.spacing.xs,
    paddingRight: theme.spacing.tight,
  },
  channelName: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.semibold,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ade80", // green — consistent with CallBar status dot
  },
  durationText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  participantCount: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },

  // Minimum 48dp touch target for minimize
  minimizeButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  minimizePressed: {
    opacity: 0.6,
  },

  body: {
    flex: 1,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingBottom: theme.spacing.lg,
  },
}));
