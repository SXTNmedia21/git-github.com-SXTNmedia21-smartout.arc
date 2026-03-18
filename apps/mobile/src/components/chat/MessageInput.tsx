/**
 * MessageInput — Text input with send button for the conversation screen.
 *
 * Shows a reply preview bar when replying to a message.
 * Send button enables only when there is text content.
 * Provides haptic feedback on send.
 */
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";
import { strings } from "@/constants/strings";
import type { MessageWithSender } from "@/hooks/queries/use-messages";

type MessageInputProps = {
  onSend: (content: string) => void;
  /** Currently replying to this message (shown as preview bar above input) */
  replyTo?: MessageWithSender | null;
  onCancelReply?: () => void;
  style?: ViewStyle;
};

export function MessageInput({
  onSend,
  replyTo,
  onCancelReply,
  style,
}: MessageInputProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const canSend = text.trim().length > 0;

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed);
    setText("");
  }, [text, onSend]);

  const handleCancelReply = useCallback(() => {
    Haptics.selectionAsync();
    onCancelReply?.();
  }, [onCancelReply]);

  return (
    <View style={[styles.container, style]}>
      {/* Reply preview */}
      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel}>
              Svar til {replyTo.senderName}
            </Text>
            <Text style={styles.replyPreview} numberOfLines={1}>
              {replyTo.content}
            </Text>
          </View>
          <Pressable
            onPress={handleCancelReply}
            hitSlop={8}
            accessibilityLabel="Avbryt svar"
          >
            <Text style={styles.replyCancelIcon}>{"\u2715"}</Text>
          </Pressable>
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={strings.chat.placeholder}
          placeholderTextColor={theme.colors.mutedForeground}
          multiline
          maxLength={2000}
          returnKeyType="default"
          blurOnSubmit={false}
          accessibilityLabel={strings.chat.placeholder}
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel={strings.common.send}
          accessibilityState={{ disabled: !canSend }}
        >
          <Text style={[styles.sendIcon, !canSend && styles.sendIconDisabled]}>
            {"\u2191"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.page,
    paddingTop: theme.spacing.tight,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    marginBottom: theme.spacing.tight,
    gap: theme.spacing.tight,
  },
  replyContent: {
    flex: 1,
    gap: 2,
  },
  replyLabel: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.primary,
  },
  replyPreview: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  replyCancelIcon: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.tight,
  },
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.element,
    paddingTop: theme.spacing.tight,
    paddingBottom: theme.spacing.tight,
    maxHeight: 120,
    minHeight: 40,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.secondary,
  },
  sendIcon: {
    color: theme.colors.primaryForeground,
    fontSize: 18,
    fontWeight: theme.fontWeights.bold,
  },
  sendIconDisabled: {
    color: theme.colors.mutedForeground,
  },
}));
