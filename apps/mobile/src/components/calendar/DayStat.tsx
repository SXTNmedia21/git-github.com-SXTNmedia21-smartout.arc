/**
 * DayStat — Compact stat tile for the DayView header strip.
 *
 * Layout: icon + count (mono, 20px) + label (tiny caps, muted).
 * tone='error' switches the count color to destructive-red.
 *
 * Used in a 3-column grid: Vakter · Oppgaver · Bookinger.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/theme";

type DayStatProps = {
  icon: LucideIcon;
  count: number;
  label: string;
  tone?: "default" | "error";
};

export function DayStat({ icon: Icon, count, label, tone = "default" }: DayStatProps) {
  const theme = useTheme();
  const countColor =
    tone === "error" ? theme.colors.destructive : theme.colors.foreground;

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Icon
        size={14}
        color={theme.colors.mutedForeground}
        strokeWidth={1.8}
        style={styles.icon}
      />
      <Text style={[styles.label, { color: theme.colors.mutedForeground }]}>
        {label.toUpperCase()}
      </Text>
      <Text style={[styles.count, { color: countColor }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 2,
  },
  icon: {
    marginBottom: 2,
  },
  label: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  count: {
    fontFamily: "GeistMono-Regular",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginTop: 4,
  },
});
