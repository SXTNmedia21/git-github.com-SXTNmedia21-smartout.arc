"use client";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Emma Awareness — Telemetry Tap + State    */
/*                                            */
/*  Listens to "smartout:telemetry" events    */
/*  dispatched by emit() on the client side.  */
/*  Stores a ring buffer and derives a        */
/*  summary string for Emma's context.        */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { useCallback, useEffect, useSyncExternalStore } from "react";

const MAX_EVENTS = 100;

export type TelemetryEntry = {
  timestamp: number;
  event: string;
  category: string;
  summary: string;
};

/* ━━━ Singleton store ━━━━━━━━━━━━━━━━━━━━━ */

let entries: TelemetryEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function getSnapshot(): TelemetryEntry[] {
  return entries;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function push(entry: TelemetryEntry) {
  entries = [...entries.slice(-(MAX_EVENTS - 1)), entry];
  notify();
}

/* ━━━ Global listener (installed once) ━━━━ */

const SERVER_SNAPSHOT: TelemetryEntry[] = [];
let installed = false;

function installTap() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("smartout:telemetry", ((e: CustomEvent) => {
    const detail = e.detail as {
      event?: string;
      properties?: Record<string, unknown>;
      workspace_id?: string | null;
    };
    if (!detail?.event) return;

    // Derive a category from the event name (first word)
    const category = detail.event.split(" ")[0] ?? "unknown";

    // Build a human-readable summary
    const props = detail.properties ?? {};
    const parts: string[] = [detail.event];

    // Extract key info from common event shapes
    if ("entity" in props && typeof props.entity === "object" && props.entity !== null) {
      const entity = props.entity as { entity_label?: string; entity_type?: string };
      if (entity.entity_label) parts.push(entity.entity_label);
      else if (entity.entity_type) parts.push(entity.entity_type);
    }
    if ("data" in props && typeof props.data === "object" && props.data !== null) {
      const data = props.data as Record<string, unknown>;
      if (data.name) parts.push(String(data.name));
      if (data.step_id) parts.push(`step: ${data.step_id}`);
      if (data.shift_count) parts.push(`${data.shift_count} shifts`);
    }
    if ("path" in props) parts.push(String(props.path));

    push({
      timestamp: Date.now(),
      event: detail.event,
      category,
      summary: parts.join(" — "),
    });
  }) as EventListener);
}

/* ━━━ Hook: useEmmaTelemetry ━━━━━━━━━━━━━ */

export function useEmmaTelemetry() {
  // Install the global tap on first mount
  useEffect(() => {
    installTap();
  }, []);

  const events = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const clearEvents = useCallback(() => {
    entries = [];
    notify();
  }, []);

  return { events, clearEvents };
}

/* ━━━ Build context summary for Emma ━━━━━━ */

/**
 * Returns a compact text summary of recent telemetry for Emma's system prompt context.
 * Only the last N events, grouped by category.
 */
export function buildTelemetrySummary(events: TelemetryEntry[], limit = 10): string {
  if (events.length === 0) return "";

  const recent = events.slice(-limit);
  const lines = recent.map((e) => {
    const ago = Math.round((Date.now() - e.timestamp) / 1000);
    const timeLabel = ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`;
    return `- ${e.event} (${timeLabel})`;
  });

  return `## Siste aktivitet\n${lines.join("\n")}`;
}
