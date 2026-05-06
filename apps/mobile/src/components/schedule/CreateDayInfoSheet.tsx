/**
 * CreateDayInfoSheet — Bottom sheet for quickly adding a day info note/event/alert.
 *
 * Designed as a lightweight "quick add" pattern: the user taps a button on the
 * shifts screen, the sheet slides up with a simple form, and dismisses on success.
 * Much lighter than a full-screen form since day info entries are brief.
 *
 * Props:
 * - date: pre-filled date string (YYYY-MM-DD) from the shifts screen context
 * - onDismiss: callback when the sheet should close
 * - visible: controls whether the sheet is open
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { Send, StickyNote, CalendarDays, AlertTriangle } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useCreateDayInfo, type DayInfoCategory } from "@/hooks/mutations/use-create-day-info";
import { BottomSheet } from "@/components/ui/BottomSheet";

type CategoryOption = {
  key: DayInfoCategory;
  label: string;
  icon: typeof StickyNote;
};

const CATEGORIES: CategoryOption[] = [
  { key: "note", label: "Notat", icon: StickyNote },
  { key: "event", label: "Hendelse", icon: CalendarDays },
  { key: "alert", label: "Varsel", icon: AlertTriangle },
];

type CreateDayInfoSheetProps = {
  date: string;
  visible: boolean;
  onDismiss: () => void;
};

export function CreateDayInfoSheet({ date, visible, onDismiss }: CreateDayInfoSheetProps) {
  const styles = useStyles();
  const theme = useTheme();
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const { data: profile } = useMyProfile();
  const { createDayInfo, isSubmitting } = useCreateDayInfo();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<DayInfoCategory>("note");

  const snapPoints = useMemo(() => ["55%"], []);

  const canSubmit = title.trim().length >= 2 && !isSubmitting;

  /* Open/close the sheet based on the visible prop */
  useEffect(() => {
    if (visible) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const resetForm = useCallback(() => {
    setTitle("");
    setContent("");
    setCategory("note");
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit || !profile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    void createDayInfo({
      title: title.trim(),
      content: content.trim() || null,
      category,
      date,
      // workspace_id and created_by resolved server-side via getProfileContext()
      // inside useCreateDayInfo — ADR-0134, not supplied by caller
    });

    resetForm();
    onDismiss();
  }, [canSubmit, profile, title, content, category, date, createDayInfo, resetForm, onDismiss]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onDismiss();
      }
    },
    [onDismiss],
  );

  /** Format the date for display: "10. april 2026" */
  const dateLabel = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    const months = [
      "januar",
      "februar",
      "mars",
      "april",
      "mai",
      "juni",
      "juli",
      "august",
      "september",
      "oktober",
      "november",
      "desember",
    ];
    return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
  }, [date]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChange}
      enablePanDownToClose
    >
      {/* Title */}
      <Text style={styles.sheetTitle}>Legg til dagsinfo</Text>
      <Text style={styles.dateLabel}>{dateLabel}</Text>

      {/* Category pills */}
      <View style={styles.categoryRow}>
        {CATEGORIES.map((cat) => {
          const isSelected = category === cat.key;
          const Icon = cat.icon;
          return (
            <Pressable
              key={cat.key}
              onPress={() => {
                Haptics.selectionAsync();
                setCategory(cat.key);
              }}
              style={[styles.categoryPill, isSelected && styles.categoryPillSelected]}
            >
              <Icon
                size={14}
                color={isSelected ? "#ffffff" : theme.colors.mutedForeground}
                strokeWidth={1.5}
              />
              <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Title input */}
      <TextInput
        style={styles.titleInput}
        placeholder="Tittel"
        placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        returnKeyType="next"
      />

      {/* Content textarea */}
      <TextInput
        style={styles.contentInput}
        placeholder="Beskrivelse (valgfritt)"
        placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Submit */}
      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitButton,
          !canSubmit && styles.submitDisabled,
          pressed && canSubmit && styles.submitPressed,
        ]}
      >
        <Text style={styles.submitText}>Legg til</Text>
        <Send size={18} color="#ffffff" strokeWidth={2} />
      </Pressable>
    </BottomSheet>
  );
}

const useStyles = createStyles((theme) => ({
  sheetTitle: {
    fontSize: 20,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  dateLabel: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.section,
  },

  /* Category pills */
  categoryRow: {
    flexDirection: "row",
    gap: theme.spacing.element,
    marginBottom: theme.spacing.section,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
  },
  categoryPillSelected: {
    backgroundColor: theme.colors.brandOrange,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  categoryTextSelected: {
    color: "#ffffff",
  },

  /* Inputs */
  titleInput: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.md,
    minHeight: 44,
    marginBottom: theme.spacing.element,
  },
  contentInput: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    minHeight: 72,
    marginBottom: theme.spacing.section,
  },

  /* Submit */
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
    height: 52,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.md,
  },
  submitDisabled: { opacity: 0.4 },
  submitPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  submitText: { fontSize: 16, fontWeight: "500", color: "#ffffff" },
}));
