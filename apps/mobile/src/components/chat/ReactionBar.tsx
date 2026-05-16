/**
 * ReactionBar — Horizontal row of 6 emoji options shown on long-press.
 *
 * Visual parity with the prototype reaction pills (chat-screens.jsx:419-432):
 * card-bg pill row with hairline border, emoji 20pt button. The container
 * is a floating card above the selected message — consumer positions it.
 *
 * 6 reactions chosen for operational context (not social):
 * thumbs up, check, eyes, fire, warning, heart.
 *
 * Mount/unmount motion (Phase 2 T3):
 *   Uses Reanimated v3 layout animation API (entering/exiting) — same pattern
 *   as ShiftClockSummary and SwapRequestSheet in this codebase.
 *   entering: FadeInDown.springify() — opacity 0→1 + slide from below (springSnappy feel).
 *   exiting:  FadeOut.duration(sheetSlideMs) — clean fade-out matching dismissal token.
 *   Consumer mounts/unmounts via conditional render; this component handles its own motion.
 */
import React, { useCallback } from "react";
import { Pressable, Text, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { nativeTheme } from "@smartout/design-tokens/native";
import { createStyles } from "@/theme";

type ReactionBarProps = {
  onReaction: (emoji: string) => void;
  style?: ViewStyle;
};

// Exit duration uses the dismissal token (sheetSlideMs = 200ms) — consistent with
// sheet/dropdown dismissal feel across the app.
const { sheetSlideMs } = nativeTheme.motion;

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
    <Animated.View
      entering={FadeInDown.springify()}
      exiting={FadeOut.duration(sheetSlideMs)}
      style={[styles.container, style]}
    >
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
    </Animated.View>
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
