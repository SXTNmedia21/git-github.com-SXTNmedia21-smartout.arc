/**
 * AbsenceBalanceScreen — Displays absence quotas (vacation, sick leave, care days)
 * and recent ledger movements.
 *
 * Read-only. Data from useAbsenceBalance() hook (absence_quota + absence_ledger).
 * Since the hook returns quotas without joined absence_type names, we fetch
 * absence types separately to resolve display labels.
 *
 * Trust tier: Settled — all figures sourced from absence_quota.remaining_days
 * (generated column).
 */

import React, { useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { createStyles, useTheme } from "@/theme";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/common/SectionHeader";
import { strings } from "@/constants/strings";
import { useAbsenceBalance } from "@/hooks/queries/use-absence-balance";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

// UI Events:
// - display-only: read-only screen, no mutations
// - color-regime: balance-health-based (green > 20%, amber < 20%, red = 0)

type AbsenceType = Database["payroll"]["Tables"]["absence_type"]["Row"];
type AbsenceLedgerType = Database["payroll"]["Enums"]["absence_ledger_type"];

/** Fetch absence type names for display labels */
async function fetchAbsenceTypes(): Promise<AbsenceType[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (profileError) throw profileError;

  const { data, error } = await supabase
    .schema("payroll")
    .from("absence_type")
    .select("*")
    .eq("workspace_id", profile.workspace_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Ledger entry types that represent positive movements (entitlement, carry-over, adjustment) */
const POSITIVE_ENTRY_TYPES: AbsenceLedgerType[] = ["entitlement", "carry_over", "adjustment"];

/** Returns the semantic color key for a balance based on remaining percentage */
function getBalanceColorKey(
  remaining: number,
  entitled: number,
): "success" | "warning" | "destructive" {
  if (remaining <= 0) return "destructive";
  if (entitled > 0 && remaining / entitled < 0.2) return "warning";
  return "success";
}

/** Format a date string as "DD.MM.YYYY" */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const dd = date.getDate().toString().padStart(2, "0");
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Format a timestamp for "last updated" display */
function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const dd = date.getDate().toString().padStart(2, "0");
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const hh = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${dd}.${mm} kl. ${hh}:${min}`;
}

export function AbsenceBalanceScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const { data, isLoading, error } = useAbsenceBalance();
  const absenceTypesQuery = useQuery<AbsenceType[]>({
    queryKey: ["absence-types"],
    queryFn: fetchAbsenceTypes,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  /** Map absence_type_id to display name (Norwegian preferred) */
  const typeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (absenceTypesQuery.data) {
      for (const t of absenceTypesQuery.data) {
        map.set(t.id, t.name_no ?? t.name);
      }
    }
    return map;
  }, [absenceTypesQuery.data]);

  if (isLoading || absenceTypesQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Laster...</Text>
      </View>
    );
  }

  if (error || absenceTypesQuery.error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Kunne ikke laste fraværssaldo</Text>
      </View>
    );
  }

  const quotas = data?.quotas ?? [];
  const ledgerEntries = data?.ledgerEntries ?? [];

  if (quotas.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <EmptyState title={strings.payroll.absenceBalance} subtitle={strings.payroll.noQuotas} />
      </ScrollView>
    );
  }

  /** Most recent updated_at across quotas — used for "last updated" footer */
  const lastUpdated = quotas.reduce((latest, q) => {
    return q.updated_at > latest ? q.updated_at : latest;
  }, quotas[0].updated_at);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Balance rows — one per absence type */}
      <Card style={styles.section}>
        {quotas.map((quota, index) => {
          const typeName = typeNameMap.get(quota.absence_type_id) ?? "Ukjent type";
          const remaining = quota.remaining_days ?? 0;
          const entitled = quota.entitled_days;
          const colorKey = getBalanceColorKey(remaining, entitled);
          const color = theme.colors[colorKey];

          return (
            <View key={quota.id}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.balanceRow}>
                <View style={styles.balanceLeft}>
                  <View style={[styles.typeDot, { backgroundColor: color }]} />
                  <Text style={styles.typeName}>{typeName}</Text>
                </View>
                <Text style={[styles.balanceValue, { color }]}>
                  {remaining} {strings.payroll.of} {entitled} dager
                </Text>
              </View>
            </View>
          );
        })}
      </Card>

      {/* Ledger: recent movements */}
      {ledgerEntries.length > 0 && (
        <View style={styles.ledgerSection}>
          <SectionHeader title={strings.payroll.recentMovements} />
          <Card>
            {ledgerEntries.map((entry, index) => {
              const isPositive = POSITIVE_ENTRY_TYPES.includes(entry.entry_type);
              return (
                <View key={entry.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.ledgerRow}>
                    <View style={styles.ledgerLeft}>
                      <Text style={styles.ledgerDate}>{formatDate(entry.effective_date)}</Text>
                      <Text style={styles.ledgerDescription} numberOfLines={1}>
                        {entry.description ??
                          typeNameMap.get(entry.absence_type_id) ??
                          entry.entry_type}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.ledgerAmount,
                        isPositive ? styles.amountPositive : styles.amountNegative,
                      ]}
                    >
                      {isPositive ? "+" : "-"}
                      {entry.days} d
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      )}

      {/* Last updated timestamp */}
      <Text style={styles.lastUpdated}>
        {strings.payroll.lastUpdated} {formatTimestamp(lastUpdated)}
      </Text>
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
  section: {
    marginBottom: theme.spacing.section,
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

  /* Balance rows */
  balanceRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: theme.spacing.element,
  },
  balanceLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.tight,
    flex: 1,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  typeName: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  balanceValue: {
    ...theme.typography.bodyBold,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },

  /* Ledger section */
  ledgerSection: {
    marginBottom: theme.spacing.section,
    gap: theme.spacing.tight,
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
  ledgerDate: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  ledgerDescription: {
    ...theme.typography.subheadline,
    color: theme.colors.foreground,
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
