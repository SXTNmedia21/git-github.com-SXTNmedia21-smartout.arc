/**
 * Payroll Home — "Lønn & Arbeid" hub matching Nordic Split design.
 *
 * Layout:
 * 1. Section label "Din Oversikt" + hero title "Lønn & Arbeid"
 * 2. Primary payroll card: estimated payout, period, hours, "Settled" badge
 * 3. Bento grid (2x2): Absence, Timebank, Supplements, Payslips
 * 4. Recent payslips list with confidence badges
 *
 * Data from usePayrollSummary() + usePayslips().
 */

import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Clock, Gift, FileText, CalendarPlus } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { ActionHeader } from "@/components/navigation/ActionHeader";
import { strings } from "@/constants/strings";
import { usePayrollSummary } from "@/hooks/queries/use-payroll-summary";
import { usePayslips } from "@/hooks/queries/use-payslips";

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

const MONTH_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAI",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OKT",
  "NOV",
  "DES",
] as const;

function formatNOKDecimal(amount: number): string {
  return amount.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getCurrentPeriodLabel(): string {
  const now = new Date();
  return `1. — ${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}. ${MONTH_NAMES[now.getMonth()]}`;
}

export default function PayrollHomeScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const { data: summary, isLoading: summaryLoading, error: summaryError } = usePayrollSummary();
  const { data: payslipsData, isLoading: payslipsLoading, error: payslipsError } = usePayslips();

  const isLoading = summaryLoading || payslipsLoading;
  const hasData = !!summary || !!payslipsData;

  const payslips = payslipsData?.payslips ?? [];
  const recentPayslips = useMemo(() => payslips.slice(0, 3), [payslips]);

  const vacationBalance = summary?.absenceBalances?.[0] ?? null;
  const timebankHours = summary?.timebankHours ?? null;
  const lastPay = summary?.lastSettledPay;

  const totalHours =
    summary?.hourlyRate && lastPay ? (lastPay.amount / summary.hourlyRate).toFixed(1) : null;

  const estimatedPay = lastPay?.amount ?? 0;

  /* Show spinner only on first load with no cached data */
  if (isLoading && !hasData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{strings.common.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActionHeader title="Lønn & Arbeid" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Primary Payroll Card ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400).springify()}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("./payslip");
            }}
            style={({ pressed }) => [styles.primaryCard, pressed && styles.cardPressed]}
          >
            {/* Decorative glow */}
            <View style={styles.primaryGlow} />

            <View style={styles.primaryTop}>
              <View>
                <Text style={styles.primaryLabel}>Estimert utbetaling</Text>
                <Text style={styles.primaryAmount}>{formatNOKDecimal(estimatedPay)}</Text>
              </View>

              {/* Status badge */}
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Settled</Text>
              </View>
            </View>

            <View style={styles.primaryMeta}>
              <Text style={styles.primaryMetaText}>{getCurrentPeriodLabel()}</Text>
              <View style={styles.primaryMetaDivider} />
              {totalHours && <Text style={styles.primaryMetaText}>{totalHours} timer totalt</Text>}
            </View>
          </Pressable>
        </Animated.View>

        {/* ── Bento Grid — 2x2 ── */}
        <View style={styles.bentoGrid}>
          {/* Ferie & Syk */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("./absence-request");
            }}
            style={({ pressed }) => [styles.bentoCard, pressed && styles.cardPressed]}
          >
            <View style={styles.bentoIconWrap}>
              <CalendarPlus size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
            </View>
            <Text style={styles.bentoOverline}>Absence</Text>
            <Text style={styles.bentoTitle}>Ferie & Syk</Text>
            <Text style={styles.bentoValue}>
              {vacationBalance ? `${vacationBalance.remaining} dager` : "—"}
            </Text>
          </Pressable>

          {/* Timebank */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("./timebank");
            }}
            style={({ pressed }) => [styles.bentoCard, pressed && styles.cardPressed]}
          >
            <View style={styles.bentoIconWrap}>
              <Clock size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
            </View>
            <Text style={styles.bentoOverline}>Timebank</Text>
            <Text style={styles.bentoTitle}>Overtime</Text>
            <Text style={styles.bentoValue}>
              {timebankHours !== null ? `+${timebankHours.toFixed(1)} t` : "—"}
            </Text>
          </Pressable>

          {/* Tillegg */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("./payroll-supplements");
            }}
            style={({ pressed }) => [styles.bentoCard, pressed && styles.cardPressed]}
          >
            <View style={styles.bentoIconWrap}>
              <Gift size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
            </View>
            <Text style={styles.bentoOverline}>Supplements</Text>
            <Text style={styles.bentoTitle}>Tillegg</Text>
            <Text style={styles.bentoValue}>—</Text>
          </Pressable>

          {/* Lønnsslipper */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("./payslip");
            }}
            style={({ pressed }) => [styles.bentoCard, pressed && styles.cardPressed]}
          >
            <View style={styles.bentoIconWrap}>
              <FileText size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
            </View>
            <Text style={styles.bentoOverline}>Archive</Text>
            <Text style={styles.bentoTitle}>Lønnsslipper</Text>
            <Text style={styles.bentoValue}>PDF Arkiv</Text>
          </Pressable>
        </View>

        {/* ── Recent Payslips ── */}
        {recentPayslips.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(300).duration(400).springify()}
            style={styles.recentSection}
          >
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Siste utbetalinger</Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push("./payslip");
                }}
              >
                <Text style={styles.seeAll}>SE ALLE</Text>
              </Pressable>
            </View>

            {recentPayslips.map((payslip) => {
              const calc = payslip.calculation;
              const netPay = calc?.total_pay ?? 0;
              const startDate = new Date(payslip.period.start_date);
              const monthShort = MONTH_SHORT[startDate.getMonth()];
              const day = startDate.getDate();
              const periodName = `Hovedlønn ${MONTH_NAMES[startDate.getMonth()]}`;
              const isExported = !!payslip.period.exported_at;

              return (
                <Pressable
                  key={payslip.period.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push("./payslip");
                  }}
                  style={({ pressed }) => [styles.payslipRow, pressed && styles.cardPressed]}
                >
                  <View style={styles.payslipLeft}>
                    {/* Date block */}
                    <View style={styles.dateBlock}>
                      <Text style={styles.dateBlockMonth}>{monthShort}</Text>
                      <Text style={styles.dateBlockDay}>{day}</Text>
                    </View>
                    <View>
                      <Text style={styles.payslipName}>{periodName}</Text>
                      <View style={styles.confidenceRow}>
                        <View
                          style={[
                            styles.confidenceDot,
                            { backgroundColor: isExported ? "#11ad32" : theme.colors.brandOrange },
                          ]}
                        />
                        <Text style={styles.confidenceText}>
                          {isExported ? "High Confidence" : "Calculated"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.payslipRight}>
                    <Text
                      style={[
                        styles.payslipAmount,
                        !isExported && { color: theme.colors.brandOrange },
                      ]}
                    >
                      {formatNOKDecimal(netPay)}
                    </Text>
                    <Text style={styles.payslipCurrency}>Netto NOK</Text>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.md,
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: theme.spacing.element,
  },
  loadingText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  /* ── Hero ── */
  hero: {
    gap: 4,
    marginBottom: theme.spacing.section,
  },
  overline: {
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },

  /* ── Primary Card ── */
  primaryCard: {
    position: "relative" as const,
    overflow: "hidden" as const,
    padding: theme.spacing.page,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.brandOrange,
    marginBottom: theme.spacing.section,
    ...theme.shadows.lg,
  },
  primaryGlow: {
    position: "absolute" as const,
    bottom: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  primaryTop: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    marginBottom: theme.spacing.section,
  },
  primaryLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.8)",
  },
  primaryAmount: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "600" as const,
    color: "#ffffff",
    marginTop: 4,
    fontVariant: ["tabular-nums" as const],
  },
  statusBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ffffff",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    color: "#ffffff",
  },
  primaryMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  primaryMetaText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: "rgba(255,255,255,0.9)",
  },
  primaryMetaDivider: {
    width: 1,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },

  /* ── Bento Grid ── */
  bentoGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.section,
  },
  bentoCard: {
    flexBasis: "47%" as unknown as number,
    flexGrow: 1,
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
  },
  bentoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: theme.spacing.md,
  },
  bentoOverline: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  bentoTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
    marginTop: 2,
  },
  bentoValue: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: theme.colors.brandOrange,
    marginTop: theme.spacing.tight,
  },

  /* ── Recent Payslips ── */
  recentSection: {
    gap: theme.spacing.element,
  },
  recentHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-end" as const,
    marginBottom: theme.spacing.xs,
  },
  recentTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  seeAll: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: theme.colors.brandOrange,
  },
  payslipRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    ...theme.shadows.sm,
  },
  payslipLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    flex: 1,
  },
  dateBlock: {
    width: 48,
    height: 48,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  dateBlockMonth: {
    fontSize: 9,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    textTransform: "uppercase" as const,
  },
  dateBlockDay: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
    marginTop: -2,
  },
  payslipName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  confidenceRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    marginTop: 3,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 9,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  payslipRight: {
    alignItems: "flex-end" as const,
  },
  payslipAmount: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },
  payslipCurrency: {
    fontSize: 9,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
    marginTop: 2,
  },
}));
