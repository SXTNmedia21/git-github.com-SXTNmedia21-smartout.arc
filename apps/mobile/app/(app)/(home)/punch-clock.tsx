/**
 * Punch Clock route — thin wrapper around ShiftClockView.
 *
 * ShiftClockView owns the full flow:
 * - idle: Stemple inn CTA with useGPSGuard geofence
 * - clocked_in: ShiftClockHeader + ShiftClockActions 2x2 grid
 *   (Pause/Notat/Tillegg/Ring leder) + PunchAnimation
 * - on_break: Break-timer + Tilbake action (Pause card shows resume state)
 * - summary: ShiftClockSummary after punch-out
 * - after_shift: Handoff + hours confirmation via AfterShiftView (workflow-mode)
 *
 * Replaces previous 989-line custom implementation that duplicated
 * (and partially broke) the ShiftClockView design.
 */

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
