/**
 * ReactionBar — Horizontal row of 6 emoji options shown on long-press.
 *
 * Appears below the selected message. Tapping an emoji calls onReaction
 * with the emoji string, then the bar dismisses (handled by parent).
 *
 * 6 reactions chosen for operational context (not social):
 * thumbs up, check, eyes, fire, warning, heart
 */
import React, { useCallback } from "react";
import { View, Pressable, Text, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";

type ReactionBarProps = {
  onReaction: (emoji: string) => void;
  style?: ViewStyle;
};

/** The 6 available reaction emojis — operational, not social */
const REACTION_EMOJIS = [
  "\ud83d\udc4d", // thumbs up — acknowledged
  "\u2705",       // check mark — done/agreed
  "\ud83d\udc40", // eyes — looking into it
  "\ud83d\udd25", // fire — great work
  "\u26a0\ufe0f", // warning — attention needed
  "\u2764\ufe0f", // heart — appreciation
] as const;

export function ReactionBar({ onReaction, style }: ReactionBarProps) {
  const styles = useStyles();

  const handlePress = useCallback(
    (emoji: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onReaction(emoji);
    },
    [onReaction],
  );

  return (
    <View style={[styles.container, style]}>
      {REACTION_EMOJIS.map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => handlePress(emoji)}
          style={({ pressed }) => [
            styles.emojiButton,
            pressed && styles.emojiPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Reager med ${emoji}`}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.tight,
    paddingVertical: theme.spacing.xs,
    gap: 2,
    marginVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
  },
  emojiButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiPressed: {
    backgroundColor: theme.colors.secondary,
    transform: [{ scale: 1.2 }],
  },
  emoji: {
    fontSize: 20,
  },
}));
