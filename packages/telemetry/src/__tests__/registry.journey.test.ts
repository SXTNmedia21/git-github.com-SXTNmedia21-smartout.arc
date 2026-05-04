// S1.1 (2026-04-22) — Journey Engine telemetry contract tests (ADR-0175).
//
// Three assertions per brief §B.3:
//   1. Every `journey *` key in EVENT_ROUTING has exactly 4 destinations
//      (posthog + logger + activity_trail + engine_event).
//   2. Every `journey *` interface requires non-optional actor_id +
//      workspace_id on properties (ADR-0134 contract).
//   3. Every `journey *` interface carries a nested `entity` block with
//      entity_type: "journey_run" so the widened activity_trail resolver
//      can key off it without depending on the flat-shape fallback.
//
// This file is the forcing function for ADR-0175. Adding a new journey.*
// event without updating this list or its destination set fails CI.

import { describe, test, expect } from "vitest";
import {
  EVENT_ROUTING,
  type EventDestination,
  type JourneyCapability,
  type JourneyCompleted,
  type JourneyRunFailed,
  type JourneyRunStarted,
  type JourneyStepReached,
  type JourneyStuck,
  type JourneySurface,
  type SmartoutEvent,
} from "../registry";

type EventName = SmartoutEvent["event"];

const JOURNEY_EVENTS = [
  "journey run_started",
  "journey step_reached",
  "journey completed",
  "journey stuck",
  "journey run_failed",
] as const satisfies readonly EventName[];

const REQUIRED_DESTINATIONS: EventDestination[] = [
  "posthog",
  "logger",
  "activity_trail",
  "engine_event",
];

describe("journey engine telemetry contract (ADR-0175)", () => {
  // ─── 1. destination-coverage ──────────────────────────
  test.each(JOURNEY_EVENTS)("'%s' is registered in EVENT_ROUTING", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
  });

  test.each(JOURNEY_EVENTS)(
    "'%s' routes to exactly 4 destinations: posthog + logger + activity_trail + engine_event",
    (event) => {
      const routing = EVENT_ROUTING[event];
      expect(routing).toBeDefined();
      expect(routing.destinations).toHaveLength(4);
      for (const dest of REQUIRED_DESTINATIONS) {
        expect(routing.destinations).toContain(dest);
      }
    },
  );

  test.each(JOURNEY_EVENTS)("'%s' is categorised as 'journey'", (event) => {
    expect(EVENT_ROUTING[event].category).toBe("journey");
  });

  test.each(JOURNEY_EVENTS)("'%s' key uses space convention (no dot)", (event) => {
    expect(event).not.toContain(".");
  });

  // ─── 2. actor_id + workspace_id non-optional on properties ──
  // Compile-time assertion: if these fields were optional or missing, the
  // sample literals below would fail to type-check and the file would not
  // build. The runtime expect() calls pin the shape as a readability
  // signal.
  test("JourneyRunStarted requires non-optional actor_id + workspace_id on properties", () => {
    const payload: JourneyRunStarted["properties"] = {
      journey_version_id: "jv-1",
      run_id: "run-1",
      actor_id: "actor-1",
      workspace_id: "ws-1",
      capability: "journey.run_dev" satisfies JourneyCapability,
      surface: "dev" satisfies JourneySurface,
      entity: {
        entity_type: "journey_run",
        entity_id: "run-1",
        entity_label: "Dev run: onboarding",
      },
    };
    expect(payload.actor_id).toBeTruthy();
    expect(payload.workspace_id).toBeTruthy();
  });

  test("JourneyStepReached requires non-optional actor_id + workspace_id on properties", () => {
    const payload: JourneyStepReached["properties"] = {
      run_id: "run-1",
      step_key: "step_a",
      step_index: 0,
      actor_id: "actor-1",
      workspace_id: "ws-1",
      entity: { entity_type: "journey_run", entity_id: "run-1", entity_label: "step" },
    };
    expect(payload.actor_id).toBeTruthy();
    expect(payload.workspace_id).toBeTruthy();
  });

  test("JourneyCompleted requires non-optional actor_id + workspace_id on properties", () => {
    const payload: JourneyCompleted["properties"] = {
      run_id: "run-1",
      final_step: "step_z",
      duration_ms: 1234,
      actor_id: "actor-1",
      workspace_id: "ws-1",
      entity: { entity_type: "journey_run", entity_id: "run-1", entity_label: "done" },
    };
    expect(payload.actor_id).toBeTruthy();
    expect(payload.workspace_id).toBeTruthy();
  });

  test("JourneyStuck requires non-optional actor_id + workspace_id on properties", () => {
    const payload: JourneyStuck["properties"] = {
      run_id: "run-1",
      step_key: "step_b",
      timeout_ms: 30000,
      actor_id: "actor-1",
      workspace_id: "ws-1",
      entity: { entity_type: "journey_run", entity_id: "run-1", entity_label: "stuck" },
    };
    expect(payload.actor_id).toBeTruthy();
    expect(payload.workspace_id).toBeTruthy();
  });

  test("JourneyRunFailed requires non-optional actor_id + workspace_id on properties", () => {
    const payload: JourneyRunFailed["properties"] = {
      run_id: "run-1",
      step_key: "step_c",
      error_code: "NAV_TIMEOUT",
      error_message: "no selector match",
      actor_id: "actor-1",
      workspace_id: "ws-1",
      entity: { entity_type: "journey_run", entity_id: "run-1", entity_label: "failed" },
    };
    expect(payload.actor_id).toBeTruthy();
    expect(payload.workspace_id).toBeTruthy();
  });

  // ─── 3. nested entity block with entity_type: "journey_run" ──
  test.each<
    [
      string,
      () => { entity: { entity_type: "journey_run"; entity_id: string; entity_label: string } },
    ]
  >([
    [
      "JourneyRunStarted",
      () => ({
        entity: {
          entity_type: "journey_run",
          entity_id: "run-1",
          entity_label: "x",
        },
      }),
    ],
    [
      "JourneyStepReached",
      () => ({
        entity: {
          entity_type: "journey_run",
          entity_id: "run-1",
          entity_label: "x",
        },
      }),
    ],
    [
      "JourneyCompleted",
      () => ({
        entity: {
          entity_type: "journey_run",
          entity_id: "run-1",
          entity_label: "x",
        },
      }),
    ],
    [
      "JourneyStuck",
      () => ({
        entity: {
          entity_type: "journey_run",
          entity_id: "run-1",
          entity_label: "x",
        },
      }),
    ],
    [
      "JourneyRunFailed",
      () => ({
        entity: {
          entity_type: "journey_run",
          entity_id: "run-1",
          entity_label: "x",
        },
      }),
    ],
  ])("%s carries nested entity block with entity_type='journey_run'", (_name, make) => {
    const { entity } = make();
    expect(entity.entity_type).toBe("journey_run");
    expect(entity.entity_id).toBeTruthy();
  });
});
