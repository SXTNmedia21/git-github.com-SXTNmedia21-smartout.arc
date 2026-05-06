/**
 * AcuteShiftToggle — Layer 3 of "Min tilgjengelighet".
 *
 * Big CTA button "Kan ta ekstra-vakt i dag". On tap we create a `preferred`
 * row with valid_from = today, valid_to = today, rrule = null. The toast
 * feedback is handled by the parent screen (so the accessibility announcement
 * stays consistent). This component owns the visual affordance + haptic.
 *
 * Press animation uses reanimated spring (stiffness=35, damping=22, mass=2.2)
 * — respects `useReducedMotion()` via the Animated primitives.
 */
import React, { useCallback } from "react";
import { Text, Pressable, View, AccessibilityInfo } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Zap, Check } from "lucide-react-native";

import { createStyles, useTheme, withOpacity } from "@/theme";

type AcuteShiftToggleProps = {
  /** True after the row has been enqueued — swaps CTA to confirmation state. */
  isActive: boolean;
  /** True while the mutation runs. */
  isSubmitting: boolean;
  onActivate: () => void;
};

const SPRING = { stiffness: 35, damping: 22, mass: 2.2 };

export function AcuteShiftToggle({ isActive, isSubmitting, onActivate }: AcuteShiftToggleProps) {
  const styles = useStyles();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (isActive || isSubmitting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    AccessibilityInfo.announceForAccessibility(
      "Leder får beskjed. Du stilles tilgjengelig for ekstravakt i dag.",
    );
    onActivate();
  }, [isActive, isSubmitting, onActivate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = reduceMotion ? 1 : withSpring(0.98, SPRING);
  }, [reduceMotion, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = reduceMotion ? 1 : withSpring(1, SPRING);
  }, [reduceMotion, scale]);

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400).springify()} style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Trenger teamet deg i dag?</Text>
        <Text style={styles.subtitle}>Ett trykk — vi sier fra til leder.</Text>
      </View>

      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isActive || isSubmitting}
          style={[styles.button, isActive && styles.buttonActive]}
          accessibilityRole="button"
          accessibilityLabel={
            isActive ? "Aktivert. Leder har fått beskjed." : "Kan ta ekstra-vakt i dag. Aktiver."
          }
          accessibilityState={{ disabled: isActive || isSubmitting }}
        >
          <View style={styles.buttonIcon}>
            {isActive ? (
              <Check size={22} color="#ffffff" strokeWidth={2} />
            ) : (
              <Zap size={22} color="#ffffff" strokeWidth={2} />
            )}
          </View>
          <View style={styles.buttonLabelWrap}>
            <Text style={styles.buttonLabel}>
              {isActive ? "Du er stilt tilgjengelig" : "Kan ta ekstra-vakt i dag"}
            </Text>
            <Text style={styles.buttonMeta}>
              {isActive ? "Leder har fått beskjed" : "Gjelder kun i dag"}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      <Text style={styles.footnote}>
        Akutt-bryteren lager en enkel {"«"}foretrekker-regel{"»"} for i dag. Du kan fjerne den når
        som helst fra dagsvisningen.
      </Text>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  wrap: {
    gap: theme.spacing.md,
    padding: theme.spacing.page,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.brandOrange, 0.06)
      : withOpacity(theme.colors.brandOrange, 0.04),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.15),
    marginBottom: theme.spacing.page,
  },
  header: { gap: 4 },
  title: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  subtitle: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    minHeight: 64,
    paddingHorizontal: theme.spacing.page,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.md,
  },
  buttonActive: {
    backgroundColor: theme.colors.success,
  },
  buttonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  buttonLabelWrap: { flex: 1, gap: 2 },
  buttonLabel: {
    ...theme.typography.bodyBold,
    color: "#ffffff",
  },
  buttonMeta: {
    ...theme.typography.caption,
    color: "rgba(255, 255, 255, 0.85)",
  },

  footnote: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontStyle: "italic",
    lineHeight: 18,
  },
}));
