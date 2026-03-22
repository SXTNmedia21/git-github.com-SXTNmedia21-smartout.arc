/**
 * NoShiftView — Clean, minimal view when no shift is active.
 *
 * Shows next shift card (if any) with clear visual hierarchy.
 * Important info (next shift time, colleagues) stands out.
 * Secondary info (training, messages) is subdued.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import { CalendarDays, Clock, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Animated, { FadeInUp } from "react-native-reanimated";
import { createStyles } from "@/theme";
import { strings } from "@/constants/strings";
import { PayrollHomeCard } from "@/components/payroll/PayrollHomeCard";
import { usePayrollSummary } from "@/hooks/queries/use-payroll-summary";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type NoShiftViewProps = {
  firstName: string;
  nextShift: ScheduleShift | null;
  unreadCount?: number;
};

function formatShiftDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const days = ["Son", "Man", "Tir", "Ons", "Tor", "Fre", "Lor"];
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mai",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "des",
  ];
  return `${days[date.getUTCDay()]} ${date.getUTCDate()}. ${months[date.getUTCMonth()]}`;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function NoShiftView({ firstName, nextShift }: NoShiftViewProps) {
  const styles = useStyles();
  const router = useRouter();
  const summary = usePayrollSummary();

  return (
    <View style={styles.container}>
      {nextShift ? (
        <Animated.View entering={FadeInUp.delay(100).duration(400).springify()}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/(app)/(shifts)/${nextShift.schedule_shift_id}`);
            }}
            style={({ pressed }) => [styles.nextShiftCard, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.nextShiftHeader}>
              <Text style={styles.nextShiftLabel}>{strings.home.nextShift}</Text>
              <ChevronRight size={16} color={styles.mutedColor.color} strokeWidth={2} />
            </View>

            <View style={styles.nextShiftBody}>
              <View style={styles.dateRow}>
                <CalendarDays size={18} color={styles.foregroundColor.color} strokeWidth={1.8} />
                <Text style={styles.dateText}>{formatShiftDate(nextShift.shift_date)}</Text>
              </View>

              <View style={styles.timeRow}>
                <Clock size={16} color={styles.mutedColor.color} strokeWidth={1.8} />
                <Text style={styles.timeText}>
                  {formatTime(nextShift.start_time)} – {formatTime(nextShift.end_time)}
                </Text>
                {nextShift.role && (
                  <>
                    <View style={styles.dot} />
                    <Text style={styles.roleText}>{nextShift.role}</Text>
                  </>
                )}
              </View>
            </View>

            {!nextShift.confirmed_at && (
              <View style={styles.confirmHint}>
                <Text style={styles.confirmHintText}>Ubekreftet — trykk for å bekrefte</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View
          entering={FadeInUp.delay(100).duration(400).springify()}
          style={styles.emptyState}
        >
          <CalendarDays size={32} color={styles.emptyIcon.color} strokeWidth={1.2} />
          <Text style={styles.emptyTitle}>{strings.home.noShift}</Text>
          <Text style={styles.emptySubtitle}>Nye vakter vises her når lederen publiserer dem.</Text>
        </Animated.View>
      )}

      {/* Payroll overview — informational, never blocks action */}
      <View style={styles.payrollCard}>
        <PayrollHomeCard
          phase="no_shift"
          shift={nextShift}
          timeEntry={null}
          summary={summary.data ?? null}
        />
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.tight,
  },

  /* Next shift card — the hero */
  nextShiftCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.card,
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  nextShiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.element,
  },
  nextShiftLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  nextShiftBody: {
    gap: theme.spacing.tight,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
  },
  dateText: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingLeft: 26,
  },
  timeText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    fontVariant: ["tabular-nums" as const],
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.mutedForeground,
  },
  roleText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
  confirmHint: {
    marginTop: theme.spacing.element,
    paddingTop: theme.spacing.element,
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  confirmHintText: {
    ...theme.typography.caption,
    color: theme.colors.brandOrange,
    fontWeight: theme.fontWeights.medium,
  },

  /* Payroll card spacing — sits below shift card or empty state */
  payrollCard: {
    marginTop: theme.spacing.section,
  },

  /* Empty state */
  emptyState: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.element,
  },
  emptyIcon: {
    color: theme.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
  },
  emptyTitle: {
    ...theme.typography.headline,
    color: theme.colors.mutedForeground,
  },
  emptySubtitle: {
    ...theme.typography.subheadline,
    color: theme.isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
    textAlign: "center",
    maxWidth: 260,
  },

  foregroundColor: {
    color: theme.colors.foreground,
  },
  mutedColor: {
    color: theme.colors.mutedForeground,
  },
}));
