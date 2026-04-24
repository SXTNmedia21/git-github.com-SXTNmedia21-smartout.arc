/**
 * ActionChip — Pill-shaped filter/action button.
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:144-154
 *
 * Rounded-full `bg-muted` with `border-border`, Lucide icon 13 + label 12.5
 * weight 500 in muted foreground. Ships as a Pressable — consumer owns press.
 */

import React, { useCallback } from "react";
import { Pressable, Text, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";

export type ActionChipProps = {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function ActionChip({
  icon: Icon,
  label,
  onPress,
  style,
  accessibilityLabel,
}: ActionChipProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Icon size={13} color={withOpacity(theme.colors.mutedForeground, 0.9)} strokeWidth={1.8} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.muted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  label: {
    fontSize: 12.5,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },
}));
