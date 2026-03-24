/**
 * BreakToggle — Standalone break start/end component.
 *
 * When clocked in: shows "Start pause" button.
 * When on break: shows live elapsed break timer in orange with "Avslutt pause" button.
 * Uses haptic feedback on toggle.
 */

import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Coffee, Play } from "lucide-react-native";

import { createStyles, withOpacity } from "@/theme";

type BreakToggleProps = {
  isOnBreak: boolean;
  breakStartTime: string | null;
  onStartBreak: () => void;
  onEndBreak: () => void;
  isLoading?: boolean;
};

/** Format elapsed seconds into MM:SS or HH:MM:SS */
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function BreakToggle({
  isOnBreak,
  breakStartTime,
  onStartBreak,
  onEndBreak,
  isLoading = false,
}: BreakToggleProps) {
  const styles = useStyles();
  const [breakSeconds, setBreakSeconds] = useState(0);

  // Live break timer — ticks every second while on break
  useEffect(() => {
    if (!isOnBreak || !breakStartTime) {
      setBreakSeconds(0);
      return;
    }

    const startMs = new Date(breakStartTime).getTime();
    const tick = () => setBreakSeconds(Math.floor((Date.now() - startMs) / 1000));

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isOnBreak, breakStartTime]);

  if (isOnBreak) {
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onEndBreak();
        }}
        disabled={isLoading}
        style={({ pressed }) => [
          styles.container,
          styles.breakActive,
          pressed && styles.pressed,
          isLoading && styles.disabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Avslutt pause"
      >
        <View style={styles.iconContainerBreak}>
          <Play size={20} color={styles.brandOrangeColor.color} strokeWidth={2} />
        </View>
        <Text style={styles.breakTimer}>{formatElapsed(breakSeconds)}</Text>
        <Text style={styles.breakLabel}>Tilbake fra pause</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onStartBreak();
      }}
      disabled={isLoading}
      style={({ pressed }) => [
        styles.container,
        styles.idle,
        pressed && styles.pressed,
        isLoading && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Start pause"
    >
      <View style={styles.iconContainer}>
        <Coffee size={20} color={styles.warningColor.color} strokeWidth={2} />
      </View>
      <Text style={styles.label}>Pause</Text>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    alignItems: "center" as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 100,
  },

  idle: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
  },

  breakActive: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
    borderColor: withOpacity(theme.colors.brandOrange, 0.25),
  },

  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },

  disabled: {
    opacity: 0.5,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: withOpacity(theme.colors.warning, 0.1),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 4,
  },

  iconContainerBreak: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.15),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 4,
  },

  label: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },

  breakTimer: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.brandOrange,
    fontVariant: ["tabular-nums" as const],
  },

  breakLabel: {
    fontSize: 10,
    color: withOpacity(theme.colors.brandOrange, 0.7),
    marginTop: 2,
  },

  brandOrangeColor: {
    color: theme.colors.brandOrange,
  },

  warningColor: {
    color: theme.colors.warning,
  },
}));
