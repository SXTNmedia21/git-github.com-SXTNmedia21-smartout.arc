import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeSessionTaskAction } from "../complete-session-task-action";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

// Strategy (a) — mock the task.complete tool body.
// The Server Action now delegates all gate/mutation/emit logic to complete.execute;
// tests only need to control what the tool returns.
const completeMock = vi.fn();
vi.mock("@smartout/ai/capabilities/task/tools", () => ({
  complete: { execute: (...args: unknown[]) => completeMock(...args) },
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

describe("completeSessionTaskAction", () => {
  const actor: ResolvedActor = {
    userId: "00000000-0000-0000-0000-00000000000A",
    profileId: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    role: "employee",
  };

  beforeEach(() => {
    completeMock.mockReset();
  });

  it("returns ok=true with taskId when tool succeeds", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";
    completeMock.mockResolvedValue(JSON.stringify({ ok: true }));

    const result = await completeSessionTaskAction(taskId, actor, "system");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.taskId).toBe(taskId);

    // Tool was invoked with correct source + id.
    expect(completeMock).toHaveBeenCalledWith(
      { id: taskId, source: "session" },
      expect.objectContaining({
        workspaceId: actor.workspaceId,
        profileId: actor.profileId,
        channel: "system",
      }),
    );
  });

  it("returns ok=false with user-facing message when tool returns not_found_or_unauthorized", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";
    completeMock.mockResolvedValue(
      JSON.stringify({ ok: false, error: "not_found_or_unauthorized" }),
    );

    const result = await completeSessionTaskAction(taskId, actor, "system");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/finnes ikke|tilgang/i);
  });

  it("returns ok=false with gate error when tool returns ikke_tillatt", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";
    completeMock.mockResolvedValue(
      JSON.stringify({ ok: false, error: "ikke_tillatt: denied by policy" }),
    );

    const result = await completeSessionTaskAction(taskId, actor, "system");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ikke autorisert/i);
  });

  it("returns ok=false when actor identity is missing", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";
    const emptyActor: ResolvedActor = { ...actor, profileId: "" };

    const result = await completeSessionTaskAction(taskId, emptyActor, "system");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ikke autentisert/i);
    // Tool must NOT be called when identity is missing.
    expect(completeMock).not.toHaveBeenCalled();
  });
});
