/**
 * ResolveFAB — bottom-right circular button that opens the ResolveSheet.
 *
 * Spec §3.3 + §3.6: 56pt circular. Shown only when status !== 'complete'
 * AND current user is the assignee. Pulsing breath (scale 1.0↔1.04) only
 * on 'waiting' status and only when reduced motion is off.
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ResponsibilityOrb, type TicketStatus } from "@smartout/ui";
import { createStyles } from "@/theme";
import { nativeTheme } from "@smartout/design-tokens/native";

export type ResolveFABProps = {
  status: Exclude<TicketStatus, "complete">;
  onPress: () => void;
};

export function ResolveFAB({ status, onPress }: ResolveFABProps) {
  const styles = useStyles();
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

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: nativeTheme.helpdesk.spacing.fabOffsetBottom + insets.bottom,
          right: nativeTheme.helpdesk.spacing.fabOffsetRight,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Løs saken"
        accessibilityHint="Åpner dialog for å løse saken"
        style={styles.pressable}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ResponsibilityOrb status={status} size={56} pulse={false} />
        </View>
        <Check size={24} color={styles.icon.color} />
      </Pressable>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: nativeTheme.helpdesk.radii.fab,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  pressable: {
    width: 56,
    height: 56,
    borderRadius: nativeTheme.helpdesk.radii.fab,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  icon: {
    color: theme.colors.foreground,
  },
}));
