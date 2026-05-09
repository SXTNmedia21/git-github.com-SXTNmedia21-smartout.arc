// apps/web/src/app/api/wizard/start/__tests__/route.test.ts
// Vitest: wizard/start workspace_id forgery rejection (ADR-0151)
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockFromProfile = vi.fn();
const mockFetch = vi.fn();
const mockEmit = vi.fn();

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "profile") return mockFromProfile();
      throw new Error(`unexpected table: ${table}`);
    },
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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        session_id: "sess-1",
        join_url: "wss://test",
        call_id: "call-1",
      }),
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
    expect(mockFetch).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const fetchBody = JSON.parse((mockFetch.mock.calls[0]![1] as { body: string }).body);
    expect(fetchBody.workspace_id).toBe(realWorkspaceId);
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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "s", join_url: "u", call_id: "c" }),
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
    const fetchBody2 = JSON.parse((mockFetch.mock.calls[0]![1] as { body: string }).body);
    expect(fetchBody2.workspace_id).toBe(realWorkspaceId);
  });

  it("returns 200 for onboarding-interview when no user is authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "s", join_url: "u", call_id: "c" }),
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
