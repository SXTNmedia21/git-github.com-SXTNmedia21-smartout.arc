/**
 * context.test.ts
 *
 * L-0233 P3-VERIFY proof — Path B (consumer half).
 *
 * Asserts that the voice-agent worker's context module accepts what mobile
 * publishes on topic="botsson-context" and exposes it via getSessionContextSnapshot().
 *
 * Wire end-to-end inside this test:
 *   1. Build a BotssonContextInitPayload (the exact shape mobile sends,
 *      mirrored at apps/mobile/src/lib/livekit-data-publish.ts:37-42).
 *   2. Encode it via TextEncoder + JSON (mirrors publishBotssonContext at
 *      apps/mobile/src/lib/livekit-data-publish.ts:75).
 *   3. Decode via parseContextPayload (this module).
 *   4. Apply via setSessionContext.
 *   5. Assert getSessionContextSnapshot() returns non-null user, workspace,
 *      and workforce — proving voice-agent's "Mr. Botsson knows the workforce
 *      at session start" contract (ADR-0297).
 *
 * This is the consumer-half guarantee for L-0233. Paired with
 * apps/mobile/src/lib/__tests__/livekit-data-publish.test.ts the full
 * contract (producer encode → wire → consumer parse → state) is covered.
 */

import { describe, it, expect } from "vitest";
import {
  parseContextPayload,
  setSessionContext,
  getSessionContextSnapshot,
} from "../src/context.js";

function encodePayload(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

const validUser = {
  profile_id: "p-1",
  role: "manager" as const,
  status: "active" as const,
  department_id: "d-1",
  display_name: "Test Manager",
  language: "no" as const,
};

const validWorkspace = {
  workspace_id: "ws-1",
  name: "Test Workspace",
  niche: "restaurant",
  active_season_id: "s-1",
  active_framework_id: "f-riksavtalen-2026",
  planning_cycle_id: "pc-1",
};

const validWorkforce = {
  employees: [
    {
      profile_id: "p-2",
      display_name: "Bob",
      role: "employee",
      status: "active",
      department_id: "d-1",
      department_name: "Bar",
      phone: "+47 90000000",
    },
  ],
  shifts_today: [
    {
      shift_id: "sh-1",
      profile_id: "p-2",
      employee_name: "Bob",
      shift_date: "2026-05-20",
      start_time: "10:00:00",
      end_time: "18:00:00",
      department_id: "d-1",
      department_name: "Bar",
      position_label: "bartender",
    },
  ],
  shifts_tomorrow: [],
  absences_active: [],
  sessions_today: [],
  snapshot_at: "2026-05-20T08:00:00Z",
};

describe("voice-agent context (L-0233 consumer half)", () => {
  it("round-trips a mobile-shaped context_init through parse → set → snapshot", () => {
    // Mobile producer constructs this exact shape (livekit-data-publish.ts:37-42,
    // wrapped by publishSnapshotToRoom in use-botsson-voice-session.ts:686-691).
    const mobilePayload = {
      type: "context_init",
      user: validUser,
      workspace: validWorkspace,
      workforce: validWorkforce,
    };

    const wire = encodePayload(mobilePayload);
    const parsed = parseContextPayload(wire, "botsson-context");

    expect(parsed).not.toBeNull();
    if (!parsed) throw new Error("unreachable");
    expect(parsed.type).toBe("context_init");

    setSessionContext(parsed);

    const snapshot = getSessionContextSnapshot();
    expect(snapshot.user).not.toBeNull();
    expect(snapshot.workspace).not.toBeNull();
    expect(snapshot.workforce).not.toBeNull();
    expect(snapshot.user?.profile_id).toBe("p-1");
    expect(snapshot.workspace?.workspace_id).toBe("ws-1");
    expect(snapshot.workforce?.employees.length).toBe(1);
    expect(snapshot.workforce?.shifts_today.length).toBe(1);
  });

  it("rejects payloads on the wrong topic so mobile cannot accidentally cross-feed", () => {
    const wire = encodePayload({
      type: "context_init",
      user: validUser,
      workspace: validWorkspace,
    });

    // Mobile must use exactly "botsson-context" — any other topic returns null
    // and setSessionContext is never called by the dispatcher in agent.ts.
    expect(parseContextPayload(wire, "botsson-tools-register")).toBeNull();
    expect(parseContextPayload(wire, "")).toBeNull();
    expect(parseContextPayload(wire, undefined)).toBeNull();
  });

  it("silently drops malformed JSON without throwing into the agent event loop", () => {
    const garbage = new TextEncoder().encode("not json at all {{");
    expect(() => parseContextPayload(garbage, "botsson-context")).not.toThrow();
    expect(parseContextPayload(garbage, "botsson-context")).toBeNull();
  });

  it("silently drops payloads with an unknown type discriminant", () => {
    const wire = encodePayload({ type: "context_unknown", foo: "bar" });
    expect(parseContextPayload(wire, "botsson-context")).toBeNull();
  });

  it("accepts a context_init with workforce omitted (mobile optional field)", () => {
    const wire = encodePayload({
      type: "context_init",
      user: validUser,
      workspace: validWorkspace,
      // no workforce — matches BotssonContextInitPayload.workforce?
    });
    const parsed = parseContextPayload(wire, "botsson-context");
    expect(parsed).not.toBeNull();
    if (!parsed) throw new Error("unreachable");

    setSessionContext(parsed);
    const snapshot = getSessionContextSnapshot();
    expect(snapshot.user).not.toBeNull();
    expect(snapshot.workspace).not.toBeNull();
    expect(snapshot.workforce).toBeNull(); // setSessionContext writes msg.workforce ?? null
  });
});
