/**
 * PunchButton — The most critical interaction in the app.
 *
 * Full-width button that shows "STEMPLE INN" or "STEMPLE UT" based on the
 * current shift phase and active time entry. One touch = done, no confirmation.
 *
 * Uses Heavy haptic feedback and a spring-back press animation via Reanimated
 * to make the interaction feel instant and satisfying.
 */

import React, { useCallback } from "react";
import { Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Pressable } from "react-native";
import * as Haptics from "expo-haptics";

import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useActiveTimeEntry } from "@/hooks/queries/use-active-time-entry";
import { usePunch } from "@/hooks/mutations/use-punch";
import { strings } from "@/constants/strings";
import { createStyles } from "@/theme";

/** Spring config: snappy response, slight overshoot for a punchy feel */
const PRESS_SPRING = { damping: 15, stiffness: 300, mass: 0.8 };

/**
 * Punch clock button. Renders as a full-width, prominently styled button
 * in the thumb zone. Determines punch direction from shift phase and
 * active time entry state.
 *
 * - No active time_entry + has active/next shift → "STEMPLE INN"
 * - Active time_entry (clocked_in) → "STEMPLE UT"
 * - No shift context at all → hidden (returns null)
 */
export function PunchButton() {
  const { phase, activeShift, nextShift, activeTimeEntry } = useShiftPhase();
  const { data: timeEntry } = useActiveTimeEntry();
  const { punchIn, punchOut } = usePunch();

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Determine which time entry to use — shift phase store or fresh query
  const currentTimeEntry = activeTimeEntry ?? timeEntry;
  const isClockedIn = currentTimeEntry?.status === "clocked_in";

  // Determine the shift to punch into
  const shiftForPunch = activeShift ?? nextShift;

  // Hide the button when there's no shift context and not clocked in
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

  const handlePress = async () => {
    // Heavy haptic — this is the most important tap in the app
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (isClockedIn && currentTimeEntry) {
      await punchOut(currentTimeEntry.time_entry_id);
    } else if (shiftForPunch) {
      await punchIn(shiftForPunch.schedule_shift_id);
    }
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
        accessibilityHint={
          isClockedIn ? "Trykk for å stemple ut" : "Trykk for å stemple inn"
        }
      >
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
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    ...theme.shadows.md,
  },
  punchIn: {
    backgroundColor: theme.colors.primary,
  },
  punchOut: {
    backgroundColor: theme.colors.destructive,
  },
  pressed: {
    opacity: 0.9,
  },
  label: {
    ...theme.typography.headline,
    color: "#ffffff",
    letterSpacing: 2,
  },
}));
