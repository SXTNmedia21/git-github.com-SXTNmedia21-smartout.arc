/**
 * Step 01 — Oversikt (KPI tiles + lønn row).
 *
 * Renders the day's headline numbers (omsetning, dekningsgrad, timer,
 * lønnskost). The `lønn` row includes an "Estimat" pill colored with
 * the Phase A --data-estimate token WHEN tariff-derivation is missing
 * (Invariant #12, Riksavtalen-in-KPI). The parent passes
 * `lonnEstimateOnly` — if true we render the pill; otherwise the number
 * is authoritative.
 */
import React from "react";
import { View, Text } from "react-native";
import { createStyles, useTheme } from "@/theme";
import { Button } from "@/components/ui/Button";

export type Step01Props = {
  omsetning: number | null;
  dekningsgrad: number | null;
  timer: number | null;
  lonnskost: number | null;
  /** Invariant #12 — true when no Riksavtalen-derived number available. */
  lonnEstimateOnly: boolean;
  onNext: (data: Record<string, unknown>) => Promise<void> | void;
  disabled?: boolean;
};

function formatMoney(n: number | null): string {
  return n === null ? "—" : `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

function formatPct(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

export function Step01Oversikt({
  omsetning,
  dekningsgrad,
  timer,
  lonnskost,
  lonnEstimateOnly,
  onNext,
  disabled,
}: Step01Props) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Oversikt</Text>
      <View style={styles.grid}>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Omsetning</Text>
          <Text style={styles.tileValue}>{formatMoney(omsetning)}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Dekningsgrad</Text>
          <Text style={styles.tileValue}>{formatPct(dekningsgrad)}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Timer</Text>
          <Text style={styles.tileValue}>{timer === null ? "—" : timer.toFixed(1)}</Text>
        </View>
        <View style={styles.tile}>
          <View style={styles.lonnHeader}>
            <Text style={styles.tileLabel}>Lønn</Text>
            {lonnEstimateOnly ? (
              <View style={styles.estimatePill}>
                <Text style={styles.estimateLabel}>Estimat</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tileValue}>{formatMoney(lonnskost)}</Text>
        </View>
      </View>
      <Button
        title="Fortsett"
        variant="primary"
        size="lg"
        fullWidth
        disabled={disabled}
        onPress={() =>
          void onNext({
            omsetning,
            dekningsgrad,
            timer,
            lonnskost,
            lonn_estimate_only: lonnEstimateOnly,
          })
        }
      />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: { gap: theme.spacing.section, padding: theme.spacing.card },
  title: { ...theme.typography.largeTitle, color: theme.colors.foreground },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.element,
  },
  tile: {
    flexBasis: "48%",
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.muted,
    gap: theme.spacing.tight,
  },
  tileLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tileValue: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  lonnHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  estimatePill: {
    backgroundColor: theme.colors.dataEstimate,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: theme.radius.full,
  },
  estimateLabel: { ...theme.typography.micro, color: theme.colors.foreground },
}));
