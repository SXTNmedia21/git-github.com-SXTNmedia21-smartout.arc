/**
 * AvailabilityStep — Employee marks days they are NOT available to work.
 *
 * 7 weekday chips; tapping a chip toggles it into the "off/unavailable" set.
 * By default all days are available (no chips selected = available every day).
 *
 * BFF CONTRACT:
 *   POST save-step with step="availability", values:
 *   { unavailableDays: WeekdayCode[] }
 *   where WeekdayCode ∈ "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU"
 *   The BFF deletes prior onboarding-wizard rows then inserts RRULE rows.
 */
import * as React from "react";
import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { createStyles, useTheme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

// ─── Types ────────────────────────────────────────────────────────────────────

type WeekdayCode = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

const WEEKDAYS: { code: WeekdayCode; label: string }[] = [
  { code: "MO", label: "Man" },
  { code: "TU", label: "Tir" },
  { code: "WE", label: "Ons" },
  { code: "TH", label: "Tor" },
  { code: "FR", label: "Fre" },
  { code: "SA", label: "Lør" },
  { code: "SU", label: "Søn" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  next: () => void | Promise<void>;
  back: () => void | Promise<void>;
  [key: string]: unknown;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AvailabilityStep({ next, back }: Props) {
  const styles = useStyles();
  const theme = useTheme();

  /** Set of weekday codes the employee cannot work. */
  const [unavailable, setUnavailable] = React.useState<Set<WeekdayCode>>(new Set());
  const [pending, setPending] = React.useState(false);

  const toggleDay = (code: WeekdayCode) => {
    setUnavailable((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const submit = async () => {
    if (pending) return;
    setPending(true);
    try {
      await saveOnboardingStep("availability", {
        unavailableDays: Array.from(unavailable),
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
      <Text style={styles.heading}>Tilgjengelighet</Text>
      <Text style={styles.sub}>
        Marker dagene du IKKE kan jobbe. Alle dager er tilgjengelige som standard.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        accessibilityRole="none"
      >
        {WEEKDAYS.map(({ code, label }) => {
          const isOff = unavailable.has(code);
          return (
            <Pressable
              key={code}
              onPress={() => {
                toggleDay(code);
              }}
              style={[styles.chip, isOff ? styles.chipOff : styles.chipOn]}
              accessibilityRole="checkbox"
              accessibilityLabel={label}
              accessibilityHint={
                isOff ? "Trykk for å gjøre tilgjengelig" : "Trykk for å markere som utilgjengelig"
              }
              accessibilityState={{ checked: isOff }}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: isOff ? theme.colors.destructiveForeground : theme.colors.foreground },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {unavailable.size > 0 && (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {unavailable.size === 1
            ? "1 dag markert som utilgjengelig."
            : `${unavailable.size} dager markert som utilgjengelige.`}
        </Text>
      )}

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
          disabled={pending}
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
  chipRow: {
    flexDirection: "row" as const,
    gap: 10,
    paddingVertical: 4,
  },
  chip: {
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  chipOn: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
  },
  chipOff: {
    backgroundColor: theme.colors.destructive,
    borderColor: theme.colors.destructive,
  },
  chipLabel: {
    ...theme.typography.bodyBold,
  },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: "auto" as unknown as number,
    gap: 12,
  },
}));
