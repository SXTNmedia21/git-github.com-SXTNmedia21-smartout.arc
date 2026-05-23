/**
 * PersonalNumberStep — Collects Norwegian personal number (11 digits).
 *
 * R8 two-phase design:
 *   Phase 1 "input":   user types the number; eye/EyeOff toggle hides/shows text.
 *   Phase 2 "confirm": user re-enters for verification; modal-style a11y.
 *
 * Reveal default = true (number shown by default per R8 council spec).
 *
 * BFF CONTRACT:
 *   POST save-step with step="personal_number", values:
 *   { personalNumber: string }  (camelCase — BFF PersonalNumberValues)
 *   Maps to profile.personal_number on the server.
 */
import * as React from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  next: () => void | Promise<void>;
  back: () => void | Promise<void>;
  [key: string]: unknown;
};

// ─── Validation ───────────────────────────────────────────────────────────────

const PERSONAL_NUMBER_RE = /^\d{11}$/;

function isValidNumber(value: string): boolean {
  return PERSONAL_NUMBER_RE.test(value.trim());
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PersonalNumberStep({ next, back }: Props) {
  const styles = useStyles();
  const theme = useTheme();

  const [phase, setPhase] = React.useState<"input" | "confirm">("input");
  const [value, setValue] = React.useState("");
  const [confirmValue, setConfirmValue] = React.useState("");
  /** Reveal = show text (default true per R8). */
  const [revealed, setRevealed] = React.useState(true);
  const [pending, setPending] = React.useState(false);

  const inputValid = isValidNumber(value);
  const confirmValid = confirmValue.trim() === value.trim() && isValidNumber(confirmValue);

  const toggleReveal = () => setRevealed((prev) => !prev);

  const handleNext = async () => {
    if (phase === "input") {
      if (!inputValid) return;
      setConfirmValue("");
      setPhase("confirm");
      return;
    }
    // confirm phase
    if (!confirmValid || pending) return;
    if (value.trim() !== confirmValue.trim()) {
      Alert.alert("Personnumrene stemmer ikke", "Vennligst skriv inn personnummeret på nytt.");
      setConfirmValue("");
      return;
    }
    setPending(true);
    try {
      // camelCase key matches BFF PersonalNumberValues Zod schema.
      await saveOnboardingStep("personal_number", {
        personalNumber: value.trim(),
      });
      await next();
    } catch (e) {
      Alert.alert("Kunne ikke lagre", e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setPending(false);
    }
  };

  const handleBack = () => {
    if (phase === "confirm") {
      setPhase("input");
      return;
    }
    void back();
  };

  return (
    <View
      style={styles.root}
      // confirm phase is modal-style — assistive tech should treat it as modal
      accessibilityViewIsModal={phase === "confirm"}
    >
      <Text style={styles.heading}>
        {phase === "input" ? "Personnummer" : "Bekreft personnummer"}
      </Text>
      <Text style={styles.sub} accessibilityLiveRegion={phase === "confirm" ? "assertive" : "none"}>
        {phase === "input"
          ? "Ditt 11-sifrede norske personnummer. Brukes til arbeidsavtalen."
          : "Skriv inn personnummeret en gang til for å bekrefte."}
      </Text>

      {/* Toggle reveal button */}
      <Pressable
        onPress={toggleReveal}
        style={styles.revealRow}
        accessibilityRole="button"
        accessibilityLabel={revealed ? "Skjul personnummer" : "Vis personnummer"}
      >
        {revealed ? (
          <EyeOff size={18} color={theme.colors.mutedForeground} strokeWidth={2} />
        ) : (
          <Eye size={18} color={theme.colors.mutedForeground} strokeWidth={2} />
        )}
        <Text style={styles.revealLabel}>{revealed ? "Skjul" : "Vis"}</Text>
      </Pressable>

      {phase === "input" ? (
        <Input
          label="Personnummer"
          value={value}
          onChangeText={setValue}
          placeholder="01019012345"
          keyboardType="number-pad"
          maxLength={11}
          secureTextEntry={!revealed}
          textContentType="none"
          returnKeyType="next"
          accessibilityLabel="Personnummer"
          accessibilityHint="11 siffer uten mellomrom"
        />
      ) : (
        <Input
          label="Gjenta personnummer"
          value={confirmValue}
          onChangeText={setConfirmValue}
          placeholder="01019012345"
          keyboardType="number-pad"
          maxLength={11}
          secureTextEntry={!revealed}
          textContentType="none"
          returnKeyType="done"
          accessibilityLabel="Bekreft personnummer"
          accessibilityHint="Skriv inn samme personnummer som du nettopp oppga"
          error={
            confirmValue.length === 11 && !confirmValid
              ? "Personnumrene stemmer ikke overens."
              : undefined
          }
        />
      )}

      <View style={styles.row}>
        <Button title="Tilbake" variant="ghost" onPress={handleBack} disabled={pending} />
        <Button
          title={pending ? "Lagrer…" : phase === "input" ? "Neste" : "Bekreft"}
          variant="primary"
          onPress={() => {
            void handleNext();
          }}
          disabled={phase === "input" ? !inputValid : !confirmValid || pending}
          loading={pending}
        />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    gap: 16,
    paddingTop: 24,
  },
  heading: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  sub: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  revealRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  revealLabel: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: "auto" as unknown as number,
    gap: 12,
  },
}));
