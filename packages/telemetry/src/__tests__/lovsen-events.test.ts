// P1.S0 (2026-04-29) — Lovsen telemetry contract tests (ADR-0238).
//
// Three assertion classes:
//   1. All 9 lovsen.* events are registered in EVENT_ROUTING with
//      destinations ['posthog', 'logger', 'activity_trail'].
//   2. All 9 events carry workspace_id + actor_id as NonEmptyString
//      on BaseEvent (ADR-0134/ADR-0193 enforcement).
//   3. Emit smoke: emit() with a valid payload routes to logger destination
//      (mocked); emit with empty actor_id throws in test environment.
//
// No engine_event routing in P1.S0 — that is P1.S4 scope (ADR-0241).

import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  EVENT_ROUTING,
  type EventDestination,
  type SmartoutEvent,
  type LovsenQueryReceived,
  type LovsenQueryClassified,
  type LovsenSkillInvoked,
  type LovsenMcpFetch,
  type LovsenMcpFetchCompleted,
  type LovsenMcpFetchFailed,
  type LovsenAnswerComposed,
  type LovsenConfidenceDegraded,
  type LovsenCitationStale,
} from "../registry";
import { nonEmpty } from "../non-empty-string";

type EventName = SmartoutEvent["event"];

const LOVSEN_EVENTS = [
  "lovsen.query.received",
  "lovsen.query.classified",
  "lovsen.skill.invoked",
  "lovsen.mcp.fetch",
  "lovsen.mcp.fetch.completed",
  "lovsen.mcp.fetch.failed",
  "lovsen.answer.composed",
  "lovsen.confidence.degraded",
  "lovsen.citation.stale",
] as const satisfies readonly EventName[];

const REQUIRED_DESTINATIONS: EventDestination[] = ["posthog", "logger", "activity_trail"];

// ─── 1. Registration and routing ────────────────────────────────────────────

describe("lovsen telemetry contract — registration (ADR-0238)", () => {
  test.each(LOVSEN_EVENTS)("'%s' is registered in EVENT_ROUTING", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
  });

  test.each(LOVSEN_EVENTS)(
    "'%s' routes to exactly 3 destinations: posthog + logger + activity_trail",
    (event) => {
      const routing = EVENT_ROUTING[event];
      expect(routing).toBeDefined();
      expect(routing.destinations).toHaveLength(3);
      for (const dest of REQUIRED_DESTINATIONS) {
        expect(routing.destinations).toContain(dest);
      }
    },
  );

  test.each(LOVSEN_EVENTS)("'%s' is categorised as 'lovsen'", (event) => {
    expect(EVENT_ROUTING[event].category).toBe("lovsen");
  });

  test.each(LOVSEN_EVENTS)("'%s' does NOT route to engine_event (P1.S0 scope)", (event) => {
    expect(EVENT_ROUTING[event].destinations).not.toContain("engine_event");
  });
});

// ─── 2. Payload shape compile-time assertions ────────────────────────────────
// These tests build valid payloads for each interface. If a required field is
// missing or wrong type the file fails to compile — the runtime expect() call
// is a readability signal, not the primary gate.

describe("lovsen telemetry contract — payload shapes (ADR-0134/ADR-0193)", () => {
  const WS = nonEmpty("ws_abc123", "workspace_id");
  const ACTOR = nonEmpty("profile_def456", "actor_id");

  test("LovsenQueryReceived payload compiles + has non-empty ids", () => {
    const payload: LovsenQueryReceived = {
      event: "lovsen.query.received",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: { query: "Hva er prøvetid i hospitality?", channel: "chat" },
    };
    expect(payload.workspace_id).toBeTruthy();
    expect(payload.actor_id).toBeTruthy();
  });

  test("LovsenQueryClassified payload compiles + has non-empty ids", () => {
    const payload: LovsenQueryClassified = {
      event: "lovsen.query.classified",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: { intent: "arbeidsrett", skill_picked: "aml-14-6-validator", tier: 1 },
    };
    expect(payload.workspace_id).toBeTruthy();
    expect(payload.actor_id).toBeTruthy();
  });

  test("LovsenSkillInvoked payload compiles + has non-empty ids", () => {
    const payload: LovsenSkillInvoked = {
      event: "lovsen.skill.invoked",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: { skill_name: "aml-14-6-validator", skill_version: "aml-14-6-2024-07" },
    };
    expect(payload.workspace_id).toBeTruthy();
    expect(payload.actor_id).toBeTruthy();
  });

  test("LovsenMcpFetch payload compiles + has non-empty ids", () => {
    const payload: LovsenMcpFetch = {
      event: "lovsen.mcp.fetch",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: {
        mcp_server: "lovdata",
        tool: "fetch_paragraph",
        params: { law: "aml", paragraph: "14-6" },
      },
    };
    expect(payload.workspace_id).toBeTruthy();
    expect(payload.actor_id).toBeTruthy();
  });

  test("LovsenMcpFetchCompleted payload compiles + has non-empty ids", () => {
    const payload: LovsenMcpFetchCompleted = {
      event: "lovsen.mcp.fetch.completed",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: {
        mcp_server: "lovdata",
        tool: "fetch_paragraph",
        latency_ms: 240,
        cache_hit: false,
      },
    };
    expect(payload.workspace_id).toBeTruthy();
    expect(payload.actor_id).toBeTruthy();
  });

  test("LovsenMcpFetchFailed payload compiles + has non-empty ids", () => {
    const payload: LovsenMcpFetchFailed = {
      event: "lovsen.mcp.fetch.failed",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: {
        mcp_server: "lovdata",
        tool: "fetch_paragraph",
        error_kind: "RATE_LIMITED",
        error_message: "429 Too Many Requests",
      },
    };
    expect(payload.workspace_id).toBeTruthy();
    expect(payload.actor_id).toBeTruthy();
  });

  test("LovsenAnswerComposed payload compiles + has non-empty ids", () => {
    const payload: LovsenAnswerComposed = {
      event: "lovsen.answer.composed",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: { citation_count: 2, confidence_level: "HØY", escalation_recommended: false },
    };
    expect(payload.workspace_id).toBeTruthy();
    expect(payload.actor_id).toBeTruthy();
  });

  test("LovsenConfidenceDegraded payload compiles + has non-empty ids", () => {
    const payload: LovsenConfidenceDegraded = {
      event: "lovsen.confidence.degraded",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: { score: 0.3, reasons: ["Stale paragraph", "Missing tariff context"] },
    };
    expect(payload.workspace_id).toBeTruthy();
    expect(payload.actor_id).toBeTruthy();
    // score: 0 is valid per journey error-path scenario in PLAN
    const zeroScorePayload: LovsenConfidenceDegraded = {
      ...payload,
      properties: { score: 0, reasons: ["No source found"] },
    };
    expect(zeroScorePayload.properties.score).toBe(0);
  });

  test("LovsenCitationStale payload compiles + has non-empty ids", () => {
    const payload: LovsenCitationStale = {
      event: "lovsen.citation.stale",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: {
        paragraph: "Aml. §14-6",
        fetched_at: "2026-03-01T00:00:00.000Z",
        age_hours: 1416,
      },
    };
    expect(payload.workspace_id).toBeTruthy();
    expect(payload.actor_id).toBeTruthy();
  });
});

// ─── 3. nonEmpty guard — empty actor_id throws in test environment ───────────

describe("lovsen telemetry — empty actor_id guard (ADR-0134)", () => {
  test("nonEmpty('', 'actor_id') throws in test environment", () => {
    expect(() => nonEmpty("", "actor_id")).toThrow(
      'telemetry: actor_id must be non-empty (got "")',
    );
  });

  test("nonEmpty(null, 'workspace_id') throws in test environment", () => {
    expect(() => nonEmpty(null, "workspace_id")).toThrow("workspace_id must be non-empty");
  });
});

// ─── 4. Emit smoke — logger destination receives the event ──────────────────
// Mocks logger provider to verify EVENT_ROUTING-driven dispatch reaches it.
// Uses dynamic import interception via vi.mock.

describe("lovsen telemetry — emit smoke (ADR-0238)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("emit('lovsen.query.received', payload) calls logToStdout", async () => {
    const logSpy = vi.fn();

    vi.doMock("../providers/logger", () => ({
      logToStdout: logSpy,
    }));

    const { emit } = await import("../emit");

    const WS = nonEmpty("ws_smoke_test", "workspace_id");
    const ACTOR = nonEmpty("actor_smoke_test", "actor_id");

    await emit({
      event: "lovsen.query.received",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: { query: "Hva er kveldstillegg?", channel: "chat" },
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: "lovsen.query.received" }),
      expect.objectContaining({ category: "lovsen" }),
    );
  });
});
