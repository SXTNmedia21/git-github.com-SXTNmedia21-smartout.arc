/**
 * AIFab — Smartout logo centered in the tab bar.
 *
 * No background circle — just the logo floating cleanly.
 * Drag upward (20px threshold) reveals an AI menu with two options:
 *   - WalkAi voice session
 *   - Botsson text chat
 * Tap without drag → WalkAi voice session (default action).
 */

import React, { useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Mic, MessageCircle } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";

const LOGO_SIZE = 52;
const DRAG_THRESHOLD = 20;
const MENU_SPRING = { damping: 14, stiffness: 160, mass: 1 };

type AIFabProps = {
  onTap?: () => void;
  onLongPress?: () => void;
};

export function AIFab({ onTap, onLongPress }: AIFabProps) {
  const styles = useStyles();
  const _theme = useTheme();
  const router = useRouter();
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const menuOpen = useSharedValue(0);
  const [showMenu, setShowMenu] = useState(false);

  const openMenu = useCallback(() => {
    setShowMenu(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const closeMenu = useCallback(() => {
    setShowMenu(false);
  }, []);

  /** Tap → navigate to shift hub (phase-aware home) */
  const handleGoHome = useCallback(() => {
    Haptics.selectionAsync();
    router.navigate("/(app)/(home)/shift-hub");
  }, [router]);

  const handleVoice = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTap?.();
    setShowMenu(false);
    menuOpen.value = withSpring(0, MENU_SPRING);
    translateY.value = withSpring(0, MENU_SPRING);
  }, [onTap, menuOpen, translateY]);

  const handleChat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress?.();
    setShowMenu(false);
    menuOpen.value = withSpring(0, MENU_SPRING);
    translateY.value = withSpring(0, MENU_SPRING);
  }, [onLongPress, menuOpen, translateY]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only respond to upward drags
      const clampedY = Math.min(0, Math.max(-40, e.translationY));
      translateY.value = clampedY;

      if (clampedY < -DRAG_THRESHOLD && menuOpen.value === 0) {
        menuOpen.value = withSpring(1, MENU_SPRING);
        runOnJS(openMenu)();
      }
    })
    .onEnd(() => {
      if (menuOpen.value > 0.5) {
        // Keep menu open, snap logo to raised position
        translateY.value = withSpring(-20, MENU_SPRING);
      } else {
        translateY.value = withSpring(0, MENU_SPRING);
      }
    });

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
    })
    .onEnd(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      if (menuOpen.value > 0.5) {
        // Menu is open — close it
        menuOpen.value = withSpring(0, MENU_SPRING);
        translateY.value = withSpring(0, MENU_SPRING);
        runOnJS(closeMenu)();
      } else {
        // Menu closed — tap goes home
        runOnJS(handleGoHome)();
      }
    })
    .onFinalize(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    });

  const composed = Gesture.Race(panGesture, tapGesture);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const menuStyle = useAnimatedStyle(() => ({
    opacity: menuOpen.value,
    transform: [
      {
        translateY: interpolate(menuOpen.value, [0, 1], [10, 0], Extrapolation.CLAMP),
      },
      {
        scale: interpolate(menuOpen.value, [0, 1], [0.8, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <View style={styles.container}>
      {/* AI Menu — appears above the logo on drag up */}
      {showMenu && (
        <Animated.View style={[styles.menu, menuStyle]}>
          <Pressable
            onPress={handleVoice}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            accessibilityRole="button"
            accessibilityLabel="WalkAi stemmeassistent"
          >
            <View style={[styles.menuIcon, styles.menuIconVoice]}>
              <Mic size={18} color="#ffffff" strokeWidth={2} />
            </View>
            <Text style={styles.menuLabel}>Snakk</Text>
          </Pressable>

          <Pressable
            onPress={handleChat}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            accessibilityRole="button"
            accessibilityLabel="Botsson tekstchat"
          >
            <View style={[styles.menuIcon, styles.menuIconChat]}>
              <MessageCircle size={18} color="#ffffff" strokeWidth={2} />
            </View>
            <Text style={styles.menuLabel}>Chat</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Logo — no background, just the image */}
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.fab, logoStyle]}>
          <Animated.Image
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

  /* AI Menu */
  menu: {
    position: "absolute",
    bottom: 52,
    flexDirection: "row",
    gap: 16,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.background,
    borderRadius: theme.radius.xl,
    paddingHorizontal: 20,
    paddingVertical: 14,
    ...theme.shadows.lg,
    borderWidth: 1,
    borderColor: theme.isDark ? theme.colors.border : "rgba(0,0,0,0.04)",
  },
  menuItem: {
    alignItems: "center",
    gap: 6,
  },
  menuItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconVoice: {
    backgroundColor: theme.colors.brandOrange,
  },
  menuIconChat: {
    backgroundColor: theme.colors.brandPurple,
  },
  menuLabel: {
    ...theme.typography.micro,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
}));
