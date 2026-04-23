/**
 * Step 02 — Omsetning (POS summary review).
 *
 * Shows OCR-derived revenue-card / revenue-cash / transactions. Shift
 * leader confirms or manually corrects each field. This step does not
 * author the OCR — a follow-up sortie wires up POS receipt scanning.
 * For now we accept numeric corrections and persist to step_data.
 */
import React, { useState } from "react";
import { View, Text, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { createStyles, useTheme } from "@/theme";
import { Button } from "@/components/ui/Button";

export type Step02Props = {
  /** OCR-derived defaults (from POS scan) — may be null when no scan yet. */
  ocrRevenueTotal: number | null;
  ocrRevenueCard: number | null;
  ocrRevenueCash: number | null;
  ocrTransactions: number | null;
  onNext: (data: Record<string, unknown>) => Promise<void> | void;
  disabled?: boolean;
};

function toNumOrNull(s: string): number | null {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function Step02Omsetning({
  ocrRevenueTotal,
  ocrRevenueCard,
  ocrRevenueCash,
  ocrTransactions,
  onNext,
  disabled,
}: Step02Props) {
  const styles = useStyles();
  const theme = useTheme();
  const [total, setTotal] = useState(ocrRevenueTotal?.toString() ?? "");
  const [card, setCard] = useState(ocrRevenueCard?.toString() ?? "");
  const [cash, setCash] = useState(ocrRevenueCash?.toString() ?? "");
  const [tx, setTx] = useState(ocrTransactions?.toString() ?? "");

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Text style={styles.title}>Omsetning</Text>
      <Text style={styles.helper}>Bekreft eller korriger tall fra POS.</Text>
      <FormField
        label="Total omsetning"
        value={total}
        onChangeText={setTotal}
        placeholder="0"
        theme={theme}
      />
      <FormField label="Kort" value={card} onChangeText={setCard} placeholder="0" theme={theme} />
      <FormField
        label="Kontant"
        value={cash}
        onChangeText={setCash}
        placeholder="0"
        theme={theme}
      />
      <FormField
        label="Antall transaksjoner"
        value={tx}
        onChangeText={setTx}
        placeholder="0"
        theme={theme}
      />
      <Button
        title="Fortsett"
        variant="primary"
        size="lg"
        fullWidth
        disabled={disabled}
        onPress={() =>
          void onNext({
            revenue_total: toNumOrNull(total),
            revenue_card: toNumOrNull(card),
            revenue_cash: toNumOrNull(cash),
            revenue_transactions: toNumOrNull(tx),
            ocr_prefilled: ocrRevenueTotal !== null,
          })
        }
      />
    </KeyboardAvoidingView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const styles = useFieldStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedForeground}
        keyboardType="decimal-pad"
        style={styles.input}
      />
    </View>
  );
}

const useFieldStyles = createStyles((theme) => ({
  row: { gap: 6 },
  label: { ...theme.typography.caption, color: theme.colors.mutedForeground },
  input: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.spacing.tight,
    fontVariant: ["tabular-nums"],
  },
}));

const useStyles = createStyles((theme) => ({
  container: { gap: theme.spacing.section, padding: theme.spacing.card },
  title: { ...theme.typography.largeTitle, color: theme.colors.foreground },
  helper: { ...theme.typography.subheadline, color: theme.colors.mutedForeground },
}));
