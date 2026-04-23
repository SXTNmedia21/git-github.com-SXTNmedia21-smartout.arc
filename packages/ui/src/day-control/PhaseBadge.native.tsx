import * as React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { nativeTheme } from "@smartout/design-tokens/native";
import type { UiPhase } from "./types";
import { PHASE_STYLES, type PhaseStyle } from "./phase-styles";

/**
 * PhaseBadge (React Native) — mirrors the web `.tsx` contract using RN
 * primitives and `nativeTheme` hex values resolved from `PhaseStyle.tone`.
 *
 * Dot pulses on `active` via reanimated opacity cycle (respects
 * `useReducedMotion()`). Text stays crisp — only the dot animates.
 *
 * ADR-0158 dual-platform: paired with `PhaseBadge.tsx`. Shared label /
 * tone / pulse metadata lives in `phase-styles.ts`. Metro's default platform
 * resolver picks this file on iOS/Android; `.tsx` ships to web.
 */
export function PhaseBadge({
  phase,
  size = "md",
  style,
}: {
  phase: UiPhase;
  size?: "sm" | "md";
  /** Additional style merged onto the pill container. */
  style?: React.ComponentProps<typeof View>["style"];
}) {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? nativeTheme.dark : nativeTheme.light;
  const phaseStyle = PHASE_STYLES[phase] ?? PHASE_STYLES.upcoming;
  const { bg, fg, dot } = resolveTones(phaseStyle, palette);

  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (!phaseStyle.pulse || reduceMotion) {
      pulse.value = 1;
      return;
    }
    // 2s breathe: 1 → 0.4 → 1, mirrors tailwind `animate-pulse` rhythm.
    pulse.value = withRepeat(
      withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [phaseStyle.pulse, reduceMotion, pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const padding =
    size === "sm"
      ? { paddingHorizontal: 8, paddingVertical: 3 }
      : { paddingHorizontal: 10, paddingVertical: 4 };
  const fontSize = size === "sm" ? 10 : 11;

  return (
    <View
      accessible
      accessibilityLabel={`Status: ${phaseStyle.label}`}
      style={[styles.pill, padding, { backgroundColor: bg }, style]}
    >
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.dot, { backgroundColor: dot }, dotStyle]}
      />
      <Text style={[styles.label, { color: fg, fontSize }]}>{phaseStyle.label.toUpperCase()}</Text>
    </View>
  );
}

/** Shared palette surface (light + dark both conform). */
type Palette = typeof nativeTheme.light | typeof nativeTheme.dark;

/**
 * Map semantic `tone` → concrete hex values for the active colour scheme.
 * Web uses `color-mix(in oklch, var(--*) 12%, transparent)` for the
 * background. RN has no color-mix primitive, so we mix manually via an
 * alpha suffix on the hex (≈ 12% / 14% opacity).
 */
function resolveTones(
  phaseStyle: PhaseStyle,
  palette: Palette,
): { bg: string; fg: string; dot: string } {
  switch (phaseStyle.tone) {
    case "success":
      return { bg: withAlpha(palette.success, 0.12), fg: palette.success, dot: palette.success };
    case "warning":
      return { bg: withAlpha(palette.warning, 0.14), fg: palette.warning, dot: palette.warning };
    case "destructive":
      return {
        bg: withAlpha(palette.destructive, 0.12),
        fg: palette.destructive,
        dot: palette.destructive,
      };
    case "brandOrange":
      return {
        bg: withAlpha(palette.brandOrange, 0.12),
        fg: palette.brandOrange,
        dot: palette.brandOrange,
      };
    case "muted":
    default:
      return { bg: palette.muted, fg: palette.mutedForeground, dot: palette.mutedForeground };
  }
}

/** Convert `#RRGGBB` → `#RRGGBBAA` with numeric alpha 0..1. */
function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  const aa = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${aa}`;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontWeight: "500",
    letterSpacing: 0.6,
  },
});
