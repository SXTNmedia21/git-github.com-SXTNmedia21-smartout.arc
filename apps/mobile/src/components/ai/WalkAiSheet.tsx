/**
 * WalkAiSheet — Bottom sheet (75% height) for voice AI interaction.
 *
 * Tap → mic toggles mute/unmute. Shows real-time transcript.
 * Status orb indicates: connecting (pulse), listening (glow),
 * thinking (rotate), speaking (wave).
 *
 * Voice session powered by Ultravox WebRTC (browser context via Expo Web).
 * Text fallback: swipe down to dismiss, long-press FAB for BotssonSheet.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";
import { useWalkAi } from "@/providers/walkai-provider";

type TranscriptEntry = {
  id: string;
  role: "agent" | "user";
  text: string;
  timestamp: number;
};

type WalkAiSheetProps = {
  /** Called when the sheet is dismissed */
  onDismiss: () => void;
};

/** Nordic Split spring physics — stiffness 35, damping 22, mass 2.2 */
const SPRING_CONFIG = { stiffness: 35, damping: 22, mass: 2.2 } as const;

const MIC_SIZE = 64;
const ORB_SIZE = 80;

export const WalkAiSheet = React.forwardRef<GorhomBottomSheet, WalkAiSheetProps>(
  function WalkAiSheet({ onDismiss }, ref) {
    const styles = useStyles();
    const theme = useTheme();
    const { status, startVoiceSession, endSession } = useWalkAi();
    const scrollRef = useRef<ScrollView>(null);

    // Transcript is local state for now — Ultravox WebRTC integration will populate it
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [isMuted, setIsMuted] = useState(false);

    const snapPoints = useMemo(() => ["75%"], []);

    // Status orb animation values
    const orbScale = useSharedValue(1);
    const orbOpacity = useSharedValue(0.6);

    const orbStyle = useAnimatedStyle(() => ({
      transform: [{ scale: orbScale.value }],
      opacity: orbOpacity.value,
    }));

    // Drive orb animation from session status — each state has a distinct visual rhythm
    React.useEffect(() => {
      switch (status) {
        case "connecting":
          // Pulse to signal active connection attempt
          orbScale.value = withRepeat(withTiming(1.2, { duration: 800 }), -1, true);
          orbOpacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
          break;
        case "active":
          // Settle to solid glow when connected
          orbScale.value = withSpring(1, SPRING_CONFIG);
          orbOpacity.value = withTiming(1, { duration: 300 });
          break;
        default:
          // Idle/error — dim and resting
          orbScale.value = withSpring(1, SPRING_CONFIG);
          orbOpacity.value = withTiming(0.6, { duration: 300 });
      }
    }, [status, orbScale, orbOpacity]);

    /** Human-readable status label shown above the orb */
    const statusLabel = useMemo(() => {
      switch (status) {
        case "connecting":
          return "Kobler til...";
        case "active":
          return isMuted ? "Mikrofon av" : "Lytter...";
        case "error":
          return "Feil — prøv igjen";
        default:
          return "Klar";
      }
    }, [status, isMuted]);

    /**
     * Orb color encodes session state at a glance:
     * - warning (amber) = connecting
     * - brandOrange = active and listening
     * - muted (gray) = muted
     * - destructive (red) = error
     */
    const orbColor = useMemo(() => {
      switch (status) {
        case "connecting":
          return theme.colors.warning;
        case "active":
          return isMuted ? theme.colors.muted : theme.colors.brandOrange;
        case "error":
          return theme.colors.destructive;
        default:
          return theme.colors.muted;
      }
    }, [status, isMuted, theme]);

    const handleMicPress = useCallback(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (status === "idle" || status === "error") {
        // Start a fresh voice session
        await startVoiceSession();
      } else if (status === "active") {
        // Toggle mute while session is running
        setIsMuted((prev) => !prev);
      }
    }, [status, startVoiceSession]);

    const handleClose = useCallback(() => {
      endSession();
      onDismiss();
    }, [endSession, onDismiss]);

    const handleChange = useCallback(
      (index: number) => {
        if (index === -1) {
          // Sheet was dragged fully closed
          handleClose();
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      [handleClose],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      [],
    );

    return (
      <GorhomBottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={handleClose}
        onChange={handleChange}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handle}
        backdropComponent={renderBackdrop}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} accessibilityLabel="Lukk" accessibilityRole="button">
              <Text style={styles.closeButton}>✕</Text>
            </Pressable>
            <Text style={styles.headerTitle}>WalkAi</Text>
            {/* Spacer keeps title visually centered */}
            <View style={styles.headerSpacer} />
          </View>

          {/* Transcript — scrollable conversation history */}
          <ScrollView
            ref={scrollRef}
            style={styles.transcript}
            contentContainerStyle={styles.transcriptContent}
            showsVerticalScrollIndicator={false}
          >
            {transcript.length === 0 && (
              <Text style={styles.emptyText}>Trykk på mikrofonen for å starte en samtale</Text>
            )}
            {transcript.map((entry) => (
              <View
                key={entry.id}
                style={[
                  styles.transcriptEntry,
                  entry.role === "user" ? styles.userEntry : styles.agentEntry,
                ]}
              >
                <Text style={styles.transcriptRole}>
                  {entry.role === "agent" ? "WalkAi" : "Du"}
                </Text>
                <Text style={styles.transcriptText}>{entry.text}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Control area — status orb + mic button in thumb zone */}
          <View style={styles.controlArea}>
            <Text style={styles.statusLabel}>{statusLabel}</Text>

            {/* Animated orb — color + pulse encode session state */}
            <Animated.View style={[styles.orb, orbStyle, { backgroundColor: orbColor }]} />

            {/* Large mic button — positioned in thumb zone at bottom of sheet */}
            <Pressable
              onPress={handleMicPress}
              style={({ pressed }) => [
                styles.micButton,
                pressed && styles.micButtonPressed,
                isMuted && status === "active" && styles.micButtonMuted,
              ]}
              accessibilityLabel={isMuted ? "Slå på mikrofon" : "Slå av mikrofon"}
              accessibilityRole="button"
            >
              <Text style={styles.micIcon}>{isMuted ? "🔇" : "🎙"}</Text>
            </Pressable>
          </View>
        </View>
      </GorhomBottomSheet>
    );
  },
);

const useStyles = createStyles((theme) => ({
  sheetBackground: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
  },
  handle: {
    backgroundColor: theme.colors.muted,
    width: 36,
    height: 4,
    borderRadius: theme.radius.full,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.element,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    color: theme.colors.mutedForeground,
    fontSize: 20,
    padding: theme.spacing.tight,
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  // Matches the close button's effective width to keep the title centered
  headerSpacer: {
    width: 36,
  },
  transcript: {
    flex: 1,
  },
  transcriptContent: {
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    gap: theme.spacing.element,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    marginTop: theme.spacing.section,
  },
  transcriptEntry: {
    gap: 2,
  },
  userEntry: {
    alignItems: "flex-end",
  },
  agentEntry: {
    alignItems: "flex-start",
  },
  transcriptRole: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
  },
  transcriptText: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.lg,
    maxWidth: "85%",
    overflow: "hidden",
  },
  controlArea: {
    alignItems: "center",
    paddingVertical: theme.spacing.section,
    gap: theme.spacing.element,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statusLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
  },
  micButton: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.lg,
  },
  micButtonPressed: {
    opacity: 0.8,
  },
  micButtonMuted: {
    backgroundColor: theme.colors.muted,
  },
  micIcon: {
    fontSize: 28,
  },
}));
