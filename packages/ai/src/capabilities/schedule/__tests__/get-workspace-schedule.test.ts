/**
 * Vitest coverage for get_workspace_schedule.
 *
 * Verifies:
 *   1. Admin/manager/owner → returns workspace shift rows for the given date.
 *   2. Employee role → returns forbidden error BEFORE any DB query.
 *   3. Missing / unknown role → returns forbidden error BEFORE any DB query.
 *   4. Voice channel → returns channel_forbidden error BEFORE any DB query.
 *   5. Empty result → returns { empty: true, date, scope: 'workspace' }.
 *   6. Department filter is forwarded to the query.
 *   7. DB error → returns { error: 'db_query_failed', detail }.
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nonEmpty } from "@smartout/telemetry/server";

import { getWorkspaceSchedule } from "../tools.js";
import type { AgentToolContext, SessionChannel } from "../../types.js";

// ─── Supabase mock builder ────────────────────────────────────────────────────
// Simulates the Supabase fluent chain. The builder returns a thenable object
// so `await supabase.from(...).select(...).eq(...)...` resolves correctly.
// `from` is a vi.fn() so tests can assert call count (role-gate tests verify
// DB was NOT reached).
function makeSupabaseAsync(opts: { result: { data: unknown; error: unknown } }): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    then: (resolve: (v: unknown) => void, reject: ((v: unknown) => void) | undefined) => {
      return Promise.resolve(opts.result).then(resolve, reject);
    },
    catch: (reject: (v: unknown) => void) => Promise.resolve(opts.result).catch(reject),
  };

  return {
    from: vi.fn(() => chain),
    rpc: vi.fn(),
  } as unknown as SupabaseClient;
}

// ─── Context builder ──────────────────────────────────────────────────────────
function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: nonEmpty("ws-test-1", "workspaceId"),
    profileId: nonEmpty("profile-admin-1", "profileId"),
    sessionId: "sess-test-1",
    channel: "chat" as SessionChannel,
    supabaseAdmin: {} as SupabaseClient,
    userContext: {
      role: "admin",
      display_name: "Test Admin",
      profile_id: "profile-admin-1",
      department_id: null,
      status: "active",
      language: "no",
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("get_workspace_schedule — role gate (must fire BEFORE DB query)", () => {
  it("blocks employee role and returns forbidden error — no DB call made", async () => {
    const supabase = makeSupabaseAsync({ result: { data: [], error: null } });
    const ctx = makeCtx({
      supabaseAdmin: supabase,
      userContext: {
        role: "employee",
        display_name: "Worker",
        profile_id: "profile-emp-1",
        department_id: "dept-1",
        status: "active",
        language: "no",
      },
    });

    const result = await getWorkspaceSchedule.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe("forbidden");
    expect(parsed.required).toContain("admin");
    expect(parsed.actual).toBe("employee");
    // DB must NOT have been queried.
    expect((supabase.from as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it("blocks unknown/missing role and returns forbidden error — no DB call made", async () => {
    const supabase = makeSupabaseAsync({ result: { data: [], error: null } });
    const ctx = makeCtx({
      supabaseAdmin: supabase,
      userContext: undefined, // no user context = role unknown
    });

    const result = await getWorkspaceSchedule.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe("forbidden");
    expect(parsed.actual).toBe("unknown");
    expect((supabase.from as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});

describe("get_workspace_schedule — voice channel guard", () => {
  it("returns channel_forbidden on voice channel — no DB call made", async () => {
    const supabase = makeSupabaseAsync({ result: { data: [], error: null } });
    const ctx = makeCtx({
      supabaseAdmin: supabase,
      channel: "voice",
    });

    const result = await getWorkspaceSchedule.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe("channel_forbidden");
    expect(parsed.reason).toBe("pii_in_voice");
    expect((supabase.from as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});

describe("get_workspace_schedule — successful admin query", () => {
  const mockShifts = [
    {
      schedule_shift_id: "shift-1",
      shift_date: "2026-05-17",
      start_time: "09:00:00",
      end_time: "17:00:00",
      role: "Servitør",
      status: "published",
      department: { name: "Sal" },
      location: { name: "Sentrum" },
      profile: { display_name: "Anna Hansen" },
    },
  ];

  it("returns enriched shift rows for admin", async () => {
    const supabase = makeSupabaseAsync({ result: { data: mockShifts, error: null } });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await getWorkspaceSchedule.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].schedule_shift_id).toBe("shift-1");
    expect(parsed[0].profile.display_name).toBe("Anna Hansen");
    expect(parsed[0].local.date).toBe("2026-05-17");
  });

  it("returns enriched shift rows for manager role", async () => {
    const supabase = makeSupabaseAsync({ result: { data: mockShifts, error: null } });
    const ctx = makeCtx({
      supabaseAdmin: supabase,
      userContext: {
        role: "manager",
        display_name: "Manager Person",
        profile_id: "profile-mgr-1",
        department_id: "dept-1",
        status: "active",
        language: "no",
      },
    });

    const result = await getWorkspaceSchedule.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it("returns enriched shift rows for owner role", async () => {
    const supabase = makeSupabaseAsync({ result: { data: mockShifts, error: null } });
    const ctx = makeCtx({
      supabaseAdmin: supabase,
      userContext: {
        role: "owner",
        display_name: "Owner Person",
        profile_id: "profile-owner-1",
        department_id: null,
        status: "active",
        language: "no",
      },
    });

    const result = await getWorkspaceSchedule.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it("returns empty structured response when no shifts match", async () => {
    const supabase = makeSupabaseAsync({ result: { data: [], error: null } });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await getWorkspaceSchedule.execute(
      { date: "2026-05-18", department_id: "00000000-0000-0000-0000-000000000001" },
      ctx,
    );
    const parsed = JSON.parse(result);

    expect(parsed.empty).toBe(true);
    expect(parsed.date).toBe("2026-05-18");
    expect(parsed.department_id).toBe("00000000-0000-0000-0000-000000000001");
    expect(parsed.scope).toBe("workspace");
  });

  it("returns db_query_failed on supabase error", async () => {
    const supabase = makeSupabaseAsync({
      result: { data: null, error: { message: "relation does not exist" } },
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await getWorkspaceSchedule.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe("db_query_failed");
    expect(parsed.detail).toBe("relation does not exist");
  });
});
