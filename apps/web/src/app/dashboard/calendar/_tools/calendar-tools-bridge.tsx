"use client";

/**
 * calendar-tools-bridge.tsx — registers Botsson tools for /dashboard/calendar.
 *
 * Hosted INSIDE CalendarPageShell so it captures the live state cursor + view
 * + tab + sheet handlers. Returns null. Tools are unregistered automatically
 * on unmount (route change).
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useCalendarTools, type CalendarToolInput } from "./use-calendar-tools";

export function CalendarToolsBridge(props: CalendarToolInput) {
  const tools = useCalendarTools(props);
  useRegisterTools("calendar", tools);
  return null;
}
