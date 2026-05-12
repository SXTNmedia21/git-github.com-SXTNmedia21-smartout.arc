import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmShiftAction } from "../confirm-shift-action";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

const adminMock = vi.fn();
vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminMock }),
}));

const gateMock = vi.fn();
vi.mock("../_shared", async () => {
  const actual = await vi.importActual<typeof import("../_shared")>("../_shared");
  return { ...actual, gateAction: (...args: unknown[]) => gateMock(...args) };
});

const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
}));

describe("confirmShiftAction", () => {
  const actor: ResolvedActor = {
    userId: "00000000-0000-0000-0000-00000000000A",
    profileId: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    role: "employee",
  };

  beforeEach(() => {
    adminMock.mockReset();
    gateMock.mockReset();
    emitMock.mockReset();
  });

  it("returns ok=true when shift matches workspace + employee and gate allows", async () => {
    const shiftId = "00000000-0000-0000-0000-000000000020";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            workspace_id: actor.workspaceId,
            employee_id: actor.profileId,
            confirmed_at: null,
          },
          error: null,
        }),
      }),
    });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    adminMock
      .mockReturnValueOnce({ select: selectMock })
      .mockReturnValueOnce({ update: updateMock });
    gateMock.mockResolvedValue({ allow: true });

    const result = await confirmShiftAction(shiftId, actor, "system");
    expect(result.ok).toBe(true);
    expect(gateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "schedule.confirm_shift",
        actionType: "confirm",
        actorProfileId: actor.profileId,
        entityId: shiftId,
      }),
    );
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ event: "shift confirmed" }));
  });

  it("returns ok=false when shift workspace differs", async () => {
    const shiftId = "00000000-0000-0000-0000-000000000020";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            workspace_id: "00000000-0000-0000-0000-00000000DEAD",
            employee_id: actor.profileId,
            confirmed_at: null,
          },
          error: null,
        }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await confirmShiftAction(shiftId, actor, "system");
    expect(result.ok).toBe(false);
    expect(gateMock).not.toHaveBeenCalled();
  });

  it("returns ok=false when gate denies", async () => {
    const shiftId = "00000000-0000-0000-0000-000000000020";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            workspace_id: actor.workspaceId,
            employee_id: actor.profileId,
            confirmed_at: null,
          },
          error: null,
        }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });
    gateMock.mockResolvedValue({ allow: false, reason: "denied by policy" });

    const result = await confirmShiftAction(shiftId, actor, "system");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/denied by policy|ikke autorisert/i);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns ok=false when shift not found", async () => {
    const shiftId = "00000000-0000-0000-0000-000000000020";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await confirmShiftAction(shiftId, actor, "system");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/finnes ikke/i);
  });
});
