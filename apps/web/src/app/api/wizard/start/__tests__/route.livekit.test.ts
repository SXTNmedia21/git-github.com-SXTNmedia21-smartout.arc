import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn(),
  nonEmpty: vi.fn((val: string) => val),
}));

import { createClient } from "@smartout/supabase/server";

describe("/api/wizard/start POST (LiveKit cutover)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure env vars are set
    process.env.STAGE_ENGINE_URL = "http://localhost:5010";
    process.env.STAGE_ENGINE_API_KEY = "test-key";
  });

  it("mints LiveKit token via livekit-token edge function for authenticated wizard call", async () => {
    const invokeMock = vi.fn().mockResolvedValue({
      data: {
        room_url: "wss://test.livekit.cloud",
        token: "lk-token-abc",
        room_name: "ws-1:wizard:user-1",
      },
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            limit: () => ({
              single: () =>
                Promise.resolve({
                  data: { profile_id: "profile-1", workspace_id: "ws-1" },
                }),
            }),
          }),
        }),
      }),
      functions: { invoke: invokeMock },
    } as never);

    const req = new Request("http://localhost/api/wizard/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mission_id: "onboarding-interview",
        voice: "coral",
        language: "no",
        first_speaker: "agent",
      }),
    });

    const res = await POST(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(invokeMock).toHaveBeenCalledWith(
      "livekit-token",
      expect.objectContaining({
        body: expect.objectContaining({
          room_name: expect.stringContaining("wizard"),
          mission_id: "onboarding-interview",
        }),
      }),
    );
    expect(body).toMatchObject({
      roomUrl: "wss://test.livekit.cloud",
      token: "lk-token-abc",
    });
  });

  it("does NOT call /adapters/ultravox/create-call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const invokeMock = vi.fn().mockResolvedValue({
      data: { room_url: "wss://x", token: "t", room_name: "anon:wizard:anon" },
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      functions: { invoke: invokeMock },
    } as never);

    const req = new Request("http://localhost/api/wizard/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mission_id: "onboarding-interview", voice: "coral" }),
    });
    await POST(req as never);

    const ultravoxCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/adapters/ultravox/"),
    );
    expect(ultravoxCalls).toHaveLength(0);
  });
});
