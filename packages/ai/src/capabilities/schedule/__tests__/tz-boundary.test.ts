/**
 * G10 — TZ wrong-day boundary tests for schedule capability.
 *
 * Root cause: tools.ts used `new Date("YYYY-MM-DDT00:00:00+02:00").toLocaleDateString()`
 * which hard-codes the CEST offset (+02:00). During winter (CET = +01:00) the
 * constructed instant is 23:00 UTC of the previous calendar day, and the
 * Intl formatter returns the WRONG weekday.
 *
 * Fix (2026-05-25): osloWeekdayFromDateStr("YYYY-MM-DD") in oslo-time.ts
 * anchors to noon UTC (12:00Z) which is always within the correct Oslo
 * calendar day regardless of DST season, then delegates to osloWeekday()
 * (Intl.DateTimeFormat with timeZone:"Europe/Oslo").
 *
 * Convention documented here:
 *   weekday strings are LOWERCASE Norwegian ("tirsdag", "søndag") matching
 *   osloWeekday() output and how employees speak in Botsson chat.
 *
 * DST 2026:
 *   spring-forward: 2026-03-29 02:00 → 03:00 (clocks advance)
 *   fall-back:      2026-10-25 03:00 → 02:00 (clocks repeat)
 */

import { describe, it, expect } from "vitest";
import { osloWeekdayFromDateStr } from "../oslo-time.js";
import { getWorkspaceSchedule, getDateScheduleForMe, getMyShifts } from "../tools.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentToolContext, SessionChannel } from "../../types.js";
import { nonEmpty } from "@smartout/telemetry/server";
import { vi } from "vitest";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

type SelectResult = { data: unknown; error: unknown };

function makeQueryBuilder(result: SelectResult, calls: Record<string, unknown[]>) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = vi.fn((...args: unknown[]) => {
    calls.select = args;
    return self();
  });
  api.eq = vi.fn((col: string, val: unknown) => {
    calls[`eq:${col}`] = [val];
    return self();
  });
  api.neq = vi.fn(() => self());
  api.gte = vi.fn((col: string, val: unknown) => {
    calls[`gte:${col}`] = [val];
    return self();
  });
  api.lte = vi.fn((col: string, val: unknown) => {
    calls[`lte:${col}`] = [val];
    return self();
  });
  api.gt = vi.fn(() => self());
  api.lt = vi.fn(() => self());
  api.order = vi.fn(() => {
    const chainable = Promise.resolve(result) as Promise<SelectResult> & {
      order: (...args: unknown[]) => unknown;
    };
    chainable.order = vi.fn(() => Promise.resolve(result)) as unknown as (
      ...args: unknown[]
    ) => unknown;
    return chainable;
  });
  api.single = vi.fn(() => Promise.resolve(result));
  api.maybeSingle = vi.fn(() => Promise.resolve(result));
  (api as { then?: unknown }).then = undefined;
  return api;
}

function makeSupabase(
  resultByTable: Record<string, SelectResult>,
  calls: Record<string, unknown[]>,
): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      const r = resultByTable[table] ?? { data: null, error: null };
      return makeQueryBuilder(r, calls);
    }),
    rpc: vi.fn(),
  } as unknown as SupabaseClient;
}

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: nonEmpty("ws-tz", "workspaceId"),
    profileId: nonEmpty("profile-tz", "profileId"),
    sessionId: "sess-tz",
    channel: "chat" as SessionChannel,
    supabaseAdmin: {} as SupabaseClient,
    userContext: {
      profile_id: "profile-tz",
      role: "manager" as const,
      status: "active" as const,
      department_id: null,
      display_name: "Test Manager",
      language: "no" as const,
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Unit: osloWeekdayFromDateStr — the primitive the tools delegate to
// ─────────────────────────────────────────────────────────────

describe("osloWeekdayFromDateStr — weekday string correctness", () => {
  it("2026-06-23 (Tuesday in NO) → tirsdag", () => {
    // The original G10 failing case: summer CEST.
    // new Date("2026-06-23T00:00:00+02:00") = 2026-06-22T22:00:00Z (Monday in UTC).
    // Intl with no TZ pin saw UTC day → returned "mandag". WRONG.
    // Fix: noon UTC = 2026-06-23T12:00:00Z = Tuesday 14:00 Oslo. Correct.
    expect(osloWeekdayFromDateStr("2026-06-23")).toBe("tirsdag");
  });

  it("2026-06-22 (Monday in NO) → mandag", () => {
    expect(osloWeekdayFromDateStr("2026-06-22")).toBe("mandag");
  });

  it("2026-01-05 (Monday in CET winter) → mandag", () => {
    // Winter: CET = UTC+1. new Date("2026-01-05T00:00:00+02:00") = 2026-01-04T22:00Z.
    // That's SUNDAY in UTC — broken for the old +02:00 form.
    // Fix: noon UTC = 2026-01-05T12:00:00Z = 13:00 CET = Monday. Correct.
    expect(osloWeekdayFromDateStr("2026-01-05")).toBe("mandag");
  });

  it("2026-03-29 (Sunday — DST spring-forward) → søndag", () => {
    // On spring-forward day clocks advance 02:00 → 03:00. Date is still Sunday.
    // Noon UTC (12:00Z) = 14:00 CEST (post-forward). Correct calendar day: Sunday.
    expect(osloWeekdayFromDateStr("2026-03-29")).toBe("søndag");
  });

  it("2026-03-28 (Saturday before spring-forward) → lørdag", () => {
    // Pre-jump: still CET (UTC+1). Noon UTC = 13:00 CET Saturday. Correct.
    expect(osloWeekdayFromDateStr("2026-03-28")).toBe("lørdag");
  });

  it("2026-10-25 (Sunday — DST fall-back) → søndag", () => {
    // On fall-back day clocks repeat 03:00 → 02:00. Date is still Sunday.
    // Noon UTC (12:00Z): before fall-back (03:00 CEST = 01:00 UTC) → noon UTC
    // is 14:00 CEST. After fall-back noon UTC = 13:00 CET. Either way: Sunday.
    expect(osloWeekdayFromDateStr("2026-10-25")).toBe("søndag");
  });

  it("2026-10-26 (Monday after fall-back) → mandag", () => {
    // Post-fall-back: CET (UTC+1). Noon UTC = 13:00 CET Monday. Correct.
    expect(osloWeekdayFromDateStr("2026-10-26")).toBe("mandag");
  });
});

// ─────────────────────────────────────────────────────────────
// Integration: getWorkspaceSchedule — local.weekday in enriched rows
// ─────────────────────────────────────────────────────────────

describe("getWorkspaceSchedule — local.weekday DST correctness", () => {
  it("shift_date 2026-06-23 → local.weekday tirsdag (G10 primary case, summer CEST)", async () => {
    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: [
            {
              schedule_shift_id: "aaaa-0001",
              shift_date: "2026-06-23", // Tuesday NO
              start_time: "08:00:00",
              end_time: "16:00:00",
              role: "bartender",
              status: "confirmed",
              department: { name: "Bar" },
              location: { name: "Strøm" },
              profile: { display_name: "Ola Normann" },
            },
          ],
          error: null,
        },
      },
      calls,
    );

    const result = await getWorkspaceSchedule.execute(
      { date: "2026-06-23" },
      makeCtx({ supabaseAdmin: supabase }),
    );
    const rows = JSON.parse(result) as Array<{ local: { weekday: string } }>;
    expect(rows).toHaveLength(1);
    // Must be tirsdag, NOT mandag (the pre-fix bug).
    expect(rows[0]?.local.weekday).toBe("tirsdag");
  });

  it("shift_date 2026-01-05 (Monday, CET winter) → local.weekday mandag", async () => {
    // The +02:00 hardcode was off by 1h in winter → could flip the weekday.
    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: [
            {
              schedule_shift_id: "aaaa-0002",
              shift_date: "2026-01-05",
              start_time: "07:00:00",
              end_time: "15:00:00",
              role: "kokk",
              status: "confirmed",
              department: { name: "Kjøkken" },
              location: null,
              profile: { display_name: "Kari Hansen" },
            },
          ],
          error: null,
        },
      },
      calls,
    );

    const result = await getWorkspaceSchedule.execute(
      { date: "2026-01-05" },
      makeCtx({ supabaseAdmin: supabase }),
    );
    const rows = JSON.parse(result) as Array<{ local: { weekday: string } }>;
    expect(rows[0]?.local.weekday).toBe("mandag");
  });

  it("shift_date 2026-03-29 (Sunday, spring-forward) → local.weekday søndag", async () => {
    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: [
            {
              schedule_shift_id: "aaaa-0003",
              shift_date: "2026-03-29",
              start_time: "10:00:00",
              end_time: "18:00:00",
              role: "servitør",
              status: "confirmed",
              department: { name: "Sal" },
              location: null,
              profile: { display_name: "Per Svensson" },
            },
          ],
          error: null,
        },
      },
      calls,
    );

    const result = await getWorkspaceSchedule.execute(
      { date: "2026-03-29" },
      makeCtx({ supabaseAdmin: supabase }),
    );
    const rows = JSON.parse(result) as Array<{ local: { weekday: string } }>;
    expect(rows[0]?.local.weekday).toBe("søndag");
  });

  it("shift_date 2026-10-25 (Sunday, fall-back) → local.weekday søndag", async () => {
    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: [
            {
              schedule_shift_id: "aaaa-0004",
              shift_date: "2026-10-25",
              start_time: "12:00:00",
              end_time: "20:00:00",
              role: "bartender",
              status: "confirmed",
              department: { name: "Bar" },
              location: null,
              profile: { display_name: "Anne Dahl" },
            },
          ],
          error: null,
        },
      },
      calls,
    );

    const result = await getWorkspaceSchedule.execute(
      { date: "2026-10-25" },
      makeCtx({ supabaseAdmin: supabase }),
    );
    const rows = JSON.parse(result) as Array<{ local: { weekday: string } }>;
    expect(rows[0]?.local.weekday).toBe("søndag");
  });
});

// ─────────────────────────────────────────────────────────────
// Integration: getDateScheduleForMe — local.weekday in enriched rows
// ─────────────────────────────────────────────────────────────

describe("getDateScheduleForMe — local.weekday DST correctness", () => {
  it("shift_date 2026-06-23 → local.weekday tirsdag (G10 primary case)", async () => {
    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: [
            {
              schedule_shift_id: "bbbb-0001",
              shift_date: "2026-06-23",
              start_time: "14:00:00",
              end_time: "22:00:00",
              role: "bartender",
              status: "confirmed",
              department: { name: "Bar" },
              location: { name: "Strøm" },
            },
          ],
          error: null,
        },
      },
      calls,
    );

    const result = await getDateScheduleForMe.execute(
      { date: "2026-06-23" },
      makeCtx({ supabaseAdmin: supabase }),
    );
    const rows = JSON.parse(result) as Array<{ local: { weekday: string } }>;
    expect(rows[0]?.local.weekday).toBe("tirsdag");
  });

  it("shift_date 2026-03-29 (spring-forward Sunday) → local.weekday søndag", async () => {
    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: [
            {
              schedule_shift_id: "bbbb-0002",
              shift_date: "2026-03-29",
              start_time: "09:00:00",
              end_time: "17:00:00",
              role: "kokk",
              status: "confirmed",
              department: { name: "Kjøkken" },
              location: null,
            },
          ],
          error: null,
        },
      },
      calls,
    );

    const result = await getDateScheduleForMe.execute(
      { date: "2026-03-29" },
      makeCtx({ supabaseAdmin: supabase }),
    );
    const rows = JSON.parse(result) as Array<{ local: { weekday: string } }>;
    expect(rows[0]?.local.weekday).toBe("søndag");
  });

  it("shift_date 2026-10-25 (fall-back Sunday) → local.weekday søndag", async () => {
    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: [
            {
              schedule_shift_id: "bbbb-0003",
              shift_date: "2026-10-25",
              start_time: "06:00:00",
              end_time: "14:00:00",
              role: "servitør",
              status: "confirmed",
              department: { name: "Sal" },
              location: null,
            },
          ],
          error: null,
        },
      },
      calls,
    );

    const result = await getDateScheduleForMe.execute(
      { date: "2026-10-25" },
      makeCtx({ supabaseAdmin: supabase }),
    );
    const rows = JSON.parse(result) as Array<{ local: { weekday: string } }>;
    expect(rows[0]?.local.weekday).toBe("søndag");
  });
});

// ─────────────────────────────────────────────────────────────
// Integration: getMyShifts — local.weekday in enriched rows
// ─────────────────────────────────────────────────────────────

describe("getMyShifts — local.weekday DST correctness", () => {
  it("shift_date 2026-06-23 → local.weekday tirsdag", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T08:00:00Z"));

    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: [
            {
              schedule_shift_id: "cccc-0001",
              shift_date: "2026-06-23",
              start_time: "14:00:00",
              end_time: "22:00:00",
              role: "bartender",
              status: "confirmed",
              department: { name: "Bar" },
              location: null,
            },
          ],
          error: null,
        },
      },
      calls,
    );

    const result = await getMyShifts.execute({ days: 7 }, makeCtx({ supabaseAdmin: supabase }));
    const rows = JSON.parse(result) as Array<{ local: { weekday: string } }>;
    expect(rows[0]?.local.weekday).toBe("tirsdag");

    vi.useRealTimers();
  });

  it("shift_date 2026-01-05 (winter CET Monday) → local.weekday mandag", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T08:00:00Z"));

    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: [
            {
              schedule_shift_id: "cccc-0002",
              shift_date: "2026-01-05",
              start_time: "07:00:00",
              end_time: "15:00:00",
              role: "kokk",
              status: "confirmed",
              department: { name: "Kjøkken" },
              location: null,
            },
          ],
          error: null,
        },
      },
      calls,
    );

    const result = await getMyShifts.execute({ days: 7 }, makeCtx({ supabaseAdmin: supabase }));
    const rows = JSON.parse(result) as Array<{ local: { weekday: string } }>;
    expect(rows[0]?.local.weekday).toBe("mandag");

    vi.useRealTimers();
  });
});
