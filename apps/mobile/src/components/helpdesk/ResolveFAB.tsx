/**
 * ResolveFAB — bottom-right circular button that opens the ResolveSheet.
 *
 * Phase 4 visual redesign per Claude Design prototype
 *   docs/design/smartout-design-helpdesk/project/prototype/mobile-screens.jsx:485-497
 *
 * Spec:
 *   - 56×56 circle, positioned bottom 148, right 16 (absolute within screen)
 *   - Fill: radial-gradient at 35 %/25 %
 *     oklch(0.78 0.16 50) → oklch(0.65 0.20 40) → oklch(0.55 0.22 40)
 *   - Shadow: 0 8 20 rgba(249,115,22,0.42) + inset 0 1 0 rgba(255,255,255,0.30)
 *   - White Check icon 22 pt, stroke 2.5
 *   - Pulse (scale 1 ↔ 1.04) on "waiting" status only, honours
 *     `useReducedMotion()`
 *   - `Haptics.impactAsync(Medium)` on press
 *
 * Technical notes:
 *   - expo-linear-gradient does NOT support radial gradients; we approximate
 *     with a diagonal LinearGradient (top-left highlight → bottom-right
 *     shadow) using the same three warm-orange stops. Visually convincing
 *     at 56 pt per the helpdesk-primitives handoff.
 *   - Android: `elevation` only renders the outer shadow — the inset
 *     highlight is simulated by a top-aligned translucent border.
 */

import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TicketStatus } from "@smartout/ui";

export type ResolveFABProps = {
  status: Exclude<TicketStatus, "complete">;
  onPress: () => void;
};

// Prototype stops resolved offline from OKLCH → sRGB (D65) for RN.
// oklch(0.78 0.16 50)  → #f6a668 (warm highlight)
// oklch(0.65 0.20 40)  → #e07438 (brand-orange core)
// oklch(0.55 0.22 40)  → #b85222 (deep shadow)
//
// Typed as a `[string, string, string]` tuple so expo-linear-gradient's
// strict `[ColorValue, ColorValue, ...ColorValue[]]` signature accepts it.
const GRADIENT_STOPS: readonly [string, string, string] = ["#f6a668", "#e07438", "#b85222"];

export function ResolveFAB({ status, onPress }: ResolveFABProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (status === "waiting" && !reduceMotion) {
      scale.value = withRepeat(
        withTiming(1.04, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 240 });
    }
  }, [status, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          // Prototype uses bottom: 148 (above composer + tab bar). On the
          // real device we respect the safe-area inset so the FAB never
          // overlaps the home indicator on notched hardware.
          bottom: 148 + Math.max(0, insets.bottom - 16),
          right: 16,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Løs saken"
        accessibilityHint="Åpner dialog for å løse saken"
        style={styles.pressable}
      >
        <LinearGradient
          // Approximation of radial(circle at 35% 25%, …) via a diagonal
          // linear gradient. Start upper-left (highlight) → end lower-right
          // (shadow). Visually ≈ identical at 56 pt.
          colors={GRADIENT_STOPS}
          locations={[0, 0.55, 1]}
          start={{ x: 0.35, y: 0.25 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Inset-highlight simulation: thin bright top edge, matching
            `inset 0 1px 0 rgba(255,255,255,0.3)` on web. */}
        <View style={styles.insetHighlight} pointerEvents="none" />
        <Check size={22} color="#ffffff" strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    // box-shadow: 0 8px 20px rgba(249,115,22,0.42)
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 20,
    elevation: 10,
  },
  pressable: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  insetHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
});
