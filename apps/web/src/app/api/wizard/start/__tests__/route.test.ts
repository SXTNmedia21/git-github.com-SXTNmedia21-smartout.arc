// apps/web/src/app/api/wizard/start/__tests__/route.test.ts
// Vitest: wizard/start workspace_id forgery rejection (ADR-0151)
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockFromProfile = vi.fn();
const mockFetch = vi.fn();
const mockEmit = vi.fn();
const mockInvoke = vi.fn();

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "profile") return mockFromProfile();
      throw new Error(`unexpected table: ${table}`);
    },
    functions: { invoke: mockInvoke },
  })),
}));

vi.mock("@smartout/telemetry", () => ({
  emit: mockEmit,
  nonEmpty: (s: string) => s,
}));

beforeEach(() => {
  vi.resetAllMocks();
  process.env.STAGE_ENGINE_URL = "http://stage-engine.test";
  process.env.STAGE_ENGINE_API_KEY = "test-key";
  vi.stubGlobal("fetch", mockFetch);
  // Default: functions.invoke succeeds (workspace_id mismatch test must NOT reach invoke)
  mockInvoke.mockResolvedValue({
    data: { room_url: "wss://test", token: "lk-token", room_name: "anon:wizard:anon" },
    error: null,
  });
});

describe("POST /api/wizard/start — workspace_id forgery rejection (ADR-0151)", () => {
  it("returns 403 when body.workspace_id differs from JWT-resolved profile.workspace_id", async () => {
    const realWorkspaceId = "11111111-1111-1111-1111-111111111111";
    const forgedWorkspaceId = "22222222-2222-2222-2222-222222222222";

    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-uuid-aaa" } },
    });
    mockFromProfile.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({
            single: async () => ({
              data: { profile_id: "profile-uuid-bbb", workspace_id: realWorkspaceId },
            }),
          }),
        }),
      }),
    });

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/wizard/start", {
      method: "POST",
      body: JSON.stringify({
        mission_id: "mr-botsson",
        workspace_id: forgedWorkspaceId,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/FORBIDDEN|workspace/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 200 when body.workspace_id matches profile.workspace_id", async () => {
    const realWorkspaceId = "11111111-1111-1111-1111-111111111111";

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-uuid-aaa" } } });
    mockFromProfile.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({
            single: async () => ({
              data: { profile_id: "profile-uuid-bbb", workspace_id: realWorkspaceId },
            }),
          }),
        }),
      }),
    });
    mockInvoke.mockResolvedValue({
      data: {
        room_url: "wss://test",
        token: "lk-token-xyz",
        room_name: `${realWorkspaceId}:wizard:user-uuid-aaa`,
      },
      error: null,
    });

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/wizard/start", {
      method: "POST",
      body: JSON.stringify({
        mission_id: "mr-botsson",
        workspace_id: realWorkspaceId,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockInvoke).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const invokeBody = (mockInvoke.mock.calls[0]![1] as { body: Record<string, unknown> }).body;
    expect(invokeBody.workspace_id).toBe(realWorkspaceId);
  });

  it("returns 200 with no workspaceId when body omits workspace_id (server-derives)", async () => {
    const realWorkspaceId = "11111111-1111-1111-1111-111111111111";

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-uuid-aaa" } } });
    mockFromProfile.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({
            single: async () => ({
              data: { profile_id: "profile-uuid-bbb", workspace_id: realWorkspaceId },
            }),
          }),
        }),
      }),
    });
    mockInvoke.mockResolvedValue({
      data: { room_url: "wss://test", token: "lk-token-zzz", room_name: "ws:wizard:u" },
      error: null,
    });

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/wizard/start", {
      method: "POST",
      body: JSON.stringify({ mission_id: "mr-botsson" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const invokeBody2 = (mockInvoke.mock.calls[0]![1] as { body: Record<string, unknown> }).body;
    expect(invokeBody2.workspace_id).toBe(realWorkspaceId);
  });

  it("returns 200 for onboarding-interview when no user is authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockInvoke.mockResolvedValue({
      data: { room_url: "wss://anon", token: "lk-anon", room_name: "anon:wizard:anon" },
      error: null,
    });

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/wizard/start", {
      method: "POST",
      body: JSON.stringify({ mission_id: "onboarding-interview" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockFromProfile).not.toHaveBeenCalled();
  });
});
