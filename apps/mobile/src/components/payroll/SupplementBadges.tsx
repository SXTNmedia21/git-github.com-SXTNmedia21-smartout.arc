/**
 * SupplementBadges — Color-coded badge strip showing active wage supplements.
 *
 * Renders a horizontal row of small pills, one per supplement type.
 * Each pill is color-coded: kveld (purple), helg (orange), helligdag (red).
 * If the supplement has qualifying hours, the badge shows them: "Kveldstillegg 2t".
 *
 * Returns null when the supplements array is empty — no layout impact.
 */

import React from "react";
import { View, Text } from "react-native";
import { createStyles } from "@/theme";
import type { ShiftSupplement } from "@/lib/supplements";

type SupplementBadgesProps = {
  supplements: ShiftSupplement[];
};

/**
 * Badge color map — background (15% opacity) and text color per supplement type.
 * Purple for evening, orange for weekend, red for public holiday.
 */
const badgeColors = {
  kveld: { bg: "rgba(139,92,246,0.15)", text: "#a78bfa" },
  helg: { bg: "rgba(249,115,22,0.15)", text: "#fb923c" },
  helligdag: { bg: "rgba(239,68,68,0.15)", text: "#f87171" },
} as const;

/** Formats qualifying hours for badge display: "2t" or "1.5t" */
function formatBadgeHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  // Drop the decimal if it's a whole number
  return rounded % 1 === 0 ? `${rounded}t` : `${rounded}t`;
}

// UI Events:
// - display-only: no interactive surfaces
// - color-regime: supplement-type-based (kveld=purple, helg=orange, helligdag=red)

export function SupplementBadges({ supplements }: SupplementBadgesProps) {
  const styles = useStyles();

  if (supplements.length === 0) return null;

  return (
    <View style={styles.container}>
      {supplements.map((supplement) => {
        const colors = badgeColors[supplement.type];
        return (
          <View key={supplement.type} style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.label, { color: colors.text }]}>
              {supplement.label}
              {supplement.hours > 0 ? ` ${formatBadgeHours(supplement.hours)}` : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.spacing.xs,
  },
  badge: {
    paddingHorizontal: theme.spacing.tight,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.sm,
  },
  label: {
    ...theme.typography.micro,
    fontWeight: theme.fontWeights.semibold,
  },
}));
