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
 * Canonicalizes event type values so dedup logic treats formatting variants
 * as the same semantic event class.
 */
function canonicalizeEventType(eventType: string): string {
  return eventType.trim().toLowerCase();
}

/**
 * Returns a stable numeric timestamp for comparisons and sorting.
 *
 * Invalid timestamps are intentionally pushed to the end of "newest-first"
 * order by mapping to Number.NEGATIVE_INFINITY.
 */
function parseOccurredAt(occurredAt: string): number {
  const parsed = Date.parse(occurredAt);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/**
 * Builds a deterministic dedup discriminator when correlationId is missing.
 *
 * This avoids accidental cross-event dedup for unrelated rows and keeps key
 * behavior readable at call sites.
 */
function fallbackDiscriminator(event: CockpitEventEnvelope): string {
  return `id:${event.id.trim()}`;
}

/**
 * Computes the stable dedup key for one envelope.
 */
function buildDedupKey(event: CockpitEventEnvelope): string {
  const canonicalEventType = canonicalizeEventType(event.eventType);
  const normalizedCorrelationId = event.correlationId?.trim();
  const discriminator =
    normalizedCorrelationId && normalizedCorrelationId.length > 0
      ? `correlation:${normalizedCorrelationId}`
      : fallbackDiscriminator(event);

  return `${canonicalEventType}::${discriminator}`;
}

/**
 * Deterministic winner selection when events have the same dedup key.
 */
function shouldReplaceExisting(
  candidate: CockpitEventEnvelope,
  existing: CockpitEventEnvelope,
): boolean {
  const candidateTimestamp = parseOccurredAt(candidate.occurredAt);
  const existingTimestamp = parseOccurredAt(existing.occurredAt);

  if (candidateTimestamp > existingTimestamp) {
    return true;
  }

  if (candidateTimestamp < existingTimestamp) {
    return false;
  }

  // Tie-break by id for stable behavior regardless of input order.
  return candidate.id.localeCompare(existing.id) > 0;
}

/**
 * Sorting comparator for newest-first feed order with deterministic ties.
 */
function compareNewestFirst(left: CockpitEventEnvelope, right: CockpitEventEnvelope): number {
  const rightTimestamp = parseOccurredAt(right.occurredAt);
  const leftTimestamp = parseOccurredAt(left.occurredAt);
  if (rightTimestamp > leftTimestamp) {
    return 1;
  }
  if (rightTimestamp < leftTimestamp) {
    return -1;
  }

  const byEventType = canonicalizeEventType(left.eventType).localeCompare(
    canonicalizeEventType(right.eventType),
  );
  if (byEventType !== 0) {
    return byEventType;
  }

  return left.id.localeCompare(right.id);
}

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
    const key = buildDedupKey(event);
    const existing = eventsByKey.get(key);

    if (!existing || shouldReplaceExisting(event, existing)) {
      eventsByKey.set(key, event);
    }
  }

  return [...eventsByKey.values()].sort(compareNewestFirst);
}
