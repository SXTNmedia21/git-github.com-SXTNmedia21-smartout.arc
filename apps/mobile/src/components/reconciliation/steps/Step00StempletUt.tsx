/**
 * Step 00 — Stemplet ut.
 *
 * Confirms the shift leader has punched out. Pre-populated from the
 * active time-entry cache. This is a read-mostly step: the user
 * confirms the recorded out-time and advances.
 */
import React from "react";
import { View, Text } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { Button } from "@/components/ui/Button";

export type Step00Props = {
  punchOutTime: string | null;
  onNext: (data: Record<string, unknown>) => Promise<void> | void;
  onBack?: () => void;
  disabled?: boolean;
};

export function Step00StempletUt({ punchOutTime, onNext, disabled }: Step00Props) {
  const styles = useStyles();
  const theme = useTheme();
  const formatted = punchOutTime
    ? new Date(punchOutTime).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
    : "—";
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stemplet ut</Text>
      <View style={styles.confirmCard}>
        <CheckCircle2 size={28} color={theme.colors.success} />
        <Text style={styles.confirmLabel}>Du stemplet ut kl. {formatted}</Text>
      </View>
      <Text style={styles.helper}>
        Bekreft at utstempling stemmer før vi fortsetter med oversikten over dagen.
      </Text>
      <Button
        title="Fortsett"
        variant="primary"
        size="lg"
        fullWidth
        disabled={disabled}
        onPress={() => void onNext({ confirmed: true, punch_out_time: punchOutTime })}
      />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: { gap: theme.spacing.section, padding: theme.spacing.card },
  title: { ...theme.typography.largeTitle, color: theme.colors.foreground },
  confirmCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.muted,
  },
  confirmLabel: { ...theme.typography.bodyBold, color: theme.colors.foreground },
  helper: { ...theme.typography.subheadline, color: theme.colors.mutedForeground },
}));
