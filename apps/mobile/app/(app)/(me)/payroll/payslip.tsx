/**
 * Payslip List — All settled payslips in a clean list.
 *
 * Tapping a payslip navigates to the detail view (payslip-detail).
 * Shows: period name, payment date, net amount, status badge.
 */

import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { FileText, Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePayslips } from "@/hooks/queries/use-payslips";
import { strings } from "@/constants/strings";

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

function formatPaymentDate(exportedAt: string | null): string {
  if (!exportedAt) return "Behandles";
  const d = new Date(exportedAt);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `Utbetalt ${day}.${month}.${year}`;
}

function formatNOK(amount: number): string {
  return amount.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PayslipListScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const { data: payslipsData, isLoading, error } = usePayslips();
  const payslips = payslipsData?.payslips ?? [];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.brandOrange} />
          <Text style={styles.loadingText}>{strings.common.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || payslips.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Lønnsslipper</Text>
        </View>
        <EmptyState
          title="Ingen lønnsslipper"
          subtitle="Når din første lønnsperiode er ferdigbehandlet, vises den her."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.header}>
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
        <View>
          <Text style={styles.headerTitle}>Lønnsslipper</Text>
          <Text style={styles.headerSubtitle}>{payslips.length} perioder</Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {payslips.map((entry, index) => {
          const netPay = entry.calculation?.total_pay ?? 0;
          const isExported = !!entry.period.exported_at;
          const periodName = formatPeriodName(entry.period.start_date);
          const paymentDate = formatPaymentDate(entry.period.exported_at);

          return (
            <Animated.View
              key={entry.period.id}
              entering={FadeInDown.delay(100 + index * 60)
                .duration(400)
                .springify()}
            >
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({
                    pathname: "./payslip-detail",
                    params: { periodId: entry.period.id },
                  });
                }}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                {/* Left: icon + text */}
                <View style={styles.cardLeft}>
                  <View style={styles.iconCircle}>
                    <FileText size={20} color={theme.colors.mutedForeground} strokeWidth={1.5} />
                  </View>
                  <View style={styles.cardText}>
                    <View style={styles.periodRow}>
                      <Text style={styles.periodName}>{periodName}</Text>
                      {isExported && (
                        <View style={styles.statusBadge}>
                          <Check size={10} color={theme.colors.success} strokeWidth={3} />
                          <Text style={styles.statusText}>UTBETALT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.paymentDate}>{paymentDate}</Text>
                  </View>
                </View>

                {/* Right: amount + chevron */}
                <View style={styles.cardRight}>
                  <View style={styles.amountCol}>
                    <Text style={styles.amount}>{formatNOK(netPay)}</Text>
                    <Text style={styles.currency}>NOK</Text>
                  </View>
                  <ChevronRight
                    size={18}
                    color={withOpacity(theme.colors.mutedForeground, 0.3)}
                    strokeWidth={1.5}
                  />
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
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
  loadingText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.tight,
    paddingBottom: theme.spacing.section,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "300",
    letterSpacing: -0.5,
    color: theme.colors.foreground,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: theme.colors.brandOrange,
    marginTop: 2,
  },

  /* Scroll */
  scrollContent: {
    paddingHorizontal: theme.spacing.section,
    paddingBottom: 120,
    gap: theme.spacing.element,
  },

  /* Card */
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: 20,
    padding: theme.spacing.card,
    gap: theme.spacing.element,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.muted, 0.5)
      : withOpacity(theme.colors.muted, 0.8),
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  periodName: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    backgroundColor: withOpacity(theme.colors.success, 0.1),
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: theme.colors.success,
  },
  paymentDate: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  amountCol: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  currency: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },
}));
