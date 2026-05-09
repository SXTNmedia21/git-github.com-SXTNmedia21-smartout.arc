import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockResolveAuth = vi.fn();
const mockAdminFromProfile = vi.fn();
const mockAdminFromWorkspace = vi.fn();
const mockAdminFromSeason = vi.fn();
const mockAdminFromBinding = vi.fn();
const mockAdminFromCycle = vi.fn();

vi.mock("@/lib/auth/resolve-auth", () => ({
  resolveAuth: mockResolveAuth,
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      switch (table) {
        case "profile":
          return mockAdminFromProfile();
        case "workspace":
          return mockAdminFromWorkspace();
        case "season":
          return mockAdminFromSeason();
        case "workspace_framework_binding":
          return mockAdminFromBinding();
        case "planning_cycle":
          return mockAdminFromCycle();
      }
      throw new Error(`unexpected table ${table}`);
    },
  })),
}));

vi.mock("@smartout/ai/agents/context-types", () => ({}));

beforeEach(() => {
  vi.resetAllMocks();
});

function chainable(data: unknown, error: unknown = null) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.maybeSingle = async () => ({ data, error });
  return builder;
}

const validWorkspaceId = "11111111-1111-1111-1111-111111111111";

describe("GET /api/botsson/voice/session-context — Bearer auth (mobile)", () => {
  it("returns 200 with user + workspace when Bearer token resolves", async () => {
    mockResolveAuth.mockResolvedValue({
      user: { id: "user-uuid-aaa" },
      accessToken: "bearer-jwt",
      authMethod: "bearer",
    });
    mockAdminFromProfile.mockReturnValue(
      chainable({
        profile_id: "p1",
        role: "manager",
        status: "active",
        department_id: "d1",
        display_name: "Test User",
        language_override: null,
      }),
    );
    mockAdminFromWorkspace.mockReturnValue(
      chainable({ workspace_id: validWorkspaceId, name: "Test WS", language: "no" }),
    );
    mockAdminFromSeason.mockReturnValue(chainable(null));
    mockAdminFromBinding.mockReturnValue(chainable(null));
    mockAdminFromCycle.mockReturnValue(chainable(null));

    const { GET } = await import("../route");
    const req = new NextRequest(
      `http://localhost/api/botsson/voice/session-context?workspaceId=${validWorkspaceId}`,
      { headers: { authorization: "Bearer bearer-jwt" } },
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.profile_id).toBe("p1");
    expect(body.workspace.workspace_id).toBe(validWorkspaceId);
  });

  it("returns 401 when resolveAuth returns null", async () => {
    mockResolveAuth.mockResolvedValue(null);
    const { GET } = await import("../route");
    const req = new NextRequest(
      `http://localhost/api/botsson/voice/session-context?workspaceId=${validWorkspaceId}`,
    );
    expect((await GET(req)).status).toBe(401);
  });

  it("returns 403 when profile not found in workspace", async () => {
    mockResolveAuth.mockResolvedValue({
      user: { id: "user-uuid-aaa" },
      accessToken: "j",
      authMethod: "bearer",
    });
    mockAdminFromProfile.mockReturnValue(chainable(null));
    const { GET } = await import("../route");
    const req = new NextRequest(
      `http://localhost/api/botsson/voice/session-context?workspaceId=${validWorkspaceId}`,
      { headers: { authorization: "Bearer j" } },
    );
    expect((await GET(req)).status).toBe(403);
  });
});
