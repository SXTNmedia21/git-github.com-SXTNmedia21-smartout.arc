import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateTaskScheduledAtAction } from "../update-task-scheduled-at";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const updateMock = vi.fn();
vi.mock("@smartout/ai/capabilities/task/tools", () => ({
  updateSessionTask: { execute: (...args: unknown[]) => updateMock(...args) },
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
  nonEmpty: (s: string, _field: string) => s,
}));

const resolveProfileMock = vi.fn();
vi.mock("../_shared", () => ({
  resolveCurrentProfile: () => resolveProfileMock(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_WS = "00000000-0000-0000-0000-000000000002";
const VALID_PROFILE = "00000000-0000-0000-0000-000000000001";
const TASK_ID = "00000000-0000-0000-0000-000000000010";
const ASSIGNEE_ID = "00000000-0000-0000-0000-000000000020";
const FROM_ISO = "2026-05-25T12:00:00.000Z";
const TO_ISO = "2026-05-25T14:00:00.000Z";

const validInput = {
  task_id: TASK_ID,
  scheduled_at: TO_ISO,
  assignee_profile_id: ASSIGNEE_ID,
  fromIso: FROM_ISO,
  fromAssignee: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("updateTaskScheduledAtAction", () => {
  beforeEach(() => {
    updateMock.mockReset();
    emitMock.mockReset();
    resolveProfileMock.mockReset();
  });

  it("happy path: resolves profile, calls tool, emits oppgaver.task_re_timed, returns ok:true", async () => {
    resolveProfileMock.mockResolvedValue({
      profileId: VALID_PROFILE,
      workspaceId: VALID_WS,
      role: "manager",
    });
    updateMock.mockResolvedValue(JSON.stringify({ ok: true, id: TASK_ID }));

    const result = await updateTaskScheduledAtAction(validInput);

    expect(result.ok).toBe(true);

    // Tool was invoked with correct identity + params.
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        task_id: TASK_ID,
        scheduled_at: TO_ISO,
        assignee_profile_id: ASSIGNEE_ID,
        actor_capability: "day-line",
        delegated_via: "day-line-dnd",
      }),
      expect.objectContaining({
        workspaceId: VALID_WS,
        profileId: VALID_PROFILE,
        channel: "chat",
      }),
    );

    // Surface-level telemetry emitted.
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "oppgaver.task_re_timed",
        workspace_id: VALID_WS,
        actor_id: VALID_PROFILE,
      }),
    );
  });

  it("L-0177: returns ok:false immediately when workspace_id is missing (no DB call)", async () => {
    resolveProfileMock.mockResolvedValue({
      profileId: VALID_PROFILE,
      workspaceId: "",
      role: "manager",
    });

    const result = await updateTaskScheduledAtAction(validInput);

    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("L-0177: returns ok:false immediately when profile_id is missing (no DB call)", async () => {
    resolveProfileMock.mockResolvedValue({
      profileId: "",
      workspaceId: VALID_WS,
      role: "manager",
    });

    const result = await updateTaskScheduledAtAction(validInput);

    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("tool returns ok:false → action returns ok:false, emit NOT fired", async () => {
    resolveProfileMock.mockResolvedValue({
      profileId: VALID_PROFILE,
      workspaceId: VALID_WS,
      role: "manager",
    });
    updateMock.mockResolvedValue(JSON.stringify({ ok: false, error: "ikke_tillatt" }));

    const result = await updateTaskScheduledAtAction(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("ikke_tillatt");
    // No surface-level emit when the mutation itself was rejected.
    expect(emitMock).not.toHaveBeenCalled();
  });
});
