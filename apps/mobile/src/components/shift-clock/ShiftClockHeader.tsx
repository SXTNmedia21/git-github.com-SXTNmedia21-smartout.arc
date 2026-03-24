/**
 * ShiftClockHeader — Live elapsed timer, status badge, and shift details.
 *
 * Updates every second via setInterval. Uses monospace font variant for the
 * time display to prevent layout shift. Status badge toggles between
 * green "PA VAKT" and orange "PAUSE" based on break state.
 */

import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from "react-native-reanimated";

import { createStyles, withOpacity } from "@/theme";

type ShiftClockHeaderProps = {
  punchInTime: string;
  isOnBreak: boolean;
  department?: string;
  zone?: string;
};

/** Format seconds into HH:MM:SS */
function formatTimer(seconds: number): { main: string; secs: string } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    main: `${pad(h)}:${pad(m)}`,
    secs: `:${pad(s)}`,
  };
}

export function ShiftClockHeader({
  punchInTime,
  isOnBreak,
  department,
  zone,
}: ShiftClockHeaderProps) {
  const styles = useStyles();
  const [elapsed, setElapsed] = useState(0);

  // Clock digit bounce on tick
  const tickScale = useSharedValue(1);

  useEffect(() => {
    const startMs = new Date(punchInTime).getTime();

    const tick = () => {
      const newElapsed = Math.floor((Date.now() - startMs) / 1000);
      setElapsed(newElapsed);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [punchInTime]);

  // Subtle bounce every second
  useEffect(() => {
    tickScale.value = withSequence(
      withTiming(1.02, { duration: 80 }),
      withSpring(1, { damping: 14, stiffness: 300 }),
    );
  }, [elapsed, tickScale]);

  const tickStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tickScale.value }],
  }));

  const { main, secs } = formatTimer(elapsed);

  const statusBadgeColor = isOnBreak ? styles.brandOrangeColor.color : styles.successColor.color;
  const statusBadgeBg = isOnBreak
    ? styles.brandOrangeBg.backgroundColor
    : styles.successBg.backgroundColor;
  const statusText = isOnBreak ? "PAUSE" : "PA VAKT";

  const punchInFormatted = new Date(punchInTime).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <View style={styles.container}>
      {/* Live elapsed timer */}
      <Animated.View style={[styles.timerRow, tickStyle]}>
        <Text style={styles.timerMain}>{main}</Text>
        <Text style={styles.timerSeconds}>{secs}</Text>
      </Animated.View>

      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusBadgeBg }]}>
        <View style={[styles.statusDot, { backgroundColor: statusBadgeColor }]} />
        <Text style={[styles.statusText, { color: statusBadgeColor }]}>{statusText}</Text>
      </View>

      {/* Punch-in time and department */}
      <Text style={styles.subText}>
        Stemplet inn {punchInFormatted}
        {department ? ` \u00B7 ${department}` : ""}
        {zone ? ` ${zone}` : ""}
      </Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    alignItems: "center" as const,
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.card,
    gap: theme.spacing.tight,
  },

  timerRow: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
  },

  timerMain: {
    fontSize: 56,
    fontWeight: "200" as const,
    color: theme.colors.foreground,
    letterSpacing: 2,
    fontVariant: ["tabular-nums" as const],
  },

  timerSeconds: {
    fontSize: 22,
    fontWeight: "200" as const,
    color: theme.colors.mutedForeground,
    fontVariant: ["tabular-nums" as const],
  },

  statusBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },

  subText: {
    fontSize: 13,
    color: theme.colors.success,
    marginTop: 4,
  },

  brandOrangeColor: {
    color: theme.colors.brandOrange,
  },

  brandOrangeBg: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.15),
  },

  successColor: {
    color: theme.colors.success,
  },

  successBg: {
    backgroundColor: withOpacity(theme.colors.success, 0.15),
  },
}));
