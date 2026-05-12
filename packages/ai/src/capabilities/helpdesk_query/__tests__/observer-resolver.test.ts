/**
 * observer-resolver.test.ts — ADR-0233 proxy chain coverage.
 *
 * Three paths:
 *   1. team_leader   — rep is on a team with a different leader.
 *   2. broadcast     — no team / leader=rep, falls back to role >= min_role.
 *   3. no_observer   — both paths exhausted, telemetry emitted, null returned.
 *
 * Schema-validated mock (L-0087) — column typos surface loudly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveObserver } from "../observer-resolver.js";
import { mockSupabase } from "../../__tests__/supabase-mock.js";

const emitMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
  nonEmpty: (v: string) => v,
}));

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const REP_PROFILE_ID = "20000000-0000-0000-0000-000000000001";
const LEADER_PROFILE_ID = "20000000-0000-0000-0000-000000000002";
const MANAGER_PROFILE_ID = "20000000-0000-0000-0000-000000000003";
const TEAM_ID = "30000000-0000-0000-0000-000000000001";
const TICKET_ID = "40000000-0000-0000-0000-000000000001";

beforeEach(() => {
  emitMock.mockClear();
});

describe("resolveObserver — team_leader path", () => {
  it("returns the team leader when rep is on a team with a different leader", async () => {
    const supabase = mockSupabase({
      team_member: {
        data: [{ team_id: TEAM_ID, created_at: "2026-04-01T00:00:00Z" }],
        error: null,
      },
      team: {
        data: { leader_profile_id: LEADER_PROFILE_ID, workspace_id: WORKSPACE_ID },
        error: null,
      },
    });

    const result = await resolveObserver({
      workspaceId: WORKSPACE_ID,
      repProfileId: REP_PROFILE_ID,
      minRole: "manager",
      supabase,
    });

    expect(result.observer_profile_id).toBe(LEADER_PROFILE_ID);
    expect(result.resolution_path).toBe("team_leader");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("skips team leader when leader is the rep itself, falls through to broadcast", async () => {
    const supabase = mockSupabase({
      team_member: {
        data: [{ team_id: TEAM_ID, created_at: "2026-04-01T00:00:00Z" }],
        error: null,
      },
      // Team leader is the rep — must NOT be returned.
      team: {
        data: { leader_profile_id: REP_PROFILE_ID, workspace_id: WORKSPACE_ID },
        error: null,
      },
      profile: {
        data: [
          { profile_id: MANAGER_PROFILE_ID, created_at: "2026-04-02T00:00:00Z", role: "manager" },
        ],
        error: null,
      },
    });

    const result = await resolveObserver({
      workspaceId: WORKSPACE_ID,
      repProfileId: REP_PROFILE_ID,
      minRole: "manager",
      supabase,
    });

    expect(result.resolution_path).toBe("broadcast");
    expect(result.observer_profile_id).toBe(MANAGER_PROFILE_ID);
  });

  it("rejects team leader from a different workspace (defence-in-depth)", async () => {
    const supabase = mockSupabase({
      team_member: {
        data: [{ team_id: TEAM_ID, created_at: "2026-04-01T00:00:00Z" }],
        error: null,
      },
      // Team belongs to a different workspace — should be ignored.
      team: {
        data: {
          leader_profile_id: LEADER_PROFILE_ID,
          workspace_id: "99999999-9999-9999-9999-999999999999",
        },
        error: null,
      },
      profile: {
        data: [
          { profile_id: MANAGER_PROFILE_ID, created_at: "2026-04-02T00:00:00Z", role: "manager" },
        ],
        error: null,
      },
    });

    const result = await resolveObserver({
      workspaceId: WORKSPACE_ID,
      repProfileId: REP_PROFILE_ID,
      minRole: "manager",
      supabase,
    });

    expect(result.resolution_path).toBe("broadcast");
    expect(result.observer_profile_id).toBe(MANAGER_PROFILE_ID);
  });
});

describe("resolveObserver — broadcast path", () => {
  it("falls back to broadcast when rep has no team membership", async () => {
    const supabase = mockSupabase({
      team_member: { data: [], error: null },
      profile: {
        data: [
          { profile_id: MANAGER_PROFILE_ID, created_at: "2026-04-02T00:00:00Z", role: "manager" },
        ],
        error: null,
      },
    });

    const result = await resolveObserver({
      workspaceId: WORKSPACE_ID,
      repProfileId: REP_PROFILE_ID,
      minRole: "manager",
      supabase,
    });

    expect(result.observer_profile_id).toBe(MANAGER_PROFILE_ID);
    expect(result.resolution_path).toBe("broadcast");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("falls back to broadcast when team has no leader", async () => {
    const supabase = mockSupabase({
      team_member: {
        data: [{ team_id: TEAM_ID, created_at: "2026-04-01T00:00:00Z" }],
        error: null,
      },
      team: { data: { leader_profile_id: null, workspace_id: WORKSPACE_ID }, error: null },
      profile: {
        data: [
          { profile_id: MANAGER_PROFILE_ID, created_at: "2026-04-02T00:00:00Z", role: "manager" },
        ],
        error: null,
      },
    });

    const result = await resolveObserver({
      workspaceId: WORKSPACE_ID,
      repProfileId: REP_PROFILE_ID,
      minRole: "manager",
      supabase,
    });

    expect(result.observer_profile_id).toBe(MANAGER_PROFILE_ID);
    expect(result.resolution_path).toBe("broadcast");
  });
});

describe("resolveObserver — no_observer path", () => {
  it("returns null and emits no_observer telemetry when both paths fail", async () => {
    const supabase = mockSupabase({
      team_member: { data: [], error: null },
      profile: { data: [], error: null },
    });

    const result = await resolveObserver({
      workspaceId: WORKSPACE_ID,
      repProfileId: REP_PROFILE_ID,
      minRole: "manager",
      supabase,
      engineStateId: TICKET_ID,
    });

    expect(result.observer_profile_id).toBeNull();
    expect(result.resolution_path).toBe("no_observer");
    expect(emitMock).toHaveBeenCalledTimes(1);

    const emittedEvent = emitMock.mock.calls[0]?.[0] as {
      event: string;
      properties: Record<string, unknown>;
    };
    expect(emittedEvent.event).toBe("helpdesk.sla.no_observer_resolved");
    expect(emittedEvent.properties.engine_state_id).toBe(TICKET_ID);
    expect(emittedEvent.properties.rep_profile_id).toBe(REP_PROFILE_ID);
    expect(emittedEvent.properties.min_role).toBe("manager");
    expect(emittedEvent.properties.attempted_paths).toEqual(["team_leader", "broadcast"]);
  });
});
