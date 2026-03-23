/**
 * Badge — Small count indicator for unread messages, notifications.
 * Renders as a pill with a number. Hides when count is 0.
 */
import React from "react";
import { View, Text, type ViewStyle } from "react-native";
import { createStyles } from "@/theme";

type BadgeProps = {
  /** Number to display. Badge hides when 0 or undefined. */
  count?: number;
  /** Maximum displayed value — shows "99+" when exceeded */
  max?: number;
  /** Custom style override */
  style?: ViewStyle;
};

export function Badge({ count, max = 99, style }: BadgeProps) {
  const styles = useStyles();

  if (!count || count <= 0) return null;

  const displayText = count > max ? `${max}+` : `${count}`;

  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text}>{displayText}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  badge: {
    backgroundColor: theme.colors.destructive,
    borderRadius: theme.radius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: theme.spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    ...theme.typography.micro,
    fontWeight: theme.fontWeights.bold,
    color: "#ffffff",
    textAlign: "center",
  },
}));
