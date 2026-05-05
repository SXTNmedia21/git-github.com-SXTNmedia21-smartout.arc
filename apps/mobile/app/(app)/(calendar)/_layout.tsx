/**
 * Calendar tab group layout.
 *
 * Stub for Phase 3f. Full calendar screens (WeekView, MonthView, DayView)
 * are built in Phase 3c. This layout satisfies Expo Router's route
 * requirement so the (calendar) tab resolves without 404.
 */

import { Stack } from "expo-router";

export default function CalendarLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
