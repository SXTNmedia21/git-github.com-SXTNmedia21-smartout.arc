import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmHoursAction } from "../confirm-hours-action";
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
  nonEmpty: (s: string | null | undefined) => s as string,
}));

describe("confirmHoursAction", () => {
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

  it("returns ok=true when approval+shift match actor and gate allows", async () => {
    const approvalId = "00000000-0000-0000-0000-000000000030";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            workspace_id: actor.workspaceId,
            shift_id: "00000000-0000-0000-0000-000000000031",
            status: "pending",
            schedule_shift: { employee_id: actor.profileId },
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

    const result = await confirmHoursAction(approvalId, actor, "system");
    expect(result.ok).toBe(true);
    expect(gateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "timesheet.confirm_hours",
        actionType: "confirm",
        entityId: approvalId,
      }),
    );
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ event: "hours confirmed" }));
  });

  it("returns ok=false when approval workspace differs", async () => {
    const approvalId = "00000000-0000-0000-0000-000000000030";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            workspace_id: "00000000-0000-0000-0000-00000000DEAD",
            shift_id: "ignored",
            status: "pending",
            schedule_shift: { employee_id: actor.profileId },
          },
          error: null,
        }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await confirmHoursAction(approvalId, actor, "system");
    expect(result.ok).toBe(false);
    expect(gateMock).not.toHaveBeenCalled();
  });

  it("returns ok=false when actor is not shift owner and not manager", async () => {
    const approvalId = "00000000-0000-0000-0000-000000000030";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            workspace_id: actor.workspaceId,
            shift_id: "00000000-0000-0000-0000-000000000031",
            status: "pending",
            // Different employee owns the shift
            schedule_shift: { employee_id: "00000000-0000-0000-0000-00000000FFFF" },
          },
          error: null,
        }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await confirmHoursAction(approvalId, actor, "system");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ikke autorisert/i);
    expect(gateMock).not.toHaveBeenCalled();
  });

  it("returns ok=false when approval not found", async () => {
    const approvalId = "00000000-0000-0000-0000-000000000030";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await confirmHoursAction(approvalId, actor, "system");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/finnes ikke/i);
  });
});
