/**
 * ResponsibilityOrb (React Native) — the darkening-orb primitive from
 * Spec §4.1 rendered as SVG with a true RadialGradient (no linear stacking).
 *
 * Phase 1 uses hue 50 + per-status chroma. Phase 2 lerps hue 50→40 and
 * chroma statusChroma→0.18 via `slaProgress`. Pulse is driven by reanimated
 * so it respects `useReducedMotion()` without remounting the view.
 *
 * Kept free of any apps/mobile imports so it stays a pure presentation
 * primitive that `packages/ui` can export.
 */

import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import type { ResponsibilityOrbProps, TicketStatus } from "./types";

const STATUS_CHROMA: Record<TicketStatus, number> = {
  waiting: 0.06,
  active: 0.1,
  complete: 0.04,
};

function resolveChroma(status: TicketStatus, slaProgress?: number): number {
  const base = STATUS_CHROMA[status];
  if (slaProgress === undefined) return base;
  const clamped = Math.min(1, Math.max(0, slaProgress));
  return base + (0.18 - base) * clamped;
}

function resolveHue(slaProgress?: number): number {
  if (slaProgress === undefined) return 50;
  const clamped = Math.min(1, Math.max(0, slaProgress));
  return 50 - 10 * clamped;
}

function shouldPulse(status: TicketStatus, pulse?: boolean): boolean {
  if (pulse !== undefined) return pulse;
  return status === "waiting";
}

export type ResponsibilityOrbNativeProps = ResponsibilityOrbProps & {
  style?: StyleProp<ViewStyle>;
};

export function ResponsibilityOrb({
  status,
  size,
  slaProgress,
  pulse,
  decorative = true,
  style,
}: ResponsibilityOrbNativeProps) {
  const reduceMotion = useReducedMotion();
  const hue = resolveHue(slaProgress);
  const chroma = resolveChroma(status, slaProgress);
  const willPulse = shouldPulse(status, pulse) && !reduceMotion;

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    if (willPulse) {
      scale.value = withRepeat(
        withTiming(1.015, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      opacity.value = withRepeat(
        withTiming(0.82, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 240 });
      opacity.value = withTiming(1, { duration: 240 });
    }
  }, [willPulse, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const innerColor = `oklch(0.72 ${chroma} ${hue})`;
  const midColor = `oklch(0.62 ${chroma * 0.7} ${hue} / 0.55)`;

  return (
    <Animated.View
      style={[{ width: size, height: size }, animatedStyle, style]}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
    >
      <View style={{ width: size, height: size, overflow: "hidden", borderRadius: size / 2 }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="orb-gradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <Stop offset="0%" stopColor={innerColor} stopOpacity={1} />
              <Stop offset="45%" stopColor={midColor} stopOpacity={0.55} />
              <Stop offset="72%" stopColor={midColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#orb-gradient)" />
        </Svg>
      </View>
    </Animated.View>
  );
}
