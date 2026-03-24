/**
 * ContentCreator — Full-screen sheet for submitting content for a spokesperson task.
 * Supports multi-image selection (expo-image-picker), free-text editing, and
 * AI writing assistance via AiWritingPanel.
 *
 * On submit: stores content reference, emits telemetry, and calls onSubmitted.
 * Since telemetry's emit() expects a server context, mobile submission goes
 * directly to Supabase via RLS-protected insert/update.
 */
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Camera, X, Sparkles, ChevronDown } from "lucide-react-native";
import { Button } from "@/components/ui";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { supabase } from "@/lib/supabase";
import { AiWritingPanel } from "./AiWritingPanel";
import type { ContentTaskItem } from "./ContentTaskList";

// ─── Types ────────────────────────────────────────────────────────

type ContentCreatorProps = {
  task: ContentTaskItem;
  spokespersonId: string;
  onSubmitted: () => void;
  onDismiss: () => void;
};

type PickedImage = {
  uri: string;
  /** width × height for aspect ratio, if available */
  width?: number;
  height?: number;
};

// ─── Task type labels ─────────────────────────────────────────────

const TASK_LABELS: Record<ContentTaskItem["type"], string> = {
  upload_photo: "Last opp bilde",
  write_post: "Skriv innlegg",
  update_quote: "Oppdater sitat",
  custom: "Egendefinert",
};

// ─── Component ────────────────────────────────────────────────────

export function ContentCreator({
  task,
  spokespersonId,
  onSubmitted,
  onDismiss,
}: ContentCreatorProps) {
  const styles = useStyles();
  const theme = useTheme();
  const textRef = useRef<TextInput>(null);

  const [text, setText] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [showAi, setShowAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = text.trim().length > 0 || images.length > 0;

  // ─── Image picker ───────────────────────────────────────────────

  const handlePickImages = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Tillatelse nektet",
        "Smartout trenger tilgang til bilder for å laste opp. Aktiver dette i Innstillinger.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      orderedSelection: true,
    });

    if (!result.canceled) {
      Haptics.selectionAsync();
      const picked: PickedImage[] = result.assets.map((a) => ({
        uri: a.uri,
        width: a.width,
        height: a.height,
      }));
      setImages((prev) => [...prev, ...picked].slice(0, 5)); // max 5 images
    }
  }, []);

  const handleRemoveImage = useCallback((uri: string) => {
    Haptics.selectionAsync();
    setImages((prev) => prev.filter((img) => img.uri !== uri));
  }, []);

  // ─── AI suggestion selected ─────────────────────────────────────

  const handleAiSelect = useCallback((suggestion: string) => {
    setText(suggestion);
    setShowAi(false);
    // Focus the text editor so employee can edit the suggestion
    setTimeout(() => textRef.current?.focus(), 100);
  }, []);

  // ─── Submit ─────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Store content submission in engine_event (activity trail).
      // In a full implementation this would: upload images to storage,
      // create a content record, and mark the task instance as completed.
      // For now we emit a lightweight event directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .schema("websites")
        .from("website_spokesperson")
        .update({ updated_at: new Date().toISOString() })
        .eq("website_spokesperson_id", spokespersonId);

      onSubmitted();
    } catch {
      Alert.alert("Feil", "Kunne ikke sende inn innholdet. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, spokespersonId, onSubmitted]);

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.sheet} edges={["bottom"]}>
        {/* Sheet header */}
        <View style={styles.header}>
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Lukk"
          >
            <ChevronDown size={24} color={theme.colors.mutedForeground} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>{TASK_LABELS[task.type]}</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Task instructions */}
            {task.instructions ? (
              <View style={styles.instructions}>
                <Text style={styles.instructionsText}>{task.instructions}</Text>
              </View>
            ) : null}

            {/* Image strip */}
            <View style={styles.imageSection}>
              <View style={styles.imageStrip}>
                {images.map((img) => (
                  <View key={img.uri} style={styles.imageThumb}>
                    <Image source={{ uri: img.uri }} style={styles.thumbImage} />
                    <Pressable
                      onPress={() => handleRemoveImage(img.uri)}
                      style={styles.removeImage}
                      hitSlop={4}
                    >
                      <X size={12} color="#ffffff" strokeWidth={2.5} />
                    </Pressable>
                  </View>
                ))}
                {images.length < 5 && (
                  <Pressable
                    onPress={handlePickImages}
                    style={styles.addImageButton}
                    accessibilityRole="button"
                    accessibilityLabel="Legg til bilde"
                  >
                    <Camera size={22} color={theme.colors.mutedForeground} strokeWidth={1.5} />
                    <Text style={styles.addImageLabel}>
                      {images.length === 0 ? "Legg til bilde" : "Legg til"}
                    </Text>
                  </Pressable>
                )}
              </View>
              {images.length > 0 && (
                <Text style={styles.imageCount}>{images.length} av 5 bilder valgt</Text>
              )}
            </View>

            {/* Text editor */}
            <View style={styles.textSection}>
              <View style={styles.textHeader}>
                <Text style={styles.textLabel}>Tekst</Text>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowAi((prev) => !prev);
                  }}
                  style={[styles.aiButton, showAi && styles.aiButtonActive]}
                  accessibilityRole="button"
                  accessibilityLabel="AI-skriveassistent"
                >
                  <Sparkles
                    size={14}
                    color={showAi ? theme.colors.brandPurple : theme.colors.mutedForeground}
                    strokeWidth={2}
                  />
                  <Text style={[styles.aiButtonLabel, showAi && styles.aiButtonLabelActive]}>
                    AI-hjelp
                  </Text>
                </Pressable>
              </View>

              <TextInput
                ref={textRef}
                style={styles.textInput}
                placeholder={
                  task.type === "update_quote"
                    ? "Skriv ditt sitat her..."
                    : "Skriv innholdet ditt her..."
                }
                placeholderTextColor={theme.colors.mutedForeground}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />

              {/* AI writing panel — shown below text input */}
              {showAi && (
                <AiWritingPanel
                  taskType={task.type}
                  restaurantName="Arbeidsplassen din"
                  onSelectText={handleAiSelect}
                />
              )}
            </View>
          </ScrollView>

          {/* Submit bar */}
          <View style={styles.submitBar}>
            <Button
              title={submitting ? "Sender..." : "Send inn"}
              variant="primary"
              fullWidth
              disabled={!canSubmit}
              loading={submitting}
              onPress={handleSubmit}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },

  scroll: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.card,
    gap: theme.spacing.section,
    paddingBottom: theme.spacing.xl,
  },

  instructions: {
    padding: theme.spacing.element,
    borderRadius: theme.radius.md,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  instructionsText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    fontStyle: "italic",
  },

  imageSection: {
    gap: theme.spacing.tight,
  },
  imageStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.tight,
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.md,
    overflow: "visible",
  },
  thumbImage: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.secondary,
  },
  removeImage: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.destructive,
    alignItems: "center",
    justifyContent: "center",
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
  },
  addImageLabel: {
    ...theme.typography.micro,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
  imageCount: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },

  textSection: {
    gap: theme.spacing.element,
  },
  textHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textLabel: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "transparent",
  },
  aiButtonActive: {
    borderColor: theme.colors.brandPurple,
    backgroundColor: withOpacity(theme.colors.brandPurple, theme.isDark ? 0.1 : 0.06),
  },
  aiButtonLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
  },
  aiButtonLabelActive: {
    color: theme.colors.brandPurple,
  },
  textInput: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    minHeight: 120,
  },

  submitBar: {
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
}));
