/**
 * MessageInput — Chat input bar with camera, shortcuts panel, emoji, voice, and send.
 *
 * Layout: [ 📷 | + | text field | 😊 ]  [ 🎙 / ➤ ]
 *
 * Camera: launches device camera for photo/video
 * Plus: toggles shortcut panel (Bilde/Video, Skift, Oppgave, Lokasjon, Manual, Prosedyre)
 * Emoji: quick-pick row of common emojis
 * Mic: voice recording placeholder
 * Send: sends text + attachments
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  ScrollView,
  Image,
  Keyboard,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  Plus,
  Smile,
  Mic,
  ArrowUp,
  X,
  Camera,
  ImageIcon,
  Video,
  CalendarClock,
  ListChecks,
  MapPin,
  BookOpen,
  ClipboardList,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { strings } from "@/constants/strings";
import type { MessageWithSender } from "@/hooks/queries/use-messages";

type Attachment = {
  uri: string;
  type: "image" | "video";
  fileName?: string;
};

type MessageInputProps = {
  onSend: (content: string, attachments?: Attachment[]) => void;
  replyTo?: MessageWithSender | null;
  onCancelReply?: () => void;
  style?: ViewStyle;
};

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "👏", "😊", "🙏", "💪", "🎉", "👀", "✅", "💯"];

type PanelMode = "none" | "shortcuts" | "emoji";

export function MessageInput({ onSend, replyTo, onCancelReply, style }: MessageInputProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [panel, setPanel] = useState<PanelMode>("none");
  const inputRef = useRef<TextInput>(null);

  const canSend = text.trim().length > 0 || attachments.length > 0;

  const togglePanel = useCallback((mode: PanelMode) => {
    Haptics.selectionAsync();
    setPanel((prev) => (prev === mode ? "none" : mode));
    if (mode !== "none") Keyboard.dismiss();
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setText("");
    setAttachments([]);
    setPanel("none");
  }, [text, attachments, onSend]);

  const handleCancelReply = useCallback(() => {
    Haptics.selectionAsync();
    onCancelReply?.();
  }, [onCancelReply]);

  const handleCamera = useCallback(async () => {
    Haptics.selectionAsync();
    setPanel("none");
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setAttachments((prev) => [
      ...prev,
      {
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
        fileName: asset.fileName ?? undefined,
      },
    ]);
  }, []);

  const handlePickImages = useCallback(async () => {
    Haptics.selectionAsync();
    setPanel("none");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });

    if (result.canceled || !result.assets) return;
    const newAttachments: Attachment[] = result.assets.map((asset) => ({
      uri: asset.uri,
      type: "image" as const,
      fileName: asset.fileName ?? undefined,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handlePickVideo = useCallback(async () => {
    Haptics.selectionAsync();
    setPanel("none");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setAttachments((prev) => [
      ...prev,
      {
        uri: asset.uri,
        type: "video",
        fileName: asset.fileName ?? undefined,
      },
    ]);
  }, []);

  const handleEmoji = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
    setPanel("none");
    inputRef.current?.focus();
  }, []);

  const handleMic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: wire up expo-av recording
  }, []);

  const removeAttachment = useCallback((index: number) => {
    Haptics.selectionAsync();
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Shortcut items for the panel
  const shortcuts = [
    { key: "photo", label: "Bilde", icon: ImageIcon, color: "#3b82f6", onPress: handlePickImages },
    { key: "video", label: "Video", icon: Video, color: "#f43f5e", onPress: handlePickVideo },
    {
      key: "shift",
      label: "Skift",
      icon: CalendarClock,
      color: "#f97316",
      onPress: () => setPanel("none"),
    },
    {
      key: "task",
      label: "Oppgave",
      icon: ListChecks,
      color: "#22c55e",
      onPress: () => setPanel("none"),
    },
    {
      key: "location",
      label: "Lokasjon",
      icon: MapPin,
      color: "#a855f7",
      onPress: () => setPanel("none"),
    },
    {
      key: "manual",
      label: "Manual",
      icon: BookOpen,
      color: "#06b6d4",
      onPress: () => setPanel("none"),
    },
    {
      key: "procedure",
      label: "Prosedyre",
      icon: ClipboardList,
      color: "#eab308",
      onPress: () => setPanel("none"),
    },
  ];

  return (
    <View style={[styles.container, style]}>
      {/* Reply preview */}
      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel}>Svar til {replyTo.senderName}</Text>
            <Text style={styles.replyPreview} numberOfLines={1}>
              {replyTo.content}
            </Text>
          </View>
          <Pressable
            onPress={handleCancelReply}
            hitSlop={8}
            accessibilityLabel="Avbryt svar"
            style={styles.replyCancelButton}
          >
            <X size={16} color={theme.colors.mutedForeground} strokeWidth={2} />
          </Pressable>
        </View>
      )}

      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.attachmentStrip}
          contentContainerStyle={styles.attachmentStripContent}
        >
          {attachments.map((att, i) => (
            <View key={att.uri} style={styles.attachmentThumb}>
              <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
              <Pressable
                onPress={() => removeAttachment(i)}
                style={styles.attachmentRemove}
                hitSlop={6}
              >
                <X size={10} color="#fff" strokeWidth={3} />
              </Pressable>
              {att.type === "video" && (
                <View style={styles.videoBadge}>
                  <Text style={styles.videoBadgeText}>VIDEO</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          {/* Camera */}
          <Pressable
            onPress={handleCamera}
            style={({ pressed }) => [styles.inlineButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Ta bilde"
          >
            <Camera
              size={16}
              color={withOpacity(theme.colors.mutedForeground, 0.5)}
              strokeWidth={1.8}
            />
          </Pressable>

          {/* Plus → shortcut panel */}
          <Pressable
            onPress={() => togglePanel("shortcuts")}
            style={({ pressed }) => [styles.inlineButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Snarveier"
          >
            <Plus
              size={16}
              color={
                panel === "shortcuts"
                  ? theme.colors.brandOrange
                  : withOpacity(theme.colors.mutedForeground, 0.5)
              }
              strokeWidth={1.8}
            />
          </Pressable>

          {/* Text input */}
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={strings.chat.placeholder}
            placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
            multiline
            maxLength={2000}
            returnKeyType="default"
            blurOnSubmit={false}
            onFocus={() => setPanel("none")}
            accessibilityLabel={strings.chat.placeholder}
          />

          {/* Emoji toggle */}
          <Pressable
            onPress={() => togglePanel("emoji")}
            style={styles.inlineButton}
            accessibilityLabel="Emoji"
          >
            <Smile
              size={16}
              color={
                panel === "emoji"
                  ? theme.colors.brandOrange
                  : withOpacity(theme.colors.mutedForeground, 0.4)
              }
              strokeWidth={1.6}
            />
          </Pressable>
        </View>

        {/* Mic / Send */}
        {canSend ? (
          <Pressable
            onPress={handleSend}
            style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={strings.common.send}
          >
            <ArrowUp size={16} color="#ffffff" strokeWidth={2.5} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleMic}
            style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Talemelding"
          >
            <Mic size={16} color="#ffffff" strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {/* Shortcut panel */}
      {panel === "shortcuts" && (
        <View style={styles.shortcutPanel}>
          {shortcuts.map((s) => (
            <Pressable
              key={s.key}
              onPress={s.onPress}
              style={({ pressed }) => [styles.shortcutItem, pressed && styles.shortcutPressed]}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: s.color + "14" }]}>
                <s.icon size={18} color={s.color} strokeWidth={1.6} />
              </View>
              <Text style={styles.shortcutLabel}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Emoji quick-pick */}
      {panel === "emoji" && (
        <View style={styles.emojiRow}>
          {QUICK_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => handleEmoji(emoji)}
              style={({ pressed }) => [styles.emojiButton, pressed && styles.emojiPressed]}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    borderTopWidth: 0.5,
    borderTopColor: withOpacity(theme.colors.brandOrange, 0.08),
    backgroundColor: withOpacity(theme.colors.background, 0.88),
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.element,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.secondary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    marginBottom: theme.spacing.tight,
    gap: theme.spacing.tight,
  },
  replyContent: { flex: 1, gap: 2 },
  replyLabel: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.brandOrange,
  },
  replyPreview: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  replyCancelButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },

  /* Attachment preview */
  attachmentStrip: { marginBottom: theme.spacing.element },
  attachmentStripContent: { gap: 8 },
  attachmentThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  attachmentImage: { width: "100%", height: "100%" },
  attachmentRemove: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoBadge: {
    position: "absolute",
    bottom: 3,
    left: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  videoBadgeText: {
    fontSize: 7,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },

  /* Input row */
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.element,
  },
  inlineButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: withOpacity(theme.colors.border, 0.05),
    minHeight: 38,
    paddingHorizontal: 2,
  },
  input: {
    flex: 1,
    color: theme.colors.foreground,
    paddingHorizontal: theme.spacing.element,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    fontSize: 14,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.md,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.92 }],
  },

  /* Shortcut panel */
  shortcutPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  shortcutItem: {
    alignItems: "center",
    gap: 4,
    width: 64,
  },
  shortcutPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },

  /* Emoji quick-pick */
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.xs,
  },
  emojiButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.4) : theme.colors.muted,
  },
  emojiPressed: { transform: [{ scale: 0.85 }] },
  emojiText: { fontSize: 18 },
}));
