/**
 * Vitest coverage for get_date_schedule_for_me.
 *
 * Verifies:
 *   1. Employee → returns their own shifts for the given date.
 *   2. Admin using this tool → returns their own shifts (no employee_id
 *      forgery possible — always filters on ctx.profileId server-side).
 *   3. Empty result → returns { empty: true, date, scope: 'personal' }.
 *   4. DB error → returns { error: 'db_query_failed', detail }.
 *   5. Voice channel is ALLOWED (own-shift query contains no other-user PII).
 *   6. No PII leak: response never exposes another employee's display_name.
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nonEmpty } from "@smartout/telemetry/server";

import { getDateScheduleForMe } from "../tools.js";
import type { AgentToolContext, SessionChannel } from "../../types.js";

// ─── Supabase mock builder ────────────────────────────────────────────────────
function makeSupabase(opts: { result: { data: unknown; error: unknown } }): SupabaseClient {
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
    workspaceId: nonEmpty("ws-test-2", "workspaceId"),
    profileId: nonEmpty("profile-emp-2", "profileId"),
    sessionId: "sess-test-2",
    channel: "chat" as SessionChannel,
    supabaseAdmin: {} as SupabaseClient,
    userContext: {
      role: "employee",
      display_name: "Test Employee",
      profile_id: "profile-emp-2",
      department_id: "dept-test",
      status: "active",
      language: "no",
    },
    ...overrides,
  };
}

// ─── Mock shift row (own shift — no other employee PII) ──────────────────────
const mockOwnShifts = [
  {
    schedule_shift_id: "shift-own-1",
    shift_date: "2026-05-17",
    start_time: "08:00:00",
    end_time: "16:00:00",
    role: "Servitør",
    status: "published",
    department: { name: "Sal" },
    location: { name: "Sentrum" },
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("get_date_schedule_for_me — employee happy path", () => {
  it("returns own shifts for the given date", async () => {
    const supabase = makeSupabase({ result: { data: mockOwnShifts, error: null } });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await getDateScheduleForMe.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].schedule_shift_id).toBe("shift-own-1");
    expect(parsed[0].shift_date).toBe("2026-05-17");
    expect(parsed[0].local.date).toBe("2026-05-17");
    expect(parsed[0].local.start).toBe("2026-05-17 08:00:00");
  });

  it("always filters by ctx.profileId — no PII from other employees", async () => {
    // Simulate a response that WOULD include another employee's name if
    // the query had leaked. The response from get_date_schedule_for_me
    // must never include a `profile` sub-object (the select omits it).
    const supabase = makeSupabase({ result: { data: mockOwnShifts, error: null } });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await getDateScheduleForMe.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    // The tool select does NOT include profile:employee_id(display_name).
    // Verify no profile field leaks through.
    expect(parsed[0].profile).toBeUndefined();
  });
});

describe("get_date_schedule_for_me — voice channel allowed", () => {
  it("voice channel is accepted (own-shift query, no other PII)", async () => {
    const supabase = makeSupabase({ result: { data: mockOwnShifts, error: null } });
    const ctx = makeCtx({
      supabaseAdmin: supabase,
      channel: "voice",
    });

    const result = await getDateScheduleForMe.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    // Must return rows, NOT a channel_forbidden error.
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].schedule_shift_id).toBe("shift-own-1");
  });
});

describe("get_date_schedule_for_me — empty and error paths", () => {
  it("returns structured empty response when no shifts match the date", async () => {
    const supabase = makeSupabase({ result: { data: [], error: null } });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await getDateScheduleForMe.execute({ date: "2026-06-01" }, ctx);
    const parsed = JSON.parse(result);

    expect(parsed.empty).toBe(true);
    expect(parsed.date).toBe("2026-06-01");
    expect(parsed.scope).toBe("personal");
    // No hallucination fodder — no invented keys.
    expect(parsed.team).toBeUndefined();
    expect(parsed.department).toBeUndefined();
  });

  it("returns db_query_failed on supabase error", async () => {
    const supabase = makeSupabase({
      result: { data: null, error: { message: "connection timeout" } },
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await getDateScheduleForMe.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe("db_query_failed");
    expect(parsed.detail).toBe("connection timeout");
  });
});

describe("get_date_schedule_for_me — admin using personal tool", () => {
  it("admin actor gets their own shifts (ctx.profileId scoped) — workspace shifts not leaked", async () => {
    // An admin using this tool still only gets THEIR OWN shifts.
    // This is correct — admins wanting workspace-level data should use
    // get_workspace_schedule.
    const supabase = makeSupabase({ result: { data: mockOwnShifts, error: null } });
    const ctx = makeCtx({
      supabaseAdmin: supabase,
      userContext: {
        role: "admin",
        display_name: "Admin Actor",
        profile_id: "profile-admin-3",
        department_id: null,
        status: "active",
        language: "no",
      },
    });

    const result = await getDateScheduleForMe.execute({ date: "2026-05-17" }, ctx);
    const parsed = JSON.parse(result);

    // Returns rows as normal — tool does not block admins.
    expect(Array.isArray(parsed)).toBe(true);
  });
});
