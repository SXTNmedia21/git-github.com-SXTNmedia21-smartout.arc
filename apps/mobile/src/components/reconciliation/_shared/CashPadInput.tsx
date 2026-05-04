/**
 * CashPadInput — denomination stacking pad.
 *
 * Each denomination row shows: pressable +1 tile, a numeric count, and
 * a clear tile. Touch targets are >=56px high (hansker-kontekst AAA).
 *
 * Stores a `Record<denomination, count>` shape. Parent reads
 * `totalValue` for the summed NOK amount.
 */
import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Minus, Plus } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";

export type CashPadValue = Record<string, number>;

export type CashPadInputProps = {
  value: CashPadValue;
  onChange: (next: CashPadValue) => void;
  /** Denomination values in descending order — defaults to NOK physical cash. */
  denominations?: number[];
};

const DEFAULT_DENOMS = [500, 200, 100, 50, 20, 10, 5, 1];

export function CashPadInput({
  value,
  onChange,
  denominations = DEFAULT_DENOMS,
}: CashPadInputProps) {
  const styles = useStyles();
  const theme = useTheme();

  const totalValue = useMemo(
    () => denominations.reduce((sum, d) => sum + (value[String(d)] ?? 0) * d, 0),
    [value, denominations],
  );

  const bump = (denom: number, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const key = String(denom);
    const next = Math.max(0, (value[key] ?? 0) + delta);
    onChange({ ...value, [key]: next });
  };

  return (
    <View style={styles.container}>
      {denominations.map((denom) => {
        const count = value[String(denom)] ?? 0;
        return (
          <View
            key={denom}
            style={styles.row}
            accessibilityLabel={`${denom} kroner, antall ${count}`}
          >
            <Text style={styles.denom}>{denom} kr</Text>
            <View style={styles.controls}>
              <Pressable
                onPress={() => bump(denom, -1)}
                accessibilityRole="button"
                accessibilityLabel={`Fjern en ${denom}-lapp`}
                disabled={count === 0}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.touch,
                  count === 0 && styles.touchDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Minus size={20} color={theme.colors.foreground} />
              </Pressable>
              <Text style={styles.count}>{count}</Text>
              <Pressable
                onPress={() => bump(denom, +1)}
                accessibilityRole="button"
                accessibilityLabel={`Legg til en ${denom}-lapp`}
                hitSlop={8}
                style={({ pressed }) => [styles.touch, pressed && styles.pressed]}
              >
                <Plus size={20} color={theme.colors.foreground} />
              </Pressable>
            </View>
            <Text style={styles.subtotal}>{(count * denom).toLocaleString("nb-NO")} kr</Text>
          </View>
        );
      })}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Totalt</Text>
        <Text style={styles.totalValue}>{totalValue.toLocaleString("nb-NO")} kr</Text>
      </View>
    </View>
  );
}

/** Compute summed NOK value from a CashPadValue — exported for submission. */
export function cashPadTotal(
  value: CashPadValue,
  denominations: number[] = DEFAULT_DENOMS,
): number {
  return denominations.reduce((sum, d) => sum + (value[String(d)] ?? 0) * d, 0);
}

const TOUCH = 56;

const useStyles = createStyles((theme) => ({
  container: {
    gap: theme.spacing.tight,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    minHeight: TOUCH,
  },
  denom: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
    width: 72,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    flex: 1,
  },
  touch: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  touchDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  count: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    minWidth: 48,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  subtotal: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    minWidth: 72,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  totalRow: {
    marginTop: theme.spacing.element,
    paddingTop: theme.spacing.element,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  totalValue: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums"],
  },
}));
