/**
 * BotssonMessage — Renders a single message in the Botsson AI chat.
 *
 * Botsson messages (is_system or sender != current user) align left with
 * a distinct AI styling: secondary background, "Mr. Botsson" label, and
 * a small "S" avatar indicator.
 *
 * User messages align right with the primary (brand) color, matching
 * the regular chat bubble style.
 */

import React from "react";
import { View, Text } from "react-native";
import { createStyles } from "@/theme";
import type { BotssonMessage as BotssonMessageType } from "@/hooks/queries/use-botsson-chat";

type BotssonMessageProps = {
  message: BotssonMessageType;
  /** Whether this message was sent by the current user */
  isOwnMessage: boolean;
};

/** Formats a timestamp to HH:MM for the message footer */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function BotssonMessage({ message, isOwnMessage }: BotssonMessageProps) {
  const styles = useStyles();

  if (isOwnMessage) {
    return (
      <View style={styles.rowOwn}>
        <View style={styles.bubbleOwn}>
          <Text style={styles.contentOwn}>{message.content}</Text>
          <Text style={styles.timestampOwn}>{formatTime(message.created_at)}</Text>
        </View>
      </View>
    );
  }

  // Botsson message — left-aligned with AI indicator
  return (
    <View style={styles.rowBotsson}>
      <View style={styles.botssonAvatar}>
        <Text style={styles.botssonAvatarText}>S</Text>
      </View>
      <View style={styles.bubbleBotsson}>
        <Text style={styles.botssonLabel}>Mr. Botsson</Text>
        <Text style={styles.contentBotsson}>{message.content}</Text>
        <Text style={styles.timestampBotsson}>{formatTime(message.created_at)}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  /* User messages — right-aligned, brand color */
  rowOwn: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    marginVertical: 2,
  },
  bubbleOwn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
  },
  contentOwn: {
    ...theme.typography.body,
    color: theme.colors.primaryForeground,
  },
  timestampOwn: {
    ...theme.typography.micro,
    color: theme.colors.primaryForeground,
    opacity: 0.7,
    alignSelf: "flex-end",
    marginTop: 2,
  },

  /* Botsson messages — left-aligned with AI avatar and distinct background */
  rowBotsson: {
    flexDirection: "row",
    alignItems: "flex-end",
    alignSelf: "flex-start",
    maxWidth: "85%",
    marginVertical: 2,
    gap: theme.spacing.xs,
  },
  botssonAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  botssonAvatarText: {
    color: theme.colors.primaryForeground,
    fontSize: 14,
    fontWeight: theme.fontWeights.bold,
  },
  bubbleBotsson: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    borderBottomLeftRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    flex: 1,
  },
  botssonLabel: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.brandOrange,
    marginBottom: 2,
  },
  contentBotsson: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  timestampBotsson: {
    ...theme.typography.micro,
    color: theme.colors.mutedForeground,
    alignSelf: "flex-end",
    marginTop: 2,
  },
}));
