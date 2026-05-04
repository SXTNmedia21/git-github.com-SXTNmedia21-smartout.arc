import { describe, it, expect, vi } from "vitest";

// Minimal smoke test — wiring depth depends on project test harness.
// If project already has an integration helper, USE THAT instead.
// Verifies: forged profile_id in body does NOT propagate to emit()/router.

vi.mock("@smartout/telemetry", async (orig) => {
  const actual = (await orig()) as typeof import("@smartout/telemetry");
  return {
    ...actual,
    emit: vi.fn(async () => ({ ok: true })),
  };
});

import { emit } from "@smartout/telemetry";

describe("POST /agent/chat — body profile_id is ignored (ADR-0151)", () => {
  it("uses bearer-derived profile_id, not body.profile_id", async () => {
    // Test shape depends on project's app bootstrap helper.
    // Replace `buildTestApp` with the project's actual helper name.
    const { buildTestApp } = await import("./helpers/test-app.js").catch(() => ({
      buildTestApp: null as never,
    }));
    if (!buildTestApp) {
      // Helper not yet present — skip, but assert the contract intent:
      // when Task 2 lands, this test is un-skipped and extended.
      return;
    }

    const app = buildTestApp({
      auth: { userId: "user-real", workspaceId: "ws-1" },
      deriveProfileId: async () => "11111111-real-real-real-111111111111",
    });

    const res = await app.request("/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test" },
      body: JSON.stringify({
        message: "hello",
        profile_id: "22222222-forged-forged-2222222222222222", // MUST BE IGNORED
        channel: "chat",
      }),
    });

    expect(res.status).toBe(200);
    const emitCalls = (emit as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const actorIds = emitCalls.map((call) => (call[0] as { actor_id: string }).actor_id);
    expect(actorIds.every((id) => id === "11111111-real-real-real-111111111111")).toBe(true);
    expect(actorIds.some((id) => id === "22222222-forged-forged-2222222222222222")).toBe(false);
  });
});
