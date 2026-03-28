// ============================================
// event-envelope.ts
// Normalizes activity feed rows into cockpit
// event envelopes and deduplicates noisy feed
// entries while preserving newest-first order.
// ============================================

import type { CockpitEventEnvelope } from "@smartout/types";

export type ActivityTrailInput = {
  id: number;
  event: string;
  category: string;
  actionVerb: string;
  actorName: string;
  entityType: string;
  entityLabel: string | null;
  createdAt: string;
};

/**
 * Normalizes one activity_trail row to the cockpit event contract.
 *
 * Why: The cockpit consumes one shared event envelope shape even when
 * source systems emit different row formats.
 *
 * @param row - Activity feed row from activity_trail mapping.
 * @returns A normalized cockpit event envelope entry.
 */
export function normalizeActivityTrailEvent(row: ActivityTrailInput): CockpitEventEnvelope {
  const normalizedEvent = row.event.toLowerCase();
  const severity =
    normalizedEvent.includes("overdue") || normalizedEvent.includes("deviation")
      ? "critical"
      : normalizedEvent.includes("late")
        ? "warning"
        : "info";

  return {
    id: `activity-${row.id}`,
    source: "human",
    sessionMode: "none",
    severity,
    eventType: row.event,
    summary: `${row.actorName} ${row.actionVerb} ${row.entityType}${row.entityLabel ? ` — ${row.entityLabel}` : ""}`,
    occurredAt: row.createdAt,
    correlationId: null,
    entityRef: row.entityLabel ? { type: row.entityType, id: row.entityLabel } : null,
    actorLabel: row.actorName,
  };
}

/**
 * Deduplicates cockpit events by event type + correlation key.
 *
 * Why: The same operational event can arrive through overlapping sources.
 * We keep the freshest version to reduce feed noise in the first screen.
 *
 * @param events - Cockpit events from one or more sources.
 * @returns Deduplicated events sorted newest-first by occurredAt.
 */
export function dedupeCockpitEvents(events: CockpitEventEnvelope[]): CockpitEventEnvelope[] {
  const eventsByKey = new Map<string, CockpitEventEnvelope>();

  for (const event of events) {
    const key = `${event.eventType}::${event.correlationId ?? event.id}`;
    const existing = eventsByKey.get(key);

    if (!existing || Date.parse(event.occurredAt) >= Date.parse(existing.occurredAt)) {
      eventsByKey.set(key, event);
    }
  }

  return [...eventsByKey.values()].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  );
}
