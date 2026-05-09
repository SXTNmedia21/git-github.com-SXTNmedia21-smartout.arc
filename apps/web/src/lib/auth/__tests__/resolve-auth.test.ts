import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAdminGetUser = vi.fn();
const mockServerGetUser = vi.fn();
const mockServerGetSession = vi.fn();

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ auth: { getUser: mockAdminGetUser } })),
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockServerGetUser,
      getSession: mockServerGetSession,
    },
  })),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveAuth — dual-mode (Bearer for mobile, cookie for web)", () => {
  it("returns user from Bearer token when Authorization header is present", async () => {
    mockAdminGetUser.mockResolvedValue({
      data: { user: { id: "user-uuid-aaa" } },
      error: null,
    });
    const { resolveAuth } = await import("../resolve-auth");
    const req = new NextRequest("http://localhost/x", {
      headers: { authorization: "Bearer test-jwt-abc" },
    });
    const result = await resolveAuth(req);
    expect(result).toMatchObject({
      user: { id: "user-uuid-aaa" },
      accessToken: "test-jwt-abc",
      authMethod: "bearer",
    });
    expect(mockAdminGetUser).toHaveBeenCalledWith("test-jwt-abc");
    expect(mockServerGetUser).not.toHaveBeenCalled();
  });

  it("returns null when Bearer token is invalid", async () => {
    mockAdminGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid jwt" },
    });
    const { resolveAuth } = await import("../resolve-auth");
    const req = new NextRequest("http://localhost/x", {
      headers: { authorization: "Bearer bad-jwt" },
    });
    expect(await resolveAuth(req)).toBeNull();
  });

  it("falls back to cookie session when no Authorization header", async () => {
    mockServerGetUser.mockResolvedValue({
      data: { user: { id: "user-uuid-bbb" } },
      error: null,
    });
    mockServerGetSession.mockResolvedValue({
      data: { session: { access_token: "cookie-jwt" } },
      error: null,
    });
    const { resolveAuth } = await import("../resolve-auth");
    const req = new NextRequest("http://localhost/x");
    const result = await resolveAuth(req);
    expect(result).toMatchObject({
      user: { id: "user-uuid-bbb" },
      accessToken: "cookie-jwt",
      authMethod: "cookie",
    });
  });

  it("returns null when cookie session is missing", async () => {
    mockServerGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockServerGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const { resolveAuth } = await import("../resolve-auth");
    const req = new NextRequest("http://localhost/x");
    expect(await resolveAuth(req)).toBeNull();
  });
});
