/**
 * BotssonSheet — Bottom sheet (70% height) for the Mr. Botsson AI chat.
 *
 * Opened via the center FAB tap. Contains:
 * - Header with "Mr. Botsson" title
 * - Inverted FlatList of messages (newest at bottom)
 * - Context-aware greeting message based on current shift phase
 * - Text input with send button
 *
 * Messages are sent with full context payload (shift phase, role, department,
 * trainee status) so Stage Engine can tailor responses.
 */

import React, { useCallback, useRef, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";
import { strings } from "@/constants/strings";
import { useBotssonChat } from "@/hooks/queries/use-botsson-chat";
import type { BotssonMessage } from "@/hooks/queries/use-botsson-chat";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { BotssonMessage as BotssonMessageComponent } from "./BotssonMessage";

type BotssonSheetProps = {
  /** Called when the sheet is dismissed */
  onDismiss: () => void;
};

/**
 * Returns a context-aware Norwegian greeting based on the current shift phase.
 * The greeting appears as the first system message when the conversation is empty.
 */
function getGreeting(phase: string, departmentName?: string | null): string {
  switch (phase) {
    case "before_shift":
      return "Hei! Du har vakt snart. Hva trenger du?";
    case "during_shift":
      return departmentName
        ? `Hei! Du er p\u00e5 vakt p\u00e5 ${departmentName}. Hva trenger du hjelp med?`
        : "Hei! Du er p\u00e5 vakt. Hva trenger du hjelp med?";
    case "after_shift":
      return "Vakt avsluttet. Trenger du hjelp med noe?";
    default:
      return "Hei! Hva kan jeg hjelpe med?";
  }
}

export const BotssonSheet = React.forwardRef<GorhomBottomSheet, BotssonSheetProps>(
  function BotssonSheet({ onDismiss }, ref) {
    const styles = useStyles();
    const theme = useTheme();
    const [inputText, setInputText] = useState("");
    const inputRef = useRef<TextInput>(null);
    const flatListRef = useRef<FlatList>(null);

    const { messages, isLoading, sendMessage, profileId, fetchNextPage, hasNextPage } =
      useBotssonChat();
    const { phase } = useShiftPhase();

    const snapPoints = useMemo(() => ["70%"], []);

    const canSend = inputText.trim().length > 0;

    const greeting = useMemo(() => getGreeting(phase), [phase]);

    /** Build the greeting as a synthetic system message for display */
    const greetingMessage: BotssonMessage = useMemo(
      () => ({
        id: "botsson-greeting",
        conversation_id: "",
        content: greeting,
        sender_id: "botsson",
        reply_to_id: null,
        is_system: true,
        attachments: [],
        reactions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        senderName: "Mr. Botsson",
        senderAvatarUrl: null,
      }),
      [greeting],
    );

    /**
     * Messages for display — real messages + greeting at the end (bottom of inverted list).
     * The greeting always shows as the first message in the conversation.
     */
    const displayMessages = useMemo(() => {
      return [...messages, greetingMessage];
    }, [messages, greetingMessage]);

    const handleSend = useCallback(async () => {
      const trimmed = inputText.trim();
      if (!trimmed) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInputText("");

      try {
        await sendMessage(trimmed);
      } catch {
        // Message send failed — optimistic update was reverted by the hook
      }
    }, [inputText, sendMessage]);

    const handleChange = useCallback((index: number) => {
      if (index >= 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      [],
    );

    const renderMessage = useCallback(
      ({ item }: { item: BotssonMessage }) => (
        <BotssonMessageComponent message={item} isOwnMessage={item.sender_id === profileId} />
      ),
      [profileId],
    );

    const keyExtractor = useCallback((item: BotssonMessage) => item.id, []);

    const handleEndReached = useCallback(() => {
      if (hasNextPage) {
        fetchNextPage();
      }
    }, [hasNextPage, fetchNextPage]);

    return (
      <GorhomBottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onDismiss}
        onChange={handleChange}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handle}
        backdropComponent={renderBackdrop}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>S</Text>
            </View>
            <Text style={styles.headerTitle}>Mr. Botsson</Text>
          </View>

          {/* Message list — inverted so newest messages appear at the bottom */}
          <FlatList
            ref={flatListRef}
            data={displayMessages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            inverted
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            keyboardShouldPersistTaps="handled"
          />

          {/* Input area */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
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
        </KeyboardAvoidingView>
      </GorhomBottomSheet>
    );
  },
);

const useStyles = createStyles((theme) => ({
  sheetBackground: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
  },
  handle: {
    backgroundColor: theme.colors.muted,
    width: 36,
    height: 4,
    borderRadius: theme.radius.full,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.element,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.tight,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    color: theme.colors.primaryForeground,
    fontSize: 16,
    fontWeight: theme.fontWeights.bold,
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  messageList: {
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.tight,
    paddingBottom: theme.spacing.element,
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
    backgroundColor: theme.colors.brandOrange,
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
