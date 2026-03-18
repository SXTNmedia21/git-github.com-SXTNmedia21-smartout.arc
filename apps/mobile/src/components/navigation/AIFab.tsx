/**
 * AIFab — Circular FAB button centered in the tab bar.
 *
 * Breaks the tab bar line upward (elevated, oversized circle).
 * Tap -> opens Botsson chat sheet (placeholder until Phase 11).
 * Swipe-up -> opens QuickActions menu with context-aware shortcuts.
 *
 * Uses PanResponder for swipe-up detection to avoid gesture conflicts
 * with the tab bar's touch handling.
 */

import React, { useCallback, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";

/** Minimum upward swipe distance (px) to trigger QuickActions */
const SWIPE_THRESHOLD = 40;

/** FAB size — must be larger than tab bar height to "break" the line */
const FAB_SIZE = 56;

type AIFabProps = {
  /** Called on tap — opens Botsson sheet */
  onPress?: () => void;
  /** Called on swipe up — opens QuickActions */
  onSwipeUp?: () => void;
};

export function AIFab({ onPress, onSwipeUp }: AIFabProps) {
  const styles = useStyles();
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  }, [onPress]);

  const handleSwipeUp = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onSwipeUp?.();
  }, [onSwipeUp]);

  // Pan gesture for swipe-up detection
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      scale.value = withSpring(0.92, { damping: 15, stiffness: 200 });
    })
    .onEnd((event) => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      // Negative translationY = upward swipe
      if (event.translationY < -SWIPE_THRESHOLD) {
        runOnJS(handleSwipeUp)();
      }
    })
    .onFinalize(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    });

  // Tap gesture
  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handlePress)();
  });

  // Combine: pan takes priority when swiping, tap fires otherwise
  const composed = Gesture.Race(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.fab, animatedStyle]}>
          <Text style={styles.icon}>S</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    alignItems: "center",
    // Push the FAB above the tab bar line
    marginTop: -(FAB_SIZE / 2 + 4),
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.lg,
    // White border ring for visual separation from tab bar
    borderWidth: 3,
    borderColor: theme.colors.card,
  },
  icon: {
    fontSize: 24,
    fontWeight: theme.fontWeights.bold,
    color: "#ffffff",
  },
}));
