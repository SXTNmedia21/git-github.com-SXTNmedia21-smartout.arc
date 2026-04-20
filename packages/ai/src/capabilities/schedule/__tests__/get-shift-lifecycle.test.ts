/**
 * Vitest coverage for get_shift_lifecycle (WS-A5).
 *
 * Verifies:
 *   1. Returns a populated payload when v_shift_lifecycle has the row.
 *   2. Returns { found: false } when the row does not exist.
 *   3. Never exposes gross_cost — employee-safe by design.
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getShiftLifecycle } from "../tools/get-shift-lifecycle.js";
import type { AgentToolContext, SessionChannel } from "../../types.js";

function makeSupabase(opts: { result: { data: unknown; error: unknown } }): SupabaseClient {
  const builder = () => {
    const api: Record<string, unknown> = {};
    const self = () => api;
    api.select = vi.fn(() => self());
    api.eq = vi.fn(() => self());
    api.maybeSingle = vi.fn(async () => opts.result);
    return api;
  };
  return {
    from: vi.fn(() => builder()),
    rpc: vi.fn(),
  } as unknown as SupabaseClient;
}

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: "ws-1",
    profileId: "profile-1",
    sessionId: "sess-1",
    channel: "chat" as SessionChannel,
    supabaseAdmin: {} as SupabaseClient,
    ...overrides,
  };
}

describe("get_shift_lifecycle", () => {
  it("returns the projected row when the shift exists", async () => {
    const supabase = makeSupabase({
      result: {
        data: {
          shift_id: "11111111-1111-1111-1111-111111111111",
          phase: "pagar",
          scheduled_hours: 8,
          interpreted_hours: null,
          approved_hours: null,
          last_punch_in: "2026-04-15T09:00:00Z",
          last_punch_out: null,
          has_deviation: false,
          has_blocking_deviation: false,
        },
        error: null,
      },
    });

    const result = await getShiftLifecycle.execute(
      { shift_id: "11111111-1111-1111-1111-111111111111" },
      makeCtx({ supabaseAdmin: supabase }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.found).toBe(true);
    expect(parsed.phase).toBe("pagar");
    expect(parsed.phase_label).toBe("Pågår");
    expect(parsed.scheduled_hours).toBe(8);
    expect(parsed.last_punch_in).toBe("2026-04-15T09:00:00Z");
    // Employee-safe: gross_cost must never appear in the payload.
    expect(parsed.gross_cost).toBeUndefined();
  });

  it("returns { found: false } when no row matches", async () => {
    const supabase = makeSupabase({
      result: { data: null, error: null },
    });

    const result = await getShiftLifecycle.execute(
      { shift_id: "11111111-1111-1111-1111-111111111111" },
      makeCtx({ supabaseAdmin: supabase }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.found).toBe(false);
  });
});
