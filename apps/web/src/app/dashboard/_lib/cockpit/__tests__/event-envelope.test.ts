/**
 * Unit tests for cockpit event normalization and deduplication.
 *
 * Source: apps/web/src/app/dashboard/_lib/cockpit/event-envelope.ts
 *
 * These tests ensure activity feed rows are mapped to the shared
 * CockpitEventEnvelope contract and duplicate events are collapsed
 * to the latest record in newest-first feed order.
 */

import { describe, expect, it } from "vitest";
import type { CockpitEventEnvelope } from "@smartout/types";
import { dedupeCockpitEvents, normalizeActivityTrailEvent } from "../event-envelope";

describe("normalizeActivityTrailEvent", () => {
  it("maps activity_trail rows to cockpit envelope", () => {
    const result = normalizeActivityTrailEvent({
      id: 12,
      event: "day_info created",
      category: "operations",
      actionVerb: "created",
      actorName: "Anna",
      entityType: "task",
      entityLabel: "Temperaturkontroll",
      createdAt: "2026-03-28T12:00:00.000Z",
    });

    expect(result.source).toBe("human");
    expect(result.sessionMode).toBe("none");
    expect(result.summary).toContain("Temperaturkontroll");
  });
});

describe("dedupeCockpitEvents", () => {
  it("keeps only one event per correlation key + type", () => {
    const input: CockpitEventEnvelope[] = [
      {
        id: "a1",
        source: "human",
        sessionMode: "none",
        severity: "warning",
        eventType: "task.overdue",
        summary: "Task overdue",
        occurredAt: "2026-03-28T10:00:00.000Z",
        correlationId: "task-1",
      },
      {
        id: "a2",
        source: "human",
        sessionMode: "none",
        severity: "warning",
        eventType: "task.overdue",
        summary: "Task overdue (duplicate)",
        occurredAt: "2026-03-28T10:00:01.000Z",
        correlationId: "task-1",
      },
    ];

    const result = dedupeCockpitEvents(input);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("a2");
  });

  it("returns events in newest-first order after dedupe", () => {
    const input: CockpitEventEnvelope[] = [
      {
        id: "b1",
        source: "system",
        sessionMode: "none",
        severity: "info",
        eventType: "session.open",
        summary: "Session opened",
        occurredAt: "2026-03-28T09:00:00.000Z",
      },
      {
        id: "b2",
        source: "agent",
        sessionMode: "agent",
        severity: "warning",
        eventType: "task.late",
        summary: "Late task",
        occurredAt: "2026-03-28T11:00:00.000Z",
      },
    ];

    const result = dedupeCockpitEvents(input);

    expect(result.map((event) => event.id)).toEqual(["b2", "b1"]);
  });

  it("normalizes event type case and trims before dedup keying", () => {
    const input: CockpitEventEnvelope[] = [
      {
        id: "case-a",
        source: "human",
        sessionMode: "none",
        severity: "warning",
        eventType: " Task.Overdue ",
        summary: "Original case",
        occurredAt: "2026-03-28T10:00:00.000Z",
        correlationId: "task-2",
      },
      {
        id: "case-b",
        source: "human",
        sessionMode: "none",
        severity: "warning",
        eventType: "task.overdue",
        summary: "Canonical case",
        occurredAt: "2026-03-28T10:05:00.000Z",
        correlationId: "task-2",
      },
    ];

    const result = dedupeCockpitEvents(input);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("case-b");
  });

  it("uses id fallback when correlation is absent", () => {
    const input: CockpitEventEnvelope[] = [
      {
        id: "no-corr-1",
        source: "system",
        sessionMode: "none",
        severity: "info",
        eventType: "session.open",
        summary: "First",
        occurredAt: "2026-03-28T09:00:00.000Z",
      },
      {
        id: "no-corr-2",
        source: "system",
        sessionMode: "none",
        severity: "info",
        eventType: "session.open",
        summary: "Second",
        occurredAt: "2026-03-28T09:30:00.000Z",
      },
    ];

    const result = dedupeCockpitEvents(input);

    expect(result).toHaveLength(2);
    expect(result.map((event) => event.id)).toEqual(["no-corr-2", "no-corr-1"]);
  });

  it("handles invalid timestamps safely and keeps deterministic order", () => {
    const input: CockpitEventEnvelope[] = [
      {
        id: "invalid-b",
        source: "human",
        sessionMode: "none",
        severity: "info",
        eventType: "audit.log",
        summary: "Invalid timestamp B",
        occurredAt: "not-a-date",
      },
      {
        id: "valid-a",
        source: "human",
        sessionMode: "none",
        severity: "info",
        eventType: "audit.log",
        summary: "Valid timestamp",
        occurredAt: "2026-03-28T10:00:00.000Z",
      },
      {
        id: "invalid-a",
        source: "human",
        sessionMode: "none",
        severity: "info",
        eventType: "audit.log",
        summary: "Invalid timestamp A",
        occurredAt: "also-not-a-date",
      },
    ];

    const result = dedupeCockpitEvents(input);

    expect(result.map((event) => event.id)).toEqual(["valid-a", "invalid-a", "invalid-b"]);
  });

  it("breaks equal timestamp ties deterministically by id", () => {
    const input: CockpitEventEnvelope[] = [
      {
        id: "tie-a",
        source: "agent",
        sessionMode: "agent",
        severity: "warning",
        eventType: "task.late",
        summary: "Tie A",
        occurredAt: "2026-03-28T11:00:00.000Z",
        correlationId: "tie-1",
      },
      {
        id: "tie-b",
        source: "agent",
        sessionMode: "agent",
        severity: "warning",
        eventType: "task.late",
        summary: "Tie B",
        occurredAt: "2026-03-28T11:00:00.000Z",
        correlationId: "tie-1",
      },
    ];

    const result = dedupeCockpitEvents(input);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("tie-b");
  });
});
