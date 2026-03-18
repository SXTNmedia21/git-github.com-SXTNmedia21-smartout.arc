/**
 * Card — Elevated container with consistent padding and border radius.
 * Used for shift cards, task items, info blocks.
 */
import React, { type ReactNode } from "react";
import { Pressable, View, type ViewStyle, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";

type CardProps = {
  children: ReactNode;
  /** Makes the card pressable with haptic feedback */
  onPress?: PressableProps["onPress"];
  /** Remove internal padding */
  noPadding?: boolean;
  /** Custom style override */
  style?: ViewStyle;
};

export function Card({ children, onPress, noPadding = false, style }: CardProps) {
  const styles = useStyles();

  const content = (
    <View style={[styles.container, noPadding && styles.noPadding, style]}>
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(e);
      }}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button"
    >
      {content}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  noPadding: {
    padding: 0,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
}));
