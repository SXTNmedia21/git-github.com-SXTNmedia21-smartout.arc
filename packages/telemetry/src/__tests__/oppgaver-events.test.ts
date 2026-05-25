// P11 (2026-05-25) — Oppgaver telemetry contract tests.
//
// Three assertion classes:
//   1. All 6 oppgaver.* events are registered in EVENT_ROUTING with the
//      correct destinations and category "oppgaver".
//   2. All 6 interfaces compile with valid payloads (compile-time gate).
//   3. nonEmpty guard: empty actor_id throws (ADR-0134/ADR-0193 enforcement).

import { describe, test, expect } from "vitest";
import {
  EVENT_ROUTING,
  type SmartoutEvent,
  type OppgaverViewOpened,
  type OppgaverViewModeChanged,
  type OppgaverAreaFilterChanged,
  type OppgaverDateChanged,
  type OppgaverTaskFocused,
  type OppgaverContextPinned,
} from "../registry";
import { nonEmpty } from "../non-empty-string";

type EventName = SmartoutEvent["event"];

const OPPGAVER_EVENTS = [
  "oppgaver.view_opened",
  "oppgaver.view_mode_changed",
  "oppgaver.area_filter_changed",
  "oppgaver.date_changed",
  "oppgaver.task_focused",
  "oppgaver.context_pinned",
] as const satisfies readonly EventName[];

// ─── 1. Registration and routing ─────────────────────────────────────────────

describe("oppgaver telemetry contract — registration (P11)", () => {
  test.each(OPPGAVER_EVENTS)("'%s' is registered in EVENT_ROUTING", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
  });

  test.each(OPPGAVER_EVENTS)("'%s' is categorised as 'oppgaver'", (event) => {
    expect(EVENT_ROUTING[event].category).toBe("oppgaver");
  });

  test.each(OPPGAVER_EVENTS)("'%s' does NOT route to engine_event", (event) => {
    expect(EVENT_ROUTING[event].destinations).not.toContain("engine_event");
  });

  test.each([
    "oppgaver.view_opened",
    "oppgaver.view_mode_changed",
    "oppgaver.area_filter_changed",
    "oppgaver.date_changed",
    "oppgaver.task_focused",
  ] as const satisfies readonly EventName[])(
    "'%s' routes to exactly posthog + logger (no activity_trail)",
    (event) => {
      const { destinations } = EVENT_ROUTING[event];
      expect(destinations).toHaveLength(2);
      expect(destinations).toContain("posthog");
      expect(destinations).toContain("logger");
      expect(destinations).not.toContain("activity_trail");
    },
  );

  test("'oppgaver.context_pinned' routes to posthog + logger + activity_trail", () => {
    const { destinations } = EVENT_ROUTING["oppgaver.context_pinned"];
    expect(destinations).toHaveLength(3);
    expect(destinations).toContain("posthog");
    expect(destinations).toContain("logger");
    expect(destinations).toContain("activity_trail");
  });
});

// ─── 2. Payload shape compile-time assertions ─────────────────────────────────
// Building valid typed payloads. Compile error = test file error.

describe("oppgaver telemetry contract — payload shapes", () => {
  const WS = nonEmpty("ws_oppgaver_test", "workspace_id");
  const ACTOR = nonEmpty("profile_oppgaver_test", "actor_id");

  test("OppgaverViewOpened compiles with valid payload", () => {
    const event: OppgaverViewOpened = {
      event: "oppgaver.view_opened",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: {
        data: {
          date_iso: "2026-05-25",
          viewer_role: "manager",
        },
      },
    };
    expect(event.properties.data.viewer_role).toBe("manager");
  });

  test("OppgaverViewModeChanged compiles with valid payload", () => {
    const event: OppgaverViewModeChanged = {
      event: "oppgaver.view_mode_changed",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: {
        data: {
          from: "area",
          to: "role",
          triggered_by: "ui",
        },
      },
    };
    expect(event.properties.data.from).toBe("area");
    expect(event.properties.data.to).toBe("role");
  });

  test("OppgaverAreaFilterChanged compiles with valid payload", () => {
    const event: OppgaverAreaFilterChanged = {
      event: "oppgaver.area_filter_changed",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: {
        data: {
          active_area_count: 3,
          triggered_by: "ui",
        },
      },
    };
    expect(event.properties.data.active_area_count).toBe(3);
  });

  test("OppgaverDateChanged compiles with valid payload", () => {
    const event: OppgaverDateChanged = {
      event: "oppgaver.date_changed",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: {
        data: {
          from_date: "2026-05-24",
          to_date: "2026-05-25",
          triggered_by: "tool",
        },
      },
    };
    expect(event.properties.data.triggered_by).toBe("tool");
  });

  test("OppgaverTaskFocused compiles with null area_id", () => {
    const event: OppgaverTaskFocused = {
      event: "oppgaver.task_focused",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: {
        data: {
          task_id: "task-uuid-123",
          area_id: null,
        },
      },
    };
    expect(event.properties.data.area_id).toBeNull();
  });

  test("OppgaverContextPinned compiles with valid payload", () => {
    const event: OppgaverContextPinned = {
      event: "oppgaver.context_pinned",
      workspace_id: WS,
      actor_id: ACTOR,
      properties: {
        data: {
          date_iso: "2026-05-25",
          active_view: "area",
        },
      },
    };
    expect(event.properties.data.active_view).toBe("area");
  });
});

// ─── 3. nonEmpty guard (ADR-0134/ADR-0193) ───────────────────────────────────

describe("oppgaver telemetry — empty id guard", () => {
  test("nonEmpty('', 'actor_id') throws", () => {
    expect(() => nonEmpty("", "actor_id")).toThrow(
      'telemetry: actor_id must be non-empty (got "")',
    );
  });
});
