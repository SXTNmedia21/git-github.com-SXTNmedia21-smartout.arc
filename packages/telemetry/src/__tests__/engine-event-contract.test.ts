/**
 * Producer-consumer contract test: telemetry emit → engine-dispatch
 *
 * Why this exists (Council R2, BREAK 1):
 *   engine-event.ts builds the dispatch payload by spreading
 *   `event.properties` at the top level:
 *       payload: { actor_id, correlation_id, ...event.properties }
 *   engine-dispatch (supabase/functions/engine-dispatch/index.ts) then
 *   reads `payload.entity_id` and `payload.entity_type` directly from
 *   the top of the payload to populate engine_state.entity_id.
 *
 *   When Shift* events used the nested shape `{ entity: EntityRef }`,
 *   `entity_id` ended up one level deep — engine_state.entity_id was
 *   NULL — and shift_lifecycle_v1 step 3 derive_shift_hours(NULL)
 *   failed silently. This test would have caught that regression by
 *   running the REAL buildPayload on the REAL event type and asserting
 *   engine_state.entity_id is populated.
 *
 * This test intentionally imports from `../providers/engine-event`
 * so any future flattening regression breaks the test immediately,
 * not at runtime in production.
 */

import { describe, expect, test } from "vitest";

import { buildPayload } from "../providers/engine-event";
import type {
  ShiftPunchedOut,
  ShiftPunchedIn,
  ShiftPublished,
  ShiftCompleted,
  SmartoutEvent,
} from "../registry";

/**
 * Mirror of the engine-dispatch entity-extraction logic. If this file
 * starts reading entity_id from somewhere else in the payload, update
 * `supabase/functions/engine-dispatch/index.ts:326-327` to match.
 */
function extractEntityAsDispatcherWould(payload: unknown): {
  entity_type: string | null;
  entity_id: string | null;
} {
  const payloadObj = (payload ?? {}) as Record<string, unknown>;
  return {
    entity_type: (payloadObj.entity_type as string | undefined) ?? null,
    entity_id: (payloadObj.entity_id as string | undefined) ?? null,
  };
}

describe("engine-event contract: producer (buildPayload) ↔ consumer (engine-dispatch)", () => {
  test("ShiftPunchedOut: buildPayload produces top-level entity_id (BREAK 1 regression guard)", () => {
    const event: ShiftPunchedOut = {
      event: "shift punched_out",
      workspace_id: "00000000-0000-0000-0000-000000000001",
      actor_id: "00000000-0000-0000-0000-000000000002",
      correlation_id: "corr-1",
      timestamp: "2026-04-15T10:00:00.000Z",
      properties: {
        entity_type: "shift",
        entity_id: "11111111-1111-1111-1111-111111111111",
        data: {
          shift_id: "11111111-1111-1111-1111-111111111111",
          time_entry_id: "22222222-2222-2222-2222-222222222222",
          punch_time: "2026-04-15T10:00:00.000Z",
          work_minutes: 480,
          break_minutes: 30,
          gps_verified: true,
        },
      },
    };

    const dispatched = buildPayload(event);

    // Primary assertion: engine_state.entity_id will NOT be NULL.
    // This is the exact check that would have caught BREAK 1 if present.
    expect(dispatched.payload).toBeDefined();
    const extracted = extractEntityAsDispatcherWould(dispatched.payload);
    expect(extracted.entity_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(extracted.entity_type).toBe("shift");

    // Secondary: event_type dot notation, workspace_id passthrough, actor_id.
    expect(dispatched.event_type).toBe("shift.punched_out");
    expect(dispatched.workspace_id).toBe("00000000-0000-0000-0000-000000000001");
    expect((dispatched.payload as Record<string, unknown>).actor_id).toBe(
      "00000000-0000-0000-0000-000000000002",
    );

    // Tertiary: nested data is still accessible, not clobbered.
    const payload = dispatched.payload as Record<string, unknown>;
    expect(payload.data).toBeDefined();
    expect((payload.data as Record<string, unknown>).time_entry_id).toBe(
      "22222222-2222-2222-2222-222222222222",
    );
  });

  test("ShiftPunchedIn: flat entity contract round-trips", () => {
    const event: ShiftPunchedIn = {
      event: "shift punched_in",
      workspace_id: "ws-1",
      actor_id: "actor-1",
      properties: {
        entity_type: "shift",
        entity_id: "shift-abc",
        data: {
          shift_id: "shift-abc",
          time_entry_id: "te-abc",
          punch_time: "2026-04-15T08:00:00.000Z",
          is_adhoc: false,
          gps_verified: false,
          gps_distance_meters: null,
        },
      },
    };

    const extracted = extractEntityAsDispatcherWould(buildPayload(event).payload);
    expect(extracted.entity_id).toBe("shift-abc");
    expect(extracted.entity_type).toBe("shift");
  });

  test("ShiftPublished: entity_id is first shift id, not undefined", () => {
    const event: ShiftPublished = {
      event: "shift published",
      workspace_id: "ws-1",
      actor_id: "actor-1",
      properties: {
        entity_type: "shift",
        entity_id: "shift-first",
        data: {
          dates: ["2026-04-15"],
          department_ids: ["dept-1"],
          shift_ids: ["shift-first", "shift-second"],
          shift_count: 2,
        },
      },
    };

    const extracted = extractEntityAsDispatcherWould(buildPayload(event).payload);
    expect(extracted.entity_id).toBe("shift-first");
  });

  test("ShiftCompleted: contract holds", () => {
    const event: ShiftCompleted = {
      event: "shift completed",
      workspace_id: "ws-1",
      actor_id: "actor-1",
      properties: {
        entity_type: "shift",
        entity_id: "shift-done",
        data: {
          shift_ids: ["shift-done"],
          department_id: "dept-1",
        },
      },
    };

    const extracted = extractEntityAsDispatcherWould(buildPayload(event).payload);
    expect(extracted.entity_id).toBe("shift-done");
    expect(extracted.entity_type).toBe("shift");
  });

  test("REGRESSION GUARD: nested { entity: EntityRef } shape would FAIL extraction", () => {
    // This is the bug shape. We simulate what would happen if someone
    // reverted to the old nested contract. The dispatcher's extraction
    // would yield null entity_id — proving the test catches the break.
    const brokenShapeEvent = {
      event: "shift punched_out",
      workspace_id: "ws-1",
      actor_id: "actor-1",
      properties: {
        // WRONG: nested. buildPayload spreads this under `payload`, so
        // `payload.entity_id` is undefined — dispatcher records NULL.
        entity: { entity_type: "shift", entity_id: "shift-broken" },
        data: {
          shift_id: "shift-broken",
          time_entry_id: "te-x",
          punch_time: "2026-04-15T10:00:00.000Z",
          work_minutes: 1,
          break_minutes: 0,
          gps_verified: false,
        },
      },
      // Cast for the test only — TypeScript will correctly reject this
      // shape against the real ShiftPunchedOut interface.
    } as unknown as SmartoutEvent;

    const extracted = extractEntityAsDispatcherWould(buildPayload(brokenShapeEvent).payload);
    expect(extracted.entity_id).toBeNull();
    expect(extracted.entity_type).toBeNull();
  });

  test("event_type dot notation: spaces become dots", () => {
    const event: ShiftPunchedOut = {
      event: "shift punched_out",
      workspace_id: "ws-1",
      actor_id: "actor-1",
      properties: {
        entity_type: "shift",
        entity_id: "s-1",
        data: {
          shift_id: "s-1",
          time_entry_id: "te-1",
          punch_time: "2026-04-15T10:00:00.000Z",
          work_minutes: 0,
          break_minutes: 0,
          gps_verified: false,
        },
      },
    };
    expect(buildPayload(event).event_type).toBe("shift.punched_out");
  });
});
