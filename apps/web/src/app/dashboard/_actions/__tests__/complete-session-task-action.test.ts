import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeSessionTaskAction } from "../complete-session-task-action";
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

describe("completeSessionTaskAction", () => {
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

  it("returns ok=true and emits when gate allows + workspace+assignee match", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            workspace_id: actor.workspaceId,
            assigned_to: actor.profileId,
            title: "Test",
            status: "pending",
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

    const result = await completeSessionTaskAction(taskId, actor, "system");

    expect(result.ok).toBe(true);
    expect(gateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: actor.workspaceId,
        capability: "task.complete_session_task",
        channel: "system",
        actorProfileId: actor.profileId,
        actionType: "complete",
        entityId: taskId,
      }),
    );
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "session_task completed",
        workspace_id: actor.workspaceId,
        actor_id: actor.profileId,
      }),
    );
  });

  it("returns ok=false when row workspace differs", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            workspace_id: "00000000-0000-0000-0000-00000000DEAD",
            assigned_to: actor.profileId,
            status: "pending",
          },
          error: null,
        }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await completeSessionTaskAction(taskId, actor, "system");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/annet arbeidsrom/i);
    expect(gateMock).not.toHaveBeenCalled();
  });

  it("returns ok=false when gate denies", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            workspace_id: actor.workspaceId,
            assigned_to: actor.profileId,
            status: "pending",
          },
          error: null,
        }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });
    gateMock.mockResolvedValue({ allow: false, reason: "denied by policy" });

    const result = await completeSessionTaskAction(taskId, actor, "system");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/denied by policy|ikke autorisert/i);
  });

  it("returns ok=false when row not found", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await completeSessionTaskAction(taskId, actor, "system");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/finnes ikke/i);
  });
});
