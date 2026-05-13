/**
 * Combines shifts, tasks, bookings, messages, and deviations into a unified
 * operations feed for the Operations screen.
 *
 * Reuses existing hooks (useMyShifts, useMyTasks, useDayInfo) rather than
 * duplicating queries. Maps each data source into the FeedItem shape the
 * Operations UI expects.
 */

import { useMemo } from "react";
import { useMyShifts } from "./use-my-shifts";
import { useMyTasks } from "./use-my-tasks";
import { useDayInfo } from "./use-day-info";
import { useShiftColleagues } from "./use-shift-colleagues";
import { useMyProfile } from "./use-my-profile";

/* ── FeedItem — the shape the Operations UI renders ── */

export type FeedItemType = "overdue" | "task" | "shift" | "team" | "booking" | "note";

export type FeedItem = {
  id: string;
  type: FeedItemType;
  title: string;
  subtitle: string;
  time?: string;
  done?: boolean;
};

/**
 * Format a time string like "16:00:00" to "16:00" for display.
 * Returns undefined if the input is null/empty.
 */
function formatTime(time: string | null | undefined): string | undefined {
  if (!time) return undefined;
  // "HH:MM:SS" → "HH:MM"
  return time.slice(0, 5);
}

/**
 * Format a shift time range like "16:00 – 23:00" from start/end times.
 */
function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/**
 * Check whether a date string (YYYY-MM-DD) matches a given JS Date.
 */
function isDateMatch(dateStr: string, target: Date): boolean {
  const targetStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
  return dateStr === targetStr;
}

/**
 * Hook: returns a unified FeedItem[] for the Operations screen.
 *
 * Combines data from:
 * - schedule_shift (via useMyShifts) → shift + team items
 * - session_task (via useMyTasks) → task + overdue items
 * - schedule_day_booking (via useDayInfo) → booking items
 * - schedule_day_message (via useDayInfo) → note items
 * - deviation (via useDayInfo) → overdue items
 *
 * @param selectedDate - The date selected in the week strip calendar
 */
export function useOperationsFeed(selectedDate: Date) {
  const shiftsQuery = useMyShifts();
  const tasksQuery = useMyTasks();
  const dayInfoQuery = useDayInfo();
  const profileQuery = useMyProfile();

  const profileId = profileQuery.data?.profile_id ?? null;

  /* Find first shift on selected date to drive colleague lookup */
  const firstShiftDate = useMemo(() => {
    const shifts = shiftsQuery.data ?? [];
    const match = shifts.find((s) => isDateMatch(s.shift_date, selectedDate));
    return match?.shift_date ?? null;
  }, [shiftsQuery.data, selectedDate]);

  const colleaguesQuery = useShiftColleagues(firstShiftDate, profileId);

  const isLoading =
    shiftsQuery.isLoading ||
    tasksQuery.isLoading ||
    dayInfoQuery.isLoading ||
    profileQuery.isLoading;

  const isError =
    shiftsQuery.isError || tasksQuery.isError || dayInfoQuery.isError || profileQuery.isError;

  const error = shiftsQuery.error ?? tasksQuery.error ?? dayInfoQuery.error ?? profileQuery.error;

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    /* ── Shifts for the selected date ── */
    const shifts = shiftsQuery.data ?? [];
    for (const shift of shifts) {
      if (!isDateMatch(shift.shift_date, selectedDate)) continue;

      items.push({
        id: `shift-${shift.schedule_shift_id}`,
        type: "shift",
        title: `${shift.role}${shift.zone ? ` — ${shift.zone}` : ""}`,
        subtitle: `${shift.day_category === "evening" ? "Kveldsskift" : shift.day_category === "weekend" ? "Helgeskift" : "Dagskift"}${shift.zone ? ` · ${shift.zone}` : ""}`,
        time: formatTimeRange(shift.start_time, shift.end_time),
      });
    }

    /* ── Team colleagues (only if we have shift on selected date) ── */
    const colleagues = colleaguesQuery.data ?? [];
    if (colleagues.length > 0 && firstShiftDate && isDateMatch(firstShiftDate, selectedDate)) {
      const names = colleagues
        .slice(0, 3)
        .map((c) => c.firstName)
        .join(", ");
      const extra = colleagues.length > 3 ? ` +${colleagues.length - 3}` : "";

      items.push({
        id: `team-${firstShiftDate}`,
        type: "team",
        title: `Teamvakt: ${names}${extra}`,
        subtitle: colleagues
          .slice(0, 3)
          .map((c) => c.role)
          .filter((r, i, arr) => arr.indexOf(r) === i)
          .join(" + "),
        time: formatTime(colleagues[0]?.startTime),
      });
    }

    /* ── Tasks (today only — session_task is scoped to today) ── */
    const today = new Date();
    const isToday = isDateMatch(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
      selectedDate,
    );

    if (isToday) {
      const tasks = tasksQuery.data ?? [];
      for (const task of tasks) {
        const isDone = task.status === "completed";
        const isOverdue = task.status === "overdue" || task.status === "skipped";

        items.push({
          id: `task-${task.id}`,
          type: isOverdue ? "overdue" : "task",
          title: task.title,
          subtitle: task.description ?? (task.compliance ? "Lovpålagt oppgave" : "Oppgave"),
          done: isDone,
        });
      }

      /* ── Deviations (active, not date-filtered — show on today only) ── */
      const deviations = dayInfoQuery.data?.deviations ?? [];
      for (const dev of deviations) {
        items.push({
          id: `dev-${dev.deviation_id}`,
          type: "overdue",
          title: dev.title,
          subtitle: `${dev.severity === "critical" ? "Kritisk" : dev.severity === "high" ? "Alvorlig" : "Avvik"} · ${dev.domain}`,
        });
      }

      /* ── Bookings (today's bookings from schedule_day_booking) ── */
      const bookings = dayInfoQuery.data?.bookings ?? [];
      for (const booking of bookings) {
        const guestLabel = `${booking.guest_count} gjester`;
        const locationPart = booking.location ? ` · ${booking.location}` : "";
        const menuPart = booking.menu ? ` · ${booking.menu}` : "";

        items.push({
          id: `booking-${booking.schedule_day_booking_id}`,
          type: "booking",
          title: `${booking.title} — ${guestLabel}`,
          subtitle: `${locationPart}${menuPart}`.replace(/^ · /, "") || "Booking",
          time: formatTime(booking.booking_time),
        });
      }

      /* ── Notes/messages (today's manager messages from schedule_day_message) ── */
      const messages = dayInfoQuery.data?.messages ?? [];
      for (const msg of messages) {
        items.push({
          id: `note-${msg.schedule_day_message_id}`,
          type: "note",
          title: msg.title,
          subtitle: msg.content.length > 60 ? `${msg.content.slice(0, 57)}...` : msg.content,
        });
      }
    }

    /* Sort: overdue first, then by type priority, then by time */
    const typePriority: Record<FeedItemType, number> = {
      overdue: 0,
      task: 1,
      shift: 2,
      team: 3,
      booking: 4,
      note: 5,
    };

    items.sort((a, b) => {
      const pa = typePriority[a.type];
      const pb = typePriority[b.type];
      if (pa !== pb) return pa - pb;
      // Within same type, sort by time if available
      if (a.time && b.time) return a.time.localeCompare(b.time);
      return 0;
    });

    return items;
  }, [
    shiftsQuery.data,
    tasksQuery.data,
    dayInfoQuery.data,
    colleaguesQuery.data,
    selectedDate,
    firstShiftDate,
  ]);

  return {
    data: feed,
    isLoading,
    isError,
    error,
    /** Expose individual query refetch for pull-to-refresh */
    refetch: async () => {
      await Promise.all([shiftsQuery.refetch(), tasksQuery.refetch(), dayInfoQuery.refetch()]);
    },
  };
}
