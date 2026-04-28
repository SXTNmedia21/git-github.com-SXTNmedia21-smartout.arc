/**
 * AvailabilityScreen — "Min tilgjengelighet" container.
 *
 * Composes the 3-layer UI per 2026-04-23 Council frontend-designer review:
 *   Layer 1 — WeeklyTemplateCard    (RRULE recurring rules)
 *   Layer 2 — SwipeCalendar         (14-day horizontal strip)
 *   Layer 3 — AcuteShiftToggle      ("Kan ta ekstra-vakt i dag")
 *
 * Data flows from the `useMyAvailability` query hook (stub — Task I will
 * replace with the real BFF call) and mutations flow through
 * `useAvailability`. Both hooks return empty data today so the UI renders
 * its empty-state CTAs (Invariant #13).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { ChevronLeft } from "lucide-react-native";

import { createStyles, useTheme } from "@/theme";
import { useMyAvailability } from "@/hooks/queries/use-my-availability";
import { useAvailability, type PreferenceType } from "@/hooks/mutations/use-availability";
import { WeeklyTemplateCard } from "./WeeklyTemplateCard";
import { SwipeCalendar } from "./SwipeCalendar";
import { AcuteShiftToggle } from "./AcuteShiftToggle";
import { DayDetailSheet } from "./DayDetailSheet";

export function AvailabilityScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading } = useMyAvailability();
  const {
    addWeeklyTemplate,
    deleteWeeklyTemplate,
    setDayStatus,
    clearAvailabilityById,
    setAcuteAvailable,
    isSubmitting,
  } = useAvailability();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [acuteActive, setAcuteActive] = useState(false);
  const sheetRef = useRef<GorhomBottomSheet>(null);

  const handleBack = useCallback(() => {
    Haptics.selectionAsync();
    router.back();
  }, [router]);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    sheetRef.current?.expand();
  }, []);

  const handleDayChoice = useCallback(
    async (status: PreferenceType | null) => {
      if (!selectedDate) return;
      // "Fjern" path: status === null. Needs the existing row id to
      // DELETE — use the DailyStatus.ruleId resolved by use-my-availability.
      // If no override exists (ruleId == null) the day is already
      // "available" → no-op, just close the sheet.
      if (status === null) {
        const existing = data?.next14Days.find((d) => d.date === selectedDate) ?? null;
        if (existing?.ruleId) {
          await clearAvailabilityById(existing.ruleId);
        }
        sheetRef.current?.close();
        return;
      }
      await setDayStatus({ date: selectedDate, preference_type: status });
      sheetRef.current?.close();
    },
    [selectedDate, setDayStatus, clearAvailabilityById, data],
  );

  const handleAddWeeklyTemplate = useCallback(async () => {
    // TODO(Task K): open rule-builder sheet. For now we seed a sensible default
    // so Task J can be demoed against real BFF once Task I lands.
    await addWeeklyTemplate({
      rrule: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=22",
      valid_from: new Date().toISOString().split("T")[0],
      preference_type: "unavailable",
      reason: null,
    });
  }, [addWeeklyTemplate]);

  const handleAcute = useCallback(async () => {
    await setAcuteAvailable();
    setAcuteActive(true);
  }, [setAcuteAvailable]);

  // Reset acute affordance at midnight (simple effect; server is source of truth).
  useEffect(() => {
    if (!acuteActive) return;
    const now = new Date();
    const msToMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timer = setTimeout(() => setAcuteActive(false), msToMidnight);
    return () => clearTimeout(timer);
  }, [acuteActive]);

  const days = data?.next14Days ?? [];
  const weeklyTemplates = data?.weeklyTemplates ?? [];
  const selectedDay = selectedDate ? (days.find((d) => d.date === selectedDate) ?? null) : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>Min tilgjengelighet</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.brandOrange} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.intro}>
            <Text style={styles.introText}>
              Si fra når du kan jobbe. Vaktplanleggeren bruker dette for å sette deg på riktige
              vakter.
            </Text>
          </Animated.View>

          <AcuteShiftToggle
            isActive={acuteActive}
            isSubmitting={isSubmitting}
            onActivate={handleAcute}
          />

          <WeeklyTemplateCard
            templates={weeklyTemplates}
            onAdd={handleAddWeeklyTemplate}
            onDelete={deleteWeeklyTemplate}
          />

          <SwipeCalendar days={days} selectedDate={selectedDate} onSelectDate={handleSelectDate} />
        </ScrollView>
      )}

      <DayDetailSheet
        ref={sheetRef}
        day={selectedDay}
        onSelect={handleDayChoice}
        onClose={() => setSelectedDate(null)}
      />
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.section,
    paddingBottom: theme.spacing.xl + 80,
  },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...theme.typography.title,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.foreground,
  },
  headerRight: { width: 44 },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  intro: {
    gap: theme.spacing.element,
    marginBottom: theme.spacing.page,
  },
  introText: {
    ...theme.typography.body,
    fontStyle: "italic",
    color: theme.colors.mutedForeground,
    lineHeight: 24,
  },
}));
