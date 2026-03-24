/**
 * Punch Clock Screen — Full-screen ShiftClock experience.
 *
 * Expo Router screen at /(app)/(home)/punch-clock.
 * Delegates all logic and rendering to ShiftClockView.
 * Hides the header for an immersive full-screen experience.
 */

import React from "react";
import { Stack } from "expo-router";
import { ShiftClockView } from "@/components/shift-clock/ShiftClockView";

export default function PunchClockScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ShiftClockView />
    </>
  );
}
