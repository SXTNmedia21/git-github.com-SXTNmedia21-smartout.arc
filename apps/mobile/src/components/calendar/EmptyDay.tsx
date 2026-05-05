/**
 * EmptyDay — Empty state for days with no calendar items.
 *
 * Shows a 56px muted circle with a minus-circle icon, "Ingen oppføringer"
 * heading, and a configurable hint line. The default hint references the
 * + FAB as the action to take.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MinusCircle } from "lucide-react-native";
import { useTheme } from "@/theme";

type EmptyDayProps = {
  /** Secondary hint text. Defaults to "Tap + for å legge til". */
  hint?: string;
};

export function EmptyDay({ hint = "Tap + for å legge til" }: EmptyDayProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.secondary }]}>
        <MinusCircle size={22} color={theme.colors.mutedForeground} strokeWidth={1.6} />
      </View>
      <Text style={[styles.heading, { color: theme.colors.mutedForeground }]}>
        Ingen oppføringer
      </Text>
      <Text style={[styles.hint, { color: theme.colors.mutedForeground }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 4,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heading: {
    fontSize: 14,
    fontWeight: "500",
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
});
