/**
 * AiWritingPanel — Shows 3 AI-generated text suggestions for a content task.
 * Employee can tap a suggestion to fill the text editor, or enter a custom
 * prompt for a different direction.
 *
 * AI call is stubbed — replace with actual edge function or @smartout/ai call
 * when the backend endpoint is ready.
 */
import React, { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { Sparkles, Send, RefreshCw } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";

// ─── Types ────────────────────────────────────────────────────────

type AiWritingPanelProps = {
  /** Context for generation — task type and optional image description */
  taskType: string;
  restaurantName: string;
  /** Called when employee selects a suggestion or enters custom text */
  onSelectText: (text: string) => void;
};

// ─── Stub AI suggestions ──────────────────────────────────────────
// Generates placeholder suggestions until the AI edge function is wired.
// Replace generateSuggestions() with a real API call when ready.

function generateStubSuggestions(taskType: string, restaurantName: string): string[] {
  if (taskType === "upload_photo") {
    return [
      `Et glimt fra kjøkkenet hos ${restaurantName} — der magien skjer hver dag. 📸`,
      `Bak kulissene hos ${restaurantName}. Vi er stolte av hvert eneste måltid vi sender ut.`,
      `Dette er arbeidsplassen vi elsker. Velkommen inn i hverdagen vår hos ${restaurantName}.`,
    ];
  }
  if (taskType === "update_quote") {
    return [
      `"Det beste med jobben er å se gjestene smile når de forlater bordet."`,
      `"Hvert måltid er en mulighet til å gjøre noen sin dag litt bedre."`,
      `"Vi lager ikke bare mat — vi skaper minner rundt bordet."`,
    ];
  }
  // Default for write_post and custom
  return [
    `En ny dag hos ${restaurantName} — klar til å yte det lille ekstra for våre gjester.`,
    `Det er ikke tilfeldig at vi elsker det vi gjør. Hos ${restaurantName} er pasjon vår hemmelighet.`,
    `Fra team ${restaurantName}: takk for at dere velger oss. Det betyr alt for oss.`,
  ];
}

// ─── Component ────────────────────────────────────────────────────

export function AiWritingPanel({ taskType, restaurantName, onSelectText }: AiWritingPanelProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [customPrompt, setCustomPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>(() =>
    generateStubSuggestions(taskType, restaurantName),
  );
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleSelectSuggestion = useCallback(
    (text: string, index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedIndex(index);
      onSelectText(text);
    },
    [onSelectText],
  );

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setSelectedIndex(null);
    Haptics.selectionAsync();

    try {
      // TODO: Replace with real AI edge function call
      // const response = await supabase.functions.invoke("ai-spokesperson-suggestions", {
      //   body: { taskType, restaurantName, customPrompt },
      // });
      // setSuggestions(response.data.suggestions);

      // Stub: simulate network delay + regenerate
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSuggestions(generateStubSuggestions(taskType, restaurantName));
    } finally {
      setLoading(false);
    }
  }, [taskType, restaurantName]);

  const handleCustomPromptSubmit = useCallback(async () => {
    if (!customPrompt.trim()) return;
    setLoading(true);
    setSelectedIndex(null);
    Haptics.selectionAsync();

    try {
      // TODO: Replace with real AI call using customPrompt as direction
      await new Promise((resolve) => setTimeout(resolve, 800));
      // Stub: prepend a custom-context suggestion
      const custom = `${customPrompt.trim()} — ${restaurantName}`;
      setSuggestions([custom, ...generateStubSuggestions(taskType, restaurantName).slice(0, 2)]);
    } finally {
      setLoading(false);
    }
  }, [customPrompt, taskType, restaurantName]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Sparkles size={16} color="#a855f7" strokeWidth={2} />
        <Text style={styles.headerTitle}>AI-forslag</Text>
        <Pressable
          onPress={handleRefresh}
          disabled={loading}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Generer nye forslag"
        >
          <RefreshCw
            size={15}
            color={loading ? theme.colors.mutedForeground : "#a855f7"}
            strokeWidth={2}
          />
        </Pressable>
      </View>

      {/* Suggestions list */}
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#a855f7" />
          <Text style={styles.loadingText}>Genererer forslag...</Text>
        </View>
      ) : (
        <View style={styles.suggestions}>
          {suggestions.map((text, index) => (
            <Pressable
              key={index}
              onPress={() => handleSelectSuggestion(text, index)}
              style={({ pressed }) => [
                styles.suggestionCard,
                selectedIndex === index && styles.suggestionSelected,
                pressed && styles.suggestionPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Forslag ${index + 1}: ${text}`}
            >
              <View style={styles.suggestionIndex}>
                <Text style={styles.suggestionIndexText}>{index + 1}</Text>
              </View>
              <Text
                style={[
                  styles.suggestionText,
                  selectedIndex === index && styles.suggestionTextSelected,
                ]}
              >
                {text}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Custom prompt */}
      <View style={styles.customSection}>
        <Text style={styles.customLabel}>Gi en retning</Text>
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="F.eks. «mer personlig tone» eller «fokus på bærekraft»..."
            placeholderTextColor={theme.colors.mutedForeground}
            value={customPrompt}
            onChangeText={setCustomPrompt}
            returnKeyType="send"
            onSubmitEditing={handleCustomPromptSubmit}
          />
          <Pressable
            onPress={handleCustomPromptSubmit}
            disabled={!customPrompt.trim() || loading}
            style={[
              styles.sendButton,
              (!customPrompt.trim() || loading) && styles.sendButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send prompt"
          >
            <Send size={16} color="#ffffff" strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    gap: theme.spacing.element,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
  },
  headerTitle: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.semibold,
    color: "#a855f7",
    flex: 1,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingVertical: theme.spacing.element,
  },
  loadingText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },

  suggestions: {
    gap: theme.spacing.tight,
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.element,
    padding: theme.spacing.element,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.isDark ? "rgba(168,85,247,0.04)" : "rgba(168,85,247,0.02)",
  },
  suggestionSelected: {
    borderColor: "#a855f7",
    backgroundColor: theme.isDark ? "rgba(168,85,247,0.12)" : "rgba(168,85,247,0.06)",
  },
  suggestionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  suggestionIndex: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(168,85,247,0.2)" : "rgba(168,85,247,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  suggestionIndexText: {
    ...theme.typography.micro,
    fontWeight: theme.fontWeights.bold,
    color: "#a855f7",
  },
  suggestionText: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    flex: 1,
    lineHeight: 20,
  },
  suggestionTextSelected: {
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.medium,
  },

  customSection: {
    gap: theme.spacing.tight,
    marginTop: theme.spacing.tight,
  },
  customLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
  },
  customRow: {
    flexDirection: "row",
    gap: theme.spacing.tight,
    alignItems: "center",
  },
  customInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: "#a855f7",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
}));
