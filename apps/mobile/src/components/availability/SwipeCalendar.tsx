/**
 * SwipeCalendar — Layer 2 of "Min tilgjengelighet".
 *
 * Horizontal 14-day strip. Employee swipes through two weeks and taps a day
 * to open DayDetailSheet, which lets them set: unavailable / preferred /
 * time-range / clear. Color coding uses Nordic Split tokens only:
 *   - available → default surface (bg-background)
 *   - unavailable → bg-muted
 *   - preferred → bg-accent (warm tint via brandOrange accent)
 *
 * Snap-to-item behaviour uses ScrollView `snapToInterval` so each day aligns
 * cleanly under the active indicator. Selected day reveals a subtle ring
 * driven by reanimated spring (stiffness=35, damping=22, mass=2.2).
 */
import React, { useCallback, useMemo } from "react";
import { View, Text, Pressable, ScrollView, AccessibilityInfo } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { createStyles, useTheme, withOpacity } from "@/theme";
import type { DailyStatus } from "@/hooks/queries/use-my-availability";

type SwipeCalendarProps = {
  days: DailyStatus[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

const DAY_WIDTH = 64; // 44pt minimum + padding
const DAY_GAP = 8;

/** nb-NO short weekday, e.g. "fre" */
const weekdayFormatter = new Intl.DateTimeFormat("nb-NO", { weekday: "short" });
const dayMonthFormatter = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
});

export function SwipeCalendar({ days, selectedDate, onSelectDate }: SwipeCalendarProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handleTap = useCallback(
    (status: DailyStatus) => {
      Haptics.selectionAsync();
      onSelectDate(status.date);
      // Accessibility announcement (aria-live equivalent).
      const announcement = `${dayMonthFormatter.format(new Date(status.date))} valgt. Status: ${statusLabel(
        status.status,
      )}.`;
      AccessibilityInfo.announceForAccessibility(announcement);
    },
    [onSelectDate],
  );

  const dateLabelMap = useMemo(() => {
    const map = new Map<string, { weekday: string; dayMonth: string }>();
    days.forEach((d) => {
      const dt = new Date(d.date);
      map.set(d.date, {
        weekday: weekdayFormatter.format(dt),
        dayMonth: dayMonthFormatter.format(dt),
      });
    });
    return map;
  }, [days]);

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(400).springify()}
      style={styles.section}
    >
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Neste 14 dager</Text>
        <Text style={styles.sectionHint}>Trykk for å endre</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripContent}
        snapToInterval={DAY_WIDTH + DAY_GAP}
        decelerationRate="fast"
        accessibilityRole="adjustable"
        accessibilityLabel="Velg dag"
      >
        {days.map((day) => {
          const labels = dateLabelMap.get(day.date);
          const isSelected = day.date === selectedDate;
          const palette = stylesForStatus(day.status, theme);
          return (
            <Pressable
              key={day.date}
              onPress={() => handleTap(day)}
              style={[
                styles.dayCell,
                { backgroundColor: palette.bg, borderColor: palette.border },
                isSelected && {
                  borderColor: withOpacity(theme.colors.brandOrange, 0.5),
                  borderWidth: 2,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${labels?.dayMonth ?? day.date}, ${statusLabel(day.status)}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.weekdayText, { color: palette.fg }]}>
                {labels?.weekday ?? ""}
              </Text>
              <Text style={[styles.dayMonthText, { color: palette.fg }]}>
                {labels?.dayMonth ?? day.date}
              </Text>
              {day.status !== "available" ? (
                <View style={[styles.statusDot, { backgroundColor: palette.dot }]} />
              ) : (
                <View style={styles.statusDotPlaceholder} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.legend}>
        <LegendChip label="Tilgjengelig" swatch={theme.colors.background} border />
        <LegendChip label="Ikke tilgjengelig" swatch={theme.colors.muted} />
        <LegendChip label="Foretrekker" swatch={withOpacity(theme.colors.brandOrange, 0.12)} />
      </View>
    </Animated.View>
  );
}

function LegendChip({
  label,
  swatch,
  border,
}: {
  label: string;
  swatch: string;
  border?: boolean;
}) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.legendRow}>
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: swatch },
          border ? { borderWidth: 1, borderColor: theme.colors.border } : null,
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function statusLabel(status: DailyStatus["status"]): string {
  switch (status) {
    case "available":
      return "tilgjengelig";
    case "unavailable":
      return "ikke tilgjengelig";
    case "preferred":
      return "foretrekker å jobbe";
    case "blocked":
      return "blokkert av leder";
    default:
      return status;
  }
}

type StatusPalette = { bg: string; fg: string; border: string; dot: string };

function stylesForStatus(
  status: DailyStatus["status"],
  theme: ReturnType<typeof useTheme>,
): StatusPalette {
  switch (status) {
    case "unavailable":
      return {
        bg: theme.colors.muted,
        fg: theme.colors.mutedForeground,
        border: theme.colors.border,
        dot: theme.colors.mutedForeground,
      };
    case "preferred":
      return {
        bg: withOpacity(theme.colors.brandOrange, 0.12),
        fg: theme.colors.brandOrange,
        border: withOpacity(theme.colors.brandOrange, 0.3),
        dot: theme.colors.brandOrange,
      };
    case "blocked":
      return {
        bg: withOpacity(theme.colors.destructive, 0.1),
        fg: theme.colors.destructive,
        border: withOpacity(theme.colors.destructive, 0.3),
        dot: theme.colors.destructive,
      };
    case "available":
    default:
      return {
        bg: theme.colors.background,
        fg: theme.colors.foreground,
        border: theme.colors.border,
        dot: theme.colors.mutedForeground,
      };
  }
}

const useStyles = createStyles((theme) => ({
  section: { gap: theme.spacing.md, marginBottom: theme.spacing.page },
  headerRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionLabel: { ...theme.typography.title, color: theme.colors.foreground },
  sectionHint: {
    ...theme.typography.micro,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  stripContent: {
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    gap: DAY_GAP,
  },
  dayCell: {
    width: DAY_WIDTH,
    minHeight: 88,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekdayText: {
    ...theme.typography.micro,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dayMonthText: {
    ...theme.typography.bodyBold,
    // TODO: mono token slot when theme adds Geist Mono variant for RN
    fontSize: 14,
    textAlign: "center",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotPlaceholder: {
    width: 6,
    height: 6,
  },

  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.element,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
