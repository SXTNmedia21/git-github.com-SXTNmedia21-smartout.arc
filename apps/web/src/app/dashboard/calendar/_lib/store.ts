/**
 * Calendar local store — useState + localStorage persistence.
 * Replace with TanStack Query + workspace-api endpoints when backend lands.
 */

"use client";

import { useEffect, useState } from "react";
import { type Booking, type CalendarEvent, type CalendarSettings, DEFAULT_SETTINGS } from "./types";

const STORAGE = {
  events: "smartout.calendar.events.v1",
  bookings: "smartout.calendar.bookings.v1",
  settings: "smartout.calendar.settings.v1",
};

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    // Only deep-merge plain objects (settings). Arrays + primitives return as-is
    // — merging arrays as objects corrupts list data (events/bookings).
    if (isPlainObject(parsed) && isPlainObject(fallback)) {
      return mergeDeep(fallback, parsed) as T;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep<T>(base: T, override: T): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override ?? base;
  }
  const out = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(override as Record<string, unknown>)) {
    const bv = (base as Record<string, unknown>)[key];
    const ov = (override as Record<string, unknown>)[key];
    out[key] = isPlainObject(bv) && isPlainObject(ov) ? mergeDeep(bv, ov) : ov;
  }
  return out as T;
}

function saveToStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled — ignore */
  }
}

// Dates computed inside a function — safe to call on both SSR and CSR.
// Module-level `new Date()` can diverge across midnight when server tz ≠ client tz.
function makeSeedEvents(): CalendarEvent[] {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return [
    {
      id: "seed-1",
      title: "Sjefsmøte",
      date: today,
      startHour: 10,
      endHour: 11,
      color: "orange",
      source: "manual",
    },
    {
      id: "seed-2",
      title: "Lunsj-service",
      date: tomorrow,
      startHour: 11,
      endHour: 14,
      color: "warm",
      source: "manual",
    },
  ];
}

function makeSeedBookings(): Booking[] {
  const today = new Date().toISOString().slice(0, 10);
  return [
    {
      id: "b-1",
      guest: "Bedriftsmiddag · Statkraft",
      date: today,
      time: "19:00",
      seats: 24,
    },
  ];
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>(makeSeedEvents);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage AFTER hydration to avoid SSR/CSR mismatch.
  useEffect(() => {
    const loaded = loadFromStorage(STORAGE.events, makeSeedEvents());
    if (Array.isArray(loaded)) setEvents(loaded);
    setHydrated(true);
  }, []);

  // Persist on change only after initial hydration to avoid overwriting
  // legitimate localStorage data with the SSR seed on first render.
  useEffect(() => {
    if (hydrated) saveToStorage(STORAGE.events, events);
  }, [events, hydrated]);

  return {
    events,
    upsertEvent: (e: CalendarEvent) =>
      setEvents((prev) => {
        const idx = prev.findIndex((p) => p.id === e.id);
        if (idx === -1) return [...prev, e];
        const next = prev.slice();
        next[idx] = e;
        return next;
      }),
    deleteEvent: (id: string) => setEvents((prev) => prev.filter((p) => p.id !== id)),
  };
}

export function useCalendarBookings() {
  const [bookings, setBookings] = useState<Booking[]>(makeSeedBookings);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage AFTER hydration to avoid SSR/CSR mismatch.
  useEffect(() => {
    const loaded = loadFromStorage(STORAGE.bookings, makeSeedBookings());
    if (Array.isArray(loaded)) setBookings(loaded);
    setHydrated(true);
  }, []);

  // Persist on change only after initial hydration.
  useEffect(() => {
    if (hydrated) saveToStorage(STORAGE.bookings, bookings);
  }, [bookings, hydrated]);

  return {
    bookings,
    upsertBooking: (b: Booking) =>
      setBookings((prev) => {
        const idx = prev.findIndex((p) => p.id === b.id);
        if (idx === -1) return [...prev, b];
        const next = prev.slice();
        next[idx] = b;
        return next;
      }),
    deleteBooking: (id: string) => setBookings((prev) => prev.filter((p) => p.id !== id)),
  };
}

export function useCalendarSettings() {
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage AFTER hydration to avoid SSR/CSR mismatch.
  useEffect(() => {
    setSettings(loadFromStorage(STORAGE.settings, DEFAULT_SETTINGS));
    setHydrated(true);
  }, []);

  // Persist on change only after initial hydration.
  useEffect(() => {
    if (hydrated) saveToStorage(STORAGE.settings, settings);
  }, [settings, hydrated]);

  return { settings, setSettings };
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
