/**
 * ConsentStep — Employee accepts handbook, GDPR, and optionally tariff.
 *
 * Renders 2 required consent rows (handbook + gdpr) and a 3rd (tariff)
 * only when the workspace is tariff-bound. The `tariffBound` prop mirrors
 * the BFF's own server-side check — if true, all three must be checked.
 *
 * Each consent label is tappable and opens the relevant document URL via
 * Linking.openURL so employees can read before accepting.
 *
 * BFF CONTRACT:
 *   POST save-step with step="consent", values:
 *   { handbook: true, gdpr: true, tariff?: true }  (camelCase)
 *   The BFF ConsentValues schema validates handbook + gdpr as literal true.
 *   Tariff is boolean optional — the BFF re-validates tariff requirement
 *   server-side from workspace_settings.is_tariff_bound.
 */
import * as React from "react";
import { View, Text, Pressable, Alert, Linking } from "react-native";
import { Square, CheckSquare } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConsentKey = "handbook" | "gdpr" | "tariff";

interface ConsentRow {
  key: ConsentKey;
  label: string;
  linkLabel: string;
  url: string;
}

const CONSENT_ROWS: ConsentRow[] = [
  {
    key: "handbook",
    label: "Jeg har lest og godtar",
    linkLabel: "personalhåndboken",
    url: "https://smartout.no/docs/handbook",
  },
  {
    key: "gdpr",
    label: "Jeg godtar",
    linkLabel: "personvernerklæringen",
    url: "https://smartout.no/docs/privacy",
  },
  {
    key: "tariff",
    label: "Jeg godtar gjeldende",
    linkLabel: "tariffavtale",
    url: "https://smartout.no/docs/tariff",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  next: () => void | Promise<void>;
  back: () => void | Promise<void>;
  /** When true, the tariff consent row is required. */
  tariffBound?: boolean;
  [key: string]: unknown;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ConsentStep({ next, back, tariffBound = false }: Props) {
  const styles = useStyles();
  const theme = useTheme();

  const [checked, setChecked] = React.useState<Record<ConsentKey, boolean>>({
    handbook: false,
    gdpr: false,
    tariff: false,
  });
  const [pending, setPending] = React.useState(false);

  const toggle = (key: ConsentKey) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert("Kunne ikke åpne lenken", "Prøv igjen.");
    });
  };

  const requiredKeys: ConsentKey[] = tariffBound
    ? ["handbook", "gdpr", "tariff"]
    : ["handbook", "gdpr"];

  const allAccepted = requiredKeys.every((k) => checked[k]);

  const submit = async () => {
    if (!allAccepted || pending) return;
    setPending(true);
    try {
      const values: Record<string, unknown> = {
        handbook: true as const,
        gdpr: true as const,
      };
      if (tariffBound) {
        values.tariff = true as const;
      }
      await saveOnboardingStep("consent", values);
      await next();
    } catch (e) {
      Alert.alert("Kunne ikke lagre", e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setPending(false);
    }
  };

  const visibleRows = tariffBound ? CONSENT_ROWS : CONSENT_ROWS.filter((r) => r.key !== "tariff");

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Samtykker</Text>
      <Text style={styles.sub}>Les gjennom dokumentene og godta for å fullføre innmeldingen.</Text>

      <View style={styles.checkboxList}>
        {visibleRows.map((row) => {
          const isChecked = checked[row.key];
          return (
            <Pressable
              key={row.key}
              onPress={() => {
                toggle(row.key);
              }}
              style={styles.checkboxRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              accessibilityLabel={`${row.label} ${row.linkLabel}`}
            >
              {isChecked ? (
                <CheckSquare size={22} color={theme.colors.primary} strokeWidth={2} />
              ) : (
                <Square size={22} color={theme.colors.mutedForeground} strokeWidth={2} />
              )}
              <Text style={styles.checkboxLabel}>
                {row.label}{" "}
                <Text
                  style={styles.link}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openUrl(row.url);
                  }}
                  accessibilityRole="link"
                  accessibilityLabel={`Les ${row.linkLabel}`}
                >
                  {row.linkLabel}
                </Text>
              </Text>
            </Pressable>
          );
        })}
      </View>

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
          disabled={!allAccepted || pending}
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
  checkboxList: {
    gap: 16,
  },
  checkboxRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 12,
  },
  checkboxLabel: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    flex: 1,
    flexWrap: "wrap" as const,
  },
  link: {
    color: theme.colors.primary,
    textDecorationLine: "underline" as const,
  },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: "auto" as unknown as number,
    gap: 12,
  },
}));
