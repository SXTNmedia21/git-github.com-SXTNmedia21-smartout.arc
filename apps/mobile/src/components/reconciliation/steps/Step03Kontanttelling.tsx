/**
 * Step 03 — Kontanttelling.
 * Wraps CashPadInput to produce a denomination-indexed cash count.
 */
import React, { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform } from "react-native";
import { createStyles } from "@/theme";
import { Button } from "@/components/ui/Button";
import { CashPadInput, cashPadTotal, type CashPadValue } from "../_shared/CashPadInput";

export type Step03Props = {
  /** Prior step's revenue_cash (for variance display). */
  expectedCash: number | null;
  initialValue?: CashPadValue;
  onNext: (data: Record<string, unknown>) => Promise<void> | void;
  disabled?: boolean;
};

export function Step03Kontanttelling({
  expectedCash,
  initialValue,
  onNext,
  disabled,
}: Step03Props) {
  const styles = useStyles();
  const [value, setValue] = useState<CashPadValue>(initialValue ?? {});
  const counted = cashPadTotal(value);
  const variance = expectedCash !== null ? counted - expectedCash : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Text style={styles.title}>Kontanttelling</Text>
      {expectedCash !== null ? (
        <View style={styles.expectedRow}>
          <Text style={styles.expectedLabel}>Forventet kontant:</Text>
          <Text style={styles.expectedValue}>{expectedCash.toLocaleString("nb-NO")} kr</Text>
        </View>
      ) : null}
      <CashPadInput value={value} onChange={setValue} />
      {variance !== null ? (
        <View style={[styles.varianceRow, variance !== 0 && styles.varianceRowOff]}>
          <Text style={styles.varianceLabel}>Avvik:</Text>
          <Text style={styles.varianceValue}>
            {variance > 0 ? "+" : ""}
            {variance.toLocaleString("nb-NO")} kr
          </Text>
        </View>
      ) : null}
      <Button
        title="Fortsett"
        variant="primary"
        size="lg"
        fullWidth
        disabled={disabled}
        onPress={() =>
          void onNext({
            cash_count_denominations: value,
            cash_count_total: counted,
            cash_count_variance: variance,
          })
        }
      />
    </KeyboardAvoidingView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { gap: theme.spacing.section, padding: theme.spacing.card },
  title: { ...theme.typography.largeTitle, color: theme.colors.foreground },
  expectedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: theme.spacing.element,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.muted,
  },
  expectedLabel: { ...theme.typography.subheadline, color: theme.colors.mutedForeground },
  expectedValue: { ...theme.typography.bodyBold, color: theme.colors.foreground },
  varianceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: theme.spacing.element,
    borderRadius: theme.radius.md,
  },
  varianceRowOff: { backgroundColor: theme.colors.warnSoft },
  varianceLabel: { ...theme.typography.bodyBold, color: theme.colors.foreground },
  varianceValue: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums"],
  },
}));
