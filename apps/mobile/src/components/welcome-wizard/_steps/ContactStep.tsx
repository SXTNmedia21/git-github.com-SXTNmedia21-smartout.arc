/**
 * ContactStep — Collects first name, last name, and phone number.
 *
 * Canonical pattern for T23 (sets template for T24-T28).
 *
 * BFF CONTRACT: POSTs { firstName, lastName, phone } (camelCase) to
 * /api/mobile/employee-onboarding/save-step with step="contact".
 * The BFF ContactValues schema validates camelCase keys — do NOT use
 * snake_case here (L-0: discovered 2026-05-23 from route.ts inspection).
 *
 * Receives WizardStepProps<TState> from WizardShell (T20). Only `next`,
 * `back`, and the optional `userEmail` display prop are used; excess
 * WizardStepProps are accepted implicitly via index signature.
 */
import * as React from "react";
import { View, Text, Alert } from "react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createStyles } from "@/theme";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  next: () => void | Promise<void>;
  back: () => void | Promise<void>;
  /** Optional email display — shown read-only to confirm identity. */
  userEmail?: string;
  [key: string]: unknown;
};

// ─── Validation ───────────────────────────────────────────────────────────────

/** E.164-ish: optional leading +, 8-15 digits. */
const PHONE_RE = /^\+?\d{8,15}$/;

function isValid(firstName: string, lastName: string, phone: string): boolean {
  return firstName.trim().length >= 2 && lastName.trim().length >= 2 && PHONE_RE.test(phone.trim());
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContactStep({ next, back, userEmail }: Props) {
  const styles = useStyles();

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const valid = isValid(firstName, lastName, phone);

  const submit = async () => {
    if (!valid || pending) return;
    setPending(true);
    try {
      // Send camelCase keys — matches ContactValues Zod schema in BFF.
      await saveOnboardingStep("contact", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
      await next();
    } catch (e) {
      Alert.alert("Kunne ikke lagre", e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Kontaktinfo</Text>
      {userEmail != null && userEmail.length > 0 ? (
        <Text style={styles.email}>{userEmail}</Text>
      ) : null}

      <Input
        label="Fornavn"
        value={firstName}
        onChangeText={setFirstName}
        placeholder="Ola"
        autoCapitalize="words"
        textContentType="givenName"
        returnKeyType="next"
      />
      <Input
        label="Etternavn"
        value={lastName}
        onChangeText={setLastName}
        placeholder="Nordmann"
        autoCapitalize="words"
        textContentType="familyName"
        returnKeyType="next"
      />
      <Input
        label="Telefon"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+47 …"
        textContentType="telephoneNumber"
        returnKeyType="done"
      />

      <View style={styles.row}>
        <Button
          title="Tilbake"
          variant="ghost"
          onPress={() => {
            void back();
          }}
          disabled={pending}
        />
        <Button
          title={pending ? "Lagrer…" : "Neste"}
          variant="primary"
          onPress={() => {
            void submit();
          }}
          disabled={!valid || pending}
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
  email: {
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
