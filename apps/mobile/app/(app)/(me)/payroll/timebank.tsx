/**
 * Timebank — Balance overview with hero card and ledger.
 *
 * Fetches real timebank entries from payroll.timebank_entry via useTimebankBalance().
 * Balance is computed client-side: sum(credits) - sum(debits).
 *
 * Layout:
 * 1. Hero card: deep blue gradient, "avspasering" serif, computed balance
 * 2. Stats bento (2-col): Opptjent i år | Brukt i år
 * 3. Siste bevegelser: ledger list with +/- amounts
 */

import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LogOut, PlusCircle, Clock, CalendarX, RefreshCw } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { ActionHeader } from "@/components/navigation/ActionHeader";
import { useTimebankBalance } from "@/hooks/queries/use-timebank-balance";

/* ── Constants ── */

/** Filter chips — Alle = no filter, others map to account_type */
type AccountFilter = "all" | "holiday" | "toil" | "wellness";

const FILTER_CHIPS: { value: AccountFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "holiday", label: "Ferie" },
  { value: "toil", label: "TOIL" },
  { value: "wellness", label: "Velferd" },
];

/** Entry types that add hours to the timebank */
const CREDIT_TYPES = ["accrual", "carry_over", "adjustment"] as const;

/** Maps entry_type to a user-friendly label and icon */
const ENTRY_TYPE_CONFIG: Record<string, { label: string; icon: typeof PlusCircle }> = {
  accrual: { label: "Overtid opptjent", icon: PlusCircle },
  carry_over: { label: "Overført fra i fjor", icon: PlusCircle },
  adjustment: { label: "Justering", icon: RefreshCw },
  withdrawal: { label: "Uttak avspasering", icon: LogOut },
  expiry: { label: "Utgått", icon: CalendarX },
  payout: { label: "Utbetalt", icon: Clock },
};

/** Format a date string to Norwegian display format: "22. MAI 2026 • FREDAG" */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const months = [
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
  ];
  const days = ["SØNDAG", "MANDAG", "TIRSDAG", "ONSDAG", "TORSDAG", "FREDAG", "LØRDAG"];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const weekday = days[date.getDay()];
  return `${day}. ${month} ${year} \u2022 ${weekday}`;
}

/* ── Component ── */

export default function TimebankScreen() {
  const styles = useStyles();
  const theme = useTheme();

  const { data, isLoading, error } = useTimebankBalance();

  // T7.3: Active account-type chip filter
  const [activeFilter, setActiveFilter] = useState<AccountFilter>("all");

  // Filter entries by account_type when a chip is active
  const filteredEntries = useMemo(() => {
    const entries = data?.entries ?? [];
    if (activeFilter === "all") return entries;
    return entries.filter((e) => e.account_type === activeFilter);
  }, [data?.entries, activeFilter]);

  // Compute yearly stats from filtered entries — sum credits and debits for current year
  const yearlyStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let earned = 0;
    let used = 0;

    for (const entry of filteredEntries) {
      const entryYear = new Date(entry.effective_date + "T00:00:00").getFullYear();
      if (entryYear !== currentYear) continue;

      const isCredit = (CREDIT_TYPES as readonly string[]).includes(entry.entry_type);
      if (isCredit) {
        earned += entry.hours;
      } else {
        used += entry.hours;
      }
    }

    return { earned, used };
  }, [filteredEntries]);

  // Take the 10 most recent entries for the ledger display
  const recentEntries = useMemo(() => {
    return filteredEntries.slice(0, 10);
  }, [filteredEntries]);

  const balance = data?.balance ?? 0;
  const today = new Date().toLocaleDateString("no-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.container}>
      <ActionHeader title="Timebank" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Card — deep blue */}
        <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroOverline}>Tilgjengelig tid</Text>
              <Text style={styles.heroTitle}>avspasering</Text>
            </View>
            <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot} />
              <Text style={styles.heroBadgeText}>{isLoading ? "Laster..." : "Oppdatert nå"}</Text>
            </View>
          </View>

          <View style={styles.heroBottom}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#ffffff" />
            ) : (
              <>
                <View style={styles.heroBalanceRow}>
                  <Text style={styles.heroBalance}>{balance.toFixed(1)}</Text>
                  <Text style={styles.heroBalanceUnit}>timer</Text>
                </View>
                <Text style={styles.heroCaption}>Basert på dine bevegelser frem til {today}</Text>
              </>
            )}
          </View>
        </Animated.View>

        {/* Stats Bento */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Opptjent i år</Text>
            <Text style={[styles.statValue, { color: theme.colors.brandOrange }]}>
              +{yearlyStats.earned.toFixed(1)}t
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Brukt i år</Text>
            <Text style={styles.statValue}>-{yearlyStats.used.toFixed(1)}t</Text>
          </View>
        </View>

        {/* T7.3: Account-type chip filter */}
        <View style={styles.chipRow}>
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeFilter === chip.value;
            return (
              <Pressable
                key={chip.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveFilter(chip.value);
                }}
                style={[styles.chip, isActive && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Ledger */}
        <View style={styles.ledgerSection}>
          <View style={styles.ledgerHeader}>
            <Text style={styles.ledgerTitle}>Siste bevegelser</Text>
            <Pressable onPress={() => Haptics.selectionAsync()}>
              <Text style={styles.ledgerViewAll}>SE ALLE</Text>
            </Pressable>
          </View>

          {isLoading && (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
            </View>
          )}

          {error && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Kunne ikke laste timebank</Text>
            </View>
          )}

          {!isLoading && !error && recentEntries.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Ingen bevegelser enn\u00e5</Text>
            </View>
          )}

          {recentEntries.map((entry) => {
            const isCredit = (CREDIT_TYPES as readonly string[]).includes(entry.entry_type);
            const config = ENTRY_TYPE_CONFIG[entry.entry_type] ?? {
              label: entry.entry_type,
              icon: Clock,
            };
            const IconComponent = config.icon;

            return (
              <View key={entry.id} style={styles.ledgerRow}>
                <View style={styles.ledgerLeft}>
                  <View
                    style={[
                      styles.ledgerIcon,
                      {
                        backgroundColor: isCredit
                          ? withOpacity(theme.colors.brandOrange, 0.08)
                          : withOpacity(theme.colors.destructive, 0.08),
                      },
                    ]}
                  >
                    <IconComponent
                      size={20}
                      color={isCredit ? theme.colors.brandOrange : theme.colors.destructive}
                      strokeWidth={1.5}
                    />
                  </View>
                  <View>
                    <Text style={styles.ledgerName}>{entry.description || config.label}</Text>
                    <Text style={styles.ledgerDate}>{formatDate(entry.effective_date)}</Text>
                  </View>
                </View>
                <View style={styles.ledgerRight}>
                  <Text
                    style={[
                      styles.ledgerAmount,
                      {
                        color: isCredit ? theme.colors.brandOrange : theme.colors.foreground,
                      },
                    ]}
                  >
                    {isCredit ? "+" : "-"}
                    {entry.hours.toFixed(1)}t
                  </Text>
                  <Text style={styles.ledgerNote}>{isCredit ? "Opptjent" : "Brukt"}</Text>
                </View>
              </View>
            );
          })}
        </View>
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
    paddingBottom: 160,
  },

  /* Hero — deep blue card */
  heroCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.page,
    marginBottom: theme.spacing.page,
    backgroundColor: "#1c3a5e",
    overflow: "hidden" as const,
    minHeight: 220,
    justifyContent: "space-between" as const,
    ...theme.shadows.lg,
  },
  heroTop: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
  },
  heroOverline: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.6)",
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: "#ffffff",
    marginTop: 4,
  },
  heroBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#93c5fd",
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    color: "#ffffff",
  },
  heroBottom: {
    marginTop: theme.spacing.section,
  },
  heroBalanceRow: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
    gap: 8,
  },
  heroBalance: {
    fontSize: 64,
    fontWeight: "300" as const,
    color: "#ffffff",
    letterSpacing: -2,
    fontVariant: ["tabular-nums" as const],
  },
  heroBalanceUnit: {
    fontSize: 22,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: "rgba(255,255,255,0.7)",
  },
  heroCaption: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
    maxWidth: 240,
  },

  /* Stats */
  statsRow: {
    flexDirection: "row" as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.page,
  },
  statCard: {
    flexBasis: "47%" as unknown as number,
    flexGrow: 1,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    justifyContent: "center" as const,
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: theme.colors.mutedForeground,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },

  /* Chip filter row (T7.3) */
  chipRow: {
    flexDirection: "row" as const,
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.page,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.secondary,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipActive: {
    backgroundColor: theme.colors.brandOrange,
    borderColor: theme.colors.brandOrange,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
  },
  chipTextActive: {
    color: "#ffffff",
    fontWeight: "600" as const,
  },

  /* Ledger */
  ledgerSection: {
    gap: theme.spacing.element,
  },
  ledgerHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: theme.spacing.xs,
  },
  ledgerTitle: {
    fontSize: 24,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  ledgerViewAll: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: theme.colors.brandOrange,
  },
  ledgerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    borderRadius: theme.radius.md,
    padding: theme.spacing.card,
  },
  ledgerLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    flex: 1,
  },
  ledgerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ledgerName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  ledgerDate: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  ledgerRight: {
    alignItems: "flex-end" as const,
    gap: 2,
  },
  ledgerAmount: {
    fontSize: 18,
    fontWeight: "500" as const,
    fontVariant: ["tabular-nums" as const],
  },
  ledgerNote: {
    fontSize: 10,
    fontWeight: "400" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  /* Empty / Loading states */
  emptyState: {
    paddingVertical: theme.spacing.page,
    alignItems: "center" as const,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    fontStyle: "italic" as const,
  },
}));
