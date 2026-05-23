/**
 * OptionalStep — Collects optional bank account, family situation, and
 * emergency contact details.
 *
 * All fields are optional. "Hopp over" calls next() without saving.
 * Submitting sends only the fields the user has filled.
 *
 * BFF CONTRACT:
 *   POST save-step with step="optional", values:
 *   {
 *     bankAccount?: string,
 *     familySituation?: "enslig" | "samboer" | "gift" | "barn",
 *     emergencyContactName?: string,
 *     emergencyContactPhone?: string,
 *     emergencyContactRelation?: string,
 *   }  (all camelCase — BFF OptionalValues schema)
 *   Maps: bankAccount/familySituation → profile; emergencyContact* → user_identity.
 */
import * as React from "react";
import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

// ─── Types ────────────────────────────────────────────────────────────────────

type FamilySituation = "enslig" | "samboer" | "gift" | "barn";

const FAMILY_OPTIONS: { value: FamilySituation; label: string }[] = [
  { value: "enslig", label: "Enslig" },
  { value: "samboer", label: "Samboer" },
  { value: "gift", label: "Gift / partner" },
  { value: "barn", label: "Har barn" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  next: () => void | Promise<void>;
  back: () => void | Promise<void>;
  [key: string]: unknown;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function OptionalStep({ next, back }: Props) {
  const styles = useStyles();
  const theme = useTheme();

  const [bankAccount, setBankAccount] = React.useState("");
  const [familySituation, setFamilySituation] = React.useState<FamilySituation | null>(null);
  const [emergencyName, setEmergencyName] = React.useState("");
  const [emergencyPhone, setEmergencyPhone] = React.useState("");
  const [emergencyRelation, setEmergencyRelation] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const skip = async () => {
    if (pending) return;
    await next();
  };

  const submit = async () => {
    if (pending) return;
    setPending(true);
    try {
      // Only include fields the user actually filled in.
      const values: Record<string, unknown> = {};
      if (bankAccount.trim()) values.bankAccount = bankAccount.trim();
      if (familySituation) values.familySituation = familySituation;
      if (emergencyName.trim()) values.emergencyContactName = emergencyName.trim();
      if (emergencyPhone.trim()) values.emergencyContactPhone = emergencyPhone.trim();
      if (emergencyRelation.trim()) values.emergencyContactRelation = emergencyRelation.trim();

      await saveOnboardingStep("optional", values);
      await next();
    } catch (e) {
      Alert.alert("Kunne ikke lagre", e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setPending(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.root}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Valgfri info</Text>
      <Text style={styles.sub}>
        Disse feltene er frivillige. Du kan hoppe over og fylle ut senere.
      </Text>

      {/* Bank account */}
      <Input
        label="Kontonummer (11 siffer)"
        value={bankAccount}
        onChangeText={setBankAccount}
        placeholder="1234 56 78901"
        keyboardType="number-pad"
        returnKeyType="next"
        accessibilityLabel="Kontonummer"
        accessibilityHint="11 siffer. Brukes til lønnsutbetaling."
      />

      {/* Family situation chips */}
      <View>
        <Text style={styles.fieldLabel}>Familiesituasjon</Text>
        <View style={styles.chipRow}>
          {FAMILY_OPTIONS.map(({ value, label }) => {
            const selected = familySituation === value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setFamilySituation(selected ? null : value);
                }}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={label}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: selected ? theme.colors.primaryForeground : theme.colors.foreground },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Emergency contact */}
      <Text style={styles.sectionLabel}>Nødkontakt</Text>
      <Input
        label="Navn"
        value={emergencyName}
        onChangeText={setEmergencyName}
        placeholder="Kari Nordmann"
        autoCapitalize="words"
        textContentType="name"
        returnKeyType="next"
        accessibilityLabel="Nødkontakt navn"
      />
      <Input
        label="Telefon"
        value={emergencyPhone}
        onChangeText={setEmergencyPhone}
        placeholder="+47 …"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        returnKeyType="next"
        accessibilityLabel="Nødkontakt telefon"
      />
      <Input
        label="Relasjon"
        value={emergencyRelation}
        onChangeText={setEmergencyRelation}
        placeholder="Ektefelle, forelder…"
        autoCapitalize="sentences"
        returnKeyType="done"
        accessibilityLabel="Nødkontakt relasjon"
      />

      <View style={styles.buttonStack}>
        <Button
          title={pending ? "Lagrer…" : "Lagre og neste"}
          variant="primary"
          fullWidth
          onPress={() => {
            void submit();
          }}
          disabled={pending}
          loading={pending}
        />
        <Button
          title="Hopp over"
          variant="ghost"
          fullWidth
          onPress={() => {
            void skip();
          }}
          disabled={pending}
        />
        <Button
          title="Tilbake"
          variant="ghost"
          fullWidth
          onPress={() => {
            void back();
          }}
          disabled={pending}
        />
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = createStyles((theme) => ({
  scroll: {
    flex: 1,
  },
  root: {
    gap: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  heading: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  sub: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  fieldLabel: {
    ...theme.typography.subheadline,
    color: theme.colors.foreground,
    marginBottom: 8,
    fontWeight: "500" as const,
  },
  sectionLabel: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipLabel: {
    ...theme.typography.subheadline,
  },
  buttonStack: {
    gap: 8,
    marginTop: 8,
  },
}));
