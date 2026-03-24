/**
 * SupplementsDetailScreen — Kveld / helg / helligdag tillegg with color-coded badges.
 *
 * Uses the same supplement engine as PayrollHomeCard for a template shift window
 * so employees see which rules apply to typical service hours. Read-only.
 */

import React, { useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { createStyles } from "@/theme";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/common/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { strings } from "@/constants/strings";
import { getTrustLabel } from "@/lib/trust-labels";
import { getShiftSupplements, mapDbRules } from "@/lib/supplements";
import { SupplementBadges } from "./SupplementBadges";
import { usePayrollSummary } from "@/hooks/queries/use-payroll-summary";

/** Template shift: evening service window to illustrate stacking (spec: Mobile Payroll UI). */
const TEMPLATE_SHIFT = {
  startTime: "15:00:00",
  endTime: "23:00:00",
  breakMinutes: 30,
};

function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function SupplementsDetailScreen() {
  const styles = useStyles();
  const { data: summary, isLoading, error } = usePayrollSummary();
  const trust = getTrustLabel({ phase: "before_shift", dataSource: "calculated" });

  const supplements = useMemo(() => {
    if (!summary?.supplementRules.length) return [];
    const engineRules = mapDbRules(summary.supplementRules);
    if (engineRules.length === 0) return [];
    const shiftDate = todayISODate();
    return getShiftSupplements({
      shiftDate,
      startTime: TEMPLATE_SHIFT.startTime,
      endTime: TEMPLATE_SHIFT.endTime,
      breakMinutes: TEMPLATE_SHIFT.breakMinutes,
      rules: engineRules,
      holidays: summary.holidays,
    });
  }, [summary]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>{strings.common.loading}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{strings.common.error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionHeader title={strings.payroll.supplements} />
      <Text style={styles.lead}>{strings.payroll.supplementTemplateLead}</Text>

      {supplements.length > 0 ? (
        <Card style={styles.card}>
          <SupplementBadges supplements={supplements} />
          {trust.showDisclaimer && <Text style={styles.disclaimer}>{trust.label}</Text>}
        </Card>
      ) : (
        <Card style={styles.card}>
          <EmptyState title={strings.payroll.supplements} subtitle={strings.payroll.noPayData} />
        </Card>
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
    padding: theme.spacing.card,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.element,
  },
  lead: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  card: {
    padding: theme.spacing.card,
  },
  disclaimer: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontStyle: "italic",
    marginTop: theme.spacing.element,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
    padding: theme.spacing.page,
  },
  muted: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  error: {
    ...theme.typography.body,
    color: theme.colors.destructive,
  },
}));
