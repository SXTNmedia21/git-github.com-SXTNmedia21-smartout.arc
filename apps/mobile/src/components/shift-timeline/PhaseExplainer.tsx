/**
 * PhaseExplainer — Tooltip bubble revealed on long-press of a phase.
 *
 * Council 6.4: long-press (400ms) reveals the explainer — tap-toggle was
 * rejected because it clashes with the timeline's selection model. The
 * bubble lives in an overlay layer so it can float above other phases
 * without pushing layout.
 *
 * Explainer copy is i18n-keyed under `shift.timeline.explainer.{phase}`.
 * The bubble is framework-free visually (no Reanimated for entrance — a
 * short fade is enough) because over-animating a passive tooltip reads as
 * noise. Reduced motion users get the same short fade.
 */

import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { nativeTheme } from "@smartout/design-tokens/native";
import { createStyles, useTheme } from "@/theme";
import { useTranslation } from "@smartout/i18n";

import type { ShiftLifecyclePhase } from "./types";

type PhaseExplainerProps = {
  phase: ShiftLifecyclePhase;
  onDismiss: () => void;
};

export function PhaseExplainer({ phase, onDismiss }: PhaseExplainerProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation("shift");
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: nativeTheme.motion.phaseTransitionMs,
      easing: Easing.out(Easing.quad),
    });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`timeline.phase.${phase}`)}
      onPress={onDismiss}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={[styles.bubble, animatedStyle]}>
        <Text style={styles.title}>{t(`timeline.phase.${phase}`)}</Text>
        <Text style={styles.body}>{t(`timeline.explainer.${phase}`)}</Text>
        <View style={[styles.caret, { borderTopColor: theme.colors.foreground }]} />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  bubble: {
    position: "absolute",
    alignSelf: "center",
    top: "20%",
    maxWidth: 320,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    backgroundColor: theme.colors.foreground,
    borderRadius: theme.radius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.background,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.background,
    opacity: 0.9,
  },
  caret: {
    position: "absolute",
    bottom: -6,
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
}));
