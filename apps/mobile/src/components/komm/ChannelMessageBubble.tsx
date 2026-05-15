/**
 * ChannelMessageBubble — Visual alias of chat/MessageBubble for the channel
 * schema (`ChannelMessageWithSender`).
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:383-447
 *
 * Variants:
 *   own     — right-aligned, `colors.warnSoft` surface (warm cream, WhatsApp own-bubble feel),
 *             corners 16/16/4/16, `colors.foreground` text, time + ReadReceipt inline bottom-right.
 *   other   — left-aligned with 32pt avatar, `colors.muted` surface,
 *             corners 16/16/16/4, sender name micro-label above the bubble.
 *   system  — centered pill with italic muted text (bg-muted + border).
 *
 * ADR-0165: shared visual primitive with chat/MessageBubble; this file exists
 * solely to adapt the channel message type while emitting identical styles.
 */
import React, { useCallback } from "react";
import { View, Text, Pressable, Platform, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import type { ChannelMessageWithSender } from "@/hooks/queries/use-channel-messages";
import { ReadReceipt, type ReadReceiptState } from "@/components/chat/ReadReceipt";

const SYSTEM_TYPES = new Set(["system", "brief", "handoff", "announcement", "reminder", "summary"]);

type Props = {
  message: ChannelMessageWithSender & { _isPending?: boolean };
  isOwnMessage: boolean;
  onLongPress: () => void;
  onSwipeReply: () => void;
  readReceiptState?: ReadReceiptState;
  style?: ViewStyle;
};

const MONO_FAMILY = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

export function ChannelMessageBubble({
  message,
  isOwnMessage,
  onLongPress,
  readReceiptState: receiptProp,
  style,
}: Props) {
  const styles = useStyles();
  const theme = useTheme();

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  }, [onLongPress]);

  // Derive effective receipt state: pending flag takes precedence over prop.
  const effectiveReceiptState: ReadReceiptState = message._isPending
    ? "pending"
    : (receiptProp ?? "sent");

  // Deleted / system → centered italic pill.
  if (message.deleted_at) {
    return (
      <View style={[styles.systemContainer, style]}>
        <View style={styles.systemPill}>
          <Text style={styles.systemText}>Melding slettet</Text>
        </View>
      </View>
    );
  }

  if (SYSTEM_TYPES.has(message.message_type)) {
    return (
      <View style={[styles.systemContainer, style]}>
        <View style={styles.systemPill}>
          <Text style={styles.systemText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  // Group reactions by emoji.
  const groupedReactions = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  const bubbleTextColor = theme.colors.foreground;
  const bubbleCorners = isOwnMessage
    ? {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 4,
        borderBottomLeftRadius: 16,
      }
    : {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        borderBottomLeftRadius: 4,
      };

  // Own bubble uses warnSoft (warm cream) for WhatsApp-style visual separation.
  // secondary === muted in both light/dark, making own+other indistinguishable — T8 fix.
  const bubbleBg = isOwnMessage ? theme.colors.warnSoft : theme.colors.muted;

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther, style]}>
      {!isOwnMessage && (
        <View style={styles.avatarSlot}>
          <Avatar
            name={message.sender_name ?? "?"}
            imageUrl={message.sender_avatar}
            size="sm"
            style={styles.avatar}
          />
        </View>
      )}

      <View style={[styles.column, isOwnMessage && styles.columnOwn]}>
        {!isOwnMessage && message.sender_name && (
          <Text style={styles.senderName}>{message.sender_name}</Text>
        )}

        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={300}
          accessibilityLabel={`${message.sender_name}: ${message.content}`}
        >
          <View style={[styles.bubble, bubbleCorners, { backgroundColor: bubbleBg }]}>
            {message.reply_to_id && message.reply_to_content && (
              <View style={isOwnMessage ? styles.replyIndicatorOwn : styles.replyIndicator}>
                <Text
                  style={[styles.replyLabel, isOwnMessage && styles.replyLabelOwn]}
                  numberOfLines={1}
                >
                  {message.reply_to_sender_name ?? ""}
                </Text>
                <Text
                  style={[styles.replyText, isOwnMessage && styles.replyTextOwn]}
                  numberOfLines={1}
                >
                  {message.reply_to_content}
                </Text>
              </View>
            )}
            <Text style={[styles.content, { color: bubbleTextColor }]}>{message.content}</Text>

            {/* Inline meta: time + receipt (own) / time only (other) — bottom-right */}
            <View style={styles.inlineMeta}>
              <Text style={styles.inlineTimestamp}>{formatTime(message.created_at)}</Text>
              {isOwnMessage && <ReadReceipt state={effectiveReceiptState} size={11} />}
            </View>
          </View>
        </Pressable>

        {Object.keys(groupedReactions).length > 0 && (
          <View
            style={[
              styles.reactionsRow,
              isOwnMessage ? styles.reactionsRowOwn : styles.reactionsRowOther,
            ]}
          >
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <View key={emoji} style={styles.reactionPill}>
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={styles.reactionCount}>{count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    marginVertical: 3,
    maxWidth: "80%",
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
  },
  rowOwn: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  rowOther: {
    alignSelf: "flex-start",
  },
  avatarSlot: {
    paddingBottom: 2,
  },
  avatar: {
    borderRadius: theme.radius.full,
  },
  column: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },
  columnOwn: {
    alignItems: "flex-end",
  },
  senderName: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.mutedForeground,
    marginBottom: 2,
    paddingLeft: 2,
  },
  bubble: {
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
  },
  content: {
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 4,
  },

  /* Inline meta row — time + receipt bottom-right inside bubble */
  inlineMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 2,
  },
  inlineTimestamp: {
    fontFamily: MONO_FAMILY,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: theme.colors.mutedForeground,
  },

  /* Reply indicators */
  replyIndicator: {
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.brandOrange,
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyIndicatorOwn: {
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.border,
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.brandOrange,
  },
  replyLabelOwn: {
    color: theme.colors.mutedForeground,
  },
  replyText: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },
  replyTextOwn: {
    color: theme.colors.mutedForeground,
  },

  /* Reactions */
  reactionsRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 3,
  },
  reactionsRowOwn: {
    paddingRight: 2,
    alignSelf: "flex-end",
  },
  reactionsRowOther: {
    paddingLeft: 2,
    alignSelf: "flex-start",
  },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reactionEmoji: {
    fontSize: 11.5,
  },
  reactionCount: {
    fontFamily: MONO_FAMILY,
    fontSize: 10,
    color: theme.colors.mutedForeground,
  },

  /* System */
  systemContainer: {
    alignSelf: "center",
    marginVertical: 8,
  },
  systemPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.muted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  systemText: {
    fontSize: 11.5,
    fontStyle: "italic",
    color: theme.colors.mutedForeground,
  },
}));
