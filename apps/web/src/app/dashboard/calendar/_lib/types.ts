/**
 * Calendar entities — local types until backend wiring lands.
 *
 * Future: events likely persist as `planning_event` (D4) or new
 * `calendar_event` table. Bookings likely become a domain table.
 * For now everything is in-memory + localStorage so the UI is testable.
 */

export type EventColor = "orange" | "warm" | "amber" | "rose" | "neutral";

// ADR-0366: CSS var references — resolved at render time from tokens.css
export const EVENT_COLOR_HEX: Record<EventColor, string> = {
  orange: "var(--brand-orange-dark)",
  warm: "var(--data-estimate)",
  amber: "var(--warning)",
  rose: "var(--destructive)",
  neutral: "var(--text-dim)",
};

export type CalendarEvent = {
  id: string;
  title: string;
  notes?: string;
  date: string; // ISO date yyyy-MM-dd
  startHour: number;
  endHour: number;
  color: EventColor;
  source: "manual" | "google";
};

export type Booking = {
  id: string;
  guest: string;
  date: string; // ISO date yyyy-MM-dd
  time: string; // HH:mm
  seats: number;
  notes?: string;
};

export type CalendarSettings = {
  google: {
    connected: boolean;
    email?: string;
    lastSyncAt?: string;
  };
  show: {
    events: boolean;
    bookings: boolean;
    shifts: boolean;
    sessions: boolean;
    holidays: boolean;
    googleEvents: boolean;
    openingHours: boolean;
  };
};

export const DEFAULT_SETTINGS: CalendarSettings = {
  google: { connected: false },
  show: {
    events: true,
    bookings: true,
    shifts: false,
    sessions: false,
    holidays: true,
    googleEvents: true,
    openingHours: true,
  },
};
