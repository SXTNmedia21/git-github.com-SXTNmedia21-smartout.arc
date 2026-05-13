/**
 * update-department-session-action.test.ts — coverage for the Server Action
 * that replaced the inline `<select onChange>` direct DB update on
 * department_session in OversiktTab.tsx. Closes F-SC-04-13.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveCurrentProfileMock, gateActionMock, createAdminClientMock, emitMock } = vi.hoisted(
  () => ({
    resolveCurrentProfileMock: vi.fn(),
    gateActionMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    emitMock: vi.fn(),
  }),
);

vi.mock("../_shared", () => ({
  resolveCurrentProfile: resolveCurrentProfileMock,
  gateAction: gateActionMock,
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
  nonEmpty: (v: string) => v,
}));

import { updateDepartmentSessionDutyLeaderAction } from "../update-department-session-action";

// ── Fixtures ────────────────────────────────────────────────────────────────
const WS_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const DEPT_ID = "44444444-4444-4444-8444-444444444444";
const PREV_LEADER = "55555555-5555-4555-8555-555555555555";
const NEW_LEADER = "66666666-6666-4666-8666-666666666666";

type LoadedSession = {
  department_session_id: string;
  workspace_id: string;
  department_id: string;
  session_date: string;
  duty_leader_id: string | null;
  status: string;
};

function buildAdminClient(params: {
  loadResult: { data: LoadedSession | null; error: unknown };
  updateError?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(params.loadResult);
  const loadEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: loadEq });

  const updateEq = vi.fn().mockResolvedValue({ data: null, error: params.updateError ?? null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  let firstCall = true;
  const from = vi.fn((table: string) => {
    if (table !== "department_session") throw new Error(`unexpected from(${table})`);
    if (firstCall) {
      firstCall = false;
      return { select };
    }
    return { update };
  });

  return {
    from,
    _select: select,
    _update: update,
    _updateEq: updateEq,
  };
}

beforeEach(() => {
  resolveCurrentProfileMock.mockReset();
  gateActionMock.mockReset();
  createAdminClientMock.mockReset();
  emitMock.mockReset();

  resolveCurrentProfileMock.mockResolvedValue({
    profileId: PROFILE_ID,
    workspaceId: WS_ID,
    role: "manager",
  });
});

describe("updateDepartmentSessionDutyLeaderAction", () => {
  it("returns ok=false 'Ikke autentisert.' when no profile", async () => {
    resolveCurrentProfileMock.mockResolvedValue(null);
    const result = await updateDepartmentSessionDutyLeaderAction({
      department_session_id: SESSION_ID,
      duty_leader_profile_id: NEW_LEADER,
    });
    expect(result).toEqual({ ok: false, error: "Ikke autentisert." });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("validation rejects invalid uuid", async () => {
    const result = await updateDepartmentSessionDutyLeaderAction({
      department_session_id: "not-a-uuid",
      duty_leader_profile_id: NEW_LEADER,
    });
    expect(result.ok).toBe(false);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("accepts null duty_leader_profile_id (clear assignment)", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          department_session_id: SESSION_ID,
          workspace_id: WS_ID,
          department_id: DEPT_ID,
          session_date: "2026-06-10",
          duty_leader_id: PREV_LEADER,
          status: "active",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);
    gateActionMock.mockResolvedValue({ allow: true });

    const result = await updateDepartmentSessionDutyLeaderAction({
      department_session_id: SESSION_ID,
      duty_leader_profile_id: null,
    });

    expect(result).toEqual({
      ok: true,
      department_session_id: SESSION_ID,
      duty_leader_profile_id: null,
      changed: true,
    });
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "session duty_leader_updated" }),
    );
    const emitArg = emitMock.mock.calls[0]?.[0];
    expect(emitArg?.properties?.data?.previous_duty_leader_id).toBe(PREV_LEADER);
    expect(emitArg?.properties?.data?.new_duty_leader_id).toBe(null);
  });

  it("returns ok=false when row not found (L-0177)", async () => {
    const admin = buildAdminClient({
      loadResult: { data: null, error: null },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await updateDepartmentSessionDutyLeaderAction({
      department_session_id: SESSION_ID,
      duty_leader_profile_id: NEW_LEADER,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/finnes ikke/i);
    expect(gateActionMock).not.toHaveBeenCalled();
  });

  it("returns ok=false on workspace mismatch (L-0177)", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          department_session_id: SESSION_ID,
          workspace_id: "deadbeef-dead-4eef-8eef-deadbeefdead",
          department_id: DEPT_ID,
          session_date: "2026-06-10",
          duty_leader_id: null,
          status: "active",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await updateDepartmentSessionDutyLeaderAction({
      department_session_id: SESSION_ID,
      duty_leader_profile_id: NEW_LEADER,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/annet arbeidsrom/i);
    expect(gateActionMock).not.toHaveBeenCalled();
  });

  it("idempotent — no change short-circuits (no UPDATE, no gate, no emit)", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          department_session_id: SESSION_ID,
          workspace_id: WS_ID,
          department_id: DEPT_ID,
          session_date: "2026-06-10",
          duty_leader_id: PREV_LEADER,
          status: "active",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await updateDepartmentSessionDutyLeaderAction({
      department_session_id: SESSION_ID,
      duty_leader_profile_id: PREV_LEADER,
    });

    expect(result).toEqual({
      ok: true,
      department_session_id: SESSION_ID,
      duty_leader_profile_id: PREV_LEADER,
      changed: false,
    });
    expect(gateActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
    expect(admin._update).not.toHaveBeenCalled();
  });

  it("gate denial returns ok=false — no UPDATE, no emit", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          department_session_id: SESSION_ID,
          workspace_id: WS_ID,
          department_id: DEPT_ID,
          session_date: "2026-06-10",
          duty_leader_id: PREV_LEADER,
          status: "active",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);
    gateActionMock.mockResolvedValue({
      allow: false,
      reason: "role_floor",
      min_role_required: "manager",
    });

    const result = await updateDepartmentSessionDutyLeaderAction({
      department_session_id: SESSION_ID,
      duty_leader_profile_id: NEW_LEADER,
    });

    expect(result.ok).toBe(false);
    expect(emitMock).not.toHaveBeenCalled();
    expect(admin._update).not.toHaveBeenCalled();
  });

  it("happy path — UPDATE + emit with canonical shape", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          department_session_id: SESSION_ID,
          workspace_id: WS_ID,
          department_id: DEPT_ID,
          session_date: "2026-06-10",
          duty_leader_id: PREV_LEADER,
          status: "active",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);
    gateActionMock.mockResolvedValue({ allow: true });

    const result = await updateDepartmentSessionDutyLeaderAction({
      department_session_id: SESSION_ID,
      duty_leader_profile_id: NEW_LEADER,
    });

    expect(result).toEqual({
      ok: true,
      department_session_id: SESSION_ID,
      duty_leader_profile_id: NEW_LEADER,
      changed: true,
    });
    expect(gateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "session.update_duty_leader",
        actionType: "update",
        entityId: SESSION_ID,
        workspaceId: WS_ID,
      }),
    );
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "session duty_leader_updated",
        workspace_id: WS_ID,
        actor_id: PROFILE_ID,
      }),
    );
    const emitArg = emitMock.mock.calls[0]?.[0];
    expect(emitArg?.properties?.data?.department_session_id).toBe(SESSION_ID);
    expect(emitArg?.properties?.data?.department_id).toBe(DEPT_ID);
    expect(emitArg?.properties?.data?.previous_duty_leader_id).toBe(PREV_LEADER);
    expect(emitArg?.properties?.data?.new_duty_leader_id).toBe(NEW_LEADER);
  });
});
