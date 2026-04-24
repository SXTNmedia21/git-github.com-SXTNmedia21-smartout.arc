/**
 * ReactionBar — Horizontal row of 6 emoji options shown on long-press.
 *
 * Visual parity with the prototype reaction pills (chat-screens.jsx:419-432):
 * card-bg pill row with hairline border, emoji 20pt button. The container
 * is a floating card above the selected message — consumer positions it.
 *
 * 6 reactions chosen for operational context (not social):
 * thumbs up, check, eyes, fire, warning, heart.
 */
import React, { useCallback } from "react";
import { View, Pressable, Text, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";

type ReactionBarProps = {
  onReaction: (emoji: string) => void;
  style?: ViewStyle;
};

/** Operational reactions — acknowledge, done, eyes, fire, warning, heart. */
const REACTION_EMOJIS = [
  "👍", // thumbs up — acknowledged
  "✅", // check mark — done/agreed
  "👀", // eyes — looking into it
  "🔥", // fire — great work
  "⚠️", // warning — attention needed
  "❤️", // heart — appreciation
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
          style={({ pressed }) => [styles.emojiButton, pressed && styles.emojiPressed]}
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
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginVertical: 4,
    gap: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
  },
  emojiButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  emojiPressed: {
    backgroundColor: theme.colors.muted,
    transform: [{ scale: 1.2 }],
  },
  emoji: {
    fontSize: 20,
  },
}));
