/**
 * Create Shift — "Ny vakt" Nordic Split form.
 *
 * Layout:
 * 1. Header — back button | "Ny vakt" (orange serif)
 * 2. Intro — italic guidance text
 * 3. Date picker — tap to show native date picker
 * 4. Start/End time — HH:MM text inputs side by side
 * 5. Role — text input
 * 6. Department — picker from workspace departments
 * 7. Break — minutes input (optional)
 * 8. Notes — textarea (optional)
 * 9. CTA — "Opprett vakt" gradient pill
 *
 * Auto-calculates day_category from the selected date (weekend detection).
 * Uses the offline sync queue via useCreateShift.
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Briefcase,
  Building2,
  Coffee,
  FileText,
  Plus,
  CheckCircle2,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useCreateShift } from "@/hooks/mutations/use-create-shift";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

import type { DayCategory } from "@/hooks/mutations/use-create-shift";

/* ── Helpers ── */

const MONTHS_NO = [
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

const DAY_NAMES_NO = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];

/** Returns "regular" or "weekend" based on the day of week */
function deriveDayCategory(date: Date): DayCategory {
  const day = date.getDay();
  return day === 0 || day === 6 ? "weekend" : "regular";
}

/** Formats a Date as YYYY-MM-DD for the database */
function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Formats a Date for display: "Mandag 14. april" */
function formatDateDisplay(date: Date): string {
  return `${DAY_NAMES_NO[date.getDay()]} ${date.getDate()}. ${MONTHS_NO[date.getMonth()]}`;
}

/** Validates HH:MM time format */
function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/* ── Department query ── */

type DepartmentOption = { department_id: string; name: string };

function useDepartments(workspaceId: string | undefined) {
  return useQuery<DepartmentOption[]>({
    queryKey: ["departments", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspaceId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000,
  });
}

/* ── Component ── */

export default function CreateShiftScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const { createShift, isSubmitting } = useCreateShift();
  const { data: departments = [] } = useDepartments(profile?.workspace_id);

  /* Form state */
  const [shiftDate, setShiftDate] = useState(new Date());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [role, setRole] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [breakMinutes, setBreakMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const dayCategory = useMemo(() => deriveDayCategory(shiftDate), [shiftDate]);

  const canSubmit =
    role.trim().length > 0 &&
    isValidTime(startTime) &&
    isValidTime(endTime) &&
    profile?.workspace_id &&
    !isSubmitting;

  /** Step the date forward or backward by one day */
  const stepDate = useCallback((direction: 1 | -1) => {
    Haptics.selectionAsync();
    setShiftDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + direction);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit || !profile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const parsedBreaks = breakMinutes ? parseInt(breakMinutes, 10) : null;

    void createShift({
      shift_date: formatDateISO(shiftDate),
      start_time: startTime,
      end_time: endTime,
      day_category: dayCategory,
      role: role.trim(),
      workspace_id: profile.workspace_id,
      department_id: selectedDeptId,
      notes: notes.trim() || null,
      breaks: Number.isFinite(parsedBreaks) ? parsedBreaks : null,
    });

    setSubmitted(true);
  }, [
    canSubmit,
    profile,
    shiftDate,
    startTime,
    endTime,
    dayCategory,
    role,
    selectedDeptId,
    notes,
    breakMinutes,
    createShift,
  ]);

  /* ── Success State ── */
  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.successContent}>
          <Animated.View entering={FadeIn.delay(100).duration(500)} style={styles.successHero}>
            <CheckCircle2 size={64} color={theme.colors.success} strokeWidth={1.2} />
            <Text style={styles.successTitle}>Vakt opprettet</Text>
            <Text style={styles.successSubtitle}>
              {formatDateDisplay(shiftDate)} • {startTime} – {endTime}
            </Text>
          </Animated.View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.successButton}
          >
            <Text style={styles.successButtonText}>Tilbake til vakter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Form ── */
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>Ny vakt</Text>
        <View style={styles.headerRight}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{dayCategory === "weekend" ? "HELG" : "UKEDAG"}</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.intro}>
            <Text style={styles.introText}>
              Opprett en ny vakt med tidspunkt, rolle og avdeling.
            </Text>
            <View style={styles.introLine} />
          </Animated.View>

          {/* Date Picker */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400).springify()}
            style={styles.section}
          >
            <View style={styles.fieldHeader}>
              <CalendarDays size={16} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={styles.sectionLabel}>Dato</Text>
            </View>
            <View style={styles.dateNav}>
              <Pressable onPress={() => stepDate(-1)} hitSlop={8} style={styles.dateNavButton}>
                <ChevronLeft size={20} color={theme.colors.mutedForeground} strokeWidth={1.8} />
              </Pressable>
              <Text style={styles.dateButtonText}>{formatDateDisplay(shiftDate)}</Text>
              <Pressable onPress={() => stepDate(1)} hitSlop={8} style={styles.dateNavButton}>
                <ChevronRight size={20} color={theme.colors.mutedForeground} strokeWidth={1.8} />
              </Pressable>
            </View>
          </Animated.View>

          {/* Time Inputs */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(400).springify()}
            style={styles.section}
          >
            <View style={styles.fieldHeader}>
              <Clock size={16} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={styles.sectionLabel}>Tidspunkt</Text>
            </View>
            <View style={styles.timeRow}>
              <View style={styles.timeInputWrapper}>
                <Text style={styles.timeLabel}>START</Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    !isValidTime(startTime) && startTime.length > 0 && styles.timeInputError,
                  ]}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00"
                  placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              <Text style={styles.timeSeparator}>—</Text>
              <View style={styles.timeInputWrapper}>
                <Text style={styles.timeLabel}>SLUTT</Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    !isValidTime(endTime) && endTime.length > 0 && styles.timeInputError,
                  ]}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="16:00"
                  placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            </View>
          </Animated.View>

          {/* Role */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(400).springify()}
            style={styles.section}
          >
            <View style={styles.fieldHeader}>
              <Briefcase size={16} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={styles.sectionLabel}>Rolle / Posisjon</Text>
            </View>
            <TextInput
              style={styles.textInput}
              value={role}
              onChangeText={setRole}
              placeholder="F.eks. Servitør, Kokk, Resepsjonist..."
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
            />
          </Animated.View>

          {/* Department */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(400).springify()}
            style={styles.section}
          >
            <View style={styles.fieldHeader}>
              <Building2 size={16} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={styles.sectionLabel}>Avdeling</Text>
            </View>
            <View style={styles.deptGrid}>
              {departments.map((dept) => {
                const isSelected = selectedDeptId === dept.department_id;
                return (
                  <Pressable
                    key={dept.department_id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedDeptId(isSelected ? null : dept.department_id);
                    }}
                    style={[styles.deptChip, isSelected && styles.deptChipSelected]}
                  >
                    <Text style={[styles.deptChipText, isSelected && styles.deptChipTextSelected]}>
                      {dept.name}
                    </Text>
                  </Pressable>
                );
              })}
              {departments.length === 0 && (
                <Text style={styles.emptyDeptText}>Ingen avdelinger funnet</Text>
              )}
            </View>
          </Animated.View>

          {/* Break */}
          <Animated.View
            entering={FadeInDown.delay(500).duration(400).springify()}
            style={styles.section}
          >
            <View style={styles.fieldHeader}>
              <Coffee size={16} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={styles.sectionLabel}>Pause (minutter)</Text>
              <Text style={styles.optionalTag}>VALGFRI</Text>
            </View>
            <TextInput
              style={styles.textInput}
              value={breakMinutes}
              onChangeText={setBreakMinutes}
              placeholder="30"
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
              keyboardType="number-pad"
              maxLength={3}
            />
          </Animated.View>

          {/* Notes */}
          <Animated.View
            entering={FadeInDown.delay(600).duration(400).springify()}
            style={styles.section}
          >
            <View style={styles.fieldHeader}>
              <FileText size={16} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={styles.sectionLabel}>Notater</Text>
              <Text style={styles.optionalTag}>VALGFRI</Text>
            </View>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="Spesielle instruksjoner, kommentarer..."
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Submit */}
          <Animated.View
            entering={FadeInDown.delay(700).duration(500).springify()}
            style={styles.submitSection}
          >
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                !canSubmit && styles.submitDisabled,
                pressed && canSubmit && styles.submitPressed,
              ]}
            >
              <Text style={styles.submitText}>Opprett vakt</Text>
              <Plus size={20} color="#ffffff" strokeWidth={2} />
            </Pressable>
            <Text style={styles.systemLabel}>SMARTOUT SCHEDULE MANAGEMENT</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },

  /* Header */
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 22,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  tag: {
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
  },

  scrollContent: { paddingHorizontal: theme.spacing.section, paddingBottom: theme.spacing.xl + 40 },

  /* Intro */
  intro: { gap: theme.spacing.element, marginBottom: theme.spacing.page },
  introText: {
    fontSize: 18,
    fontStyle: "italic",
    color: theme.colors.mutedForeground,
    lineHeight: 26,
  },
  introLine: { width: 48, height: 1, backgroundColor: withOpacity(theme.colors.brandOrange, 0.3) },

  /* Sections */
  section: { gap: theme.spacing.md, marginBottom: theme.spacing.page },
  fieldHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionLabel: { ...theme.typography.title, color: theme.colors.foreground },
  optionalTag: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    textTransform: "uppercase",
  },

  /* Date navigation */
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.section,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
  },
  dateNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withOpacity(theme.colors.muted, 0.5),
  },
  dateButtonText: {
    ...theme.typography.body,
    fontWeight: "500",
    color: theme.colors.foreground,
  },

  /* Time row */
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  timeInputWrapper: { flex: 1, gap: 4 },
  timeLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
  },
  timeInput: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "300",
    letterSpacing: 1,
  },
  timeInputError: {
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.destructive, 0.4),
  },
  timeSeparator: {
    fontSize: 20,
    fontWeight: "300",
    color: withOpacity(theme.colors.mutedForeground, 0.4),
    paddingTop: 20,
  },

  /* Text input */
  textInput: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
  },

  /* Text area */
  textArea: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    minHeight: 100,
  },

  /* Department chips */
  deptGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.element },
  deptChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderWidth: 1,
    borderColor: "transparent",
  },
  deptChipSelected: {
    borderColor: withOpacity(theme.colors.brandOrange, 0.3),
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.06),
  },
  deptChipText: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  deptChipTextSelected: { color: theme.colors.brandOrange },
  emptyDeptText: {
    ...theme.typography.subheadline,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    fontStyle: "italic",
  },

  /* Submit */
  submitSection: { paddingTop: theme.spacing.md, gap: theme.spacing.section },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.lg,
  },
  submitDisabled: { opacity: 0.4 },
  submitPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  submitText: { fontSize: 18, fontWeight: "500", color: "#ffffff" },
  systemLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.4),
    textAlign: "center",
    textTransform: "uppercase",
  },

  /* Success */
  successContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xl,
    paddingHorizontal: theme.spacing.page,
  },
  successHero: { alignItems: "center", gap: theme.spacing.md },
  successTitle: { ...theme.typography.largeTitle, color: theme.colors.foreground },
  successSubtitle: { ...theme.typography.subheadline, color: theme.colors.mutedForeground },
  successButton: {
    paddingHorizontal: theme.spacing.page,
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
  },
  successButtonText: { ...theme.typography.bodyBold, color: "#ffffff" },
}));
