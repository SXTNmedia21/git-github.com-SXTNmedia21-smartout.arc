/**
 * DoneStep — Final step: fires the "complete" save and advances.
 *
 * Calls saveOnboardingStep("complete", {}) which triggers the BFF to:
 *   - Set profile.is_welcome_complete = true + welcome_completed_at
 *   - Upsert employee_onboarding_state { status: "completed", completed_at }
 *   - Emit "profile welcome_wizard_completed" to all 4 telemetry destinations
 *
 * On success, calls next() — WizardShell handles the final navigation
 * (e.g. dismissing the modal or routing to the main dashboard tab).
 *
 * BFF CONTRACT:
 *   POST save-step with step="complete", values: {}
 *   No user-supplied identity — actor resolved server-side from Bearer token.
 */
import * as React from "react";
import { View, Text } from "react-native";
import { Check } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  next: () => void | Promise<void>;
  [key: string]: unknown;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DoneStep({ next }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const [pending, setPending] = React.useState(false);

  const complete = async () => {
    if (pending) return;
    setPending(true);
    try {
      // "complete" is the sentinel step — fires profile flag flip + telemetry.
      await saveOnboardingStep("complete", {});
      await next();
    } catch {
      // Even on error we advance — profile flag is best-effort;
      // the BFF can be retried later via a heartbeat / re-open flow.
      await next();
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap} accessibilityElementsHidden>
        <Check size={48} color={theme.colors.primary} strokeWidth={2.5} />
      </View>

      <Text style={styles.heading} accessibilityRole="header">
        Du er klar!
      </Text>
      <Text style={styles.sub}>
        Profilen din er satt opp. Du kan nå se vaktene dine og chatte med Botsson.
      </Text>

      <Button
        title={pending ? "Fullfører…" : "Fullfør"}
        variant="primary"
        fullWidth
        onPress={() => {
          void complete();
        }}
        disabled={pending}
        loading={pending}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    justifyContent: "center",
    gap: 24,
    paddingTop: 24,
  },
  iconWrap: {
    alignItems: "center" as const,
  },
  heading: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
    textAlign: "center" as const,
  },
  sub: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
  },
}));
