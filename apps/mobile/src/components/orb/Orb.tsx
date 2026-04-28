/**
 * Orb (native) — radial-gradient responsibility indicator for React Native.
 *
 * Design source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:82-105
 * Web twin: apps/web/src/components/helpdesk-orb/Orb.tsx
 *
 * Why the gradient stops are hard-coded RGBA instead of OKLCH:
 *   React Native does not support the `oklch()` color function as of Expo
 *   SDK 52 / expo-linear-gradient 15.x. The four gradient stops per status
 *   are resolved offline from the prototype formula
 *     radial-gradient(circle at 45% 35%,
 *       oklch(0.82 ${chroma} 50)            0%,
 *       oklch(0.72 ${chroma*0.7} 50 / 0.75) 35%,
 *       oklch(0.62 ${chroma*0.4} 50 / 0.35) 60%,
 *       transparent                         75%)
 *   for hue 50 at chroma 0.08 / 0.12 / 0.04 (waiting / active / complete).
 *
 * Why LinearGradient instead of RadialGradient:
 *   expo-linear-gradient ships with Expo by default; a radial gradient
 *   requires a Skia canvas dependency which is disproportionate for Phase
 *   1. The diagonal linear gradient below is a visually acceptable
 *   approximation for small orb sizes (≤ 64pt) and is documented as a
 *   known limitation in HANDOFF-helpdesk-primitives.md.
 *
 * Nordic Split:
 *   - `useReducedMotion()` disables the pulse for assistive users.
 *   - Lucide icon (Check) only.
 */
import { Check } from "lucide-react-native";
import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import type { OrbStatus } from "./types";

// 4-stop gradient per status, resolved offline from the prototype's OKLCH
// formula (hue 50, chroma 0.08 / 0.12 / 0.04). See file header for the exact
// source formula. Values cover lightness 0.82 → transparent.
const STOPS: Record<OrbStatus, [string, string, string, string]> = {
  waiting: [
    "rgba(194, 154, 116, 1)",
    "rgba(166, 127, 91, 0.75)",
    "rgba(125, 94, 65, 0.35)",
    "transparent",
  ],
  active: [
    "rgba(207, 151, 101, 1)",
    "rgba(180, 119, 73, 0.75)",
    "rgba(137, 87, 50, 0.35)",
    "transparent",
  ],
  complete: [
    "rgba(183, 168, 154, 1)",
    "rgba(155, 139, 126, 0.75)",
    "rgba(117, 103, 93, 0.35)",
    "transparent",
  ],
};

export interface OrbProps {
  size?: number;
  status?: OrbStatus;
  pulse?: boolean;
  withCheck?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export function Orb({
  size = 48,
  status = "waiting",
  pulse = false,
  withCheck = false,
  style,
  testID,
  accessibilityLabel,
}: OrbProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (pulse && !reducedMotion) {
      // 2.8s full cycle ≈ 1400ms one-way timing w/ reverse repeat.
      scale.value = withRepeat(
        withTiming(1.06, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      opacity.value = withRepeat(
        withTiming(0.82, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      scale.value = 1;
      opacity.value = 1;
    }
  }, [pulse, reducedMotion, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const colors = STOPS[status];

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: "hidden",
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={colors}
          locations={[0, 0.35, 0.6, 0.75]}
          start={{ x: 0.45, y: 0.35 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      {withCheck && (
        <Check testID="orb-check" size={size * 0.42} strokeWidth={2.25} color="#1c1814" />
      )}
    </View>
  );
}
