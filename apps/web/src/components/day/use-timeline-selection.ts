"use client";

/**
 * useTimelineSelection — Local selection state for TimelineTab.
 *
 * Tracks which DayEvent is selected and from which surface (strip marker or list row).
 * The pulseSource drives the animation handshake:
 *   - "strip" → DayEventList row pulses ring + scrolls into view.
 *   - "list"  → DayTimelineStrip marker pulses scale keyframe.
 *
 * Scoped to TimelineTab; never a top-level context (ADR-0113).
 */

import { useState, useRef, useCallback } from "react";
import type { DayEvent } from "@/app/dashboard/_hooks/use-day-timeline-events";

export type SelectionSource = "strip" | "list" | null;

export type TimelineSelectionApi = {
  selectedId: string | null;
  selectedEvent: DayEvent | null;
  pulseSource: SelectionSource;
  selectFromStrip: (event: DayEvent | null) => void;
  selectFromList: (event: DayEvent | null) => void;
  clear: () => void;
};

const PULSE_DURATION_MS = 1200;

export function useTimelineSelection(): TimelineSelectionApi {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DayEvent | null>(null);
  const [pulseSource, setPulseSource] = useState<SelectionSource>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armPulse = useCallback((source: SelectionSource) => {
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    setPulseSource(source);
    if (source !== null) {
      pulseTimer.current = setTimeout(() => setPulseSource(null), PULSE_DURATION_MS);
    }
  }, []);

  const selectFromStrip = useCallback(
    (event: DayEvent | null) => {
      setSelectedId(event?.id ?? null);
      setSelectedEvent(event);
      armPulse(event ? "strip" : null);
    },
    [armPulse],
  );

  const selectFromList = useCallback(
    (event: DayEvent | null) => {
      setSelectedId(event?.id ?? null);
      setSelectedEvent(event);
      armPulse(event ? "list" : null);
    },
    [armPulse],
  );

  const clear = useCallback(() => {
    setSelectedId(null);
    setSelectedEvent(null);
    armPulse(null);
  }, [armPulse]);

  return { selectedId, selectedEvent, pulseSource, selectFromStrip, selectFromList, clear };
}
