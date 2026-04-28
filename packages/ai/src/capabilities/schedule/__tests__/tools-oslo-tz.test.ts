/**
 * D2 — wrong-day bug: tz-boundary coverage for schedule capability tools.
 *
 * These tests are falsifiable per ADR-0196 Invariant 12:
 *   - "Friday 22:00 Oslo stays Fredag" is a deterministic assertion:
 *     given a TIMESTAMPTZ stored as 20:00Z on 2026-05-22, the capability
 *     output MUST say "fredag" and "22:00", not "lørdag" / "00:00".
 *   - DST edges (last Sun March, last Sun October) are exercised with
 *     real 2026 transition dates (2026-03-29 and 2026-10-25).
 *   - `getTodaySchedule`'s Oslo day-boundary query is validated by
 *     inspecting the ISO strings passed to supabase.gte/lte.
 *
 * The tests pin `now` via vi.useFakeTimers() so the suite is deterministic
 * across CI timezones and DST seasons.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nonEmpty } from "@smartout/telemetry/server";

import { getMyShifts, getTodaySchedule, getShiftDetail } from "../tools.js";
import {
  startOfOsloDay,
  endOfOsloDay,
  osloWeekday,
  osloClock,
  osloDateISO,
  enrichShiftRowWithOsloTime,
} from "../oslo-time.js";
import type { AgentToolContext, SessionChannel } from "../../types.js";

// ---------- Test doubles ----------

type SelectResult = { data: unknown; error: unknown };

/**
 * Builder-style mock that records every .gte/.lte/.eq call so we can
 * assert on the date boundaries passed to Supabase. `.single()` and the
 * thenable resolution both return the same configured result.
 */
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
  api.order = vi.fn(() => Promise.resolve(result));
  api.single = vi.fn(() => Promise.resolve(result));
  api.maybeSingle = vi.fn(() => Promise.resolve(result));
  // Allow await on the builder itself (Supabase chain is thenable).
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
    workspaceId: nonEmpty("ws-1", "workspaceId"),
    profileId: nonEmpty("profile-1", "profileId"),
    sessionId: "sess-1",
    channel: "chat" as SessionChannel,
    supabaseAdmin: {} as SupabaseClient,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

// ---------- oslo-time primitives ----------

describe("oslo-time primitives", () => {
  it("osloWeekday returns Norwegian lowercase weekday for an instant", () => {
    // 2026-05-22 20:00Z = fredag 22:00 Europe/Oslo (CEST, UTC+2)
    const instant = new Date("2026-05-22T20:00:00Z");
    expect(osloWeekday(instant)).toBe("fredag");
    expect(osloClock(instant)).toBe("22:00");
    expect(osloDateISO(instant)).toBe("2026-05-22");
  });

  it("osloWeekday switches to lørdag only AFTER local midnight in Oslo", () => {
    // 2026-05-22 21:59Z = fredag 23:59 Oslo — still fredag.
    const lateFriday = new Date("2026-05-22T21:59:00Z");
    expect(osloWeekday(lateFriday)).toBe("fredag");

    // 2026-05-22 22:00Z = lørdag 00:00 Oslo — now lørdag.
    const midnightSat = new Date("2026-05-22T22:00:00Z");
    expect(osloWeekday(midnightSat)).toBe("lørdag");
  });

  it("startOfOsloDay lands at 00:00 Oslo regardless of DST", () => {
    // Summer (CEST, UTC+2): Oslo 00:00 = 22:00Z previous day.
    const summerNow = new Date("2026-05-22T20:00:00Z"); // Fredag 22:00 Oslo
    const summerStart = startOfOsloDay(summerNow);
    expect(summerStart.toISOString()).toBe("2026-05-21T22:00:00.000Z");
    expect(osloWeekday(summerStart)).toBe("fredag");
    expect(osloClock(summerStart)).toBe("00:00");

    // Winter (CET, UTC+1): Oslo 00:00 = 23:00Z previous day.
    const winterNow = new Date("2026-12-05T10:00:00Z");
    const winterStart = startOfOsloDay(winterNow);
    expect(winterStart.toISOString()).toBe("2026-12-04T23:00:00.000Z");
    expect(osloWeekday(winterStart)).toBe("lørdag");
    expect(osloClock(winterStart)).toBe("00:00");
  });

  it("startOfOsloDay handles the DST spring-forward day (2026-03-29)", () => {
    // On 2026-03-29, Oslo jumps 02:00 → 03:00. Midnight is unaffected;
    // 00:00 Oslo = 23:00Z on 2026-03-28 (still CET before the jump).
    const instant = new Date("2026-03-29T12:00:00Z");
    const start = startOfOsloDay(instant);
    expect(start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(osloClock(start)).toBe("00:00");
    expect(osloDateISO(start)).toBe("2026-03-29");
  });

  it("startOfOsloDay handles the DST fall-back day (2026-10-25)", () => {
    // On 2026-10-25, Oslo falls 03:00 → 02:00. Midnight Oslo = 22:00Z
    // on 2026-10-24 (still CEST before the fall-back).
    const instant = new Date("2026-10-25T12:00:00Z");
    const start = startOfOsloDay(instant);
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(osloClock(start)).toBe("00:00");
    expect(osloDateISO(start)).toBe("2026-10-25");
  });

  it("endOfOsloDay is exactly 1ms before next day start", () => {
    const instant = new Date("2026-05-22T20:00:00Z");
    const start = startOfOsloDay(instant);
    const end = endOfOsloDay(instant);
    // Next Oslo day starts at 22:00Z (CEST).
    // End of current Oslo day is 21:59:59.999Z next UTC day.
    expect(end.toISOString()).toBe("2026-05-22T21:59:59.999Z");
    expect(end.getTime() - start.getTime()).toBe(86_400_000 - 1);
  });

  it("enrichShiftRowWithOsloTime adds Oslo weekday + clock alongside UTC ISO", () => {
    const row = {
      id: "abc",
      start_time: "2026-05-22T20:00:00Z", // fredag 22:00 Oslo
      end_time: "2026-05-23T00:00:00Z", // lørdag 02:00 Oslo
    };
    const enriched = enrichShiftRowWithOsloTime(row);
    expect(enriched.start_time).toBe("2026-05-22T20:00:00Z"); // UTC preserved
    expect(enriched.local.start_weekday).toBe("fredag");
    expect(enriched.local.start_time).toBe("22:00");
    expect(enriched.local.start_date).toBe("2026-05-22");
    expect(enriched.local.end_weekday).toBe("lørdag");
    expect(enriched.local.end_time).toBe("02:00");
    expect(enriched.local.tz).toBe("Europe/Oslo");
  });
});

// ---------- getMyShifts ----------

describe("getMyShifts — Oslo tz enrichment", () => {
  it("decorates every shift row with Norwegian weekday + local clock", async () => {
    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: [
            {
              id: "shift-1",
              start_time: "2026-05-22T20:00:00Z", // fredag 22:00 Oslo
              end_time: "2026-05-23T00:00:00Z", // lørdag 02:00 Oslo
              position: "bartender",
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

    const result = await getMyShifts.execute({ days: 7 }, makeCtx({ supabaseAdmin: supabase }));
    const parsed = JSON.parse(result) as Array<{
      start_time: string;
      local: { start_weekday: string; start_time: string };
    }>;

    expect(parsed).toHaveLength(1);
    const row = parsed[0];
    if (!row) throw new Error("expected one row");
    // Raw UTC preserved.
    expect(row.start_time).toBe("2026-05-22T20:00:00Z");
    // Oslo-localized — the bug was that the LLM got only UTC and said
    // "lørdag". With `local` present, it quotes fredag verbatim.
    expect(row.local.start_weekday).toBe("fredag");
    expect(row.local.start_time).toBe("22:00");
  });
});

// ---------- getTodaySchedule — the canonical bug site ----------

describe("getTodaySchedule — Oslo day boundary", () => {
  it("queries Oslo day boundaries, not server-local day boundaries", async () => {
    // Pin `now` to 2026-05-22 22:30Z = lørdag 00:30 Europe/Oslo.
    // OLD BUG: setHours(0) on UTC server = 00:00Z = fredag 02:00 Oslo,
    // and the `gte`/`lte` window would include Fridag's 22:00 shift,
    // which is technically yesterday in Oslo.
    // NEW: Oslo day = lørdag, so today-start = 22:00Z on 2026-05-22.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22T22:30:00Z"));

    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        profile: { data: { department_id: "dept-1" }, error: null },
        schedule_shift: { data: [], error: null },
      },
      calls,
    );

    await getTodaySchedule.execute({}, makeCtx({ supabaseAdmin: supabase }));

    const gteStart = (calls["gte:start_time"]?.[0] ?? "") as string;
    const lteStart = (calls["lte:start_time"]?.[0] ?? "") as string;

    // Oslo "today" at 00:30 Oslo lørdag is the full Saturday:
    //   start = 2026-05-22T22:00:00Z (lørdag 00:00 Oslo)
    //   end   = 2026-05-23T21:59:59.999Z (lørdag 23:59:59.999 Oslo)
    expect(gteStart).toBe("2026-05-22T22:00:00.000Z");
    expect(lteStart).toBe("2026-05-23T21:59:59.999Z");
  });

  it("uses Oslo day even when server is in UTC and wall-clock just crossed midnight Oslo", async () => {
    // Winter: pin `now` to 2026-12-05 23:30Z = lørdag 00:30 Oslo (CET, UTC+1).
    // The OLD bug: UTC "today" = 2026-12-05 00:00Z–23:59Z. At 23:30Z UTC
    // the server is still in "fredag" in UTC terms, even though Oslo is
    // already lørdag. Without tz fix, getTodaySchedule would return
    // Friday's shifts when the user asks "what's on today?"
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-05T23:30:00Z"));

    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        profile: { data: { department_id: "dept-1" }, error: null },
        schedule_shift: { data: [], error: null },
      },
      calls,
    );

    await getTodaySchedule.execute({}, makeCtx({ supabaseAdmin: supabase }));

    const gteStart = (calls["gte:start_time"]?.[0] ?? "") as string;
    const lteStart = (calls["lte:start_time"]?.[0] ?? "") as string;

    // Oslo day 2026-12-06 = lørdag 00:00 Oslo = 2026-12-05T23:00Z to
    // 2026-12-06T22:59:59.999Z.
    expect(gteStart).toBe("2026-12-05T23:00:00.000Z");
    expect(lteStart).toBe("2026-12-06T22:59:59.999Z");
  });

  it("decorates today's shifts with Oslo weekday", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22T10:00:00Z")); // fredag 12:00 Oslo

    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        profile: { data: { department_id: "dept-1" }, error: null },
        schedule_shift: {
          data: [
            {
              id: "shift-1",
              start_time: "2026-05-22T20:00:00Z", // fredag 22:00 Oslo
              end_time: "2026-05-23T00:00:00Z",
              position: "kokk",
              status: "confirmed",
              profile: { display_name: "Ola" },
            },
          ],
          error: null,
        },
      },
      calls,
    );

    const result = await getTodaySchedule.execute({}, makeCtx({ supabaseAdmin: supabase }));
    const parsed = JSON.parse(result) as Array<{
      local: { start_weekday: string; start_time: string };
    }>;

    const row = parsed[0];
    if (!row) throw new Error("expected one row");
    expect(row.local.start_weekday).toBe("fredag");
    expect(row.local.start_time).toBe("22:00");
  });
});

// ---------- getShiftDetail ----------

describe("getShiftDetail — Oslo tz enrichment", () => {
  it("enriches the single-shift response with Oslo weekday", async () => {
    const calls: Record<string, unknown[]> = {};
    const supabase = makeSupabase(
      {
        schedule_shift: {
          data: {
            id: "shift-1",
            start_time: "2026-05-22T20:00:00Z", // fredag 22:00 Oslo
            end_time: "2026-05-23T00:00:00Z",
            position: "bartender",
            status: "confirmed",
            department: { name: "Bar" },
            location: { name: "Strøm" },
            profile: { display_name: "Ola" },
            notes: null,
          },
          error: null,
        },
      },
      calls,
    );

    const result = await getShiftDetail.execute(
      { shift_id: "11111111-1111-1111-1111-111111111111" },
      makeCtx({ supabaseAdmin: supabase }),
    );
    const parsed = JSON.parse(result) as {
      local: { start_weekday: string; start_time: string };
    };

    expect(parsed.local.start_weekday).toBe("fredag");
    expect(parsed.local.start_time).toBe("22:00");
  });
});
