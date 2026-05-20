/**
 * NetworkRetryBanner — Reconnect status banner for voice disconnects (D3).
 *
 * Two states:
 *   retrying  — "Nettverket falt ut. Prøver igjen..." (no action button)
 *   failed    — "Kunne ikke koble til. Bytt til skriftlig?" with action
 *
 * Parent drives state by passing `phase`. The banner is purely presentational.
 *
 * Strings: Norwegian with TODO tags — wire via t() when i18n keys land.
 * Colors: theme tokens only — no hardcoded values (ADR-0366).
 * a11y: accessibilityLiveRegion="polite" for screen reader announcements.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import { createStyles, useTheme } from "@/theme";

export type NetworkRetryPhase = "retrying" | "failed";

type NetworkRetryBannerProps = {
  /** Current reconnect phase. */
  phase: NetworkRetryPhase;
  /** Which retry attempt is in progress (1-based). Only relevant when phase="retrying". */
  attempt?: number;
  /** Called when the user taps "Bytt til chat" on final failure. */
  onSwitchToText: () => void;
};

export function NetworkRetryBanner({ phase, attempt, onSwitchToText }: NetworkRetryBannerProps) {
  const styles = useStyles();
  const theme = useTheme();

  const label =
    phase === "retrying"
      ? // TODO(i18n): voice_reconnect_retrying — attempt hint optional
        attempt !== undefined
        ? `Nettverket falt ut. Prøver igjen (${attempt}/3)...`
        : "Nettverket falt ut. Prøver igjen..."
      : // TODO(i18n): voice_reconnect_failed
        "Kunne ikke koble til. Bytt til skriftlig?";

  const accessibilityLabel =
    phase === "retrying"
      ? "Tilkoblingen falt ut, prøver å koble til på nytt"
      : "Kunne ikke koble til. Bytt til tekstmodus?";

  return (
    <View
      style={styles.container}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.message} numberOfLines={2}>
        {label}
      </Text>
      {phase === "failed" && (
        <Pressable
          onPress={onSwitchToText}
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Bytt til chat"
          // TODO(i18n): voice_reconnect_switch_to_text_label
          hitSlop={theme.spacing.tight}
        >
          <Text style={styles.actionText}>
            {/* TODO(i18n): voice_reconnect_switch_label */}
            Bytt til chat
          </Text>
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
    marginHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.tight,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.secondary,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning,
    gap: theme.spacing.tight,
  },
  message: {
    flex: 1,
    ...theme.typography.caption,
    color: theme.colors.foreground,
  },
  actionButton: {
    paddingHorizontal: theme.spacing.tight,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionText: {
    ...theme.typography.caption,
    color: theme.colors.foreground,
    fontWeight: "600",
  },
}));
