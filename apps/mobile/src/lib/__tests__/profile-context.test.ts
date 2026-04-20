/**
 * Contract tests for getProfileContext (ADR-0134).
 *
 * Every mobile mutation that emits telemetry depends on getProfileContext
 * returning a non-null, non-empty workspace_id and profile_id. These tests
 * lock the contract: the helper throws fast on missing/empty values, so
 * downstream mutations cannot emit corrupt attribution to activity_trail.
 *
 * Reference: docs/decisions/0134-mobile-telemetry-contract-enforcement.md
 */

const supabaseMock = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

jest.mock("@/lib/supabase", () => ({ supabase: supabaseMock }), { virtual: true });

import { getProfileContext } from "@/lib/profile-context";

function mockProfileQuery(profile: unknown, error: unknown = null) {
  const single = jest.fn().mockResolvedValue({ data: profile, error });
  const limit = jest.fn().mockReturnValue({ single });
  const eq = jest.fn().mockReturnValue({ limit });
  const select = jest.fn().mockReturnValue({ eq });
  supabaseMock.from.mockReturnValue({ select });
}

describe("getProfileContext — ADR-0134 telemetry contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns profileId + workspaceId when profile is fully populated", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockProfileQuery({ profile_id: "p-1", workspace_id: "w-1" });

    const ctx = await getProfileContext();

    expect(ctx.profileId).toBe("p-1");
    expect(ctx.workspaceId).toBe("w-1");
    // Contract: both non-empty strings
    expect(ctx.profileId.length).toBeGreaterThan(0);
    expect(ctx.workspaceId.length).toBeGreaterThan(0);
  });

  it("throws when no auth user (no broken telemetry can leak)", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });

    await expect(getProfileContext()).rejects.toThrow(/Not authenticated/);
  });

  it("throws when profile lookup returns an error", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockProfileQuery(null, new Error("db down"));

    await expect(getProfileContext()).rejects.toThrow();
  });

  it("throws when profile row is missing", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockProfileQuery(null);

    await expect(getProfileContext()).rejects.toThrow(/Profile not found/);
  });

  it("throws when profile_id is empty (prevents actor_id: '')", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockProfileQuery({ profile_id: "", workspace_id: "w-1" });

    await expect(getProfileContext()).rejects.toThrow(/profile_id/);
  });

  it("throws when workspace_id is empty (prevents workspace_id: '')", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockProfileQuery({ profile_id: "p-1", workspace_id: "" });

    await expect(getProfileContext()).rejects.toThrow(/workspace_id/);
  });

  it("throws when workspace_id is null (prevents workspace_id: null)", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockProfileQuery({ profile_id: "p-1", workspace_id: null });

    await expect(getProfileContext()).rejects.toThrow(/workspace_id/);
  });
});
