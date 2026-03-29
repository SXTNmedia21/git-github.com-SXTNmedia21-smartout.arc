/**
 * AfterShiftView — "Bra jobba!" post-shift summary.
 *
 * Layout:
 * 1. Hero — "Bra jobba, Sofia!" + subtitle
 * 2. Bento grid — hours worked + points earned
 * 3. Deviation badge (if any)
 * 4. Confirm hours — planned vs registered + confirm/dispute
 * 5. Handoff textarea
 * 6. "Ferdig" CTA
 */

import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { AlertTriangle, Clock, Send } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { strings } from "@/constants/strings";
import type { Database } from "@smartout/supabase/database.types";
import type { TimeEntry } from "@/types/time-entry";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type AfterShiftViewProps = {
  shift: ScheduleShift | null;
  timeEntry: TimeEntry;
  onSubmitHandoff?: (text: string) => void;
  submittingHandoff?: boolean;
  onConfirmHours?: () => void;
  confirmingHours?: boolean;
  onDisputeHours?: () => void;
};

function formatDuration(start: string, end: string): string {
  const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const totalMin = Math.floor(diff / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}t ${m.toString().padStart(2, "0")}m`;
}

export function AfterShiftView({
  shift,
  timeEntry,
  onSubmitHandoff,
  submittingHandoff = false,
  onConfirmHours,
  confirmingHours = false,
  onDisputeHours,
}: AfterShiftViewProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [handoffText, setHandoffText] = useState("");
  const [handoffSent, setHandoffSent] = useState(false);

  const registeredTime = timeEntry.punch_out
    ? formatDuration(timeEntry.punch_in, timeEntry.punch_out)
    : "—";
  const plannedTime = shift ? `${shift.work_hours}t 00m` : "—";

  const handleSubmitHandoff = useCallback(() => {
    if (!handoffText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmitHandoff?.(handoffText.trim());
    setHandoffSent(true);
  }, [handoffText, onSubmitHandoff]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.hero}>
        <Text style={styles.heroTitle}>Bra jobba!</Text>
        <Text style={styles.heroSubtitle}>
          Din vakt er nå fullført. Her er dagens oppsummering.
        </Text>
      </Animated.View>

      {/* Bento stats */}
      <Animated.View
        entering={FadeInDown.delay(150).duration(400).springify()}
        style={styles.statsGrid}
      >
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TIMER</Text>
          <Text style={styles.statValue}>{registeredTime}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>POENG</Text>
          <Text style={[styles.statValue, styles.statValueAccent]}>+45</Text>
        </View>
      </Animated.View>

      {/* Deviation badge */}
      <Animated.View
        entering={FadeInDown.delay(250).duration(400).springify()}
        style={styles.deviationBadge}
      >
        <AlertTriangle size={20} color={theme.colors.destructive} strokeWidth={2} />
        <View>
          <Text style={styles.deviationTitle}>1 avvik rapportert</Text>
          <Text style={styles.deviationDetail}>Kjøleskap A · Temperatur-logg</Text>
        </View>
      </Animated.View>

      {/* Confirm hours */}
      <Animated.View
        entering={FadeInDown.delay(350).duration(400).springify()}
        style={styles.confirmCard}
      >
        <View style={styles.confirmHeader}>
          <Text style={styles.sectionTitle}>{strings.hours.title}</Text>
          <Clock
            size={20}
            color={withOpacity(theme.colors.mutedForeground, 0.4)}
            strokeWidth={1.5}
          />
        </View>
        <View style={styles.hoursRow}>
          <View style={styles.hoursCol}>
            <Text style={styles.hoursLabel}>PLANLAGT</Text>
            <Text style={styles.hoursValue}>{plannedTime}</Text>
          </View>
          <View style={styles.hoursDivider} />
          <View style={[styles.hoursCol, styles.hoursColRight]}>
            <Text style={styles.hoursLabel}>REGISTRERT</Text>
            <Text style={[styles.hoursValue, styles.hoursValueAccent]}>{registeredTime}</Text>
          </View>
        </View>
        <View style={styles.confirmActions}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onDisputeHours?.();
            }}
            style={({ pressed }) => [styles.disputeButton, pressed && styles.actionPressed]}
          >
            <Text style={styles.disputeText}>{strings.hours.dispute}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onConfirmHours?.();
            }}
            disabled={confirmingHours}
            style={({ pressed }) => [styles.confirmButton, pressed && styles.actionPressed]}
          >
            <Text style={styles.confirmText}>{strings.hours.confirm}</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Handoff */}
      <Animated.View
        entering={FadeInDown.delay(450).duration(400).springify()}
        style={styles.handoffSection}
      >
        <Text style={styles.sectionTitle}>Overlevering (Handoff)</Text>
        {handoffSent ? (
          <View style={styles.handoffSent}>
            <Text style={styles.handoffSentText}>{strings.common.done}</Text>
          </View>
        ) : (
          <View style={styles.handoffInputWrap}>
            <TextInput
              style={styles.handoffInput}
              placeholder="Skriv notater til neste skift..."
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
              value={handoffText}
              onChangeText={setHandoffText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>
        )}
      </Animated.View>

      {/* Final CTA */}
      <Animated.View
        entering={FadeInDown.delay(550).duration(500).springify()}
        style={styles.ctaSection}
      >
        <Pressable
          onPress={() => {
            if (handoffText.trim() && !handoffSent) handleSubmitHandoff();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
          style={({ pressed }) => [styles.ctaButton, pressed && styles.actionPressed]}
        >
          <Text style={styles.ctaText}>Ferdig</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1 },
  content: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.xl + 40,
  },

  hero: { gap: 8, marginBottom: theme.spacing.page },
  heroTitle: { fontSize: 40, fontWeight: "300", letterSpacing: -1, color: theme.colors.foreground },
  heroSubtitle: {
    ...theme.typography.body,
    fontStyle: "italic",
    color: withOpacity(theme.colors.mutedForeground, 0.8),
    lineHeight: 22,
  },

  statsGrid: { flexDirection: "row", gap: theme.spacing.md, marginBottom: theme.spacing.section },
  statCard: {
    flex: 1,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    gap: 8,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  statValue: { fontSize: 24, fontWeight: "600", color: theme.colors.foreground },
  statValueAccent: { color: theme.colors.brandOrange, fontWeight: "700" },

  deviationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    backgroundColor: withOpacity(theme.colors.destructive, 0.06),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.destructive, 0.1),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.section,
  },
  deviationTitle: {
    ...theme.typography.subheadline,
    fontWeight: "600",
    color: theme.colors.destructive,
  },
  deviationDetail: {
    ...theme.typography.caption,
    color: withOpacity(theme.colors.destructive, 0.7),
  },

  confirmCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.background,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    ...theme.shadows.sm,
    marginBottom: theme.spacing.section,
    gap: theme.spacing.section,
  },
  confirmHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { ...theme.typography.title, color: theme.colors.foreground },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: theme.spacing.section,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(theme.colors.border, 0.15),
  },
  hoursCol: { flex: 1, gap: 4 },
  hoursColRight: { alignItems: "flex-end" },
  hoursDivider: {
    width: 1,
    height: 40,
    backgroundColor: withOpacity(theme.colors.border, 0.2),
    alignSelf: "center",
  },
  hoursLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
    textTransform: "uppercase",
  },
  hoursValue: { fontSize: 22, fontWeight: "500", color: theme.colors.foreground },
  hoursValueAccent: { color: theme.colors.brandOrange, fontWeight: "700" },
  confirmActions: { flexDirection: "row", gap: theme.spacing.element },
  disputeButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.2),
    alignItems: "center",
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
  },
  disputeText: { ...theme.typography.bodyBold, color: theme.colors.foreground },
  confirmText: { ...theme.typography.bodyBold, color: theme.colors.foreground },
  actionPressed: { transform: [{ scale: 0.95 }], opacity: 0.9 },

  handoffSection: { gap: theme.spacing.md, marginBottom: theme.spacing.section },
  handoffInputWrap: { position: "relative" },
  handoffInput: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    minHeight: 160,
  },
  handoffSent: { alignItems: "center", paddingVertical: theme.spacing.section },
  handoffSentText: { ...theme.typography.bodyBold, color: theme.colors.success },

  ctaSection: { paddingTop: theme.spacing.md },
  ctaButton: {
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.lg,
  },
  ctaText: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
}));
