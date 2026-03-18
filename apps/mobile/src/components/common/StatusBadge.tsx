/**
 * StatusBadge — Colored pill badge for shift/task/profile status.
 * Maps semantic status values to colors from design tokens.
 */
import React from "react";
import { View, Text, type ViewStyle } from "react-native";
import { createStyles, withOpacity, useTheme } from "@/theme";

type StatusVariant =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "muted"
  | "brand";

type StatusBadgeProps = {
  /** Display label */
  label: string;
  /** Visual variant determining color */
  variant?: StatusVariant;
  /** Custom style override */
  style?: ViewStyle;
};

/** Maps variant to background + text colors using theme tokens */
function getVariantColors(
  colors: ReturnType<typeof useTheme>["colors"],
  variant: StatusVariant,
): { bg: string; text: string } {
  switch (variant) {
    case "success":
      return { bg: withOpacity(colors.success, 0.15), text: colors.success };
    case "warning":
      return { bg: withOpacity(colors.warning, 0.15), text: colors.warning };
    case "destructive":
      return { bg: withOpacity(colors.destructive, 0.15), text: colors.destructive };
    case "info":
      return { bg: withOpacity(colors.info, 0.15), text: colors.info };
    case "muted":
      return { bg: colors.muted, text: colors.mutedForeground };
    case "brand":
      return { bg: withOpacity(colors.brandOrange, 0.15), text: colors.brandOrange };
  }
}

export function StatusBadge({ label, variant = "muted", style }: StatusBadgeProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const variantColors = getVariantColors(colors, variant);

  return (
    <View style={[styles.badge, { backgroundColor: variantColors.bg }, style]}>
      <Text style={[styles.text, { color: variantColors.text }]}>{label}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  badge: {
    paddingHorizontal: theme.spacing.tight,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    alignSelf: "flex-start",
  },
  text: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.semibold,
  },
}));
