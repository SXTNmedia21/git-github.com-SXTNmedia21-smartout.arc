/**
 * Button — Primary, secondary, ghost, and destructive variants.
 * Every press triggers haptic feedback (100ms rule).
 * Supports loading and disabled states.
 */
import React, { useCallback } from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<PressableProps, "style"> & {
  /** Button label */
  title: string;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size preset */
  size?: ButtonSize;
  /** Shows spinner and disables interaction */
  loading?: boolean;
  /** Full-width button */
  fullWidth?: boolean;
  /** Custom style override */
  style?: ViewStyle;
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const styles = useStyles();
  const isDisabled = disabled || loading;

  const handlePress = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
      if (isDisabled) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.(e);
    },
    [isDisabled, onPress],
  );

  const baseStyle = styles[`variant_${variant}` as keyof typeof styles] as ViewStyle;
  const sizeStyle = styles[`size_${size}` as keyof typeof styles] as ViewStyle;
  const textVariant = styles[`text_${variant}` as keyof typeof styles] as TextStyle;
  const textSize = styles[`textSize_${size}` as keyof typeof styles] as TextStyle;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        baseStyle,
        sizeStyle,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "primary" || variant === "destructive"
              ? styles.text_primary.color
              : undefined
          }
        />
      ) : (
        <Text style={[styles.text, textVariant, textSize]}>{title}</Text>
      )}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
  },
  fullWidth: {
    width: "100%",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...theme.typography.bodyBold,
  },

  // Variants
  variant_primary: {
    backgroundColor: theme.colors.primary,
  },
  variant_secondary: {
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  variant_ghost: {
    backgroundColor: "transparent",
  },
  variant_destructive: {
    backgroundColor: theme.colors.destructive,
  },

  // Text variants
  text_primary: {
    color: theme.colors.primaryForeground,
  },
  text_secondary: {
    color: theme.colors.secondaryForeground,
  },
  text_ghost: {
    color: theme.colors.foreground,
  },
  text_destructive: {
    color: theme.colors.primaryForeground,
  },

  // Sizes
  size_sm: {
    paddingVertical: theme.spacing.tight,
    paddingHorizontal: theme.spacing.element,
    minHeight: 36,
  },
  size_md: {
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    minHeight: 44,
  },
  size_lg: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.section,
    minHeight: 52,
  },

  // Text sizes
  textSize_sm: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.semibold,
  },
  textSize_md: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.semibold,
  },
  textSize_lg: {
    ...theme.typography.headline,
  },
}));
