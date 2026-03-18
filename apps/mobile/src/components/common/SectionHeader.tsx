/**
 * SectionHeader — Section title with optional action link.
 * Used to separate content areas on home, shifts, and chat screens.
 */
import React from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";

type SectionHeaderProps = {
  /** Section title */
  title: string;
  /** Optional action label shown on the right */
  actionLabel?: string;
  /** Callback when the action is pressed */
  onAction?: () => void;
  /** Custom style override */
  style?: ViewStyle;
};

export function SectionHeader({ title, actionLabel, onAction, style }: SectionHeaderProps) {
  const styles = useStyles();

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onAction();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.tight,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  action: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.brandOrange,
  },
}));
