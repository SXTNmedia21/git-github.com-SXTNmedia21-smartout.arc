/**
 * Card — Elevated container with depth via shadow.
 *
 * Design: subtle border, real shadow for dimension, rounded corners.
 * No heavy border — the shadow provides depth.
 */
import React, { type ReactNode } from "react";
import { Pressable, View, type ViewStyle, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";

type CardProps = {
  children: ReactNode;
  onPress?: PressableProps["onPress"];
  noPadding?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityRole?: PressableProps["accessibilityRole"];
};

export function Card({
  children,
  onPress,
  noPadding = false,
  style,
  accessibilityLabel,
  accessibilityRole,
}: CardProps) {
  const styles = useStyles();

  const content = (
    <View style={[styles.container, noPadding && styles.noPadding, style]}>{children}</View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(e);
      }}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.isDark ? 0.3 : 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  noPadding: {
    padding: 0,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
}));
