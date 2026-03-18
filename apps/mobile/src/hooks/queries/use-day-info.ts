/**
 * Fetches today's day info: bookings, manager messages, and active deviations.
 *
 * Combines three parallel queries into a single hook for the home screen's
 * day brief section. All data is workspace-scoped via the authenticated user's JWT.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type DayBooking = Database["public"]["Tables"]["schedule_day_booking"]["Row"];
type DayMessage = Database["public"]["Tables"]["schedule_day_message"]["Row"];
type Deviation = Database["public"]["Tables"]["deviation"]["Row"];

export type DayInfo = {
  bookings: DayBooking[];
  messages: DayMessage[];
  deviations: Deviation[];
};

const CACHE_KEY = "cache:day-info";
const STALE_TIME_MS = 5 * 60 * 1000;

function getPlaceholderData(): DayInfo | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(CACHE_KEY);
    return cached ? (JSON.parse(cached) as DayInfo) : undefined;
  } catch {
    return undefined;
  }
}

function persistToCache(data: DayInfo): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    mmkvStorage?.set(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache module not available
  }
}

async function fetchDayInfo(): Promise<DayInfo> {
  const today = new Date().toISOString().split("T")[0];

  // Run all three queries in parallel — they're independent
  const [bookingsResult, messagesResult, deviationsResult] = await Promise.all([
    supabase
      .from("schedule_day_booking")
      .select("*")
      .eq("shift_date", today)
      .order("booking_time", { ascending: true }),

    supabase
      .from("schedule_day_message")
      .select("*")
      .eq("shift_date", today)
      .order("created_at", { ascending: false }),

    // Active deviations = not resolved, created today or still open
    supabase
      .from("deviation")
      .select("*")
      .in("status", ["reported", "acknowledged"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (bookingsResult.error) throw bookingsResult.error;
  if (messagesResult.error) throw messagesResult.error;
  if (deviationsResult.error) throw deviationsResult.error;

  const dayInfo: DayInfo = {
    bookings: bookingsResult.data ?? [],
    messages: messagesResult.data ?? [],
    deviations: deviationsResult.data ?? [],
  };

  persistToCache(dayInfo);
  return dayInfo;
}

/**
 * Hook: returns today's bookings, manager messages, and active deviations.
 * Used by the home screen's day brief and the shift detail view.
 */
export function useDayInfo() {
  return useQuery<DayInfo>({
    queryKey: ["day-info"],
    queryFn: fetchDayInfo,
    staleTime: STALE_TIME_MS,
    placeholderData: getPlaceholderData,
  });
}
