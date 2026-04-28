/**
 * MessageInput — Chat composer (Nordic Split).
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:449-539
 *
 * Layout (top → bottom):
 *   ┌─ reply bar (brand-orange left border)          (optional)
 *   ├─ attachments strip (56pt thumbs + X removals)  (optional)
 *   ├─ input pill [Camera 32 | Plus 32 | TextInput | Smile 32]  →  [ArrowUp / Mic 38]
 *   └─ shortcuts panel / emoji panel                 (optional)
 *
 * Send button morphs: when text or attachments present → ArrowUp (stroke 2.5);
 * otherwise → Mic (stroke 2) as a voice-record affordance. Active panel
 * colors its trigger icon brand-orange.
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
  Platform,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

// expo-image-picker is a native-only module
const ImagePicker: typeof import("expo-image-picker") | null =
  Platform.OS !== "web" ? require("expo-image-picker") : null;
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
    if (!ImagePicker) return;
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
    if (!ImagePicker) return;
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
    if (!ImagePicker) return;
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
  ] as const;

  const placeholder = replyTo ? "Skriv svaret ditt…" : strings.chat.placeholder;

  return (
    <View style={[styles.container, style]}>
      {/* Reply bar */}
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
            style={styles.replyCancel}
            accessibilityLabel="Avbryt svar"
          >
            <X size={14} color={theme.colors.mutedForeground} strokeWidth={2} />
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
              {att.type === "video" && (
                <View style={styles.videoOverlay}>
                  <View style={styles.videoBadge}>
                    <Text style={styles.videoBadgeText}>VIDEO</Text>
                  </View>
                </View>
              )}
              <Pressable
                onPress={() => removeAttachment(i)}
                style={styles.attachmentRemove}
                hitSlop={6}
                accessibilityLabel="Fjern vedlegg"
              >
                <X size={10} color="#fff" strokeWidth={3} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <View style={styles.inputPill}>
          <Pressable
            onPress={handleCamera}
            style={({ pressed }) => [styles.inlineBtn, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Ta bilde"
          >
            <Camera
              size={16}
              color={withOpacity(theme.colors.mutedForeground, 0.6)}
              strokeWidth={1.8}
            />
          </Pressable>

          <Pressable
            onPress={() => togglePanel("shortcuts")}
            style={({ pressed }) => [styles.inlineBtn, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Snarveier"
          >
            <Plus
              size={16}
              color={
                panel === "shortcuts"
                  ? theme.colors.brandOrange
                  : withOpacity(theme.colors.mutedForeground, 0.6)
              }
              strokeWidth={1.8}
            />
          </Pressable>

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.5)}
            multiline
            maxLength={2000}
            returnKeyType="default"
            blurOnSubmit={false}
            onFocus={() => setPanel("none")}
            accessibilityLabel={strings.chat.placeholder}
          />

          <Pressable
            onPress={() => togglePanel("emoji")}
            style={({ pressed }) => [styles.inlineBtn, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Emoji"
          >
            <Smile
              size={16}
              color={
                panel === "emoji"
                  ? theme.colors.brandOrange
                  : withOpacity(theme.colors.mutedForeground, 0.45)
              }
              strokeWidth={1.6}
            />
          </Pressable>
        </View>

        {canSend ? (
          <Pressable
            onPress={handleSend}
            style={({ pressed }) => [styles.sendBtn, pressed && styles.sendPressed]}
            accessibilityRole="button"
            accessibilityLabel={strings.common.send}
          >
            <ArrowUp size={16} color="#ffffff" strokeWidth={2.5} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleMic}
            style={({ pressed }) => [styles.sendBtn, pressed && styles.sendPressed]}
            accessibilityRole="button"
            accessibilityLabel="Talemelding"
          >
            <Mic size={16} color="#ffffff" strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {/* Shortcut panel */}
      {panel === "shortcuts" && (
        <View style={styles.panelContainer}>
          {shortcuts.map((s) => (
            <Pressable
              key={s.key}
              onPress={s.onPress}
              style={({ pressed }) => [styles.shortcutItem, pressed && styles.shortcutPressed]}
              accessibilityRole="button"
              accessibilityLabel={s.label}
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
        <View style={styles.emojiPanel}>
          {QUICK_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => handleEmoji(emoji)}
              style={({ pressed }) => [styles.emojiButton, pressed && styles.emojiPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Emoji ${emoji}`}
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: withOpacity(theme.colors.background, 0.92),
    borderTopWidth: 0.5,
    borderTopColor: withOpacity(theme.colors.brandOrange, 0.08),
  },

  /* Reply bar — orange 3pt left border */
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: withOpacity(theme.colors.muted, 0.6),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.4),
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.brandOrange,
    borderRadius: 8,
  },
  replyContent: { flex: 1, minWidth: 0, gap: 1 },
  replyLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.brandOrange,
  },
  replyPreview: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },
  replyCancel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Attachments */
  attachmentStrip: {
    marginBottom: 10,
  },
  attachmentStripContent: {
    gap: 8,
  },
  attachmentThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  attachmentImage: {
    width: "100%",
    height: "100%",
  },
  videoOverlay: {
    position: "absolute",
    inset: 0,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  videoBadge: {
    margin: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  videoBadgeText: {
    fontSize: 7,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  attachmentRemove: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Input row */
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    padding: 2,
    borderRadius: 12,
    backgroundColor: withOpacity(theme.colors.muted, 0.5),
    borderWidth: 0.5,
    borderColor: withOpacity(theme.colors.border, 0.5),
  },
  inlineBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    opacity: 0.7,
  },
  input: {
    flex: 1,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 10,
    color: theme.colors.foreground,
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 120,
  },

  /* Send button */
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.brandOrange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  sendPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.94 }],
  },

  /* Shortcut panel */
  panelContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 14,
  },
  shortcutItem: {
    width: 64,
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
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

  /* Emoji panel */
  emojiPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingTop: 12,
  },
  emojiButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withOpacity(theme.colors.muted, 0.4),
  },
  emojiPressed: {
    transform: [{ scale: 0.85 }],
  },
  emojiText: {
    fontSize: 18,
  },
}));
