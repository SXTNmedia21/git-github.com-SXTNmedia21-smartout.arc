/**
 * BotssonSheet — Bottom sheet (75% height) for voice/text AI interaction.
 *
 * Voice mode: tap mic to toggle mute/unmute. Status orb shows session state.
 * Text mode: text input + send button in thumb zone. Same TranscriptPane.
 *
 * Mode is controlled by BotssonProvider.mode — the sheet renders the
 * appropriate control area based on the current mode.
 *
 * Voice session powered by LiveKit (per ADR-0282).
 * Text mode POSTs to /api/emma/chat via BotssonProvider.sendTextMessage.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { X, Mic, MicOff } from "lucide-react-native";
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";
import { useBotsson, type TranscriptEntry, type BotssonIntent } from "@/providers/botsson-provider";
import { TranscriptPane } from "@/components/ai/TranscriptPane";
import { ChatErrorBanner } from "@/components/ai/ChatErrorBanner";
import { MicPermissionDialog } from "@/components/ai/MicPermissionDialog";
import { NetworkRetryBanner } from "@/components/ai/NetworkRetryBanner";

// TranscriptEntry is defined and exported by botsson-provider — imported above.

type BotssonSheetProps = {
  /** Called when the sheet is dismissed */
  onDismiss: () => void;
};

/** Nordic Split spring physics — stiffness 35, damping 22, mass 2.2 */
const SPRING_CONFIG = { stiffness: 35, damping: 22, mass: 2.2 } as const;

/**
 * Derive a human-readable opening prompt from the pending intent.
 * This text is shown as a contextual banner so the employee immediately
 * understands why Botsson opened and what they can discuss.
 *
 * Intentionally plain Norwegian — fits the "Ren og Varm" voice.
 */
function intentPrompt(intent: BotssonIntent): string {
  switch (intent.kind) {
    case "deviation":
      return "Du har en avvik på denne vakten. Vil du at Botsson skal forklare hva som skjedde?";
    case "help":
      return "Hva trenger du hjelp med på denne vakten?";
    default:
      return "Botsson er klar til å hjelpe.";
  }
}

const MIC_SIZE = 64;
const ORB_SIZE = 80;

export const BotssonSheet = React.forwardRef<GorhomBottomSheet, BotssonSheetProps>(
  function BotssonSheet({ onDismiss }, ref) {
    const styles = useStyles();
    const theme = useTheme();
    const {
      status,
      mode,
      isMuted,
      voiceStatus,
      transcript,
      pendingIntent,
      clearIntent,
      startVoiceSession,
      startTextSession,
      endSession,
      setMicrophoneMuted,
      sendTextMessage,
      isSendingText,
      textError,
      micPermissionDenied,
      reconnectPhase,
      reconnectAttempt,
      policyFlipped,
    } = useBotsson();

    // Local text input state — controlled input for the text-mode compose field.
    const [textInput, setTextInput] = useState("");

    /**
     * D1: Track the last sent message so "Prøv igjen" can re-send it.
     * Cleared when the message sends successfully.
     */
    const lastSentRef = useRef<string>("");

    // Snapshot the intent the moment it arrives so the prompt persists for the
    // duration of the sheet session even after clearIntent() fires.
    const capturedIntentRef = useRef<BotssonIntent | null>(null);

    // Consume pendingIntent on mount / when it changes. Clears it so it fires
    // only once — the "one-shot" contract documented on clearIntent.
    useEffect(() => {
      if (pendingIntent) {
        capturedIntentRef.current = pendingIntent;
        clearIntent();
      }
    }, [pendingIntent, clearIntent]);

    // Reset captured intent + text input when the sheet closes.
    useEffect(() => {
      if (status === "idle") {
        capturedIntentRef.current = null;
        setTextInput("");
      }
    }, [status]);

    /**
     * P5 text-mode send handler.
     * 1. Trims and guards empty input.
     * 2. Clears the compose field immediately so the user can type the next message.
     * 3. Delegates to sendTextMessage() which handles optimistic append + rollback.
     */
    const handleSendText = useCallback(async () => {
      const trimmed = textInput.trim();
      if (!trimmed || isSendingText) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // D1: Record the message before clearing the input so retry can re-send.
      lastSentRef.current = trimmed;
      setTextInput("");
      await sendTextMessage(trimmed);
      // D1: On success textError becomes null — banner clears automatically.
    }, [textInput, isSendingText, sendTextMessage]);

    /**
     * D1: Retry handler — re-sends the last failed message.
     * Clears `lastSentRef` only on success (via `textError` watch).
     */
    const handleRetry = useCallback(async () => {
      const last = lastSentRef.current;
      if (!last || isSendingText) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendTextMessage(last);
    }, [isSendingText, sendTextMessage]);

    const snapPoints = useMemo(() => ["75%"], []);

    /**
     * D5: ADR-0366 — all animations gated by useReducedMotion.
     * When reduced motion is requested, animated values are set to their final
     * state immediately (no withRepeat / withTiming transitions).
     */
    const reducedMotion = useReducedMotion();

    // Status orb animation values
    const orbScale = useSharedValue(1);
    const orbOpacity = useSharedValue(0.6);

    const orbStyle = useAnimatedStyle(() => ({
      transform: [{ scale: orbScale.value }],
      opacity: orbOpacity.value,
    }));

    /**
     * D5: Drive orb animation from fine-grained `voiceStatus` (6 states) rather
     * than coarse `status` (3 states). Maps each voice phase to a distinct
     * visual rhythm so employees can read the AI state at a glance:
     *
     *   idle       — dim (0.4 opacity), resting scale 1
     *   connecting — slow pulse (scale 1→1.15, opacity 0.6→1, 900ms cycle)
     *   listening  — bright pulse (scale 1→1.1, opacity 0.85→1, 1400ms cycle)
     *   thinking   — steady bright (opacity 1, scale 1 — "held breath")
     *   speaking   — faster pulse (scale 1→1.12, opacity 0.9→1, 600ms cycle)
     *   error      — dim resting (opacity 0.5) — red tint from orbColor
     *
     * All animations are skipped (final value set directly) when reducedMotion
     * is true per ADR-0366.
     */
    React.useEffect(() => {
      if (mode !== "voice") {
        // Text mode — orb is not shown; reset to idle values.
        orbScale.value = reducedMotion ? 1 : withSpring(1, SPRING_CONFIG);
        orbOpacity.value = reducedMotion ? 0.6 : withTiming(0.6, { duration: 300 });
        return;
      }
      switch (voiceStatus) {
        case "connecting":
          if (reducedMotion) {
            orbScale.value = 1.15;
            orbOpacity.value = 0.8;
          } else {
            orbScale.value = withRepeat(withTiming(1.15, { duration: 900 }), -1, true);
            orbOpacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
          }
          break;
        case "listening":
          if (reducedMotion) {
            orbScale.value = 1;
            orbOpacity.value = 1;
          } else {
            orbScale.value = withRepeat(withTiming(1.1, { duration: 1400 }), -1, true);
            orbOpacity.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
          }
          break;
        case "thinking":
          // Steady — "held breath" between user utterance and agent response.
          orbScale.value = reducedMotion ? 1 : withSpring(1, SPRING_CONFIG);
          orbOpacity.value = reducedMotion ? 1 : withTiming(1, { duration: 200 });
          break;
        case "speaking":
          // Faster pulse to signal TTS output.
          if (reducedMotion) {
            orbScale.value = 1;
            orbOpacity.value = 1;
          } else {
            orbScale.value = withRepeat(withTiming(1.12, { duration: 600 }), -1, true);
            orbOpacity.value = withRepeat(withTiming(1, { duration: 600 }), -1, true);
          }
          break;
        case "error":
          // Dim and resting — red tint from orbColor communicates the state.
          orbScale.value = reducedMotion ? 1 : withSpring(1, SPRING_CONFIG);
          orbOpacity.value = reducedMotion ? 0.5 : withTiming(0.5, { duration: 300 });
          break;
        default:
          // idle
          orbScale.value = reducedMotion ? 1 : withSpring(1, SPRING_CONFIG);
          orbOpacity.value = reducedMotion ? 0.4 : withTiming(0.4, { duration: 300 });
      }
    }, [voiceStatus, mode, reducedMotion, orbScale, orbOpacity]);

    /** Human-readable status label shown above the orb */
    const statusLabel = useMemo(() => {
      if (mode === "text") {
        if (isSendingText) return "Sender...";
        // TODO(i18n): status_text_ready
        return "Skriv en melding";
      }
      // D5: Use fine-grained voiceStatus for the label.
      // TODO(i18n): all voice status labels
      switch (voiceStatus) {
        case "connecting":
          return "Kobler til...";
        case "listening":
          return isMuted ? "Mikrofon av" : "Lytter...";
        case "thinking":
          return "Tenker...";
        case "speaking":
          return "Botsson snakker";
        case "error":
          return "Feil — prøv igjen";
        default:
          return "Klar";
      }
    }, [mode, voiceStatus, isMuted, isSendingText]);

    /**
     * D5: Orb color encodes fine-grained voice state at a glance:
     *   idle       — muted (dim gray)
     *   connecting — warning (amber)
     *   listening  — brandOrange (active attention)
     *   thinking   — warning (amber — agent processing)
     *   speaking   — brandOrange (agent TTS output)
     *   error      — destructive (red)
     *
     * Muted mic override: when active but muted, show muted color regardless
     * of listening/speaking sub-state.
     */
    const orbColor = useMemo(() => {
      if (status === "error" || voiceStatus === "error") return theme.colors.destructive;
      if (isMuted && (voiceStatus === "listening" || voiceStatus === "speaking")) {
        return theme.colors.muted;
      }
      switch (voiceStatus) {
        case "connecting":
          return theme.colors.warning;
        case "listening":
          return theme.colors.brandOrange;
        case "thinking":
          return theme.colors.warning;
        case "speaking":
          return theme.colors.brandOrange;
        default:
          return theme.colors.muted;
      }
    }, [status, voiceStatus, isMuted, theme]);

    const handleMicPress = useCallback(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (status === "idle" || status === "error") {
        // Start a fresh voice session
        await startVoiceSession();
      } else if (status === "active") {
        // Toggle mute — calls muteMic()/unmuteMic() on the LiveKit session
        setMicrophoneMuted(!isMuted);
      }
    }, [status, isMuted, startVoiceSession, setMicrophoneMuted]);

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
              <X size={20} color={theme.colors.mutedForeground} />
            </Pressable>
            <Text style={styles.headerTitle}>Botsson</Text>
            {/* Spacer keeps title visually centered */}
            <View style={styles.headerSpacer} />
          </View>

          {/* Intent banner — shown when sheet opened via openWithIntent */}
          {capturedIntentRef.current ? (
            <View style={styles.intentBanner}>
              <Text style={styles.intentBannerText}>{intentPrompt(capturedIntentRef.current)}</Text>
            </View>
          ) : null}

          {/* D2: Mic permission denial dialog — shown when voice start is denied by OS */}
          {micPermissionDenied ? (
            <MicPermissionDialog
              onSwitchToText={() => {
                startTextSession();
              }}
            />
          ) : null}

          {/* D3: Network reconnect banner — shown during LiveKit exponential backoff */}
          {reconnectPhase !== "idle" ? (
            <NetworkRetryBanner
              phase={reconnectPhase === "retrying" ? "retrying" : "failed"}
              attempt={reconnectPhase === "retrying" ? reconnectAttempt : undefined}
              onSwitchToText={() => {
                startTextSession();
              }}
            />
          ) : null}

          {/* D4: Policy-flip banner — shown when workspace voice policy revoked mid-session */}
          {policyFlipped ? (
            <View
              style={styles.policyBanner}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              accessibilityLabel="Stemme er deaktivert i denne workspace. Bytter til chat."
            >
              <Text style={styles.policyBannerText}>
                {/* TODO(i18n): voice_policy_disabled_message */}
                Stemme er deaktivert i denne workspace. Bytter til chat.
              </Text>
            </View>
          ) : null}

          {/* D1: Chat error banner — shown below transcript on text send failure */}
          {mode === "text" && textError ? (
            <ChatErrorBanner message={textError} onRetry={handleRetry} />
          ) : null}

          {/* Transcript — shared for voice and text turns */}
          <TranscriptPane transcripts={transcript} />

          {/* Control area — mode-conditional: text input OR voice mic */}
          <View style={styles.controlArea}>
            <Text style={styles.statusLabel}>{statusLabel}</Text>

            {mode === "text" ? (
              /* P5 — Text mode compose row */
              <View style={styles.textRow}>
                <TextInput
                  style={styles.textInput}
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder="Skriv en melding..."
                  placeholderTextColor={theme.colors.mutedForeground}
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSendText}
                  editable={!isSendingText}
                  accessibilityLabel="Skriv melding til Botsson"
                />
                <Pressable
                  onPress={handleSendText}
                  disabled={isSendingText || textInput.trim().length === 0}
                  style={({ pressed }) => [
                    styles.sendButton,
                    pressed && styles.sendButtonPressed,
                    (isSendingText || textInput.trim().length === 0) && styles.sendButtonDisabled,
                  ]}
                  accessibilityLabel="Send melding"
                  accessibilityRole="button"
                >
                  <Text style={styles.sendIcon}>{isSendingText ? "…" : "↑"}</Text>
                </Pressable>
              </View>
            ) : (
              /* Voice mode — orb + mic button */
              <>
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
                  {isMuted ? (
                    <MicOff size={28} color={theme.colors.foreground} />
                  ) : (
                    <Mic size={28} color={theme.colors.foreground} />
                  )}
                </Pressable>
              </>
            )}
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
  intentBanner: {
    marginHorizontal: theme.spacing.card,
    marginTop: theme.spacing.element,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.secondary,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.brandOrange,
  },
  intentBannerText: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  // D4: Policy-flip banner — uses warning (amber) to indicate workspace policy change.
  policyBanner: {
    marginHorizontal: theme.spacing.card,
    marginTop: theme.spacing.tight,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.secondary,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning,
  },
  policyBannerText: {
    ...theme.typography.caption,
    color: theme.colors.foreground,
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
  // P5 — text-mode compose row
  textRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingHorizontal: theme.spacing.card,
    width: "100%",
  },
  textInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.sm,
  },
  sendButtonPressed: {
    opacity: 0.8,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.muted,
  },
  sendIcon: {
    ...theme.typography.headline,
    color: theme.colors.background,
    fontSize: 20,
  },
}));
