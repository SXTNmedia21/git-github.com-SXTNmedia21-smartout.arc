/**
 * Punch Clock — Full-screen time registration inspired by landing page FeaturePunchIn.
 *
 * Layout:
 * - Back button (top-left)
 * - Location badge (workspace + department)
 * - Large live clock display
 * - Shift time label ("Vakt starter 07:00" / "På vakt siden 06:58")
 * - Animated punch button (circle with fingerprint/clock icon)
 * - Elapsed time counter (when clocked in)
 * - Confirmation badge after punch
 *
 * Uses Reanimated for press animation and a 1-second timer for the live clock.
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, MapPin, Clock, CheckCircle2, Fingerprint } from "lucide-react-native";

import { createStyles } from "@/theme";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useActiveTimeEntry } from "@/hooks/queries/use-active-time-entry";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { usePunch } from "@/hooks/mutations/use-punch";
import { strings } from "@/constants/strings";

/** Format time as HH:MM:SS with leading zeros */
function formatTime(date: Date): string {
  return date.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Format shift start/end as HH:MM */
function formatShiftTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Calculate elapsed time since punch-in as "Xh Ym" */
function formatElapsed(punchIn: string): string {
  const start = new Date(punchIn).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}t ${minutes}m`;
  return `${minutes}m`;
}

const PRESS_SPRING = { damping: 12, stiffness: 250, mass: 0.8 };

export default function PunchClockScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { phase, activeShift, nextShift, activeTimeEntry: phaseTimeEntry } = useShiftPhase();
  const { data: queryTimeEntry } = useActiveTimeEntry();
  const { data: profile } = useMyProfile();
  const { punchIn, punchOut } = usePunch();

  const currentTimeEntry = phaseTimeEntry ?? queryTimeEntry;
  const isClockedIn = currentTimeEntry?.status === "clocked_in";
  const shiftForPunch = activeShift ?? nextShift;

  // Live clock — update every second
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Punch button animation
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const [justPunched, setJustPunched] = useState(false);

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedRing = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.92, PRESS_SPRING);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING);
  }, [scale]);

  const handlePunch = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Ripple effect
    ringScale.value = 1;
    ringOpacity.value = 0.4;
    ringScale.value = withTiming(2.2, { duration: 600, easing: Easing.out(Easing.cubic) });
    ringOpacity.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });

    // Success bounce
    scale.value = withSequence(
      withSpring(1.08, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );

    if (isClockedIn && currentTimeEntry) {
      await punchOut(currentTimeEntry.time_entry_id);
    } else if (shiftForPunch) {
      await punchIn(shiftForPunch.schedule_shift_id);
    }

    setJustPunched(true);
    setTimeout(() => setJustPunched(false), 3000);
  }, [
    isClockedIn,
    currentTimeEntry,
    shiftForPunch,
    punchIn,
    punchOut,
    scale,
    ringScale,
    ringOpacity,
  ]);

  // Shift label
  const shiftLabel =
    isClockedIn && currentTimeEntry?.punch_in
      ? `${strings.home.onShift} \u2022 ${formatElapsed(currentTimeEntry.punch_in)}`
      : shiftForPunch
        ? `Vakt ${formatShiftTime(shiftForPunch.start_time)} \u2013 ${formatShiftTime(shiftForPunch.end_time)}`
        : "Ingen vakt";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Back button */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={28} color={styles.iconColor.color} strokeWidth={2} />
        </Pressable>
      </View>

      {/* Content centered in the screen */}
      <View style={styles.content}>
        {/* Location badge */}
        <View style={styles.locationBadge}>
          <MapPin size={14} color={styles.mutedColor.color} strokeWidth={1.8} />
          <Text style={styles.locationText}>
            {profile?.workspace_id ? "STRØM MAT & BAR" : "Arbeidsplass"}
          </Text>
        </View>

        {/* Live clock */}
        <Text style={styles.clock}>{formatTime(now)}</Text>

        {/* Shift info */}
        <Text style={styles.shiftLabel}>{shiftLabel}</Text>

        {/* Punch button */}
        <View style={styles.punchContainer}>
          {/* Ripple ring */}
          <Animated.View
            style={[
              styles.rippleRing,
              isClockedIn ? styles.rippleRingOut : styles.rippleRingIn,
              animatedRing,
            ]}
          />

          {/* Main button */}
          <Animated.View style={animatedButton}>
            <Pressable
              onPress={handlePunch}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={[
                styles.punchButton,
                isClockedIn ? styles.punchButtonOut : styles.punchButtonIn,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isClockedIn ? strings.shift.punchOut : strings.shift.punchIn}
            >
              {isClockedIn ? (
                <Clock size={40} color="#ffffff" strokeWidth={1.8} />
              ) : (
                <Fingerprint size={40} color="#ffffff" strokeWidth={1.8} />
              )}
            </Pressable>
          </Animated.View>
        </View>

        {/* Punch label */}
        <Text style={[styles.punchLabel, isClockedIn && styles.punchLabelOut]}>
          {isClockedIn ? strings.shift.punchOut.toUpperCase() : strings.shift.punchIn.toUpperCase()}
        </Text>

        {/* Elapsed time when clocked in */}
        {isClockedIn && currentTimeEntry?.punch_in && (
          <View style={styles.elapsedContainer}>
            <Text style={styles.elapsedLabel}>Tid på jobb</Text>
            <Text style={styles.elapsedValue}>{formatElapsed(currentTimeEntry.punch_in)}</Text>
          </View>
        )}

        {/* Confirmation badge */}
        {justPunched && (
          <View style={styles.confirmBadge}>
            <CheckCircle2 size={16} color="#22c55e" strokeWidth={2} />
            <Text style={styles.confirmText}>
              {isClockedIn ? "Innstemplet" : "Utstemplet"} {formatTime(now)}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  iconColor: {
    color: theme.colors.foreground,
  },
  mutedColor: {
    color: theme.colors.mutedForeground,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.xl,
  },

  /* Location badge */
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.section,
  },
  locationText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
    letterSpacing: 0.5,
  },

  /* Clock display */
  clock: {
    fontSize: 52,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.foreground,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
    marginBottom: theme.spacing.tight,
  },
  shiftLabel: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.lg,
  },

  /* Punch button */
  punchContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 160,
    height: 160,
    marginBottom: theme.spacing.section,
  },
  rippleRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
  },
  rippleRingIn: {
    borderColor: theme.colors.brandOrange,
  },
  rippleRingOut: {
    borderColor: theme.colors.destructive,
  },
  punchButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.lg,
  },
  punchButtonIn: {
    backgroundColor: theme.colors.brandOrange,
  },
  punchButtonOut: {
    backgroundColor: theme.colors.destructive,
  },

  /* Labels */
  punchLabel: {
    ...theme.typography.headline,
    color: theme.colors.brandOrange,
    letterSpacing: 3,
    fontWeight: theme.fontWeights.bold,
    marginBottom: theme.spacing.section,
  },
  punchLabelOut: {
    color: theme.colors.destructive,
  },

  /* Elapsed time */
  elapsedContainer: {
    alignItems: "center",
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  elapsedLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.xs,
  },
  elapsedValue: {
    fontSize: 28,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums"],
  },

  /* Confirmation */
  confirmBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.08)",
  },
  confirmText: {
    ...theme.typography.subheadline,
    color: "#22c55e",
    fontWeight: theme.fontWeights.medium,
  },
}));
