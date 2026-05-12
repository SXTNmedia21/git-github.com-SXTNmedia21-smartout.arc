import { describe, it, expect, vi, beforeEach } from "vitest";
import { pinMessageAction } from "../pin-message-action";

// Helper: narrow PinResult to its failure branch for test assertions.
function failureReason(result: Awaited<ReturnType<typeof pinMessageAction>>): string {
  if (!result.ok) return result.reason;
  throw new Error("Expected a failure result but got ok:true");
}

const adminUpdate = vi.fn();
const resolveProfile = vi.fn();

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      update: (payload: unknown) => ({
        eq: () => ({ eq: () => adminUpdate(table, payload) }),
      }),
    }),
  }),
}));

vi.mock("@/app/dashboard/_actions/_shared", () => ({
  resolveCurrentProfile: () => resolveProfile(),
}));

describe("pinMessageAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects when caller is not authenticated", async () => {
    resolveProfile.mockResolvedValue(null);

    const result = await pinMessageAction({
      messageId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      pin: true,
    });

    expect(result.ok).toBe(false);
    expect(failureReason(result)).toMatch(/authenticated/i);
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it("rejects when caller is not manager+", async () => {
    resolveProfile.mockResolvedValue({
      profileId: "00000000-0000-0000-0000-000000000100",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      role: "employee",
    });

    const result = await pinMessageAction({
      messageId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      pin: true,
    });

    expect(result.ok).toBe(false);
    expect(failureReason(result)).toMatch(/role/i);
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it("rejects when caller workspace mismatches body workspace", async () => {
    resolveProfile.mockResolvedValue({
      profileId: "00000000-0000-0000-0000-000000000100",
      workspaceId: "00000000-0000-0000-0000-000000000099",
      role: "manager",
    });

    const result = await pinMessageAction({
      messageId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      pin: true,
    });

    expect(result.ok).toBe(false);
    expect(failureReason(result)).toMatch(/workspace/i);
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it("writes is_pinned=true + pinned_by + pinned_at when caller is manager", async () => {
    resolveProfile.mockResolvedValue({
      profileId: "00000000-0000-0000-0000-000000000100",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      role: "manager",
    });
    adminUpdate.mockResolvedValue({ data: null, error: null });

    const result = await pinMessageAction({
      messageId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      pin: true,
    });

    expect(result.ok).toBe(true);
    expect(adminUpdate).toHaveBeenCalledWith(
      "channel_message",
      expect.objectContaining({
        is_pinned: true,
        pinned_by: "00000000-0000-0000-0000-000000000100",
        pinned_at: expect.any(String),
      }),
    );
  });

  it("writes is_pinned=false + null pinned_by/pinned_at when unpinning", async () => {
    resolveProfile.mockResolvedValue({
      profileId: "00000000-0000-0000-0000-000000000100",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      role: "admin",
    });
    adminUpdate.mockResolvedValue({ data: null, error: null });

    const result = await pinMessageAction({
      messageId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      pin: false,
    });

    expect(result.ok).toBe(true);
    expect(adminUpdate).toHaveBeenCalledWith(
      "channel_message",
      expect.objectContaining({
        is_pinned: false,
        pinned_by: null,
        pinned_at: null,
      }),
    );
  });
});
