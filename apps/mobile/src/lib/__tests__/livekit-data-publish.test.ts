/**
 * livekit-data-publish.test.ts
 *
 * L-0233 P3-VERIFY proof — Path C (producer half).
 *
 * Asserts the contract that mobile publishes on the LiveKit data channel for
 * topic="botsson-context" so voice-agent's setSessionContext() fires.
 *
 * Reference contract:
 *   - producer: apps/mobile/src/lib/livekit-data-publish.ts (publishBotssonContext)
 *   - consumer: services/voice-agent/src/context.ts (parseContextPayload + setSessionContext)
 *
 * What we prove here:
 *   1. publishBotssonContext encodes payload as UTF-8 JSON
 *   2. Calls room.localParticipant.publishData EXACTLY ONCE on success with:
 *        - encoded payload (Uint8Array, contains BotssonContextInitPayload JSON)
 *        - opts.topic === "botsson-context"
 *        - opts.reliable === true
 *   3. Decoded payload satisfies the discriminant the consumer requires:
 *        - parsed JSON has `type === "context_init"`
 *        - has non-empty `user`, `workspace`; optional `workforce`
 *   4. On first-attempt failure: retries once (~500 ms back-off), succeeds on attempt 2
 *   5. On both attempts failing: returns {ok:false, attempts:2, reason}
 *   6. Result carries non-zero payload_bytes + numeric latency_ms (≥0)
 */

import { publishBotssonContext, type BotssonContextInitPayload } from "../livekit-data-publish";

type PublishDataFn = (
  payload: Uint8Array,
  opts: { topic: string; reliable: boolean },
) => Promise<void>;

function makeMockRoom(publishData: PublishDataFn): Parameters<typeof publishBotssonContext>[0] {
  return {
    localParticipant: {
      publishData,
    },
  } as unknown as Parameters<typeof publishBotssonContext>[0];
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

const baseUser = {
  profile_id: "p-1",
  role: "manager",
  status: "active",
  department_id: null,
  display_name: "Test User",
  language: "no",
};

const baseWorkspace = {
  workspace_id: "ws-1",
  name: "Test WS",
  niche: null,
  active_season_id: null,
  active_framework_id: null,
  planning_cycle_id: null,
};

const baseWorkforce = {
  employees: [],
  shifts_today: [],
  shifts_tomorrow: [],
  absences_active: [],
  sessions_today: [],
  snapshot_at: "2026-05-20T08:00:00Z",
};

const payload: BotssonContextInitPayload = {
  type: "context_init",
  user: baseUser,
  workspace: baseWorkspace,
  workforce: baseWorkforce,
};

describe("publishBotssonContext (L-0233 producer half)", () => {
  it("publishes exactly once on success with correct topic + reliable flag", async () => {
    const publishData = jest.fn().mockResolvedValue(undefined);
    const room = makeMockRoom(publishData);

    const result = await publishBotssonContext(room, payload);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");

    expect(publishData).toHaveBeenCalledTimes(1);
    const [bytes, opts] = publishData.mock.calls[0] as [
      Uint8Array,
      { topic: string; reliable: boolean },
    ];

    // Contract: topic + reliable
    expect(opts.topic).toBe("botsson-context");
    expect(opts.reliable).toBe(true);

    // Contract: payload is Uint8Array carrying JSON
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    // Contract: decoded JSON satisfies consumer discriminant
    const decoded = JSON.parse(decodeUtf8(bytes));
    expect(decoded.type).toBe("context_init"); // <-- parseContextPayload accepts this
    expect(decoded.user).toEqual(baseUser);
    expect(decoded.workspace).toEqual(baseWorkspace);
    expect(decoded.workforce).toEqual(baseWorkforce);

    // Contract: result carries observable signals for telemetry
    expect(result.payload_bytes).toBe(bytes.length);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.attempts).toBe(1);
  });

  it("retries once after a 500ms back-off when the first publishData throws", async () => {
    jest.useFakeTimers();
    try {
      let calls = 0;
      const publishData = jest.fn().mockImplementation(async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("transient send failure");
        }
      });
      const room = makeMockRoom(publishData);

      const pending = publishBotssonContext(room, payload);

      // First attempt fires synchronously; advance through the 500ms retry back-off.
      await Promise.resolve(); // let attempt 1 reject
      await Promise.resolve(); // let catch run
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();

      const result = await pending;

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("unreachable");
      expect(publishData).toHaveBeenCalledTimes(2);
      expect(result.attempts).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("returns failure when both attempts throw and never makes a third attempt", async () => {
    jest.useFakeTimers();
    try {
      const publishData = jest.fn().mockRejectedValue(new Error("dead channel"));
      const room = makeMockRoom(publishData);

      const pending = publishBotssonContext(room, payload);
      // Drive the back-off so attempt 2 runs and we don't time out.
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();

      const result = await pending;

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.attempts).toBe(2);
      expect(result.reason).toBe("dead channel");
      expect(publishData).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("publishes with workforce omitted when caller passes undefined", async () => {
    const publishData = jest.fn().mockResolvedValue(undefined);
    const room = makeMockRoom(publishData);

    const result = await publishBotssonContext(room, {
      type: "context_init",
      user: baseUser,
      workspace: baseWorkspace,
      // no workforce
    });

    expect(result.ok).toBe(true);
    const [bytes] = publishData.mock.calls[0] as [Uint8Array];
    const decoded = JSON.parse(decodeUtf8(bytes));
    expect(decoded.type).toBe("context_init");
    expect("workforce" in decoded).toBe(false);
  });
});
