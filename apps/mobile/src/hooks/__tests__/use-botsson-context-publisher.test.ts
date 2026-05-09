/**
 * Tests for publishContextOnce — the pure orchestrator inside
 * use-botsson-context-publisher.ts.
 *
 * Jest-node: no React renderer, no LiveKit Room, no Expo. We test only the
 * pure helper that is injectable in the hook variant.
 *
 * Coverage:
 *   - Happy path: fetch resolves → publisher called with context_init message.
 *   - Null fetch: publisher NOT called when fetch returns null.
 *   - Fetch error: swallowed, publisher NOT called, function resolves cleanly.
 */

// Mock livekit-client so the module import chain doesn't fail in node.
jest.mock(
  "livekit-client",
  () => ({
    Room: class FakeRoom {},
    RoomEvent: {},
  }),
  { virtual: true },
);

// Mock web-api to avoid EXPO_PUBLIC_WEB_API_URL env requirement in tests.
jest.mock(
  "@/lib/web-api",
  () => ({
    getWebApiUrl: jest.fn(() => "http://localhost:3060"),
  }),
  { virtual: true },
);

// Mock react to avoid React renderer requirement in node.
jest.mock(
  "react",
  () => ({
    useEffect: jest.fn(),
    useRef: jest.fn(() => ({ current: null })),
  }),
  { virtual: true },
);

import {
  publishContextOnce,
  type ContextFetcher,
  type ContextPublisher,
} from "../use-botsson-context-publisher";

const validPayload = {
  user: {
    profile_id: "p1",
    role: "manager" as const,
    status: "active" as const,
    department_id: "d1",
    display_name: "Test",
    language: "no" as const,
  },
  workspace: {
    workspace_id: "w1",
    name: "Test WS",
    niche: null,
    active_season_id: null,
    active_framework_id: null,
    planning_cycle_id: null,
  },
};

describe("publishContextOnce — context_init publish on Room connect", () => {
  it("publishes context_init when fetch resolves with payload", async () => {
    const fetcher: ContextFetcher = jest.fn(async () => validPayload);
    const publisher: ContextPublisher = jest.fn();

    await publishContextOnce({
      workspaceId: "w1",
      accessToken: "jwt",
      fetcher,
      publisher,
    });

    expect(publisher).toHaveBeenCalledTimes(1);
    const msg = (publisher as jest.Mock).mock.calls[0][0];
    expect(msg.type).toBe("context_init");
    expect(msg.user.profile_id).toBe("p1");
    expect(msg.workspace.workspace_id).toBe("w1");
  });

  it("does not publish when fetch returns null", async () => {
    const fetcher: ContextFetcher = jest.fn(async () => null);
    const publisher: ContextPublisher = jest.fn();

    await publishContextOnce({
      workspaceId: "w1",
      accessToken: "jwt",
      fetcher,
      publisher,
    });

    expect(publisher).not.toHaveBeenCalled();
  });

  it("swallows fetcher errors and skips publish (degraded mode — log+continue)", async () => {
    const fetcher: ContextFetcher = jest.fn(async () => {
      throw new Error("network fail");
    });
    const publisher: ContextPublisher = jest.fn();

    await expect(
      publishContextOnce({
        workspaceId: "w1",
        accessToken: "jwt",
        fetcher,
        publisher,
      }),
    ).resolves.not.toThrow();

    expect(publisher).not.toHaveBeenCalled();
  });
});
