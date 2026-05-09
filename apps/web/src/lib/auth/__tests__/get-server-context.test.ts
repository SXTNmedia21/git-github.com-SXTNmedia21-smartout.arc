/**
 * get-server-context.test.ts
 *
 * Tests for the canonical auth + profile bundle helper used by BFF routes.
 * Verifies three cases:
 *   1. Authenticated user with profile row → returns full context
 *   2. Auth failure → returns null
 *   3. Authenticated user but no profile row → returns user + null profile
 *
 * ADR-0151: workspace_id is server-derived from the profile table,
 * never from the request body.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockResolveAuth = vi.fn();
const mockAdminFromProfile = vi.fn();

vi.mock("@/lib/auth/resolve-auth", () => ({ resolveAuth: mockResolveAuth }));
vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (_table: string) => mockAdminFromProfile(),
  })),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("getServerContext — auth + profile bundle (KRIT-4 / Track C)", () => {
  it("returns user + profile when authenticated and profile row exists", async () => {
    mockResolveAuth.mockResolvedValue({
      user: { id: "u1" },
      accessToken: "tok-abc",
      authMethod: "cookie" as const,
    });
    // Simulate Supabase chained query: from("profile").select(...).eq(...).limit(1).maybeSingle()
    const profileChain = {
      select: () => profileChain,
      eq: () => profileChain,
      limit: () => profileChain,
      maybeSingle: async () => ({
        data: { profile_id: "p1", workspace_id: "w1", role: "owner" },
        error: null,
      }),
    };
    mockAdminFromProfile.mockReturnValue(profileChain);

    const { getServerContext } = await import("../get-server-context");
    const req = new NextRequest("http://localhost/x");
    const ctx = await getServerContext(req);

    expect(ctx).toMatchObject({
      user: { id: "u1" },
      accessToken: "tok-abc",
      authMethod: "cookie",
      profile: { profile_id: "p1", workspace_id: "w1", role: "owner" },
    });
  });

  it("returns null when auth resolves to null (unauthenticated)", async () => {
    mockResolveAuth.mockResolvedValue(null);

    const { getServerContext } = await import("../get-server-context");
    const req = new NextRequest("http://localhost/x");
    const ctx = await getServerContext(req);

    expect(ctx).toBeNull();
    // Admin client should never be called if auth fails
    expect(mockAdminFromProfile).not.toHaveBeenCalled();
  });

  it("returns user + null profile when authenticated but no profile row exists", async () => {
    mockResolveAuth.mockResolvedValue({
      user: { id: "u2" },
      accessToken: "tok-xyz",
      authMethod: "bearer" as const,
    });
    const chain = {
      select: () => chain,
      eq: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    mockAdminFromProfile.mockReturnValue(chain);

    const { getServerContext } = await import("../get-server-context");
    const req = new NextRequest("http://localhost/x");
    const ctx = await getServerContext(req);

    expect(ctx).toMatchObject({
      user: { id: "u2" },
      accessToken: "tok-xyz",
      authMethod: "bearer",
      profile: null,
    });
  });
});
