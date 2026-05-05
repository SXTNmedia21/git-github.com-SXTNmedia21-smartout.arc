/**
 * WeekStrip — 7-day pill selector (man–søn).
 *
 * Each pill shows a short day label (e.g. "MAN") and the date number in
 * Instrument Serif. The selected day gets a full brand-orange fill; today
 * (when not selected) shows a small orange dot below the date number.
 * Tapping any pill fires onSelect(date).
 *
 * Spring-press feedback uses springReactive from motion tokens.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { nativeTheme } from "@smartout/design-tokens/native";
import { useTheme } from "@/theme";

const DAY_SHORT = ["MAN", "TIR", "ONS", "TOR", "FRE", "LØR", "SØN"] as const;
const { springReactive } = nativeTheme.motion;

type DayPillProps = {
  date: Date;
  today: Date;
  selectedDate: Date;
  onSelect: (d: Date) => void;
};

function DayPill({ date, today, selectedDate, onSelect }: DayPillProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const isSelected =
    date.getFullYear() === selectedDate.getFullYear() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getDate() === selectedDate.getDate();

  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  // Day-of-week index: JS getDay() is 0=Sun..6=Sat; re-map to 0=Mon..6=Sun
  const jsDay = date.getDay();
  const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
  const dayLabel = DAY_SHORT[dayIdx];
  const dateNum = date.getDate();

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.pillWrapper, animStyle]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.96, springReactive);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, springReactive);
        }}
        onPress={() => onSelect(date)}
        style={[
          styles.pill,
          isSelected
            ? { backgroundColor: theme.colors.brandOrange }
            : { backgroundColor: "transparent" },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${dayLabel} ${dateNum}`}
        accessibilityState={{ selected: isSelected }}
      >
        <Text
          style={[
            styles.dayLabel,
            {
              color: isSelected ? "rgba(255,255,255,0.9)" : theme.colors.mutedForeground,
            },
          ]}
        >
          {dayLabel}
        </Text>
        <Text
          style={[
            styles.dateNum,
            {
              color: isSelected ? "#ffffff" : theme.colors.foreground,
            },
          ]}
        >
          {dateNum}
        </Text>
        {isToday && !isSelected && (
          <View style={[styles.todayDot, { backgroundColor: theme.colors.brandOrange }]} />
        )}
      </Pressable>
    </Animated.View>
  );
}

type WeekStripProps = {
  /** Currently selected date. */
  selectedDate: Date;
  /** Callback when user taps a day pill. */
  onSelect: (d: Date) => void;
  /** Today's date — used for the orange dot indicator. */
  today: Date;
};

/**
 * Renders 7 day pills for the week that contains selectedDate (Mon–Sun).
 * The week is derived from selectedDate so the strip always shows the correct
 * contextual week without requiring the caller to pass individual day objects.
 */
export function WeekStrip({ selectedDate, onSelect, today }: WeekStripProps) {
  // Build Mon–Sun for the week containing selectedDate
  const days: Date[] = [];
  const jsDay = selectedDate.getDay(); // 0=Sun..6=Sat
  const daysSinceMon = jsDay === 0 ? 6 : jsDay - 1;
  const monday = new Date(selectedDate);
  monday.setDate(selectedDate.getDate() - daysSinceMon);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }

  return (
    <View style={styles.row}>
      {days.map((d) => (
        <DayPill
          key={d.toISOString()}
          date={d}
          today={today}
          selectedDate={selectedDate}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 4,
  },
  pillWrapper: {
    flex: 1,
  },
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    position: "relative",
    minHeight: 72,
    justifyContent: "center",
    gap: 4,
  },
  dayLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  dateNum: {
    fontSize: 26,
    fontFamily: "InstrumentSerif-Regular",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  todayDot: {
    position: "absolute",
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 99,
  },
});
