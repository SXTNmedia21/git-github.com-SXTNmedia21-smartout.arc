/**
 * packages/ai/src/capabilities/shift_marketplace/__tests__/tools.test.ts
 *
 * Vitest unit tests for shift_marketplace capability tools.
 * 12 tests: 3 per tool (happy + auth-fail + state-precondition).
 *
 * Pattern:
 *   - Supabase admin client is mocked at the from().select/insert/update level.
 *   - mutateWithGate is mocked to isolate gate evaluation from DB writes.
 *   - eligibilityFor is real (pure TS) — not mocked.
 *
 * ADR-0099: gate always checked before mutation.
 * ADR-0288: voice channel returns chat-only message for claim + approve_claim + post_open.
 * ADR-0134: emit() called once per successful mutation.
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from "vitest";
import type { AgentToolContext } from "../../types.js";

// ── Mock @smartout/telemetry ─────────────────────────────────────────────────
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

// ── Mock mutateWithGate ──────────────────────────────────────────────────────
vi.mock("../../_shared/mutate-with-gate.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../_shared/mutate-with-gate.js")>();
  return {
    ...original,
    mutateWithGate: vi.fn(),
  };
});

import { emit } from "@smartout/telemetry";
import { mutateWithGate, MutateWithGateDenied } from "../../_shared/mutate-with-gate.js";
import { listOpenOffers, postOpen, claim, approveClaim, cancelOffer } from "../tools.js";

// ── Typed mocks ──────────────────────────────────────────────────────────────
const mockEmit = emit as unknown as MockInstance;
const mockMutateWithGate = mutateWithGate as unknown as MockInstance;

// ── Shared test context ──────────────────────────────────────────────────────
const WORKSPACE_ID = "b0000000-0000-0000-0000-000000000001";
const PROFILE_ID = "f0000000-0000-0000-0000-000000000001";
const OFFER_ID = "00000000-0000-0000-0000-000000000111";
const SHIFT_ID = "00000000-0000-0000-0000-000000000222";

function makeCtx(overrides?: Partial<AgentToolContext>): AgentToolContext {
  return {
    workspaceId: WORKSPACE_ID as unknown as AgentToolContext["workspaceId"],
    profileId: PROFILE_ID as unknown as AgentToolContext["profileId"],
    sessionId: "test-session",
    channel: "chat",
    supabaseAdmin: makeMockSupabase(),
    ...overrides,
  } as AgentToolContext;
}

/** Minimal chainable Supabase mock. Override per test by replacing supabaseAdmin. */
function makeMockSupabase(opts?: {
  selectData?: unknown;
  selectError?: { message: string };
  insertData?: unknown;
  insertError?: { message: string };
  updateError?: { message: string };
}) {
  const single = vi.fn().mockResolvedValue({
    data: opts?.selectData ?? null,
    error: opts?.selectError ?? null,
  });

  const select = vi.fn().mockReturnValue({ eq: chainEq(single), in: chainIn(single), single });
  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: opts?.insertData ?? { schedule_shift_offer_id: OFFER_ID },
        error: opts?.insertError ?? null,
      }),
    }),
  });
  const update = vi.fn().mockReturnValue({
    eq: chainEq({ error: opts?.updateError ?? null }),
    in: chainIn({ error: opts?.updateError ?? null }),
  });

  return {
    from: vi.fn().mockReturnValue({ select, insert, update }),
  } as unknown as AgentToolContext["supabaseAdmin"];
}

/** Chain helper: eq().eq().eq()...single() or resolve result directly. */
function chainEq(terminal: unknown) {
  const chain: Record<string, unknown> = {};
  const eq = vi.fn().mockReturnValue(
    new Proxy(chain, {
      get(_t, prop) {
        if (prop === "eq") return eq;
        if (prop === "in") return chainIn(terminal);
        if (prop === "single")
          return typeof terminal === "function" ? terminal : vi.fn().mockResolvedValue(terminal);
        if (prop === "order")
          return vi
            .fn()
            .mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) });
        if (prop === "limit") return vi.fn().mockResolvedValue({ data: [], error: null });
        return vi.fn().mockReturnValue(chain);
      },
    }),
  );
  return eq;
}

function chainIn(terminal: unknown) {
  return vi.fn().mockReturnValue({
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    eq: chainEq(terminal),
    single: typeof terminal === "function" ? terminal : vi.fn().mockResolvedValue(terminal),
  });
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: mutateWithGate succeeds and calls exec.
  mockMutateWithGate.mockImplementation(
    async (
      _client: unknown,
      args: { exec: (db: unknown) => Promise<unknown>; workspaceId: string; profileId: string },
    ) => {
      const result = await args.exec(_client);
      return { ok: true, result, gateEvaluationId: "gate-eval-1", correlationId: "corr-1" };
    },
  );
});

// ── listOpenOffers ───────────────────────────────────────────────────────────

describe("listOpenOffers", () => {
  it("happy: returns open offers as JSON", async () => {
    const offers = [
      {
        schedule_shift_offer_id: OFFER_ID,
        shift_id: SHIFT_ID,
        status: "open",
        posted_at: "2026-06-15T08:00:00Z",
        expires_at: null,
        posted_by_profile_id: PROFILE_ID,
        claimed_by_profile_id: null,
        claimed_at: null,
      },
    ];

    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: offers, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await listOpenOffers.execute(
      { status_filter: "open", limit: 20 },
      makeCtx({ supabaseAdmin }),
    );
    const parsed = JSON.parse(result as string);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].schedule_shift_offer_id).toBe(OFFER_ID);
  });

  it("empty state: returns Norwegian empty message", async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await listOpenOffers.execute(
      { status_filter: "open", limit: 20 },
      makeCtx({ supabaseAdmin }),
    );
    expect(result).toBe("Ingen åpne vakt-tilbud funnet.");
  });

  it("db error: returns error message", async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: { message: "connection refused" } }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await listOpenOffers.execute(
      { status_filter: "open", limit: 20 },
      makeCtx({ supabaseAdmin }),
    );
    expect(result).toContain("Feil ved henting av tilbud");
  });
});

// ── postOpen ─────────────────────────────────────────────────────────────────

describe("postOpen", () => {
  it("happy: posts offer and emits shift_offer.posted", async () => {
    // Shift lookup returns valid shift.
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { schedule_shift_id: SHIFT_ID, workspace_id: WORKSPACE_ID },
                error: null,
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: { schedule_shift_offer_id: OFFER_ID }, error: null }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await postOpen.execute({ shift_id: SHIFT_ID }, makeCtx({ supabaseAdmin }));
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.offer_id).toBe(OFFER_ID);
    expect(mockEmit).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_offer.posted" });
  });

  it("voice channel: rejects with chat-only message", async () => {
    const result = await postOpen.execute({ shift_id: SHIFT_ID }, makeCtx({ channel: "voice" }));
    expect(result).toContain("chat");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });

  it("authority denied: returns ok:false JSON", async () => {
    // Shift lookup OK.
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { schedule_shift_id: SHIFT_ID, workspace_id: WORKSPACE_ID },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    mockMutateWithGate.mockRejectedValueOnce(
      new MutateWithGateDenied({ deniedBy: "capability", reason: "Role manager required" }),
    );

    const result = await postOpen.execute({ shift_id: SHIFT_ID }, makeCtx({ supabaseAdmin }));
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("authority_denied");
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ── claim ─────────────────────────────────────────────────────────────────────

describe("claim", () => {
  const validEligibilityContext = {
    existing_shifts: [],
    absences: [],
    framework_rules: [
      { rule_type: "aml_daily_max_hours" as const, value_hours: 9 },
      { rule_type: "aml_weekly_max_hours" as const, value_hours: 40 },
    ],
    active_contract: {
      contract_id: "c1",
      start_date: "2025-01-01",
      end_date: null,
      status: "active",
    },
    profile: {
      profile_id: PROFILE_ID,
      competent_roles: ["server"],
      workspace_id: WORKSPACE_ID,
      employment_status: "active",
    },
  };

  it("happy: claims offer and emits shift_offer.claimed", async () => {
    // Offer load: status='open'.
    // Shift load: role='server', shift_date='2026-06-20', start_time='18:00', end_time='23:00', work_hours=5.
    let callCount = 0;
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                  // offer lookup
                  return Promise.resolve({
                    data: {
                      schedule_shift_offer_id: OFFER_ID,
                      status: "open",
                      shift_id: SHIFT_ID,
                      workspace_id: WORKSPACE_ID,
                    },
                    error: null,
                  });
                }
                // shift lookup
                return Promise.resolve({
                  data: {
                    schedule_shift_id: SHIFT_ID,
                    role: "server",
                    shift_date: "2026-06-20",
                    start_time: "18:00:00",
                    end_time: "23:00:00",
                    work_hours: 5,
                  },
                  error: null,
                });
              }),
            }),
          }),
        })),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await claim.execute(
      { offer_id: OFFER_ID, eligibility_context: validEligibilityContext },
      makeCtx({ supabaseAdmin }),
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(mockEmit).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_offer.claimed" });
  });

  it("voice channel: rejects with chat-only message", async () => {
    const result = await claim.execute(
      { offer_id: OFFER_ID, eligibility_context: validEligibilityContext },
      makeCtx({ channel: "voice" }),
    );
    expect(result).toContain("chat");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });

  it("offer already claimed: returns state-precondition error", async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  schedule_shift_offer_id: OFFER_ID,
                  status: "claimed",
                  shift_id: SHIFT_ID,
                  workspace_id: WORKSPACE_ID,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await claim.execute(
      { offer_id: OFFER_ID, eligibility_context: validEligibilityContext },
      makeCtx({ supabaseAdmin }),
    );
    expect(result).toContain("claimed");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});

// ── approveClaim ──────────────────────────────────────────────────────────────

describe("approveClaim", () => {
  it("happy: approves claim, updates shift, emits shift_offer.approved", async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  schedule_shift_offer_id: OFFER_ID,
                  status: "claimed",
                  shift_id: SHIFT_ID,
                  workspace_id: WORKSPACE_ID,
                  claimed_by_profile_id: "emp-profile-001",
                },
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await approveClaim.execute({ offer_id: OFFER_ID }, makeCtx({ supabaseAdmin }));
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.assigned_to).toBe("emp-profile-001");
    expect(mockEmit).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_offer.approved" });
  });

  it("voice channel: rejects with chat-only message", async () => {
    const result = await approveClaim.execute(
      { offer_id: OFFER_ID },
      makeCtx({ channel: "voice" }),
    );
    expect(result).toContain("chat");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });

  it("offer not in claimed state: returns state-precondition error", async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  schedule_shift_offer_id: OFFER_ID,
                  status: "open", // not claimed
                  shift_id: SHIFT_ID,
                  workspace_id: WORKSPACE_ID,
                  claimed_by_profile_id: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await approveClaim.execute({ offer_id: OFFER_ID }, makeCtx({ supabaseAdmin }));
    expect(result).toContain("open");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});

// ── cancelOffer ───────────────────────────────────────────────────────────────

describe("cancelOffer", () => {
  it("happy: cancels offer and emits shift_offer.cancelled", async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  schedule_shift_offer_id: OFFER_ID,
                  status: "open",
                  workspace_id: WORKSPACE_ID,
                  posted_by_profile_id: PROFILE_ID,
                  shift_id: SHIFT_ID,
                },
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await cancelOffer.execute(
      { offer_id: OFFER_ID, reason: "Vakten er fylt opp manuelt" },
      makeCtx({ supabaseAdmin }),
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(mockEmit).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_offer.cancelled" });
  });

  it("authority denied: returns ok:false JSON", async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  schedule_shift_offer_id: OFFER_ID,
                  status: "open",
                  workspace_id: WORKSPACE_ID,
                  posted_by_profile_id: "other-profile",
                  shift_id: SHIFT_ID,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    mockMutateWithGate.mockRejectedValueOnce(
      new MutateWithGateDenied({ deniedBy: "capability", reason: "Only poster can cancel" }),
    );

    const result = await cancelOffer.execute(
      { offer_id: OFFER_ID, reason: "Test avbryting" },
      makeCtx({ supabaseAdmin }),
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("authority_denied");
  });

  it("approved offer: returns state-precondition error", async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  schedule_shift_offer_id: OFFER_ID,
                  status: "approved", // cannot cancel
                  workspace_id: WORKSPACE_ID,
                  posted_by_profile_id: PROFILE_ID,
                  shift_id: SHIFT_ID,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await cancelOffer.execute(
      { offer_id: OFFER_ID, reason: "Test avbryting" },
      makeCtx({ supabaseAdmin }),
    );
    expect(result).toContain("approved");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});
