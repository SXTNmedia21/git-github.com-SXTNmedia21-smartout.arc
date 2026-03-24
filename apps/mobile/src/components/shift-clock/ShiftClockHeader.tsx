import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { createStyles, useTheme } from "@/theme";
import { formatTime } from "@/components/shift/ShiftCard";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type ShiftClockHeaderProps = {
  shift: ScheduleShift;
  state: "IDLE" | "CLOCKED_IN" | "ON_BREAK" | "SUMMARY";
  activeDurationMinutes: number; // For live timer
};

export function ShiftClockHeader({ shift, state, activeDurationMinutes }: ShiftClockHeaderProps) {
  const styles = useStyles();
  const theme = useTheme();

  // Format elapsed time to HH:MM:SS
  const formatDuration = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = 0; // Simplified for UI without a true per-second ticking hook here
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:00`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.departmentName}>Avdeling / Sone</Text>

      {state === "CLOCKED_IN" && (
        <Animated.View entering={FadeInDown} style={styles.activeContainer}>
          <Text style={styles.timerText}>{formatDuration(activeDurationMinutes)}</Text>
          <View style={styles.badgeContainer}>
            <View style={[styles.statusDot, { backgroundColor: theme.colors.success }]} />
            <Text style={[styles.statusText, { color: theme.colors.success }]}>PÅ VAKT</Text>
          </View>
        </Animated.View>
      )}

      {state === "ON_BREAK" && (
        <Animated.View entering={FadeInDown} style={styles.activeContainer}>
          <Text style={[styles.timerText, { color: theme.colors.warning }]}>
            {formatDuration(activeDurationMinutes)}
          </Text>
          <View style={styles.badgeContainer}>
            <View style={[styles.statusDot, { backgroundColor: theme.colors.warning }]} />
            <Text style={[styles.statusText, { color: theme.colors.warning }]}>PAUSE</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    alignItems: "center",
    paddingVertical: theme.spacing.section,
  },
  departmentName: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.tight,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  activeContainer: {
    alignItems: "center",
  },
  timerText: {
    fontFamily: "Geist Mono",
    fontSize: 48,
    fontWeight: "700",
    color: theme.colors.foreground,
    letterSpacing: -1,
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    marginTop: theme.spacing.element,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
}));
