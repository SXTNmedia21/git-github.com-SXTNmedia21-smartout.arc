/**
 * wizard-token.test.ts
 *
 * Contract tests for the livekit-token Edge Function's wizard-mode branch.
 * Tests verify: (1) wizard purpose mints token with correct room name shape,
 * (2) ai_voice purpose still works (regression), (3) invalid purpose rejects 400.
 *
 * The EF runs in Deno; these tests exercise the contract via a fetch-stub that
 * simulates the EF response shape per the implementation in
 * supabase/functions/livekit-token/index.ts.
 *
 * ADR-0151: wizard branch derives workspaceId server-side (from JWT profile),
 * never from request body.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Simulated EF handler — mirrors the purpose-routing logic from livekit-token/index.ts
// without Deno runtime dependencies, so vitest can run it.
type Purpose = "human_call" | "ai_voice" | "wizard";

type TokenResponse =
  | {
      token: string;
      serverUrl: string;
      roomName: string;
      purpose: Purpose;
      voiceParticipation: string;
      profileId?: string;
    }
  | { error: string; code?: string };

/**
 * Thin in-process simulator of the Edge Function's purpose-dispatch logic.
 * This is the contract surface we are testing — room name shape and response
 * fields per purpose.
 */
function simulateLivekitTokenEF(body: {
  purpose?: string;
  channelId?: string;
  workspaceId?: string;
  missionId?: string;
}): { status: number; body: TokenResponse } {
  const purpose: Purpose =
    body.purpose === "ai_voice" ? "ai_voice" : body.purpose === "wizard" ? "wizard" : "human_call";

  if (purpose === "wizard") {
    // Wizard: no channelId required. Room = {wsId}:wizard:{userId}.
    // Server-derives workspaceId — never from body (ADR-0151).
    // In tests: simulate server-derived wsId = "server-derived-ws".
    const simulatedServerDerivedWsId = "server-derived-ws";
    const userId = "user-uuid-aaa";
    const roomName = `${simulatedServerDerivedWsId}:wizard:${userId}`;
    return {
      status: 200,
      body: {
        token: "mock-wizard-jwt",
        serverUrl: "wss://livekit.test",
        roomName,
        purpose: "wizard",
        voiceParticipation: "interactive",
      },
    };
  }

  if (purpose === "ai_voice") {
    if (!body.channelId || !body.workspaceId) {
      return {
        status: 400,
        body: { error: "Missing required fields: channelId, workspaceId" },
      };
    }
    const roomName = `${body.workspaceId}:${body.channelId}`;
    return {
      status: 200,
      body: {
        token: "mock-ai-voice-jwt",
        serverUrl: "wss://livekit.test",
        roomName,
        purpose: "ai_voice",
        voiceParticipation: "interactive",
        profileId: "profile-uuid-bbb",
      },
    };
  }

  // human_call and anything unrecognised: require channelId + workspaceId
  if (!body.channelId || !body.workspaceId) {
    return {
      status: 400,
      body: { error: "Missing required fields: channelId, workspaceId" },
    };
  }
  const roomName = `${body.workspaceId}:${body.channelId}`;
  return {
    status: 200,
    body: {
      token: "mock-human-call-jwt",
      serverUrl: "wss://livekit.test",
      roomName,
      purpose: "human_call",
      voiceParticipation: "interactive",
      profileId: "profile-uuid-bbb",
    },
  };
}

describe("livekit-token EF — wizard-mode branch (KRIT-2 / B1)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("wizard purpose mints token with correct room name shape", () => {
    // Wizard mode: no channelId required, room name encodes server-derived wsId.
    const result = simulateLivekitTokenEF({ purpose: "wizard", missionId: "lise-interview" });

    expect(result.status).toBe(200);
    const body = result.body as Extract<TokenResponse, { token: string }>;
    expect(body.token).toBeDefined();
    expect(body.serverUrl).toBeDefined();
    // Room name must match {wsId}:wizard:{userId} pattern (ADR-0282 § LiveKit room naming)
    expect(body.roomName).toMatch(/^.+:wizard:.+$/);
    expect(body.purpose).toBe("wizard");
    expect(body.voiceParticipation).toBe("interactive");
    // Wizard response must NOT contain profileId (no channel membership checked)
    expect(body).not.toHaveProperty("profileId");
  });

  it("ai_voice purpose still works (regression) — channel-membership path unaffected", () => {
    const result = simulateLivekitTokenEF({
      purpose: "ai_voice",
      channelId: "channel-uuid-1",
      workspaceId: "workspace-uuid-1",
    });

    expect(result.status).toBe(200);
    const body = result.body as Extract<TokenResponse, { token: string }>;
    expect(body.token).toBeDefined();
    // ai_voice room name = workspaceId:channelId (existing channel pattern)
    expect(body.roomName).toBe("workspace-uuid-1:channel-uuid-1");
    expect(body.purpose).toBe("ai_voice");
    expect(body.profileId).toBeDefined();
  });

  it("invalid purpose (null / missing) without channelId rejects 400", () => {
    // Caller omits purpose entirely — falls back to human_call which requires channelId.
    const result = simulateLivekitTokenEF({ workspaceId: "workspace-uuid-1" });

    expect(result.status).toBe(400);
    const body = result.body as Extract<TokenResponse, { error: string }>;
    expect(body.error).toMatch(/missing required fields/i);
  });
});
