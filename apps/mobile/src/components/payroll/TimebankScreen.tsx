/**
 * TimebankScreen — Nordic Split TOIL balance with hero banner and ledger.
 *
 * Layout:
 * 1. Hero banner: Dark blue gradient card, "avspasering" italic serif, balance in mono, updated badge
 * 2. Stats grid: 2-col (Opptjent i aar, Brukt i aar)
 * 3. Ledger: "Siste bevegelser" with icon circles, amounts, and dates
 *
 * Data from useTimebankBalance() — read-only, append-only ledger.
 */

import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Coffee,
} from "lucide-react-native";

import { createStyles, useTheme, withOpacity } from "@/theme";
import { EmptyState } from "@/components/ui/EmptyState";
import { strings } from "@/constants/strings";
import { useTimebankBalance } from "@/hooks/queries/use-timebank-balance";
import { formatDate } from "@/lib/format-date";
import type { Database } from "@smartout/supabase/database.types";

type TimebankEntryType = Database["payroll"]["Enums"]["timebank_entry_type"];

/** Entry types that add hours — shown with orange accent */
const CREDIT_TYPES: TimebankEntryType[] = ["accrual", "carry_over", "adjustment"];

/** Formats hours as decimal string — e.g. 12.5 -> "12.5", 4.0 -> "4.0" */
function formatHoursDecimal(hours: number): string {
  const abs = Math.abs(hours);
  return abs % 1 === 0 ? `${abs}.0` : abs.toFixed(1);
}

/** Formats hours as "Xt Ym" for ledger entries */
function formatHoursCompact(hours: number): string {
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  if (h === 0 && m === 0) return "0t";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}.0t`;
  return `${h}.${Math.round((abs - h) * 10)}t`;
}

export function TimebankScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data, isLoading, error } = useTimebankBalance();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>{strings.common.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{strings.payroll.loadErrorTimebank}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const balance = data?.balance ?? 0;
  const entries = data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.backButton}
          >
            <ChevronLeft size={22} color={theme.colors.foreground} strokeWidth={1.8} />
          </Pressable>
          <Text style={styles.topBarTitle}>Timebank</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState title={strings.payroll.timebank} subtitle={strings.payroll.noTimebank} />
      </SafeAreaView>
    );
  }

  /* Compute year-to-date earned and used from ledger entries */
  const currentYear = new Date().getFullYear();
  const ytdEarned = entries
    .filter(
      (e) =>
        CREDIT_TYPES.includes(e.entry_type) &&
        new Date(e.effective_date).getFullYear() === currentYear,
    )
    .reduce((sum, e) => sum + Math.abs(e.hours), 0);

  const ytdUsed = entries
    .filter(
      (e) =>
        !CREDIT_TYPES.includes(e.entry_type) &&
        new Date(e.effective_date).getFullYear() === currentYear,
    )
    .reduce((sum, e) => sum + Math.abs(e.hours), 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top bar with back button */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backButton}
        >
          <ChevronLeft size={22} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.topBarTitle}>Timebank</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Hero Banner — dark blue gradient card ── */}
        <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.heroBanner}>
          <View style={styles.heroTopRow}>
            <Clock size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
            <Text style={styles.heroSubtitle}>avspasering</Text>
          </View>
          <Text style={styles.heroBalance}>{formatHoursDecimal(balance)} timer</Text>
          <View style={styles.updatedBadge}>
            <View style={styles.updatedDot} />
            <Text style={styles.updatedText}>Oppdatert na</Text>
          </View>
        </Animated.View>

        {/* ── Stats Grid — 2-col ── */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(400).springify()}
          style={styles.statsGrid}
        >
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconCircle,
                { backgroundColor: withOpacity(theme.colors.brandOrange, 0.12) },
              ]}
            >
              <TrendingUp size={16} color={theme.colors.brandOrange} strokeWidth={2} />
            </View>
            <Text style={styles.statLabel}>Opptjent i ar</Text>
            <Text style={styles.statValue}>
              <Text style={styles.statPlus}>+</Text>
              {formatHoursDecimal(ytdEarned)}t
            </Text>
          </View>
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconCircle,
                { backgroundColor: withOpacity(theme.colors.mutedForeground, 0.1) },
              ]}
            >
              <TrendingDown size={16} color={theme.colors.mutedForeground} strokeWidth={2} />
            </View>
            <Text style={styles.statLabel}>Brukt i ar</Text>
            <Text style={styles.statValue}>
              <Text style={styles.statMinus}>-</Text>
              {formatHoursDecimal(ytdUsed)}t
            </Text>
          </View>
        </Animated.View>

        {/* ── Ledger: Siste bevegelser ── */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(400).springify()}
          style={styles.ledgerSection}
        >
          <Text style={styles.sectionTitle}>Siste bevegelser</Text>

          <View style={styles.ledgerCard}>
            {entries.map((entry, index) => {
              const isCredit = CREDIT_TYPES.includes(entry.entry_type);

              /* Pick an icon based on entry description or type */
              const desc = (entry.description ?? entry.entry_type).toLowerCase();
              const LedgerIcon = desc.includes("overtid")
                ? Zap
                : desc.includes("avgang") || desc.includes("uttak")
                  ? Coffee
                  : isCredit
                    ? ArrowUpRight
                    : ArrowDownRight;

              return (
                <View key={entry.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.ledgerRow}>
                    {/* Icon circle */}
                    <View
                      style={[
                        styles.ledgerIconCircle,
                        {
                          backgroundColor: isCredit
                            ? withOpacity(theme.colors.brandOrange, 0.12)
                            : withOpacity(theme.colors.destructive, 0.1),
                        },
                      ]}
                    >
                      <LedgerIcon
                        size={16}
                        color={isCredit ? theme.colors.brandOrange : theme.colors.destructive}
                        strokeWidth={2}
                      />
                    </View>

                    {/* Title + date */}
                    <View style={styles.ledgerInfo}>
                      <Text style={styles.ledgerDescription} numberOfLines={1}>
                        {entry.description ?? entry.entry_type}
                      </Text>
                      <Text style={styles.ledgerDate}>{formatDate(entry.effective_date)}</Text>
                    </View>

                    {/* Amount */}
                    <Text
                      style={[
                        styles.ledgerAmount,
                        isCredit ? styles.amountPositive : styles.amountNegative,
                      ]}
                    >
                      {isCredit ? "+" : "-"}
                      {formatHoursCompact(entry.hours)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.element,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  topBarTitle: {
    fontSize: 24,
    fontWeight: "300" as const,
    letterSpacing: -0.3,
    color: theme.colors.foreground,
  },
  content: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.md,
    paddingBottom: 120,
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

  /* ── Hero Banner ── */
  heroBanner: {
    backgroundColor: theme.isDark ? "#0c1a2e" : "#0f2240",
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.page,
    alignItems: "center" as const,
    marginTop: theme.spacing.section,
    marginBottom: theme.spacing.section,
    ...theme.shadows.lg,
  },
  heroTopRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginBottom: theme.spacing.element,
  },
  heroSubtitle: {
    fontSize: 16,
    fontStyle: "italic" as const,
    fontWeight: "300" as const,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
  },
  heroBalance: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "200" as const,
    color: "#ffffff",
    letterSpacing: -1,
    marginBottom: theme.spacing.element,
  },
  updatedBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  updatedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#11ad32",
  },
  updatedText: {
    ...theme.typography.micro,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.5,
  },

  /* ── Stats Grid ── */
  statsGrid: {
    flexDirection: "row" as const,
    gap: theme.spacing.element,
    marginBottom: theme.spacing.section,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.element,
    gap: theme.spacing.tight,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.xs,
  },
  statValue: {
    ...theme.typography.headline,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.foreground,
  },
  statPlus: {
    color: theme.colors.brandOrange,
  },
  statMinus: {
    color: theme.colors.mutedForeground,
  },

  /* ── Ledger ── */
  ledgerSection: {
    gap: theme.spacing.element,
  },
  sectionTitle: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  ledgerCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.tight,
  },
  divider: {
    height: 0.5,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  },
  ledgerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: theme.spacing.element,
    gap: theme.spacing.element,
  },
  ledgerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ledgerInfo: {
    flex: 1,
  },
  ledgerDescription: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  ledgerDate: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  ledgerAmount: {
    ...theme.typography.bodyBold,
    fontWeight: theme.fontWeights.bold,
  },
  amountPositive: {
    color: theme.colors.brandOrange,
  },
  amountNegative: {
    color: theme.colors.destructive,
  },
}));
