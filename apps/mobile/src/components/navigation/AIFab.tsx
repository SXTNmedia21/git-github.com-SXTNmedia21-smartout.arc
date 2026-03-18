/**
 * AIFab — Smartout logo button centered in the tab bar.
 *
 * The logo overflows the circle slightly for a bold, branded feel.
 * Tap → navigate home. Swipe up → QuickActions.
 */

import React, { useCallback } from "react";
import { View, Image } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";

const SWIPE_THRESHOLD = 40;
const FAB_SIZE = 56;
/** Logo extends beyond the circle for visual impact */
const LOGO_SIZE = FAB_SIZE + 16;

type AIFabProps = {
  onPress?: () => void;
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

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      scale.value = withSpring(0.92, { damping: 15, stiffness: 200 });
    })
    .onEnd((event) => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      if (event.translationY < -SWIPE_THRESHOLD) {
        runOnJS(handleSwipeUp)();
      }
    })
    .onFinalize(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handlePress)();
  });

  const composed = Gesture.Race(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.fab, animatedStyle]}>
          <Image
            source={require("@assets/smartout-icon.png")}
            style={styles.logoImage}
            accessibilityLabel="Smartout"
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    alignItems: "center",
    marginTop: -(FAB_SIZE / 2 + 4),
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    // Allow logo to overflow the circle
    overflow: "visible",
    ...theme.shadows.lg,
    borderWidth: 3,
    borderColor: theme.colors.card,
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    resizeMode: "contain",
  },
}));
