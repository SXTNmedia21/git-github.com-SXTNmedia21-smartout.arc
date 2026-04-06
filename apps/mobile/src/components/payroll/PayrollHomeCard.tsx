/**
 * PayrollHomeCard — Adaptive payroll info card for the home screen.
 *
 * Renders BELOW the primary shift action (confirm, punch out, etc).
 * Shows different content based on shift phase:
 *   - no_shift:      Relaxed overview (vacation, timebank, last pay)
 *   - before_shift:  Supplement preview for the upcoming shift
 *   - during_shift:  Live earnings counter with pulsing dot
 *   - after_shift:   Shift earnings summary from actual punched hours
 *
 * Every monetary figure is annotated with a trust label (estimate/recorded/settled).
 * The top stripe color communicates phase at a glance.
 */

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  FadeInUp,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { ChevronRight, Wallet, Plane, Clock } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { createStyles, useTheme } from "@/theme";
import { strings } from "@/constants/strings";
import { getTrustLabel } from "@/lib/trust-labels";
import { getShiftSupplements, mapDbRules } from "@/lib/supplements";
import { calculateShiftEarnings } from "@/lib/payroll-calc";
import { SupplementBadges } from "@/components/payroll/SupplementBadges";
import type { PayrollSummary } from "@/hooks/queries/use-payroll-summary";
import type { TimeEntry } from "@/types/time-entry";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type PayrollHomeCardProps = {
  phase: "no_shift" | "before_shift" | "during_shift" | "after_shift";
  shift: ScheduleShift | null;
  timeEntry: TimeEntry | null;
  summary: PayrollSummary | null;
};

// UI Events:
// - nav: /(app)/(payroll)/payslip ("Se alt" link in no_shift mode)
// - display: supplement badges (before_shift, during_shift, after_shift)
// - display: pulsing dot (during_shift live indicator)
// - color-regime: phase-based stripe (green/blue=no_shift, purple/orange=before, orange=during, green=after)

// ---------------------------------------------------------------------------
// Top stripe color palette per phase
// ---------------------------------------------------------------------------

const stripeColorKeys = {
  no_shift: ["success", "info"] as const,
  before_shift: ["brandPurple", "brandOrange"] as const,
  during_shift: ["brandOrange", "brandOrange"] as const,
  after_shift: ["success", "success"] as const,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a number as Norwegian kroner: "21 146" with space as thousands separator */
function formatKr(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Returns elapsed minutes between a punch-in ISO string and now (or a punch-out) */
function getElapsedMinutes(punchIn: string, punchOut: string | null): number {
  const start = new Date(punchIn).getTime();
  const end = punchOut ? new Date(punchOut).getTime() : Date.now();
  return Math.max(0, (end - start) / (1000 * 60));
}

// ---------------------------------------------------------------------------
// Sub-components per phase
// ---------------------------------------------------------------------------

function NoShiftContent({ summary }: { summary: PayrollSummary }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();

  // Find the vacation balance (first absence balance, typically ferie)
  const vacationBalance = summary.absenceBalances?.[0] ?? null;
  const vacationTrust = getTrustLabel({ phase: "no_shift", dataSource: "absence_quota" });
  const payTrust = getTrustLabel({ phase: "no_shift", dataSource: "payroll_period" });

  return (
    <View style={styles.content}>
      {/* Vacation balance */}
      {vacationBalance && (
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Plane size={16} color={colors.success} strokeWidth={1.8} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{strings.payroll.vacation}</Text>
            <Text style={styles.rowValue}>
              {vacationBalance.remaining} {strings.payroll.of} {vacationBalance.total}
            </Text>
          </View>
        </View>
      )}

      {/* Timebank */}
      {summary.timebankHours !== null && (
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Clock size={16} color={colors.info} strokeWidth={1.8} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{strings.payroll.timebank}</Text>
            <Text style={styles.rowValue}>
              {summary.timebankHours.toFixed(1)} {strings.payroll.hours}
            </Text>
          </View>
        </View>
      )}

      {/* Last settled pay */}
      {summary.lastSettledPay && (
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Wallet size={16} color={styles.brandColor.color} strokeWidth={1.8} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{strings.payroll.lastPaid}</Text>
            <Text style={styles.rowValue}>
              {payTrust.prefix}kr {formatKr(summary.lastSettledPay.amount)}
            </Text>
          </View>
        </View>
      )}

      {/* Trust footnote — all no_shift data is settled */}
      <Text style={styles.trustCaption}>{vacationTrust.label}</Text>

      {/* "Se alt" navigation link */}
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          router.push("/(app)/(payroll)");
        }}
        style={({ pressed }) => [styles.seeAllRow, pressed && styles.seeAllPressed]}
        accessibilityRole="link"
        accessibilityLabel={strings.payroll.seeAll}
      >
        <Text style={styles.seeAllText}>{strings.payroll.seeAll}</Text>
        <ChevronRight size={14} color={styles.brandColor.color} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function BeforeShiftContent({ shift, summary }: { shift: ScheduleShift; summary: PayrollSummary }) {
  const styles = useStyles();
  const trust = getTrustLabel({ phase: "before_shift", dataSource: "calculated" });

  const supplements = useMemo(() => {
    if (summary.supplementRules.length === 0) return [];
    const engineRules = mapDbRules(summary.supplementRules);
    if (engineRules.length === 0) return [];
    return getShiftSupplements({
      shiftDate: shift.shift_date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      breakMinutes: shift.breaks ?? 0,
      rules: engineRules,
      holidays: summary.holidays,
    });
  }, [summary.supplementRules, summary.holidays, shift]);

  const estimatedTotal = useMemo(() => {
    return supplements.reduce((sum, s) => sum + (s.estimatedAmount ?? 0), 0);
  }, [supplements]);

  return (
    <View style={styles.content}>
      <Text style={styles.sectionLabel}>{strings.payroll.todaysSupplements}</Text>

      {supplements.length > 0 ? (
        <>
          <SupplementBadges supplements={supplements} />
          <View style={styles.estimateRow}>
            <Text style={styles.estimateAmount}>
              {trust.prefix}kr {formatKr(estimatedTotal)}
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.muted}>{strings.payroll.supplements}: --</Text>
      )}

      {trust.showDisclaimer && <Text style={styles.disclaimer}>{trust.label}</Text>}
    </View>
  );
}

function DuringShiftContent({
  shift,
  timeEntry,
  summary,
}: {
  shift: ScheduleShift;
  timeEntry: TimeEntry;
  summary: PayrollSummary;
}) {
  const styles = useStyles();
  const trust = getTrustLabel({ phase: "during_shift", dataSource: "calculated" });

  // Pulsing dot animation — opacity loop 1 → 0.3 → 1 over 2s
  const pulseOpacity = useSharedValue(1);
  useEffect(() => {
    pulseOpacity.value = withRepeat(withTiming(0.3, { duration: 1000 }), -1, true);
  }, [pulseOpacity]);

  // Live counter — recalculate every 60 seconds
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const earnings = useMemo(() => {
    const hourlyRate = summary.hourlyRate ?? 0;
    const elapsed = getElapsedMinutes(timeEntry.punch_in, null);

    // Calculate supplements for the current shift
    const engineRules = mapDbRules(summary.supplementRules);
    const supplements =
      engineRules.length > 0
        ? getShiftSupplements({
            shiftDate: shift.shift_date,
            startTime: shift.start_time,
            endTime: shift.end_time,
            breakMinutes: shift.breaks ?? 0,
            rules: engineRules,
            holidays: summary.holidays,
          })
        : [];

    const supplementEarnings = supplements.map((s) => ({
      type: s.type,
      hours: s.hours,
      // For fixed_per_hour rules, derive the rate from estimatedAmount to stay
      // consistent with how calculateShiftEarnings applies it. For percentage
      // rules, pass the raw rate directly — estimatedAmount is undefined because
      // the base hourly rate is not available inside the supplement engine.
      rate: s.rateType === "percentage" ? s.rate : (s.estimatedAmount ?? 0) / (s.hours || 1),
      rateType: s.rateType,
    }));

    return calculateShiftEarnings({
      hourlyRate,
      workedMinutes: elapsed,
      supplements: supplementEarnings,
    });
  }, [tick, timeEntry.punch_in, summary, shift]);

  return (
    <View style={styles.content}>
      {/* Header with pulsing dot */}
      <View style={styles.liveHeader}>
        <Animated.View style={[styles.pulseDot, { opacity: pulseOpacity }]} />
        <Text style={styles.sectionLabel}>{strings.payroll.earnedThisShift}</Text>
      </View>

      {/* Running totals */}
      <View style={styles.earningsGrid}>
        <View style={styles.earningsItem}>
          <Text style={styles.earningsLabel}>{strings.payroll.baseSalary}</Text>
          <Text style={styles.earningsValue}>
            {trust.prefix}kr {formatKr(earnings.basePay)}
          </Text>
        </View>
        {earnings.supplementPay > 0 && (
          <View style={styles.earningsItem}>
            <Text style={styles.earningsLabel}>{strings.payroll.supplements}</Text>
            <Text style={styles.earningsValue}>
              {trust.prefix}kr {formatKr(earnings.supplementPay)}
            </Text>
          </View>
        )}
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{strings.payroll.totalSoFar}</Text>
        <Text style={styles.totalAmount}>
          {trust.prefix}kr {formatKr(earnings.total)}
        </Text>
      </View>

      {trust.showDisclaimer && <Text style={styles.disclaimer}>{trust.label}</Text>}
    </View>
  );
}

function AfterShiftContent({
  shift,
  timeEntry,
  summary,
}: {
  shift: ScheduleShift;
  timeEntry: TimeEntry;
  summary: PayrollSummary;
}) {
  const styles = useStyles();
  const trust = getTrustLabel({ phase: "after_shift", dataSource: "calculated" });

  const earnings = useMemo(() => {
    const hourlyRate = summary.hourlyRate ?? 0;
    const workedMinutes = getElapsedMinutes(timeEntry.punch_in, timeEntry.punch_out);

    const engineRules = mapDbRules(summary.supplementRules);
    const supplements =
      engineRules.length > 0
        ? getShiftSupplements({
            shiftDate: shift.shift_date,
            startTime: shift.start_time,
            endTime: shift.end_time,
            breakMinutes: shift.breaks ?? 0,
            rules: engineRules,
            holidays: summary.holidays,
          })
        : [];

    const supplementEarnings = supplements.map((s) => ({
      type: s.type,
      hours: s.hours,
      // For fixed_per_hour rules, derive the rate from estimatedAmount to stay
      // consistent with how calculateShiftEarnings applies it. For percentage
      // rules, pass the raw rate directly — estimatedAmount is undefined because
      // the base hourly rate is not available inside the supplement engine.
      rate: s.rateType === "percentage" ? s.rate : (s.estimatedAmount ?? 0) / (s.hours || 1),
      rateType: s.rateType,
    }));

    return {
      result: calculateShiftEarnings({
        hourlyRate,
        workedMinutes,
        supplements: supplementEarnings,
      }),
      supplements,
    };
  }, [timeEntry, summary, shift]);

  return (
    <View style={styles.content}>
      <Text style={styles.sectionLabel}>{strings.payroll.totalEarned}</Text>

      {/* Supplement badges */}
      {earnings.supplements.length > 0 && (
        <View style={styles.badgeRow}>
          <SupplementBadges supplements={earnings.supplements} />
        </View>
      )}

      {/* Breakdown */}
      <View style={styles.earningsGrid}>
        <View style={styles.earningsItem}>
          <Text style={styles.earningsLabel}>{strings.payroll.baseSalary}</Text>
          <Text style={styles.earningsValue}>
            {trust.prefix}kr {formatKr(earnings.result.basePay)}
          </Text>
        </View>
        {earnings.result.supplementPay > 0 && (
          <View style={styles.earningsItem}>
            <Text style={styles.earningsLabel}>{strings.payroll.supplements}</Text>
            <Text style={styles.earningsValue}>
              {trust.prefix}kr {formatKr(earnings.result.supplementPay)}
            </Text>
          </View>
        )}
      </View>

      {/* Green total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{strings.payroll.totalEarned}</Text>
        <Text style={[styles.totalAmount, styles.totalGreen]}>
          {trust.prefix}kr {formatKr(earnings.result.total)}
        </Text>
      </View>

      {trust.showDisclaimer && <Text style={styles.disclaimer}>{trust.label}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PayrollHomeCard({ phase, shift, timeEntry, summary }: PayrollHomeCardProps) {
  const styles = useStyles();

  // Empty state — no payroll data loaded yet
  if (!summary) {
    return (
      <Animated.View entering={FadeInUp.delay(200).duration(400).springify()} style={styles.card}>
        <TopStripe phase={phase} />
        <View style={styles.content}>
          <Text style={styles.emptyText}>{strings.payroll.noPayData}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(200).duration(400).springify()} style={styles.card}>
      <TopStripe phase={phase} />

      {phase === "no_shift" && <NoShiftContent summary={summary} />}

      {phase === "before_shift" && shift && <BeforeShiftContent shift={shift} summary={summary} />}

      {phase === "during_shift" && shift && timeEntry && (
        <DuringShiftContent shift={shift} timeEntry={timeEntry} summary={summary} />
      )}

      {phase === "after_shift" && shift && timeEntry && (
        <AfterShiftContent shift={shift} timeEntry={timeEntry} summary={summary} />
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// TopStripe — colored 3px bar at the top of the card
// ---------------------------------------------------------------------------

function TopStripe({ phase }: { phase: PayrollHomeCardProps["phase"] }) {
  const { colors } = useTheme();
  const [leftKey, rightKey] = stripeColorKeys[phase];
  const left = colors[leftKey];
  const right = colors[rightKey];
  const isGradient = left !== right;

  if (!isGradient) {
    return (
      <View
        style={{
          height: 3,
          backgroundColor: left,
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      />
    );
  }

  // React Native doesn't have CSS gradients natively. Approximate with two halves.
  return (
    <View
      style={{
        flexDirection: "row",
        height: 3,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        overflow: "hidden",
      }}
    >
      <View style={{ flex: 1, backgroundColor: left }} />
      <View style={{ flex: 1, backgroundColor: right }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = createStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.isDark ? 0.3 : 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden" as const,
  },

  content: {
    padding: theme.spacing.card,
    gap: theme.spacing.element,
  },

  // --- no_shift rows ---
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.element,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  rowBody: {
    flex: 1,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  rowLabel: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
  rowValue: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },

  // --- "Se alt" link ---
  seeAllRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "flex-end" as const,
    gap: theme.spacing.xxs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  seeAllPressed: {
    opacity: 0.7,
  },
  seeAllText: {
    ...theme.typography.subheadline,
    color: theme.colors.brandOrange,
    fontWeight: theme.fontWeights.semibold,
  },

  // --- Section label (used in before/during/after) ---
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },

  // --- before_shift ---
  estimateRow: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
  },
  estimateAmount: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },

  // --- during_shift ---
  liveHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.tight,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.brandOrange,
  },
  earningsGrid: {
    gap: theme.spacing.xs,
  },
  earningsItem: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  earningsLabel: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  earningsValue: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },

  // --- Total row (during + after) ---
  totalRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingTop: theme.spacing.tight,
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  totalLabel: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  totalAmount: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },
  totalGreen: {
    color: theme.colors.success,
  },

  // --- Trust / disclaimer ---
  trustCaption: {
    ...theme.typography.micro,
    color: theme.colors.mutedForeground,
  },
  disclaimer: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontStyle: "italic" as const,
  },

  // --- Supplement badges row ---
  badgeRow: {
    marginTop: theme.spacing.xxs,
  },

  // --- Shared ---
  muted: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  emptyText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
    paddingVertical: theme.spacing.element,
  },

  // --- Color references for icon usage ---
  brandColor: {
    color: theme.colors.brandOrange,
  },
}));
