/**
 * TimebankScreen — Displays the employee's TOIL (Time Off In Lieu) balance
 * and recent timebank ledger entries.
 *
 * Read-only. Data from useTimebankBalance() hook which returns an append-only
 * ledger of entries and a client-computed net balance in hours.
 *
 * Trust tier: Settled — append-only ledger is the canonical source.
 */

import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { createStyles, withOpacity } from "@/theme";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/common/SectionHeader";
import { strings } from "@/constants/strings";
import { useTimebankBalance } from "@/hooks/queries/use-timebank-balance";
import { formatDate, formatTimestamp } from "@/lib/format-date";
import type { Database } from "@smartout/supabase/database.types";

// UI Events:
// - display-only: read-only screen, no mutations
// - color-regime: entry-type-based (accrual/carry_over = green, withdrawal/expiry/payout = red)

type TimebankEntryType = Database["payroll"]["Enums"]["timebank_entry_type"];

/** Entry types that add hours — shown in green with + prefix */
const CREDIT_TYPES: TimebankEntryType[] = ["accrual", "carry_over", "adjustment"];

/** Formats hours as "Xt Ym" — e.g., 2.5 → "2t 30m", 0.75 → "45m" */
function formatHours(hours: number): string {
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);

  if (h === 0 && m === 0) return "0t";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

export function TimebankScreen() {
  const styles = useStyles();
  const { data, isLoading, error } = useTimebankBalance();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{strings.common.loading}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{strings.payroll.loadErrorTimebank}</Text>
      </View>
    );
  }

  const balance = data?.balance ?? 0;
  const entries = data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <EmptyState title={strings.payroll.timebank} subtitle={strings.payroll.noTimebank} />
      </ScrollView>
    );
  }

  /** Most recent entry date for "last updated" */
  const lastUpdated = entries.length > 0 ? entries[0].created_at : "";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Blue balance banner */}
      <View style={styles.balanceBanner}>
        <Text style={styles.balanceNumber}>
          {balance % 1 === 0 ? balance.toString() : balance.toFixed(1)}
        </Text>
        <Text style={styles.balanceUnit}>{strings.payroll.hours}</Text>
        <Text style={styles.balanceLabel}>{strings.payroll.availableForToil}</Text>
      </View>

      {/* Ledger: recent movements */}
      <View style={styles.ledgerSection}>
        <SectionHeader title={strings.payroll.recentMovements} />
        <Card>
          {entries.map((entry, index) => {
            const isCredit = CREDIT_TYPES.includes(entry.entry_type);
            return (
              <View key={entry.id}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.ledgerRow}>
                  <View style={styles.ledgerLeft}>
                    <Text style={styles.ledgerDescription} numberOfLines={1}>
                      {entry.description ?? entry.entry_type}
                    </Text>
                    <Text style={styles.ledgerDate}>{formatDate(entry.effective_date)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.ledgerAmount,
                      isCredit ? styles.amountPositive : styles.amountNegative,
                    ]}
                  >
                    {isCredit ? "+" : "-"}
                    {formatHours(entry.hours)}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>
      </View>

      {/* Last updated timestamp */}
      {lastUpdated !== "" && (
        <Text style={styles.lastUpdated}>
          {strings.payroll.lastUpdated} {formatTimestamp(lastUpdated)}
        </Text>
      )}
    </ScrollView>
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

  /* Blue balance banner */
  balanceBanner: {
    backgroundColor: withOpacity(theme.colors.info, 0.12),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.info, 0.2),
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.section,
    paddingHorizontal: theme.spacing.card,
    alignItems: "center" as const,
    marginBottom: theme.spacing.section,
  },
  balanceNumber: {
    ...theme.typography.largeTitle,
    fontSize: 48,
    lineHeight: 56,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.foreground,
  },
  balanceUnit: {
    ...theme.typography.headline,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  balanceLabel: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.tight,
  },

  /* Ledger section */
  ledgerSection: {
    marginBottom: theme.spacing.section,
    gap: theme.spacing.tight,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  ledgerRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: theme.spacing.element,
  },
  ledgerLeft: {
    flex: 1,
    marginRight: theme.spacing.element,
  },
  ledgerDescription: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  ledgerDate: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  ledgerAmount: {
    ...theme.typography.bodyBold,
  },
  amountPositive: {
    color: theme.colors.success,
  },
  amountNegative: {
    color: theme.colors.destructive,
  },

  /* Last updated */
  lastUpdated: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
    marginTop: theme.spacing.tight,
  },
}));
