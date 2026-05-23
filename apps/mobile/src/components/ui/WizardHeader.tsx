/**
 * WizardHeader — 64px sticky top-bar for the clockout wizard.
 *
 * Contains:
 *   - Close X (triggers UnsavedChangesSheet if dirty)
 *   - Truncated department label (1 line)
 *   - Step count "Steg N / M"
 *   - Morphing progress-fill bar (spring 35/22/2.2) — respects
 *     useReducedMotion() by crossfading instead of animating width.
 *
 * `aria-live="polite"` on the step-count region so VO announces the
 * progression but doesn't interrupt the user mid-interaction.
 */
import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";

export type WizardHeaderProps = {
  departmentName: string;
  currentStep: number; // 0-based index
  totalSteps: number;
  onClose: () => void;
  /** If true, the close button triggers the parent's unsaved-changes sheet. */
  hasUnsavedChanges?: boolean;
  /** Prefers reduced motion — crossfade instead of animate width. */
  reducedMotion?: boolean;
};

export function WizardHeader({
  departmentName,
  currentStep,
  totalSteps,
  onClose,
  hasUnsavedChanges = false,
  reducedMotion = false,
}: WizardHeaderProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const progress = Math.min(1, Math.max(0, (currentStep + 1) / totalSteps));
  const widthAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    if (reducedMotion) {
      widthAnim.setValue(progress);
      return;
    }
    Animated.spring(widthAnim, {
      toValue: progress,
      useNativeDriver: false,
      stiffness: 35,
      damping: 22,
      mass: 2.2,
    }).start();
  }, [progress, reducedMotion, widthAnim]);

  const fillWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(1, width - 2)],
  });

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={
            hasUnsavedChanges ? "Lukk — du har ulagrede endringer" : "Lukk wizard"
          }
          hitSlop={12}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <X size={22} color={theme.colors.foreground} />
        </Pressable>
        <Text style={styles.deptLabel} numberOfLines={1} ellipsizeMode="tail">
          {departmentName}
        </Text>
        <View
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Steg ${currentStep + 1} av ${totalSteps}`}
        >
          <Text style={styles.stepCount}>
            {currentStep + 1} / {totalSteps}
          </Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: fillWidth }]} />
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: {
    height: 64,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    justifyContent: "flex-end",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.element,
    gap: theme.spacing.element,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  deptLabel: {
    flex: 1,
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  stepCount: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    minWidth: 42,
    textAlign: "right",
  },
  progressTrack: {
    height: 2,
    backgroundColor: theme.colors.muted,
    width: "100%",
  },
  progressFill: {
    height: 2,
    backgroundColor: theme.colors.brandOrange,
  },
}));
