// ============================================
// pg-notify-bus.test.ts
// Unit tests for the pg_notify guardian bus (ADR-0186).
//
// The LISTEN loop itself requires a real pg connection — that is covered
// by the integration smoke in Phase 8. These tests lock down the pure
// broadcast logic: workspace scoping, session subscription filtering,
// and WebSocket readyState guarding.
// ============================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addClient,
  removeClient,
  subscribeSession,
  unsubscribeSession,
  broadcastGuardianEvent,
  _resetClientsForTest,
  type GuardianSocket,
} from "../pg-notify-bus.js";

type TestSocket = GuardianSocket & { send: ReturnType<typeof vi.fn> };

function makeSocket(readyState = 1): TestSocket {
  const sock: TestSocket = {
    send: vi.fn() as unknown as TestSocket["send"],
    readyState,
  };
  return sock;
}

function makeEvent(overrides: Partial<Parameters<typeof broadcastGuardianEvent>[0]> = {}) {
  return {
    id: "evt_1",
    workspace_id: "ws_A",
    session_id: "sess_1",
    event_type: "test.event",
    actor: "system" as const,
    summary: "test",
    data: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("pg-notify-bus broadcast", () => {
  beforeEach(() => _resetClientsForTest());

  it("delivers events to clients in the same workspace", () => {
    const ws = makeSocket();
    addClient(ws, "ws_A");

    broadcastGuardianEvent(makeEvent({ workspace_id: "ws_A" }));

    expect(ws.send).toHaveBeenCalledTimes(1);
    const msg = JSON.parse(ws.send.mock.calls[0]?.[0] as string) as { type: string };
    expect(msg.type).toBe("event");
  });

  it("does NOT deliver events to clients in a different workspace", () => {
    const ws = makeSocket();
    addClient(ws, "ws_A");

    broadcastGuardianEvent(makeEvent({ workspace_id: "ws_OTHER" }));

    expect(ws.send).not.toHaveBeenCalled();
  });

  it("without subscriptions a client receives all events in its workspace", () => {
    const ws = makeSocket();
    addClient(ws, "ws_A");

    broadcastGuardianEvent(makeEvent({ session_id: "sess_1" }));
    broadcastGuardianEvent(makeEvent({ session_id: "sess_2" }));

    expect(ws.send).toHaveBeenCalledTimes(2);
  });

  it("with subscriptions a client only receives subscribed sessions", () => {
    const ws = makeSocket();
    const client = addClient(ws, "ws_A");
    subscribeSession(client, "sess_1");

    broadcastGuardianEvent(makeEvent({ session_id: "sess_1" }));
    broadcastGuardianEvent(makeEvent({ session_id: "sess_2" }));

    expect(ws.send).toHaveBeenCalledTimes(1);
  });

  it("unsubscribeSession restores no-filter semantics when no sessions remain", () => {
    const ws = makeSocket();
    const client = addClient(ws, "ws_A");
    subscribeSession(client, "sess_1");
    unsubscribeSession(client, "sess_1");

    broadcastGuardianEvent(makeEvent({ session_id: "sess_anything" }));

    // Fallback: empty subscription set = receive all workspace events
    expect(ws.send).toHaveBeenCalledTimes(1);
  });

  it("skips sockets that are not OPEN (readyState !== 1)", () => {
    const ws = makeSocket(3); // CLOSED
    addClient(ws, "ws_A");

    broadcastGuardianEvent(makeEvent({ workspace_id: "ws_A" }));

    expect(ws.send).not.toHaveBeenCalled();
  });

  it("removeClient stops delivery to that client", () => {
    const ws = makeSocket();
    const client = addClient(ws, "ws_A");
    removeClient(client);

    broadcastGuardianEvent(makeEvent({ workspace_id: "ws_A" }));

    expect(ws.send).not.toHaveBeenCalled();
  });
});
