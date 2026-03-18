/**
 * PunchButton — Navigates to the full-screen punch clock.
 *
 * Full-width button that shows "STEMPLE INN" or "STEMPLE UT" based on the
 * current shift phase. Tapping opens the dedicated punch clock screen
 * where the actual punch in/out happens.
 *
 * Uses haptic feedback and a spring-back press animation via Reanimated.
 */

import React from "react";
import { Text, Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Clock, Fingerprint } from "lucide-react-native";

import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useActiveTimeEntry } from "@/hooks/queries/use-active-time-entry";
import { strings } from "@/constants/strings";
import { createStyles } from "@/theme";

const PRESS_SPRING = { damping: 15, stiffness: 300, mass: 0.8 };

/**
 * Punch clock button on the home screen. Navigates to /(app)/(home)/punch-clock
 * instead of punching inline — the full-screen experience is better.
 */
export function PunchButton() {
  const { phase, activeShift, nextShift, activeTimeEntry } = useShiftPhase();
  const { data: timeEntry } = useActiveTimeEntry();
  const router = useRouter();

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const currentTimeEntry = activeTimeEntry ?? timeEntry;
  const isClockedIn = currentTimeEntry?.status === "clocked_in";
  const shiftForPunch = activeShift ?? nextShift;

  // Hide when there's no shift context and not clocked in
  const shouldShow = isClockedIn || (phase !== "no_shift" && shiftForPunch);
  if (!shouldShow) return null;

  const label = isClockedIn
    ? strings.shift.punchOut.toUpperCase()
    : strings.shift.punchIn.toUpperCase();

  const handlePressIn = () => {
    scale.value = withSpring(0.95, PRESS_SPRING);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, PRESS_SPRING);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(app)/(home)/punch-clock");
  };

  const styles = useStyles();

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.button,
          isClockedIn ? styles.punchOut : styles.punchIn,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Åpner stemplingsklocka"
      >
        {isClockedIn ? (
          <Clock size={22} color="#ffffff" strokeWidth={2} style={styles.icon} />
        ) : (
          <Fingerprint size={22} color="#ffffff" strokeWidth={2} style={styles.icon} />
        )}
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  wrapper: {
    width: "100%",
    paddingHorizontal: theme.spacing.card,
  },
  button: {
    width: "100%",
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: theme.spacing.tight,
    minHeight: 56,
    ...theme.shadows.md,
  },
  punchIn: {
    backgroundColor: theme.colors.brandOrange,
  },
  punchOut: {
    backgroundColor: theme.colors.destructive,
  },
  pressed: {
    opacity: 0.9,
  },
  icon: {
    marginRight: 2,
  },
  label: {
    ...theme.typography.headline,
    color: "#ffffff",
    letterSpacing: 2,
  },
}));
