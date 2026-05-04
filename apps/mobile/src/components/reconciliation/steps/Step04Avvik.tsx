/**
 * Step 04 — Avvik (deviations / HACCP).
 *
 * Reads open deviations from the parent + lets leader add a closing
 * note. Re-used across hospitality (cash/service/HACCP) and retail.
 */
import React, { useState } from "react";
import { View, Text, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { Button } from "@/components/ui/Button";

export type Step04DeviationSummary = {
  deviationId: string;
  title: string;
  severity: "info" | "warning" | "critical";
  resolved: boolean;
};

export type Step04Props = {
  deviations: Step04DeviationSummary[];
  onNext: (data: Record<string, unknown>) => Promise<void> | void;
  disabled?: boolean;
};

export function Step04Avvik({ deviations, onNext, disabled }: Step04Props) {
  const styles = useStyles();
  const theme = useTheme();
  const [notes, setNotes] = useState("");
  const unresolvedCount = deviations.filter((d) => !d.resolved).length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Text style={styles.title}>Avvik</Text>
      {deviations.length === 0 ? (
        <Text style={styles.helper}>Ingen registrerte avvik i dag. Notat under ved behov.</Text>
      ) : (
        <View style={styles.list}>
          {deviations.map((d) => (
            <View key={d.deviationId} style={[styles.devRow, !d.resolved && styles.devRowOpen]}>
              <AlertTriangle
                size={18}
                color={d.resolved ? theme.colors.success : theme.colors.warnSoftForeground}
              />
              <View style={styles.devCopy}>
                <Text style={styles.devTitle}>{d.title}</Text>
                <Text style={styles.devMeta}>
                  {d.resolved ? "Lukket" : "Åpen"} · {d.severity}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.label}>Kommentar (valgfritt)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        placeholder="Merknader / handlinger…"
        placeholderTextColor={theme.colors.mutedForeground}
        style={styles.textarea}
        accessibilityLabel="Avviks-kommentar"
      />
      <Button
        title="Fortsett"
        variant="primary"
        size="lg"
        fullWidth
        disabled={disabled}
        onPress={() =>
          void onNext({
            deviations_count: deviations.length,
            deviations_unresolved: unresolvedCount,
            notes,
          })
        }
      />
    </KeyboardAvoidingView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { gap: theme.spacing.section, padding: theme.spacing.card },
  title: { ...theme.typography.largeTitle, color: theme.colors.foreground },
  helper: { ...theme.typography.subheadline, color: theme.colors.mutedForeground },
  list: { gap: theme.spacing.element },
  devRow: {
    flexDirection: "row",
    gap: theme.spacing.element,
    padding: theme.spacing.element,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
  },
  devRowOpen: { backgroundColor: theme.colors.warnSoft },
  devCopy: { flex: 1, gap: 2 },
  devTitle: { ...theme.typography.bodyBold, color: theme.colors.foreground },
  devMeta: { ...theme.typography.caption, color: theme.colors.mutedForeground },
  label: { ...theme.typography.caption, color: theme.colors.mutedForeground },
  textarea: {
    minHeight: 80,
    padding: theme.spacing.element,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.foreground,
    textAlignVertical: "top",
    ...theme.typography.body,
  },
}));
