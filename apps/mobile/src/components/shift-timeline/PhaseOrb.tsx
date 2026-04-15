/**
 * PhaseOrb — Single warm radial-glow orb for the shift timeline.
 *
 * Council 6.4 (2026-04-15) constraints (locked):
 * - ONE orb, ONE expo-linear-gradient — no SVG, no multi-orb stack.
 * - Two motion vocabularies from nativeTheme.motion:
 *     springAmbient → slow lava-lamp drift around the active phase anchor
 *     springReactive → migration impulse when the active phase changes
 * - Respects Reanimated `useReducedMotion()` — when reduced motion is on,
 *   the orb parks on the active anchor and skips the drift animation.
 *
 * The orb is a positioning layer — the visual is a soft warm glow achieved
 * by a LinearGradient clipped into a rounded square then masked by opacity.
 * The container is absolutely positioned by the parent; this component only
 * animates its internal translate offsets and its anchor index.
 */

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { nativeTheme } from "@smartout/design-tokens/native";

import { PHASE_ORDER, type ShiftLifecyclePhase } from "./types";

type PhaseOrbProps = {
  /** Currently active phase — the orb anchors near this position. */
  activePhase: ShiftLifecyclePhase;
  /** Total vertical extent (px) spanned by the four phase rows. */
  trackHeight: number;
  /** Orb diameter in px. Defaults to 120. */
  size?: number;
  /** Intensity multiplier 0..1 — tune per host surface. */
  intensity?: number;
  /** Direction — vertical (full timeline) or horizontal (compact strip). */
  orientation?: "vertical" | "horizontal";
};

/**
 * Map phase index (0..3) to a 0..1 position along the track.
 * Active phase sits slightly above center of its row (visual weight).
 */
function anchorForPhase(phase: ShiftLifecyclePhase): number {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx < 0) return 0;
  // Four phases → anchors at 0.125 / 0.375 / 0.625 / 0.875 (center of each quarter).
  return (idx + 0.5) / PHASE_ORDER.length;
}

export function PhaseOrb({
  activePhase,
  trackHeight,
  size = 120,
  intensity = 0.85,
  orientation = "vertical",
}: PhaseOrbProps) {
  const reduceMotion = useReducedMotion();

  // 0..1 anchor position along the track.
  const anchor = useSharedValue(anchorForPhase(activePhase));
  // Small oscillation around the anchor — the "lava-lamp" breath.
  const drift = useSharedValue(0);

  // React to phase changes — migrate with a reactive spring.
  useEffect(() => {
    const target = anchorForPhase(activePhase);
    if (reduceMotion) {
      anchor.value = target;
      return;
    }
    anchor.value = withSpring(target, nativeTheme.motion.springReactive);
  }, [activePhase, reduceMotion, anchor]);

  // Ambient drift loop — slow, breath-like.
  useEffect(() => {
    if (reduceMotion) {
      drift.value = 0;
      return;
    }
    const halfPeriod = nativeTheme.motion.orbDriftMs / 2;
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: halfPeriod }),
        withTiming(-1, { duration: halfPeriod }),
      ),
      -1,
      true,
    );
  }, [reduceMotion, drift]);

  const animatedStyle = useAnimatedStyle(() => {
    // Convert 0..1 anchor to pixels along the track.
    const trackPosition = anchor.value * trackHeight;
    // Breath amplitude — ~6% of size feels ambient, never competes with UI.
    const breathAmplitude = size * 0.06;
    const breathOffset = drift.value * breathAmplitude;

    if (orientation === "horizontal") {
      return {
        transform: [
          { translateX: trackPosition - size / 2 + breathOffset },
          { translateY: -size / 2 },
        ],
      };
    }
    return {
      transform: [
        { translateX: -size / 2 + breathOffset * 0.5 },
        { translateY: trackPosition - size / 2 + breathOffset },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.orb, { width: size, height: size, opacity: intensity }, animatedStyle]}
    >
      <LinearGradient
        colors={[nativeTheme.panel.glowWarm, nativeTheme.panel.glowDeep, "transparent"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    borderRadius: 9999,
    overflow: "hidden",
  },
});
