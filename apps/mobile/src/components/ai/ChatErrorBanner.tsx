/**
 * ChatErrorBanner — Inline error banner for text-mode chat failures (D1).
 *
 * Shown directly below the transcript when `textError` is set. Clears on the
 * next successful send (managed by the parent — this component is purely
 * presentational).
 *
 * Strings: Norwegian with TODO tags — wire via t() when i18n keys land.
 * Colors: theme tokens only — no hardcoded values (ADR-0366).
 * a11y: accessibilityLiveRegion="polite" announces error to screen readers.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import { createStyles, useTheme } from "@/theme";

type ChatErrorBannerProps = {
  /** Error message to display. */
  message: string;
  /** Called when the user taps "Prøv igjen". */
  onRetry: () => void;
};

/**
 * Inline error banner with a retry action.
 * Renders nothing when message is empty.
 */
export function ChatErrorBanner({ message, onRetry }: ChatErrorBannerProps) {
  const styles = useStyles();
  const theme = useTheme();

  if (!message) return null;

  return (
    <View
      style={styles.container}
      // ADR-0366: no hardcoded colors — theme tokens only.
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessibilityLabel={`Feil: ${message}`}
    >
      <Text style={styles.message} numberOfLines={2}>
        {/* TODO(i18n): chat_error_message */}
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Prøv igjen"
        // TODO(i18n): chat_error_retry_label
        hitSlop={theme.spacing.tight}
      >
        <Text style={styles.retryText}>
          {/* TODO(i18n): chat_error_retry */}
          Prøv igjen
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.tight,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.md,
    // Theme token for error surface — destructiveMuted keeps it readable.
    backgroundColor: theme.colors.destructiveMuted,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.destructive,
    gap: theme.spacing.tight,
  },
  message: {
    flex: 1,
    ...theme.typography.caption,
    color: theme.colors.destructiveForeground,
  },
  retryButton: {
    paddingHorizontal: theme.spacing.tight,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.destructiveForeground,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryText: {
    ...theme.typography.caption,
    color: theme.colors.destructiveForeground,
    fontWeight: "600",
  },
}));
