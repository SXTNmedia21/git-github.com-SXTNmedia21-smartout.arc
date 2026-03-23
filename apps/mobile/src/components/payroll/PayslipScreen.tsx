/**
 * PayslipScreen (Min Lønn) — Employee payslip detail view.
 *
 * Shows net pay hero for the selected period, a line-item breakdown
 * (base pay, supplements, overtime, deductions), a vacation balance strip,
 * and a list of previous settled periods to navigate between.
 *
 * Read-only. Data from usePayslips() for the period list and
 * usePayslipDetail(periodId) for the selected period's calculation lines.
 *
 * Trust tier: Settled — all figures come from payroll.calculation + payroll.calculation_line.
 */

import React, { useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/common/SectionHeader";
import { strings } from "@/constants/strings";
import { usePayslips, usePayslipDetail } from "@/hooks/queries/use-payslips";
import { useAbsenceBalance } from "@/hooks/queries/use-absence-balance";
import { useAbsenceTypes } from "@/hooks/queries/use-absence-types";
import { SupplementBadges } from "@/components/payroll/SupplementBadges";
import type { ShiftSupplement } from "@/lib/supplements";
import type { PayslipEntry } from "@/hooks/queries/use-payslips";

// UI Events:
// - action: selectPeriod(periodId) — switches hero/breakdown to that period
// - nav: /(app)/(me)/absence-balance — vacation strip press
// - display-only: all payroll figures are read-only

/** Norwegian month names — indexed 0-11 */
const MONTH_NAMES = [
  "Januar",
  "Februar",
  "Mars",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/** Formats a date string (YYYY-MM-DD) as "Måned YYYY" — e.g., "Mars 2026" */
function formatPeriodName(startDate: string): string {
  const date = new Date(startDate);
  const monthName = MONTH_NAMES[date.getMonth()];
  return `${monthName} ${date.getFullYear()}`;
}

/** Formats a date string as "DD. måned" — e.g., "25. mars" */
function formatDayMonth(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const monthName = MONTH_NAMES[date.getMonth()].toLowerCase();
  return `${day}. ${monthName}`;
}

/** Formats a date range as "DD. mmm – DD. mmm" */
function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDayMonth(startDate)} – ${formatDayMonth(endDate)}`;
}

/** Format NOK amount — "kr 21 146" */
function formatNOK(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toLocaleString("nb-NO");
  return `kr ${formatted}`;
}

/** Convert minutes to "Xt Ym" display */
function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

/**
 * Extract supplement badges from calculation lines.
 * Lines with line_type containing supplement info are mapped to ShiftSupplement.
 */
function extractSupplementBadges(
  lines: { line_type: string; description: string; hours: number | null; amount: number }[],
): ShiftSupplement[] {
  const supplements: ShiftSupplement[] = [];

  for (const line of lines) {
    if (line.line_type !== "supplement") continue;

    const desc = line.description.toLowerCase();
    if (desc.includes("kveld")) {
      supplements.push({
        type: "kveld",
        label: strings.payroll.eveningSupplement,
        hours: line.hours ?? 0,
        estimatedAmount: line.amount,
      });
    } else if (desc.includes("helg") || desc.includes("helge")) {
      supplements.push({
        type: "helg",
        label: strings.payroll.weekendSupplement,
        hours: line.hours ?? 0,
        estimatedAmount: line.amount,
      });
    } else if (desc.includes("helligdag")) {
      supplements.push({
        type: "helligdag",
        label: strings.payroll.holidaySupplement,
        hours: line.hours ?? 0,
        estimatedAmount: line.amount,
      });
    }
  }

  return supplements;
}

export function PayslipScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const { data: payslipsData, isLoading: payslipsLoading, error: payslipsError } = usePayslips();
  const absenceBalance = useAbsenceBalance();
  const absenceTypesQuery = useAbsenceTypes();
  const currentYear = new Date().getFullYear();

  const payslips = payslipsData?.payslips ?? [];

  /** Selected period ID — defaults to the most recent payslip */
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  const activePeriodId = selectedPeriodId ?? payslips[0]?.period.id ?? "";

  const { data: detailData, isLoading: detailLoading } = usePayslipDetail(activePeriodId);

  /** Find the selected payslip entry from the list */
  const activePayslip = useMemo(
    () => payslips.find((p) => p.period.id === activePeriodId) ?? null,
    [payslips, activePeriodId],
  );

  /** Previous periods — all except the currently selected one */
  const previousPayslips = useMemo(
    () => payslips.filter((p) => p.period.id !== activePeriodId),
    [payslips, activePeriodId],
  );

  const handleSelectPeriod = useCallback((periodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPeriodId(periodId);
  }, []);

  const handleVacationPress = useCallback(() => {
    Haptics.selectionAsync();
    router.push("/(app)/(me)/absence-balance");
  }, [router]);

  if (payslipsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{strings.common.loading}</Text>
      </View>
    );
  }

  if (payslipsError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{strings.payroll.loadErrorPayslip}</Text>
      </View>
    );
  }

  if (payslips.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <EmptyState title={strings.payroll.myPay} subtitle={strings.payroll.noPayslips} />
      </ScrollView>
    );
  }

  const period = activePayslip?.period;
  const calculation = activePayslip?.calculation;
  const lines = detailData?.lines ?? [];

  /** Aggregate amounts from calculation lines by type */
  const supplementTotal = lines
    .filter((l) => l.line_type === "supplement")
    .reduce((sum, l) => sum + l.amount, 0);
  const overtimeTotal = lines
    .filter((l) => l.line_type === "overtime")
    .reduce((sum, l) => sum + l.amount, 0);
  const deductionTotal = lines
    .filter((l) => l.line_type === "deduction" || l.line_type === "absence")
    .reduce((sum, l) => sum + l.amount, 0);

  const supplementBadges = extractSupplementBadges(lines);

  /** Vacation quota for the vacation strip.
   *
   * We need the quota whose absence type has category "vacation" — not just any
   * quota for the current year. useAbsenceTypes() is called at the top of the
   * component (before any early returns, as required by React's Rules of Hooks)
   * and is already cached via the shared hook. */
  const vacationQuota = useMemo(() => {
    const quotas = absenceBalance.data?.quotas ?? [];
    const types = absenceTypesQuery.data ?? [];

    // Find the absence type id for the vacation category
    const vacationType = types.find((t) => t.category === "vacation");
    if (!vacationType) {
      // Fallback: if we can't identify the vacation type yet, use the first
      // quota for the current year (matches pre-existing behavior)
      return quotas.find((q) => q.year === currentYear) ?? null;
    }

    return (
      quotas.find((q) => q.year === currentYear && q.absence_type_id === vacationType.id) ?? null
    );
  }, [absenceBalance.data?.quotas, absenceTypesQuery.data, currentYear]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Net pay hero */}
      {period && (
        <Card style={styles.heroCard}>
          <Text style={styles.heroPeriod}>{formatPeriodName(period.start_date)}</Text>
          <Text style={styles.heroAmount}>
            {calculation ? formatNOK(calculation.total_pay) : "—"}
          </Text>
          <Text style={styles.heroLabel}>{strings.payroll.netPay}</Text>
          {period.exported_at && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {strings.payroll.netPay} {formatDayMonth(period.exported_at)}
              </Text>
            </View>
          )}
        </Card>
      )}

      {/* Vacation strip — links to absence balance */}
      {vacationQuota && (
        <Pressable
          onPress={handleVacationPress}
          style={styles.vacationStrip}
          accessibilityRole="link"
          accessibilityLabel={strings.payroll.absenceBalance}
        >
          <Text style={styles.vacationText}>
            {strings.payroll.vacationDaysLeftIn} {currentYear}: {vacationQuota.remaining_days ?? 0}{" "}
            {strings.payroll.of} {vacationQuota.entitled_days}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}

      {/* Breakdown: Spesifikasjon */}
      {calculation && (
        <View style={styles.breakdownSection}>
          <SectionHeader title={strings.payroll.specification} />
          <Card>
            {/* Work hours */}
            <BreakdownRow
              label={strings.payroll.workHours}
              value={formatMinutesToHours(calculation.net_working_minutes)}
            />

            {/* Base salary */}
            <View style={styles.divider} />
            <BreakdownRow
              label={strings.payroll.baseSalary}
              value={formatNOK(calculation.base_pay)}
            />

            {/* Supplements */}
            {supplementTotal > 0 && (
              <>
                <View style={styles.divider} />
                <BreakdownRow
                  label={strings.payroll.supplements}
                  value={formatNOK(supplementTotal)}
                />
                {supplementBadges.length > 0 && (
                  <View style={styles.badgeRow}>
                    <SupplementBadges supplements={supplementBadges} />
                  </View>
                )}
              </>
            )}

            {/* Overtime */}
            {overtimeTotal > 0 && (
              <>
                <View style={styles.divider} />
                <BreakdownRow label={strings.payroll.overtime} value={formatNOK(overtimeTotal)} />
              </>
            )}

            {/* Heavy divider before gross */}
            <View style={styles.heavyDivider} />

            {/* Gross pay */}
            <BreakdownRow
              label={strings.payroll.grossPay}
              value={formatNOK(calculation.base_pay + calculation.total_supplements)}
              bold
            />

            {/* Tax / deductions */}
            {calculation.total_deductions > 0 && (
              <>
                <View style={styles.divider} />
                <BreakdownRow
                  label={strings.payroll.taxDeduction}
                  value={`-${formatNOK(calculation.total_deductions)}`}
                  negative
                />
              </>
            )}

            {/* Heavy divider before net */}
            <View style={styles.heavyDivider} />

            {/* Net pay */}
            <BreakdownRow
              label={strings.payroll.netPay}
              value={formatNOK(calculation.total_pay)}
              positive
              bold
            />
          </Card>

          {detailLoading && (
            <View style={styles.detailLoading}>
              <ActivityIndicator size="small" />
            </View>
          )}
        </View>
      )}

      {/* Previous periods */}
      {previousPayslips.length > 0 && (
        <View style={styles.previousSection}>
          <SectionHeader title={strings.payroll.previousPeriods} />
          {previousPayslips.map((payslip) => (
            <PeriodCard
              key={payslip.period.id}
              payslip={payslip}
              onPress={() => handleSelectPeriod(payslip.period.id)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/** Single row in the payslip breakdown */
function BreakdownRow({
  label,
  value,
  bold = false,
  positive = false,
  negative = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  const styles = useStyles();
  const theme = useTheme();

  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, bold && styles.boldText]}>{label}</Text>
      <Text
        style={[
          styles.breakdownValue,
          bold && styles.boldText,
          positive && { color: theme.colors.success },
          negative && { color: theme.colors.destructive },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/** Pressable card for a previous period — tapping switches the hero view */
function PeriodCard({ payslip, onPress }: { payslip: PayslipEntry; onPress: () => void }) {
  const styles = useStyles();

  return (
    <Card
      onPress={onPress}
      style={styles.periodCard}
      accessibilityRole="button"
      accessibilityLabel={formatPeriodName(payslip.period.start_date)}
    >
      <View style={styles.periodCardContent}>
        <View style={styles.periodCardLeft}>
          <Text style={styles.periodCardName}>{formatPeriodName(payslip.period.start_date)}</Text>
          <Text style={styles.periodCardRange}>
            {formatDateRange(payslip.period.start_date, payslip.period.end_date)}
          </Text>
        </View>
        <View style={styles.periodCardRight}>
          <Text style={styles.periodCardAmount}>
            {payslip.calculation ? formatNOK(payslip.calculation.total_pay) : "—"}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
    </Card>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: theme.spacing.element,
  },
  loadingText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.destructive,
    textAlign: "center" as const,
  },

  /* Hero card — net pay display */
  heroCard: {
    alignItems: "center" as const,
    marginBottom: theme.spacing.section,
  },
  heroPeriod: {
    ...theme.typography.headline,
    color: theme.colors.mutedForeground,
  },
  heroAmount: {
    ...theme.typography.largeTitle,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.success,
    marginTop: theme.spacing.tight,
  },
  heroLabel: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.xs,
  },
  statusBadge: {
    backgroundColor: withOpacity(theme.colors.success, 0.1),
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.tight,
    paddingVertical: theme.spacing.xxs,
    marginTop: theme.spacing.element,
  },
  statusBadgeText: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.success,
  },

  /* Vacation strip */
  vacationStrip: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    backgroundColor: withOpacity(theme.colors.success, 0.1),
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.section,
  },
  vacationText: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.success,
    flex: 1,
  },
  chevron: {
    ...theme.typography.headline,
    color: theme.colors.mutedForeground,
    marginLeft: theme.spacing.tight,
  },

  /* Breakdown section */
  breakdownSection: {
    marginBottom: theme.spacing.section,
    gap: theme.spacing.tight,
  },
  breakdownRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: theme.spacing.element,
  },
  breakdownLabel: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  breakdownValue: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  boldText: {
    fontWeight: theme.fontWeights.bold,
  },
  badgeRow: {
    paddingBottom: theme.spacing.tight,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  heavyDivider: {
    height: 2,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  detailLoading: {
    alignItems: "center" as const,
    paddingVertical: theme.spacing.element,
  },

  /* Previous periods section */
  previousSection: {
    gap: theme.spacing.tight,
  },
  periodCard: {
    marginBottom: theme.spacing.tight,
  },
  periodCardContent: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  periodCardLeft: {
    flex: 1,
  },
  periodCardName: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  periodCardRange: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  periodCardRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.tight,
  },
  periodCardAmount: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
}));
