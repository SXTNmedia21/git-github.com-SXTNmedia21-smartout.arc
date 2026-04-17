/**
 * Payslip Detail — Full breakdown of a single payslip period.
 *
 * Based on "The Tactile Nomad" Payroll Detail mockup:
 * 1. Hero — net payout amount (serif, large) + confidence badge
 * 2. Gross Earnings — base salary + supplements with icons
 * 3. Deductions — tax + pension with verification label
 * 4. Footer — payment info + download PDF button
 */

import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Download,
  Moon,
  Calendar,
  PartyPopper,
  ShieldCheck,
  Info,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import { usePayslips, usePayslipDetail } from "@/hooks/queries/use-payslips";
import { useMyProfile } from "@/hooks/queries/use-my-profile";

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

function formatNOK(amount: number): string {
  return amount.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPaymentDate(exportedAt: string | null, endDate: string): string {
  const source = exportedAt ?? endDate;
  const d = new Date(source);
  const day = d.getDate();
  const monthName = MONTH_NAMES[d.getMonth()];
  return `${monthName} ${day}.`;
}

/** Map supplement description to an icon */
function getSupplementIcon(description: string) {
  const desc = description.toLowerCase();
  if (desc.includes("kveld") || desc.includes("natt")) return Moon;
  if (desc.includes("helg") || desc.includes("weekend")) return Calendar;
  if (desc.includes("helligdag") || desc.includes("holiday")) return PartyPopper;
  return Calendar;
}

export default function PayslipDetailScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { periodId } = useLocalSearchParams<{ periodId: string }>();
  const { data: profile } = useMyProfile();
  const { data: payslipsData } = usePayslips();
  const { data: detailData, isLoading: detailLoading } = usePayslipDetail(periodId ?? "");

  const payslip = useMemo(
    () => payslipsData?.payslips.find((p) => p.period.id === periodId) ?? null,
    [payslipsData, periodId],
  );

  const calc = payslip?.calculation;
  const lines = detailData?.lines ?? [];
  const supplementLines = lines.filter((l) => l.line_type === "supplement");
  const deductionLines = lines.filter(
    (l) => l.line_type === "deduction" || l.line_type === "absence",
  );

  const netPay = calc?.total_pay ?? 0;
  const basePay = calc?.base_pay ?? 0;
  const totalDeductions = calc?.total_deductions ?? 0;
  const grossPay = basePay + supplementLines.reduce((sum, l) => sum + l.amount, 0);
  const workMinutes = calc?.net_working_minutes ?? 0;
  const workHours = (workMinutes / 60).toFixed(1);
  const hourlyRate = workMinutes > 0 ? Math.round(basePay / (workMinutes / 60)) : 0;
  const periodName = payslip ? formatPeriodName(payslip.period.start_date) : "";

  if (!periodId) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Ingen periode valgt</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top bar */}
      <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={22} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.topBarTitle}>Lønnsslipp</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      {detailLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.brandOrange} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero: Net Payout ── */}
          <Animated.View entering={FadeIn.delay(100).duration(500)} style={styles.hero}>
            <Text style={styles.heroLabel}>{periodName} Net Payout</Text>
            <Text style={styles.heroAmount}>{formatNOK(netPay)}</Text>
            <Text style={styles.heroCurrency}>NOK</Text>

            {/* Confidence badge */}
            <View style={styles.confidenceBadge}>
              <ShieldCheck size={12} color={theme.colors.brandOrange} strokeWidth={2} />
              <Text style={styles.confidenceText}>CALCULATION CONFIDENCE: 100%</Text>
            </View>
          </Animated.View>

          {/* ── Gross Earnings ── */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(400).springify()}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Gross Earnings</Text>
              <Text style={styles.sectionMeta}>Breakdown</Text>
            </View>

            <View style={styles.card}>
              {/* Base salary */}
              <View style={styles.lineRow}>
                <View style={styles.lineLeft}>
                  <Text style={styles.lineLabel}>Base Salary</Text>
                  <Text style={styles.lineMeta}>
                    {workHours} hours @ {formatNOK(hourlyRate)}
                  </Text>
                </View>
                <Text style={styles.lineAmount}>{formatNOK(basePay)}</Text>
              </View>

              <View style={styles.divider} />

              {/* Supplements header */}
              {supplementLines.length > 0 && (
                <>
                  <Text style={styles.subsectionLabel}>Supplements</Text>
                  {supplementLines.map((line, i) => {
                    const IconComponent = getSupplementIcon(line.description);
                    return (
                      <View key={`supp-${i}`}>
                        <View style={styles.supplementRow}>
                          <View style={styles.supplementLeft}>
                            <IconComponent
                              size={16}
                              color={theme.colors.brandOrange}
                              strokeWidth={1.5}
                            />
                            <Text style={styles.supplementLabel}>{line.description}</Text>
                          </View>
                          <Text style={styles.lineAmount}>{formatNOK(line.amount)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}

              {/* Gross total */}
              <View style={styles.dividerThick} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Gross</Text>
                <Text style={styles.totalAmount}>{formatNOK(grossPay)}</Text>
              </View>
            </View>
          </Animated.View>

          {/* ── Deductions ── */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Deductions</Text>

            <View style={styles.card}>
              {deductionLines.length > 0 ? (
                deductionLines.map((line, i) => {
                  const isLast = i === deductionLines.length - 1;
                  return (
                    <View key={`ded-${i}`}>
                      <View style={styles.lineRow}>
                        <View style={styles.lineLeft}>
                          <Text style={styles.lineLabel}>{line.description}</Text>
                          {i === 0 && <Text style={styles.lineMetaRed}>Automatic calculation</Text>}
                        </View>
                        <Text style={styles.lineAmountRed}>
                          -{formatNOK(Math.abs(line.amount))}
                        </Text>
                      </View>
                      {!isLast && <View style={styles.divider} />}
                    </View>
                  );
                })
              ) : totalDeductions > 0 ? (
                <View style={styles.lineRow}>
                  <View style={styles.lineLeft}>
                    <Text style={styles.lineLabel}>Skattetrekk</Text>
                    <Text style={styles.lineMetaRed}>Automatic calculation</Text>
                  </View>
                  <Text style={styles.lineAmountRed}>-{formatNOK(totalDeductions)}</Text>
                </View>
              ) : null}

              {/* Verification label */}
              <View style={styles.verificationBar}>
                <View style={styles.verificationLeft}>
                  <Info size={12} color={theme.colors.mutedForeground} strokeWidth={1.5} />
                  <Text style={styles.verificationText}>Verified by National Tax Authority</Text>
                </View>
                <Pressable onPress={() => Haptics.selectionAsync()}>
                  <Text style={styles.verificationLink}>Details</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>

          {/* ── Footer ── */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(400).springify()}
            style={styles.footer}
          >
            <Text style={styles.footerText}>
              Paid on{" "}
              {formatPaymentDate(
                payslip?.period.exported_at ?? null,
                payslip?.period.end_date ?? "",
              )}{" "}
              to account ending in ****
            </Text>

            <Pressable
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
              style={({ pressed }) => [styles.downloadButton, pressed && styles.downloadPressed]}
            >
              <Download size={20} color="#ffffff" strokeWidth={2} />
              <Text style={styles.downloadText}>Download PDF Payslip</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
  },
  emptyText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.element,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.secondary,
  },
  topBarTitle: {
    fontSize: 24,
    fontWeight: "300",
    letterSpacing: -0.3,
    color: theme.colors.foreground,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Scroll */
  scrollContent: {
    paddingHorizontal: theme.spacing.section,
    paddingBottom: 120,
  },

  /* Hero */
  hero: {
    alignItems: "center",
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.page,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.tight,
  },
  heroAmount: {
    fontSize: 56,
    fontWeight: "300",
    letterSpacing: -2,
    color: theme.colors.brandOrange,
    lineHeight: 64,
  },
  heroCurrency: {
    fontSize: 14,
    fontWeight: "500",
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    letterSpacing: 1,
    marginTop: 2,
  },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: theme.spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.2),
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.secondary,
    ...theme.shadows.sm,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: withOpacity(theme.colors.mutedForeground, 0.7),
  },

  /* Sections */
  section: {
    marginBottom: theme.spacing.page,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: theme.spacing.element,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "300",
    letterSpacing: -0.3,
    color: theme.colors.foreground,
  },
  sectionMeta: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },

  /* Card */
  card: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: 20,
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.card,
  },

  /* Line rows */
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: theme.spacing.element,
  },
  lineLeft: {
    flex: 1,
    marginRight: theme.spacing.element,
    gap: 2,
  },
  lineLabel: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  lineMeta: {
    fontSize: 10,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
    letterSpacing: 0.3,
  },
  lineMetaRed: {
    fontSize: 10,
    fontWeight: "500",
    color: theme.colors.destructive,
    letterSpacing: 0.3,
  },
  lineAmount: {
    ...theme.typography.subheadline,
    fontWeight: "700",
    color: theme.colors.foreground,
  },
  lineAmountRed: {
    ...theme.typography.subheadline,
    fontWeight: "700",
    color: theme.colors.destructive,
  },

  /* Supplements */
  subsectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: theme.colors.mutedForeground,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.tight,
  },
  supplementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.element,
  },
  supplementLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  supplementLabel: {
    ...theme.typography.subheadline,
    color: withOpacity(theme.colors.foreground, 0.7),
  },

  /* Dividers */
  divider: {
    height: 0.5,
    backgroundColor: withOpacity(theme.colors.border, 0.15),
  },
  dividerThick: {
    height: 0.5,
    backgroundColor: withOpacity(theme.colors.border, 0.25),
    marginTop: theme.spacing.element,
  },

  /* Totals */
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: theme.spacing.md,
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: "300",
    letterSpacing: -0.3,
    color: theme.colors.foreground,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },

  /* Verification bar */
  verificationBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing.element,
    marginHorizontal: -theme.spacing.section,
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.element,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.muted, 0.3)
      : withOpacity(theme.colors.muted, 0.6),
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  verificationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  verificationText: {
    fontSize: 10,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },
  verificationLink: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.colors.brandOrange,
  },

  /* Footer */
  footer: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.page,
  },
  footerText: {
    ...theme.typography.caption,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 18,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    backgroundColor: theme.colors.brandOrange,
    paddingVertical: 18,
    borderRadius: 9999,
    ...theme.shadows.lg,
  },
  downloadPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  downloadText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
}));
