/**
 * FilterChips — Horizontal scrollable chip row for calendar item filtering.
 *
 * 5 chips: Alt / Oppgaver / Vakter / Bookinger / Avvik.
 * Each chip shows a count badge in Geist Mono. Active chip gets orange fill +
 * white text. Inactive chips use surface2 + muted text.
 *
 * Tap fires onChange(filter). No spring animation needed here — instant state
 * transition per the handoff's "Keep simple" note.
 */

import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "@/theme";

export type FilterValue = "alt" | "oppgaver" | "vakter" | "bookinger" | "avvik";

type FilterChipsProps = {
  filter: FilterValue;
  counts: Record<FilterValue, number>;
  onChange: (f: FilterValue) => void;
};

const CHIPS: { k: FilterValue; label: string }[] = [
  { k: "alt", label: "Alt" },
  { k: "oppgaver", label: "Oppgaver" },
  { k: "vakter", label: "Vakter" },
  { k: "bookinger", label: "Bookinger" },
  { k: "avvik", label: "Avvik" },
];

export function FilterChips({ filter, counts, onChange }: FilterChipsProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      {CHIPS.map((chip) => {
        const isActive = filter === chip.k;
        return (
          <Pressable
            key={chip.k}
            onPress={() => onChange(chip.k)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? theme.colors.brandOrange : theme.colors.secondary,
                borderColor: isActive ? theme.colors.brandOrange : theme.colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${chip.label} ${counts[chip.k]}`}
          >
            <Text
              style={[
                styles.chipLabel,
                {
                  color: isActive ? "#ffffff" : theme.colors.mutedForeground,
                },
              ]}
            >
              {chip.label}
            </Text>
            <Text
              style={[
                styles.count,
                {
                  color: isActive ? "rgba(255,255,255,0.8)" : theme.colors.mutedForeground,
                },
              ]}
            >
              {counts[chip.k]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  container: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  count: {
    fontSize: 10.5,
    fontFamily: "GeistMono-Regular",
  },
});
