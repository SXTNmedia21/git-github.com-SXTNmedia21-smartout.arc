/**
 * PunchButton — Clean, prominent CTA that navigates to the punch clock.
 *
 * Design: rounded pill shape, brand orange for punch-in, muted red for out.
 * Less text, more weight. Icon + short label.
 */

import React from "react";
import { Text, Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Fingerprint, LogOut } from "lucide-react-native";

import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useActiveTimeEntry } from "@/hooks/queries/use-active-time-entry";
import { strings } from "@/constants/strings";
import { useTheme } from "@/theme";

export function PunchButton() {
  const { colors } = useTheme();
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

  // Always show punch button — employees may need ad-hoc punch even without scheduled shifts
  const isIdle = !isClockedIn && phase === "no_shift";

  const label = isClockedIn ? strings.shift.punchOut : strings.shift.punchIn;

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/(app)/(home)/punch-clock");
        }}
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 200 });
        }}
        style={[
          styles.button,
          isClockedIn
            ? { backgroundColor: colors.destructive }
            : isIdle
              ? { backgroundColor: colors.muted }
              : { backgroundColor: colors.brandOrange },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {isClockedIn ? (
          <LogOut size={20} color={colors.primaryForeground} strokeWidth={2} />
        ) : (
          <Fingerprint
            size={20}
            color={isIdle ? colors.mutedForeground : colors.primaryForeground}
            strokeWidth={2}
          />
        )}
        <Text
          style={[
            styles.label,
            { color: isIdle ? colors.mutedForeground : colors.primaryForeground },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = (() => {
  // Static styles — no theme needed for this simple component
  return {
    wrapper: {
      paddingHorizontal: 20,
    },
    button: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 10,
      paddingVertical: 16,
      borderRadius: 14,
      minHeight: 56,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    label: {
      fontSize: 16,
      fontWeight: "600" as const,
      letterSpacing: 0.5,
    },
  };
})();
