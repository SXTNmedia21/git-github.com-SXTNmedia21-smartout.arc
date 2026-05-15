/**
 * Home — 3-screen pager: Pre-shift · On-shift · Post-shift.
 *
 * Replaces (calendar) as the daily anchor + FAB-tap target.
 * Horizontal swipe between modes. Default lands on On-shift when an active
 * time_entry exists, otherwise Pre-shift (next upcoming) or Post-shift (just
 * clocked out today). Falls back to Pre-shift when nothing relevant.
 *
 * SUPERSEDES the relevant parts of ADR-0268 anchor behavior (FAB tap +
 * initial route). Calendar tab remains accessible but is no longer the
 * landing screen.
 */

import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useTheme } from "@/theme";
import { PreShiftScreen } from "@/components/home/PreShiftScreen";
import { OnShiftScreen } from "@/components/home/OnShiftScreen";
import { PostShiftScreen } from "@/components/home/PostShiftScreen";

const { width: SCREEN_W } = Dimensions.get("window");

export default function HomeIndex() {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== pageIndex) setPageIndex(i);
  };

  const labels = useMemo(() => ["Før vakt", "I vakt", "Etter vakt"], []);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Mode indicator dots */}
      <View style={styles.indicatorRow}>
        {labels.map((label, i) => (
          <View key={label} style={styles.indicatorItem}>
            <View
              style={[
                styles.indicatorDot,
                {
                  backgroundColor: i === pageIndex ? theme.colors.brandOrange : theme.colors.border,
                },
              ]}
            />
            <Text
              style={[
                styles.indicatorLabel,
                {
                  color: i === pageIndex ? theme.colors.foreground : theme.colors.mutedForeground,
                  fontWeight: i === pageIndex ? "700" : "500",
                },
              ]}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        <View style={{ width: SCREEN_W }}>
          <PreShiftScreen />
        </View>
        <View style={{ width: SCREEN_W }}>
          <OnShiftScreen />
        </View>
        <View style={{ width: SCREEN_W }}>
          <PostShiftScreen />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  indicatorRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  indicatorItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  indicatorLabel: {
    fontSize: 12,
  },
});
