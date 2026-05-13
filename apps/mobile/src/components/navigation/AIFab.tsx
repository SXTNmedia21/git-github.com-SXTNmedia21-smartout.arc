/**
 * AIFab — Smartout logo centered in the tab bar.
 *
 * PanResponder-driven gesture surface (ADR-0298 Sortie 4):
 *   Tap (≤5px movement, ≤250ms) → onTap (Kalender anchor per ADR-0268).
 *   Swipe up ≥80px  → onSwipeLayer1 (open AddSheet).
 *   Swipe up ≥160px → onSwipeLayer2 (open AddSheet + BotssonSheet stacked).
 */

import React, { useRef, useMemo } from "react";
import { View, PanResponder, Animated } from "react-native";
import { createStyles } from "@/theme";

// ─── Gesture thresholds ───────────────────────────────────────────────────────

export const LAYER_1_PX = 80;
export const LAYER_2_PX = 160;
export const TAP_MAX_MOVE = 5;
export const TAP_MAX_MS = 250;

// ─── Pure gesture classifier (exported for unit tests) ───────────────────────

/**
 * Classifies a completed gesture based on its displacement and elapsed time.
 *
 * @param dy     Raw dy from PanResponder gestureState (negative = upward swipe)
 * @param dx     Raw dx from PanResponder gestureState
 * @param elapsedMs  Time between grant and release in milliseconds
 * @returns  'tap' | 'layer1' | 'layer2' | 'cancelled'
 */
export function classifyGesture(
  dy: number,
  dx: number,
  elapsedMs: number,
): "tap" | "layer1" | "layer2" | "cancelled" {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  // Upward swipe: dy is negative going up
  const upwardPx = -dy;

  const isTap = absDx < TAP_MAX_MOVE && absDy < TAP_MAX_MOVE && elapsedMs < TAP_MAX_MS;
  if (isTap) return "tap";
  if (upwardPx >= LAYER_2_PX) return "layer2";
  if (upwardPx >= LAYER_1_PX) return "layer1";
  return "cancelled";
}

const LOGO_SIZE = 52;

// ─── Types ────────────────────────────────────────────────────────────────────

type AIFabProps = {
  onTap: () => void;
  onSwipeLayer1: () => void;
  onSwipeLayer2: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AIFab({ onTap, onSwipeLayer1, onSwipeLayer2 }: AIFabProps) {
  const styles = useStyles();
  const scale = useRef(new Animated.Value(1)).current;
  const startTimeRef = useRef<number>(0);

  const scaleDown = () => {
    Animated.timing(scale, {
      toValue: 0.96,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const scaleUp = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,

        onPanResponderGrant: () => {
          startTimeRef.current = Date.now();
          scaleDown();
        },

        onPanResponderRelease: (_evt, gestureState) => {
          scaleUp();

          const elapsed = Date.now() - startTimeRef.current;
          const gesture = classifyGesture(gestureState.dy, gestureState.dx, elapsed);

          if (gesture === "tap") {
            onTap();
          } else if (gesture === "layer2") {
            onSwipeLayer2();
          } else if (gesture === "layer1") {
            onSwipeLayer1();
          }
          // "cancelled" — no-op
        },

        onPanResponderTerminate: () => {
          scaleUp();
        },
      }),
    [onTap, onSwipeLayer1, onSwipeLayer2],
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.fab, { transform: [{ scale }] }]}
        {...panResponder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel="Smartout"
        accessibilityHint="Swipe up to create or talk to Botsson"
      >
        <Animated.Image
          source={require("@assets/smartout-icon.png")}
          style={styles.logoImage}
          accessibilityLabel="Smartout"
        />
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    resizeMode: "contain",
  },
}));
