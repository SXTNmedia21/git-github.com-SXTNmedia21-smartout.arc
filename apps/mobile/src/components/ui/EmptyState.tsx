/**
 * EmptyState — Icon + title + subtitle for empty lists.
 * Design rule: "Empty states are instructions" — never a blank screen.
 * Always tells the user what to do or what to expect next.
 */
import React, { type ReactNode } from "react";
import { View, Text, type ViewStyle } from "react-native";
import { createStyles } from "@/theme";

type EmptyStateProps = {
  /** Icon element rendered above the title */
  icon?: ReactNode;
  /** Primary message — what happened */
  title: string;
  /** Secondary message — what to do next or when things change */
  subtitle?: string;
  /** Optional action element rendered below the text */
  action?: ReactNode;
  /** Custom style override */
  style?: ViewStyle;
};

export function EmptyState({ icon, title, subtitle, action, style }: EmptyStateProps) {
  const styles = useStyles();

  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && <View style={styles.actionContainer}>{action}</View>}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.page,
    gap: theme.spacing.tight,
  },
  iconContainer: {
    marginBottom: theme.spacing.tight,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    textAlign: "center",
  },
  subtitle: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
  actionContainer: {
    marginTop: theme.spacing.element,
  },
}));
