/**
 * MessageBubble — Chat bubble matching Nordic Split design (WhatsApp-style layout).
 *
 * Variants:
 *   own     — right-aligned, `colors.secondary` surface (warm off-white / dark neutral),
 *             corners 16/16/4/16, `colors.foreground` text,
 *             timestamp + ReadReceipt inline bottom-right inside the bubble.
 *   other   — left-aligned with 28pt avatar, `colors.muted` surface,
 *             corners 16/16/16/4, sender name micro-label above bubble,
 *             timestamp inline bottom-right inside bubble (no receipt).
 *   system  — centered pill: muted bg + border, italic 11.5 muted text.
 *
 * Reactions render as card-bg pills below the bubble (emoji + mono count).
 * Attachments render above the text bubble; clean separation from layout.
 */

import React, { useCallback } from "react";
import { View, Text, Pressable, Image, type ViewStyle, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Play } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import type { MessageWithSender, MessageAttachment } from "@/hooks/queries/use-messages";
import { ReadReceipt, type ReadReceiptState } from "./ReadReceipt";

type MessageBubbleProps = {
  message: MessageWithSender;
  isOwnMessage: boolean;
  isPending: boolean;
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

/** Renders an image/video thumbnail above the text bubble. */
function AttachmentThumb({ attachment }: { attachment: MessageAttachment }) {
  const theme = useTheme();
  const isVideo =
    attachment.file_type === "video" || (attachment.mime_type?.startsWith("video") ?? false);

  return (
    <View style={{ width: 200, height: 150, borderRadius: 10, overflow: "hidden" }}>
      <Image
        source={{ uri: attachment.url }}
        style={{ width: 200, height: 150 }}
        resizeMode="cover"
      />
      {isVideo && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            // Black scrim over video thumbnail — intentional dark overlay.
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          {/* Play icon on dark scrim always needs maximum-contrast color */}
          <Play
            size={24}
            color={theme.colors.primaryForeground}
            fill={theme.colors.primaryForeground}
            strokeWidth={0}
          />
        </View>
      )}
    </View>
  );
}

export function MessageBubble({
  message,
  isOwnMessage,
  isPending,
  onLongPress,
  readReceiptState: receiptProp,
  style,
}: MessageBubbleProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  }, [onLongPress]);

  // Derive effective receipt state: pending flag takes precedence over prop.
  const effectiveReceiptState: ReadReceiptState = isPending ? "pending" : (receiptProp ?? "sent");

  // System message — centered pill.
  if (message.is_system) {
    return (
      <View style={[styles.systemContainer, style]}>
        <View style={styles.systemPill}>
          <Text style={styles.systemText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  // Attachments
  const attachmentList: MessageAttachment[] = Array.isArray(message.attachments)
    ? message.attachments
    : [];

  // Reactions (raw array grouped by emoji)
  const reactions = Array.isArray(message.reactions)
    ? (message.reactions as { emoji: string; profileId: string }[])
    : [];
  const groupedReactions = reactions.reduce<Record<string, number>>((acc, r) => {
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

  const bubbleBg = isOwnMessage ? theme.colors.secondary : theme.colors.muted;

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther, style]}>
      {/* Avatar — other messages only */}
      {!isOwnMessage && (
        <View style={styles.avatarSlot}>
          <Avatar
            name={message.senderName}
            imageUrl={message.senderAvatarUrl}
            size="sm"
            style={styles.avatar}
          />
        </View>
      )}

      <View style={[styles.column, isOwnMessage && styles.columnOwn]}>
        {/* Sender label — other messages only */}
        {!isOwnMessage && message.senderName && (
          <Text style={styles.senderName}>{message.senderName}</Text>
        )}

        {/* Attachments above the text bubble */}
        {attachmentList.length > 0 && (
          <Pressable onLongPress={handleLongPress} delayLongPress={300} style={styles.attachments}>
            {attachmentList.map((att) => (
              <AttachmentThumb key={att.id} attachment={att} />
            ))}
          </Pressable>
        )}

        {/* Text bubble */}
        {(message.content.trim().length > 0 ||
          (!isOwnMessage && message.reply_to_id) ||
          (isOwnMessage && attachmentList.length === 0)) && (
          <Pressable
            onLongPress={handleLongPress}
            delayLongPress={300}
            accessibilityLabel={`${message.senderName}: ${message.content}`}
          >
            <View style={[styles.bubble, bubbleCorners, { backgroundColor: bubbleBg }]}>
              {/* Reply indicator — own */}
              {isOwnMessage && message.reply_to_id && message.reply_to_content && (
                <View style={styles.replyIndicatorOwn}>
                  <Text style={[styles.replyText, styles.replyTextOwn]} numberOfLines={1}>
                    {message.reply_to_content}
                  </Text>
                </View>
              )}
              {/* Reply indicator — other */}
              {!isOwnMessage && message.reply_to_id && message.reply_to_content && (
                <View style={styles.replyIndicator}>
                  <Text style={styles.replyText} numberOfLines={1}>
                    {message.reply_to_content}
                  </Text>
                </View>
              )}

              {/* Message text */}
              {message.content.trim().length > 0 && (
                <Text style={[styles.content, { color: bubbleTextColor }]}>{message.content}</Text>
              )}

              {/* Inline meta: time + receipt (own) / time only (other) — bottom-right */}
              <View style={styles.inlineMeta}>
                <Text style={styles.inlineTimestamp}>{formatTime(message.created_at)}</Text>
                {isOwnMessage && <ReadReceipt state={effectiveReceiptState} size={11} />}
              </View>
            </View>
          </Pressable>
        )}

        {/* Reactions pill row */}
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
  attachments: {
    marginBottom: 6,
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
  replyText: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },
  replyTextOwn: {
    color: theme.colors.mutedForeground,
  },

  /* Reactions — card pills below bubble */
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

  /* System messages */
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
