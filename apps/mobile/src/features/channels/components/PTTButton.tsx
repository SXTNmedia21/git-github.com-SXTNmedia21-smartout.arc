/**
 * PTTButton — Hold-to-talk button for push-to-talk mode.
 * Large thumb-friendly target with visual feedback and haptics.
 * Uses Pressable onPressIn/onPressOut for press detection.
 */
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Mic } from "lucide-react-native";
import { createStyles } from "@/theme";
import type { PTTState } from "@smartout/walkie-talkie";

type Props = {
  pttState: PTTState;
  isTalking: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
};

export function PTTButton({ pttState, isTalking, onPressIn, onPressOut }: Props) {
  const styles = useStyles();
  const isDisabled = pttState === "idle" || pttState === "connecting";

  const stateLabel = {
    idle: "Koble til f\u00f8rst",
    connecting: "Kobler til\u2026",
    connected_muted: "Hold for \u00e5 snakke",
    talking: "Snakker\u2026",
  }[pttState];

  return (
    <View style={styles.container}>
      <Pressable
        onPressIn={isDisabled ? undefined : onPressIn}
        onPressOut={isDisabled ? undefined : onPressOut}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.button,
          isTalking && styles.buttonTalking,
          pressed && !isDisabled && styles.buttonPressed,
          isDisabled && styles.buttonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Push to talk"
        accessibilityState={{ disabled: isDisabled }}
      >
        <Mic size={28} color={isTalking ? "#fff" : isDisabled ? "#999" : "#fff"} />
      </Pressable>
      <Text style={[styles.label, isDisabled && styles.labelDisabled]}>{stateLabel}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonTalking: {
    backgroundColor: "#22c55e",
    transform: [{ scale: 1.1 }],
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.muted,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.medium,
  },
  labelDisabled: {
    color: theme.colors.mutedForeground,
  },
}));
