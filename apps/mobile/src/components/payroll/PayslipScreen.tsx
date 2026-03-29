/**
 * PayslipScreen — Nordic Split payroll detail with hero card, breakdown, and history grid.
 *
 * Layout:
 * 1. Hero: Period "Mars 2026" + "UTBETALT" green badge + net amount centered + ambient glow + PDF/share
 * 2. Spesifikasjon: line items with badges (PURPLE=overtime, ORANGE=evening, RED=tax)
 * 3. Tidligere perioder: 2x2 grid cards with month, amount, status + "Vis alle" dashed card
 *
 * Data from usePayslips() + usePayslipDetail().
 */

import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Download, Share2, Check, ChevronRight } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { EmptyState } from "@/components/ui/EmptyState";
import { strings } from "@/constants/strings";
import { usePayslips, usePayslipDetail } from "@/hooks/queries/use-payslips";

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

function formatPeriodName(startDate: string): string {
  const d = new Date(startDate);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPeriodShort(startDate: string): string {
  const d = new Date(startDate);
  return `${MONTH_NAMES[d.getMonth()]?.slice(0, 3)} ${d.getFullYear()}`;
}

function formatNOK(amount: number): string {
  return amount.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Determine badge color for supplement line items */
function getSupplementBadge(description: string): {
  label: string;
  bgColor: string;
  textColor: string;
} | null {
  const desc = description.toLowerCase();
  if (desc.includes("overtid")) {
    return { label: "OVERTID", bgColor: "rgba(139,92,246,0.12)", textColor: "#8b5cf6" };
  }
  if (desc.includes("kveld")) {
    return { label: "KVELD", bgColor: "rgba(249,115,22,0.12)", textColor: "#f97316" };
  }
  if (desc.includes("helg")) {
    return { label: "HELG", bgColor: "rgba(249,115,22,0.12)", textColor: "#f97316" };
  }
  if (desc.includes("helligdag")) {
    return { label: "HELLIGDAG", bgColor: "rgba(249,115,22,0.12)", textColor: "#f97316" };
  }
  return null;
}

export function PayslipScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const _router = useRouter();

  const { data: payslipsData, isLoading, error } = usePayslips();
  const payslips = payslipsData?.payslips ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? payslips[0]?.period.id ?? "";
  const { data: detailData, isLoading: detailLoading } = usePayslipDetail(activeId);

  const activePayslip = useMemo(
    () => payslips.find((p) => p.period.id === activeId) ?? null,
    [payslips, activeId],
  );

  const lines = detailData?.lines ?? [];
  const calc = activePayslip?.calculation;

  const supplementLines = lines.filter((l) => l.line_type === "supplement");
  const deductionLines = lines.filter(
    (l) => l.line_type === "deduction" || l.line_type === "absence",
  );

  /* Previous periods (exclude active) for the history grid */
  const previousPayslips = useMemo(
    () => payslips.filter((p) => p.period.id !== activeId).slice(0, 3),
    [payslips, activeId],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{strings.common.loading}</Text>
      </View>
    );
  }

  if (error || payslips.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <EmptyState title={strings.payroll.myPay} subtitle={strings.payroll.noPayslips} />
      </ScrollView>
    );
  }

  const netPay = calc?.total_pay ?? 0;
  const basePay = calc?.base_pay ?? 0;
  const totalDeductions = calc?.total_deductions ?? 0;
  const workMinutes = calc?.net_working_minutes ?? 0;
  const workHours = (workMinutes / 60).toFixed(1);
  const hourlyRate = workMinutes > 0 ? Math.round(basePay / (workMinutes / 60)) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero Card — net payout with ambient glow ── */}
      <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.heroCard}>
        {/* Ambient glow effect */}
        <View style={styles.heroGlow} />

        <Text style={styles.heroPeriod}>
          {formatPeriodName(activePayslip?.period.start_date ?? "")}
        </Text>

        {/* UTBETALT badge */}
        <View style={styles.paidBadge}>
          <Check size={10} color="#11ad32" strokeWidth={3} />
          <Text style={styles.paidBadgeText}>UTBETALT</Text>
        </View>

        {/* Net amount */}
        <Text style={styles.heroAmount}>kr {formatNOK(netPay)}</Text>

        {/* Action buttons */}
        <View style={styles.heroActions}>
          <Pressable
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={styles.heroActionButton}
          >
            <Download size={18} color={theme.colors.foreground} strokeWidth={1.5} />
            <Text style={styles.heroActionText}>PDF</Text>
          </Pressable>
          <View style={styles.heroActionDivider} />
          <Pressable
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={styles.heroActionButton}
          >
            <Share2 size={18} color={theme.colors.foreground} strokeWidth={1.5} />
            <Text style={styles.heroActionText}>Del</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Spesifikasjon ── */}
      <Animated.View
        entering={FadeInDown.delay(150).duration(400).springify()}
        style={styles.specSection}
      >
        <Text style={styles.sectionTitle}>Spesifikasjon</Text>

        <View style={styles.specCard}>
          {/* Base salary — Arbeidstimer */}
          <View style={styles.specRow}>
            <View style={styles.specRowLeft}>
              <Text style={styles.specLabel}>Arbeidstimer</Text>
              <Text style={styles.specMeta}>
                {workHours} timer @ {formatNOK(hourlyRate)}
              </Text>
            </View>
            <Text style={styles.specAmount}>{formatNOK(basePay)}</Text>
          </View>

          <View style={styles.divider} />

          {/* Grunnlonn */}
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Grunnlonn</Text>
            <Text style={styles.specAmount}>{formatNOK(basePay)}</Text>
          </View>

          {/* Supplement lines with badges */}
          {supplementLines.map((line, i) => {
            const badge = getSupplementBadge(line.description);
            return (
              <View key={`supp-${i}`}>
                <View style={styles.divider} />
                <View style={styles.specRow}>
                  <View style={styles.specRowLeft}>
                    <View style={styles.specLabelRow}>
                      <Text style={styles.specLabel}>{line.description}</Text>
                      {badge && (
                        <View style={[styles.lineBadge, { backgroundColor: badge.bgColor }]}>
                          <Text style={[styles.lineBadgeText, { color: badge.textColor }]}>
                            {badge.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.specAmountPositive}>+{formatNOK(line.amount)}</Text>
                </View>
              </View>
            );
          })}

          {/* Deduction lines — tax in red */}
          {deductionLines.length > 0 && (
            <>
              <View style={styles.dividerThick} />
              {deductionLines.map((line, i) => (
                <View key={`ded-${i}`}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={[styles.specRow, styles.specRowDeduction]}>
                    <Text style={styles.specLabelDeduction}>{line.description}</Text>
                    <Text style={styles.specAmountDeduction}>
                      -{formatNOK(Math.abs(line.amount))}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Fallback deduction if no detailed lines */}
          {deductionLines.length === 0 && totalDeductions > 0 && (
            <>
              <View style={styles.dividerThick} />
              <View style={[styles.specRow, styles.specRowDeduction]}>
                <Text style={styles.specLabelDeduction}>{strings.payroll.taxDeduction}</Text>
                <Text style={styles.specAmountDeduction}>-{formatNOK(totalDeductions)}</Text>
              </View>
            </>
          )}
        </View>
      </Animated.View>

      {/* ── Tidligere perioder — 2x2 grid ── */}
      {previousPayslips.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(300).duration(400).springify()}
          style={styles.historySection}
        >
          <Text style={styles.sectionTitle}>Tidligere perioder</Text>

          <View style={styles.historyGrid}>
            {previousPayslips.map((payslip) => {
              const pCalc = payslip.calculation;
              const pNet = pCalc?.total_pay ?? 0;
              const isExported = !!payslip.period.exported_at;

              return (
                <Pressable
                  key={payslip.period.id}
                  style={styles.historyCard}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedId(payslip.period.id);
                  }}
                >
                  <View style={styles.historyCardTop}>
                    <Text style={styles.historyMonth}>
                      {formatPeriodShort(payslip.period.start_date)}
                    </Text>
                    {isExported && (
                      <View style={styles.historyCheck}>
                        <Check size={12} color="#11ad32" strokeWidth={2.5} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.historyAmount}>kr {formatNOK(pNet)}</Text>
                </Pressable>
              );
            })}

            {/* "Vis alle" dashed card */}
            <Pressable style={styles.historyCardDashed} onPress={() => Haptics.selectionAsync()}>
              <Text style={styles.historyShowAll}>Vis alle</Text>
              <ChevronRight size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />
            </Pressable>
          </View>
        </Animated.View>
      )}

      {detailLoading && (
        <View style={styles.detailLoading}>
          <ActivityIndicator size="small" />
        </View>
      )}
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
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

  /* ── Hero Card ── */
  heroCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.page,
    alignItems: "center" as const,
    marginTop: theme.spacing.section,
    marginBottom: theme.spacing.section,
    overflow: "hidden" as const,
    ...theme.shadows.lg,
  },
  heroGlow: {
    position: "absolute" as const,
    top: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.06),
  },
  heroPeriod: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.tight,
  },
  paidBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: withOpacity(theme.colors.success, 0.1),
    marginBottom: theme.spacing.element,
  },
  paidBadgeText: {
    ...theme.typography.micro,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.success,
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "300" as const,
    color: theme.colors.foreground,
    letterSpacing: -1,
    marginBottom: theme.spacing.card,
  },
  heroActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.tight,
    paddingHorizontal: theme.spacing.md,
  },
  heroActionButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.xs,
  },
  heroActionText: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  heroActionDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
  },

  /* ── Spesifikasjon ── */
  specSection: {
    marginBottom: theme.spacing.section,
  },
  sectionTitle: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.element,
  },
  specCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
  },
  specRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    paddingVertical: theme.spacing.element,
  },
  specRowLeft: {
    flex: 1,
    marginRight: theme.spacing.element,
  },
  specLabelRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.tight,
    flexWrap: "wrap" as const,
  },
  specLabel: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  specMeta: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  specAmount: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.foreground,
  },
  specAmountPositive: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.success,
  },
  lineBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  lineBadgeText: {
    fontSize: 9,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  specRowDeduction: {
    backgroundColor: withOpacity(theme.colors.destructive, 0.04),
    marginHorizontal: -theme.spacing.card,
    paddingHorizontal: theme.spacing.card,
    borderRadius: theme.radius.sm,
  },
  specLabelDeduction: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.destructive,
  },
  specAmountDeduction: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.destructive,
  },
  divider: {
    height: 0.5,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  },
  dividerThick: {
    height: 1,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    marginVertical: theme.spacing.xs,
  },

  /* ── Tidligere perioder — 2x2 grid ── */
  historySection: {
    marginBottom: theme.spacing.section,
  },
  historyGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.spacing.element,
  },
  historyCard: {
    width: "47%" as unknown as number,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.element,
    gap: theme.spacing.tight,
  },
  historyCardTop: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  historyMonth: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  historyCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: withOpacity(theme.colors.success, 0.1),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  historyAmount: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  historyCardDashed: {
    width: "47%" as unknown as number,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.element,
    borderWidth: 1.5,
    borderStyle: "dashed" as const,
    borderColor: theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
  },
  historyShowAll: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.mutedForeground,
  },

  detailLoading: {
    alignItems: "center" as const,
    paddingVertical: theme.spacing.element,
  },
}));
