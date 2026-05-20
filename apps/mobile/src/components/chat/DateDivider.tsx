/**
 * DateDivider — Pill-shaped date separator for chat threads (Nordic Split).
 *
 * Renders a centered pill row between message groups so long threads gain
 * temporal context at a glance. Phase 1 is inline-only; sticky-on-scroll
 * and spring-fade animation land in Phase 2.
 *
 * Format rules (Norwegian default):
 *   - Same calendar day as today → "I DAG"
 *   - One day before today      → "I GÅR"
 *   - Within last 7 days        → capitalized weekday, e.g. "TORSDAG"
 *   - Older (same year)         → "torsdag 15. mai"
 *   - Different year            → "torsdag 15. mai 2024"
 *
 * Export `formatDividerLabel` separately so it can be unit-tested without
 * mounting the component.
 */

import React from "react";
import { View, Text } from "react-native";
import { format, isToday, isYesterday, differenceInCalendarDays, getYear } from "date-fns";
import { nb } from "date-fns/locale";
import { createStyles } from "@/theme";

// ─── Label helper ────────────────────────────────────────────────────────────

/**
 * Build the human-readable label for a given date relative to `now`.
 * Exported so callers can unit-test the formatting logic in isolation.
 */
export function formatDividerLabel(date: Date, now: Date): string {
  if (isToday(date)) return "I DAG";
  if (isYesterday(date)) return "I GÅR";

  const daysAgo = differenceInCalendarDays(now, date);
  if (daysAgo < 7) {
    // Capitalized weekday name, e.g. "TORSDAG"
    return format(date, "EEEE", { locale: nb }).toUpperCase();
  }

  // Older: lowercase weekday + day + month, append year only when different.
  const sameYear = getYear(date) === getYear(now);
  const pattern = sameYear ? "EEEE d. MMMM" : "EEEE d. MMMM yyyy";
  return format(date, pattern, { locale: nb });
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = { date: Date };

export function DateDivider({ date }: Props) {
  const styles = useStyles();
  const label = formatDividerLabel(date, new Date());

  return (
    <View style={styles.row}>
      <View style={styles.pill}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = createStyles((theme) => ({
  row: {
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: theme.spacing.md,
  },
  pill: {
    backgroundColor: theme.colors.muted,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    opacity: 0.7,
  },
  label: {
    color: theme.colors.mutedForeground,
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
}));
