/**
 * MessageBubble — Nordic Split chat bubble.
 *
 * Received: left-aligned, surface-container-low bg, rounded with flat bottom-left
 * Sent: right-aligned, primary gradient bg, rounded with flat bottom-right
 * System: centered pill with muted italic text
 * Pending: clock icon next to timestamp
 *
 * Timestamps in mono uppercase below the bubble.
 * Avatar shown for received messages (rounded-lg, not circle).
 */

import React, { useCallback, useState } from "react";
import { View, Text, Pressable, Image, Modal, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Play } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import type { MessageWithSender, MessageAttachment } from "@/hooks/queries/use-messages";

type MessageBubbleProps = {
  message: MessageWithSender;
  isOwnMessage: boolean;
  isPending: boolean;
  onLongPress: () => void;
  onSwipeReply: () => void;
  style?: ViewStyle;
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

/** Renders an image or video thumbnail */
function AttachmentThumb({ attachment }: { attachment: MessageAttachment; isOwn: boolean }) {
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
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <Play size={24} color="#ffffff" fill="#ffffff" strokeWidth={0} />
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
  onSwipeReply,
  style,
}: MessageBubbleProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  }, [onLongPress]);

  // System messages
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

  // Reactions
  const reactions = Array.isArray(message.reactions)
    ? (message.reactions as { emoji: string; profileId: string }[])
    : [];
  const groupedReactions = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther, style]}>
      {/* Avatar — received messages only */}
      {!isOwnMessage && (
        <Avatar
          name={message.senderName}
          imageUrl={message.senderAvatarUrl}
          size="md"
          style={styles.avatar}
        />
      )}

      <View style={[styles.bubbleColumn, isOwnMessage && styles.bubbleColumnOwn]}>
        {/* Attachments — rendered outside the text bubble for clean layout */}
        {attachmentList.length > 0 && (
          <Pressable onLongPress={handleLongPress} delayLongPress={300}>
            <View style={styles.attachSingle}>
              {attachmentList.map((att) => (
                <AttachmentThumb key={att.id} attachment={att} isOwn={isOwnMessage} />
              ))}
            </View>
          </Pressable>
        )}

        {/* Text bubble — only when there's text, sender name, or reply */}
        {(message.content.trim().length > 0 || !isOwnMessage || message.reply_to_id) && (
          <Pressable
            onLongPress={handleLongPress}
            delayLongPress={300}
            style={({ pressed }) => [
              styles.bubble,
              isOwnMessage ? styles.bubbleOwn : styles.bubbleOther,
              pressed && styles.bubblePressed,
            ]}
            accessibilityLabel={`${message.senderName}: ${message.content}`}
          >
            {!isOwnMessage && <Text style={styles.senderName}>{message.senderName}</Text>}

            {message.reply_to_id && (
              <View style={styles.replyIndicator}>
                <Text style={styles.replyText} numberOfLines={1}>
                  Svar
                </Text>
              </View>
            )}

            {message.content.trim().length > 0 && (
              <Text
                style={[styles.content, isOwnMessage ? styles.contentOwn : styles.contentOther]}
              >
                {message.content}
              </Text>
            )}
          </Pressable>
        )}

        {/* Timestamp below bubble */}
        <View style={[styles.metaRow, isOwnMessage && styles.metaRowOwn]}>
          <Text style={styles.timestamp}>
            {formatTime(message.created_at)}
            {!isOwnMessage ? ` \u00B7 ${message.senderName}` : ""}
          </Text>
          {isPending && <Text style={styles.pendingIcon}>{"\ud83d\udd51"}</Text>}
          {isOwnMessage && !isPending && <Text style={styles.readStatus}>{"\u2713\u2713"}</Text>}
        </View>

        {/* Reactions */}
        {Object.keys(groupedReactions).length > 0 && (
          <View style={styles.reactionsRow}>
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <View key={emoji} style={styles.reactionPill}>
                <Text style={styles.reactionEmoji}>
                  {emoji}
                  {count > 1 ? ` ${count}` : ""}
                </Text>
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
    maxWidth: "82%",
  },
  rowOwn: {
    alignSelf: "flex-end",
  },
  rowOther: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.element,
  },
  avatar: {
    borderRadius: theme.radius.sm,
  },
  bubbleColumn: {
    flex: 1,
    gap: 4,
    alignItems: "flex-start",
  },
  bubbleColumnOwn: {
    alignItems: "flex-end",
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    ...theme.shadows.sm,
  },
  bubbleOwn: {
    backgroundColor: theme.colors.brandOrange,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.secondary,
    borderBottomLeftRadius: 4,
  },
  bubblePressed: {
    opacity: 0.85,
  },
  senderName: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.brandOrange,
    marginBottom: 1,
    letterSpacing: 0.3,
  },
  replyIndicator: {
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.brandOrange,
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  attachSingle: {
    marginBottom: 6,
  },
  attachGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginBottom: 6,
  },
  content: {
    fontSize: 14,
    lineHeight: 19,
  },
  contentOwn: {
    color: "#ffffff",
  },
  contentOther: {
    color: theme.colors.foreground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 2,
  },
  metaRowOwn: {
    paddingRight: 2,
    paddingLeft: 0,
  },
  timestamp: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },
  pendingIcon: {
    fontSize: 9,
  },
  readStatus: {
    fontSize: 10,
    color: theme.colors.brandOrange,
    fontWeight: "600",
  },

  /* System messages */
  systemContainer: {
    alignSelf: "center",
    marginVertical: theme.spacing.element,
  },
  systemPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: withOpacity(theme.colors.muted, 0.5),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  systemText: {
    fontSize: 10,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
    fontStyle: "italic",
  },

  /* Reactions */
  reactionsRow: {
    flexDirection: "row",
    gap: 4,
  },
  reactionPill: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.8) : theme.colors.secondary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
  },
  reactionEmoji: {
    fontSize: 12,
  },
}));
