/**
 * HeroStep — First screen in the employee onboarding wizard.
 *
 * Canonical pattern for T22 (sets template for T24-T28).
 * No form fields; single CTA to start the wizard flow.
 *
 * Receives WizardStepProps<TState> from WizardShell (T20); only `next` is
 * needed — excess props are accepted but unused (TS structural typing).
 */
import * as React from "react";
import { View, Text } from "react-native";
import { Button } from "@/components/ui/Button";
import { createStyles } from "@/theme";

type Props = {
  next: () => void | Promise<void>;
  [key: string]: unknown;
};

export function HeroStep({ next }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Velkommen til Smartout</Text>
      <Text style={styles.sub}>La oss få deg klar til første vakt. Det tar 3–5 minutter.</Text>
      <Button
        title="Sett i gang"
        onPress={() => {
          void next();
        }}
        variant="primary"
        fullWidth
      />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    justifyContent: "center",
    gap: 24,
  },
  heading: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
  },
  sub: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
}));
