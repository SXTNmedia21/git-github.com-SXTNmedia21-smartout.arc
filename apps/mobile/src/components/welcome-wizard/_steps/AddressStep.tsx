/**
 * AddressStep — Collects date of birth + address fields.
 *
 * BFF CONTRACT:
 *   POST save-step with step="address", values:
 *   { dateOfBirth, addressLine1, addressLine2?, postalCode, city }  (camelCase)
 *   The BFF AddressValues schema maps:
 *     dateOfBirth → user_identity.date_of_birth
 *     addressLine1 / postalCode / city → profile address columns
 *
 * addressLine2 is NOT in the BFF Zod schema — omitted from the payload.
 * Validation: dateOfBirth YYYY-MM-DD, addressLine1 non-empty,
 * postalCode exactly 4 digits, city non-empty.
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
  [key: string]: unknown;
};

// ─── Validation ───────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const POSTAL_RE = /^\d{4}$/;

function isValid(
  dateOfBirth: string,
  addressLine1: string,
  postalCode: string,
  city: string,
): boolean {
  return (
    DATE_RE.test(dateOfBirth) &&
    addressLine1.trim().length > 0 &&
    POSTAL_RE.test(postalCode) &&
    city.trim().length > 0
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddressStep({ next, back }: Props) {
  const styles = useStyles();

  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const [addressLine1, setAddressLine1] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [city, setCity] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const valid = isValid(dateOfBirth, addressLine1, postalCode, city);

  const submit = async () => {
    if (!valid || pending) return;
    setPending(true);
    try {
      // camelCase keys match BFF AddressValues Zod schema.
      await saveOnboardingStep("address", {
        dateOfBirth: dateOfBirth.trim(),
        addressLine1: addressLine1.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
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
      <Text style={styles.heading}>Adresse</Text>
      <Text style={styles.sub}>Vi bruker dette til arbeidsavtalen din.</Text>

      <Input
        label="Fødselsdato (ÅÅÅÅ-MM-DD)"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        placeholder="1990-01-15"
        keyboardType="numbers-and-punctuation"
        textContentType="none"
        returnKeyType="next"
        accessibilityLabel="Fødselsdato"
        accessibilityHint="Format: fire sifre, bindestrek, to sifre, bindestrek, to sifre"
      />
      <Input
        label="Gateadresse"
        value={addressLine1}
        onChangeText={setAddressLine1}
        placeholder="Storgata 1"
        autoCapitalize="words"
        textContentType="streetAddressLine1"
        returnKeyType="next"
        accessibilityLabel="Gateadresse"
      />
      <Input
        label="Postnummer"
        value={postalCode}
        onChangeText={setPostalCode}
        placeholder="0000"
        keyboardType="number-pad"
        textContentType="postalCode"
        maxLength={4}
        returnKeyType="next"
        accessibilityLabel="Postnummer"
      />
      <Input
        label="Sted"
        value={city}
        onChangeText={setCity}
        placeholder="Oslo"
        autoCapitalize="words"
        textContentType="addressCity"
        returnKeyType="done"
        accessibilityLabel="Poststed"
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
  sub: {
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
