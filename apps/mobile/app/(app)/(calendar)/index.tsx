/**
 * Calendar tab — stub screen.
 *
 * Phase 3c delivers WeekView, MonthView, DayView to replace this stub.
 * Rendering a minimal placeholder keeps the tab functional during Phase 3f.
 */

import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/theme";

export default function CalendarScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.label, { color: theme.colors.mutedForeground }]}>
        Kalender — kjem i Phase 3c
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
});
