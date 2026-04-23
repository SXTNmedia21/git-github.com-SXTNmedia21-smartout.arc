/**
 * Step 05 — Se gjennom.
 *
 * Summarises steps 01–04 in a scannable list + enables "Send inn"
 * CTA. If any blocker code is surfaced by the preflight, we disable
 * the primary CTA and expose a "Be om overstyring" secondary that the
 * parent wires to AdminOverrideSheet.
 */
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { AlertCircle, Check } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { Button } from "@/components/ui/Button";

export type Step05Blocker = {
  code: string;
  label: string;
};

export type Step05Props = {
  /** Summary rows rendered above the CTA block — label/value pairs. */
  summary: Array<{ label: string; value: string }>;
  blockers: Step05Blocker[];
  onSubmit: () => Promise<void> | void;
  onRequestOverride?: () => void;
  submitting?: boolean;
};

export function Step05SeGjennom({
  summary,
  blockers,
  onSubmit,
  onRequestOverride,
  submitting = false,
}: Step05Props) {
  const styles = useStyles();
  const theme = useTheme();
  const blocked = blockers.length > 0;
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.inner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Se gjennom</Text>
      <View style={styles.summaryCard}>
        {summary.map(({ label, value }) => (
          <View key={label} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue}>{value}</Text>
          </View>
        ))}
      </View>
      {blocked ? (
        <View style={styles.blockerCard}>
          <View style={styles.blockerHeader}>
            <AlertCircle size={18} color={theme.colors.warnSoftForeground} />
            <Text style={styles.blockerTitle}>Blokkeringer</Text>
          </View>
          {blockers.map((b) => (
            <Text key={b.code} style={styles.blockerItem}>
              · {b.label}
            </Text>
          ))}
        </View>
      ) : (
        <View style={styles.okCard}>
          <Check size={18} color={theme.colors.success} />
          <Text style={styles.okLabel}>Ingen blokkeringer — klar til innsending</Text>
        </View>
      )}
      <Button
        title={blocked ? "Blokkert" : "Send inn avstemming"}
        variant="primary"
        size="lg"
        fullWidth
        disabled={blocked || submitting}
        loading={submitting}
        onPress={() => void onSubmit()}
      />
      {blocked && onRequestOverride ? (
        <Button
          title="Be om overstyring (admin)"
          variant="ghost"
          size="md"
          fullWidth
          onPress={onRequestOverride}
        />
      ) : null}
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1 },
  inner: { gap: theme.spacing.section, padding: theme.spacing.card },
  title: { ...theme.typography.largeTitle, color: theme.colors.foreground },
  summaryCard: {
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.muted,
    gap: theme.spacing.tight,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { ...theme.typography.subheadline, color: theme.colors.mutedForeground },
  summaryValue: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  blockerCard: {
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.warnSoft,
    gap: theme.spacing.tight,
  },
  blockerHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.tight },
  blockerTitle: { ...theme.typography.bodyBold, color: theme.colors.warnSoftForeground },
  blockerItem: { ...theme.typography.subheadline, color: theme.colors.warnSoftForeground },
  okCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.muted,
  },
  okLabel: { ...theme.typography.bodyBold, color: theme.colors.foreground },
}));
