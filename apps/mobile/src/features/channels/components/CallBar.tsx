/**
 * CallBar — Fixed bottom bar shown during an active call.
 * Displays participant count, active speakers, and mute/end buttons.
 * Stays visible across navigation while in a call.
 */
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Mic, MicOff, PhoneOff } from "lucide-react-native";
import { createStyles, shadows } from "@/theme";
import { strings } from "@/constants/strings";

type Props = {
  participantCount: number;
  isMicEnabled: boolean;
  activeSpeakers: string[];
  onToggleMic: () => void;
  onEndCall: () => void;
  /** Tapping the bar opens the full CallSheet */
  onPress?: () => void;
};

export function CallBar({
  participantCount,
  isMicEnabled,
  activeSpeakers,
  onToggleMic,
  onEndCall,
  onPress,
}: Props) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={strings.call.inCall}
    >
      <View style={styles.container}>
        <View style={styles.info}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>I samtale ({participantCount})</Text>
          {activeSpeakers.length > 0 && (
            <Text style={styles.speakerText} numberOfLines={1}>
              {activeSpeakers.length === 1 ? "1 snakker" : `${activeSpeakers.length} snakker`}
            </Text>
          )}
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={onToggleMic}
            style={({ pressed }) => [
              styles.button,
              !isMicEnabled && styles.buttonMuted,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isMicEnabled ? "Demp mikrofon" : "Sl\u00e5 p\u00e5 mikrofon"}
          >
            {isMicEnabled ? <Mic size={18} color="#fff" /> : <MicOff size={18} color="#fff" />}
          </Pressable>

          <Pressable
            onPress={onEndCall}
            style={({ pressed }) => [styles.endButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Avslutt samtale"
          >
            <PhoneOff size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    borderRadius: theme.radius.lg,
    marginHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.element,
    ...shadows.md,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ade80",
  },
  statusText: {
    ...theme.typography.subheadline,
    color: "#fff",
    fontWeight: theme.fontWeights.medium,
  },
  speakerText: {
    ...theme.typography.caption,
    color: "rgba(255, 255, 255, 0.8)",
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonMuted: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  endButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
}));
