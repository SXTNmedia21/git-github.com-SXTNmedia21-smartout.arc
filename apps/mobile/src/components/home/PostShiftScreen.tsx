/**
 * PostShiftScreen — placeholder.
 * Post-shift wrap-up: clock-out summary, deviations, reflection.
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";

export function PostShiftScreen() {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={[styles.container]}>
      <Text style={[styles.heading, { color: theme.colors.foreground }]}>Etter vakt</Text>
      <Text style={[styles.subhead, { color: theme.colors.mutedForeground }]}>
        Oppsummering, avvik, refleksjon.
      </Text>
      <View style={[styles.placeholderCard, { borderColor: theme.colors.border }]}>
        <Text style={[styles.placeholderText, { color: theme.colors.mutedForeground }]}>
          Stub — innhold venter på spec
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "InstrumentSerif-Regular",
  },
  subhead: {
    fontSize: 14,
    lineHeight: 20,
  },
  placeholderCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 24,
    marginTop: 16,
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 13,
    fontStyle: "italic",
  },
});
