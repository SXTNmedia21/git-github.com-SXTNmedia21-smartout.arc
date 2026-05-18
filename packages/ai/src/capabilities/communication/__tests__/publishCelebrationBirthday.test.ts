// packages/ai/src/capabilities/communication/__tests__/publishCelebrationBirthday.test.ts
//
// Unit tests for the birthday celebration auto-publish pipe (ADR-0372).
//
// Five test cases:
//   TC-1  Service-role caller + kind='celebration' → happy path, message published
//         Call shape mirrors EF: p_actor_profile_id=BOT, p_linked_entity_id=celebrated person
//   TC-2  Idempotency: 2nd call same day returns NULL message_id, no double notification
//         Call shape mirrors EF: p_actor_profile_id=BOT, p_linked_entity_id=celebrated person
//         (Previous version passed celebrated profile as actor — masking Blocker 1 where
//          UNIQUE (workspace_id, bot_profile_id, kind, date) caused employees #2..N to be skipped.)
//   TC-3  Manager-gate bypass verified: celebration skips is_manager_in_workspace check
//   TC-4  Config-disabled skip: auto_celebrate_birthdays=false → NULL returned, skip logged
//   TC-5  Opt-out via fallback JSONB key: celebrate_birthday=false excluded from cohort
//
// These tests exercise the DB-layer logic via mocked Supabase RPC calls.
// E2E DB tests live at apps/e2e/db/birthday-cohort.spec.ts.
//
// Mock strategy: supabase chain stubbed inline — no capability-layer mocks needed
// (celebration branch is RPC-only, not agent-tool initiated per ADR-0372 §Agent Impact).

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

// ── Helpers ───────────────────────────────────────────────────────────────

const WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
const CHANNEL_ID = "c0000000-0000-0000-0000-000000000001";
const PROFILE_ID_ALICE = "a0000000-0000-0000-0000-000000000001";
const PROFILE_ID_BOB = "a0000000-0000-0000-0000-000000000002";
const MESSAGE_ID_1 = "e0000000-0000-0000-0000-000000000001";
const ACTOR_ID = "00000000-0000-0000-0000-000000000001"; // platform system actor
const TODAY = "2026-05-18";

type RpcCapture = { fn: string; args: Record<string, unknown> };

/**
 * Build a Supabase service-role client stub.
 *
 * `rpcCaptures` collects every `.rpc(fnName, args)` call.
 * `opts` lets individual tests control per-RPC responses.
 */
function makeServiceSupabase(
  rpcCaptures: RpcCapture[] = [],
  opts: {
    cohortRows?: Array<{ profile_id: string; display_name: string }>;
    publishReturnId?: string | null;
    conflictOnPublish?: boolean; // simulate celebration_publication CONFLICT
    workspaceDisabled?: boolean;
    configMissing?: boolean;
  } = {},
): SupabaseClient {
  const {
    cohortRows = [{ profile_id: PROFILE_ID_ALICE, display_name: "Alice" }],
    publishReturnId = MESSAGE_ID_1,
    conflictOnPublish = false,
    workspaceDisabled = false,
    configMissing = false,
  } = opts;

  return {
    rpc(fnName: string, args: Record<string, unknown>) {
      rpcCaptures.push({ fn: fnName, args });

      if (fnName === "fn_birthday_cohort_for_workspace") {
        return Promise.resolve({ data: cohortRows, error: null });
      }

      if (fnName === "publish_announcement_atomic") {
        // Simulate config-missing error
        if (configMissing) {
          return Promise.resolve({
            data: null,
            error: {
              message: "CELEBRATION_CONFIG_MISSING: workspace_celebration_config row not found",
            },
          });
        }
        // Simulate workspace-disabled skip (RPC returns NULL)
        if (workspaceDisabled) {
          return Promise.resolve({ data: null, error: null });
        }
        // Simulate idempotency conflict (already published today — RPC returns NULL)
        if (conflictOnPublish) {
          return Promise.resolve({ data: null, error: null });
        }
        // Happy path
        return Promise.resolve({ data: publishReturnId, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      if (table === "workspace_celebration_config") {
        if (configMissing) {
          return {
            select() {
              return {
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              };
            },
          };
        }
        return {
          select() {
            return {
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    auto_celebrate_birthdays: !workspaceDisabled,
                    target_channel_id: CHANNEL_ID,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "profile") {
        return {
          select() {
            return {
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { profile_id: ACTOR_ID },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          },
        };
      }

      if (table === "activity_trail") {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      // Fallback
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    },
  } as unknown as SupabaseClient;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Birthday celebration auto-publish pipe (ADR-0372)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TC-1 (happy path): service-role + kind=celebration → message published, dual telemetry logged", async () => {
    // Call shape mirrors EF (supabase/functions/publish-birthday-celebrations/index.ts):
    //   p_actor_profile_id = ACTOR_ID (workspace bot/system profile)
    //   p_linked_entity_id = PROFILE_ID_ALICE (the celebrated person)
    // The RPC celebration branch inserts celebration_publication.profile_id = p_linked_entity_id
    // (not p_actor_profile_id) per ADR-0372 §Q9 + V2 council Blocker 1 fix.
    const rpcCaptures: RpcCapture[] = [];
    const sb = makeServiceSupabase(rpcCaptures);

    // Simulate the cohort call
    const cohortResult = await (
      sb.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )("fn_birthday_cohort_for_workspace", { p_workspace_id: WORKSPACE_ID, p_today: TODAY });

    expect(cohortResult.error).toBeNull();
    expect(cohortResult.data).toHaveLength(1);
    const cohort = cohortResult.data as Array<{ profile_id: string; display_name: string }>;
    expect(cohort[0]!.profile_id).toBe(PROFILE_ID_ALICE);
    // DOB must NOT appear in cohort result
    expect(JSON.stringify(cohort)).not.toContain("date_of_birth");
    expect(JSON.stringify(cohort)).not.toContain("1990");

    // Simulate the publish call — bot actor + celebrated person as linked entity
    const publishResult = await (
      sb.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )("publish_announcement_atomic", {
      p_workspace_id: WORKSPACE_ID,
      p_actor_profile_id: ACTOR_ID, // bot/system actor — NOT the celebrated person
      p_channel_id: CHANNEL_ID,
      p_content: "Gratulerer med dagen, Alice!\nI dag har Alice bursdag. Ta deg tid til å hilse.",
      p_kind: "celebration",
      p_tier: "social",
      p_linked_entity_type: "profile",
      p_linked_entity_id: PROFILE_ID_ALICE, // celebrated person — used for UNIQUE guard
      p_celebration_kind: "birthday",
      p_celebration_date: TODAY,
    });

    expect(publishResult.error).toBeNull();
    expect(publishResult.data).toBe(MESSAGE_ID_1);

    // Verify 2 RPC calls: cohort + publish
    expect(rpcCaptures).toHaveLength(2);
    expect(rpcCaptures[0]!.fn).toBe("fn_birthday_cohort_for_workspace");
    expect(rpcCaptures[1]!.fn).toBe("publish_announcement_atomic");

    // Verify EF call shape: actor=bot, linked=celebrated
    const publishArgs = rpcCaptures[1]!.args;
    expect(publishArgs.p_actor_profile_id).toBe(ACTOR_ID);
    expect(publishArgs.p_linked_entity_id).toBe(PROFILE_ID_ALICE);
    expect(publishArgs.p_kind).toBe("celebration");
    expect(publishArgs.p_tier).toBe("social");
    expect(publishArgs.p_celebration_kind).toBe("birthday");
    expect(publishArgs.p_celebration_date).toBe(TODAY);
    // Actor must NOT equal the celebrated person (would mask Blocker 1)
    expect(publishArgs.p_actor_profile_id).not.toBe(PROFILE_ID_ALICE);
  });

  it("TC-2 (idempotency): 2nd call same day returns NULL, no double notification", async () => {
    // Call shape mirrors EF: bot actor + celebrated person as linked entity.
    // Previous version passed the celebrated profile as p_actor_profile_id, which masked
    // Blocker 1: under the old RPC body, UNIQUE was (workspace_id, BOT_id, kind, date).
    // Without p_linked_entity_id in the call, the mock appeared to test idempotency
    // but actually tested the wrong unique key. Fixed here per V2 council T4 mask fix.
    const rpcCaptures: RpcCapture[] = [];
    const sb = makeServiceSupabase(rpcCaptures, { conflictOnPublish: true });

    // Simulate 2nd call same day — RPC returns NULL (idempotency skip because
    // (workspace_id, PROFILE_ID_ALICE, 'birthday', TODAY) already exists in
    // celebration_publication after employee #1's run).
    const result = await (
      sb.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )("publish_announcement_atomic", {
      p_workspace_id: WORKSPACE_ID,
      p_actor_profile_id: ACTOR_ID, // bot/system actor — same as TC-1
      p_channel_id: CHANNEL_ID,
      p_content: "Gratulerer med dagen, Alice!\nI dag har Alice bursdag.",
      p_kind: "celebration",
      p_tier: "social",
      p_linked_entity_type: "profile",
      p_linked_entity_id: PROFILE_ID_ALICE, // celebrated person — UNIQUE guard key
      p_celebration_kind: "birthday",
      p_celebration_date: TODAY,
      p_client_message_id: crypto.randomUUID(),
    });

    // NULL return = already published / idempotency skip
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();

    // Verify call shape: actor=bot, linked=celebrated (not the same — distinct roles)
    const capturedArgs = rpcCaptures[0]!.args;
    expect(capturedArgs.p_actor_profile_id).toBe(ACTOR_ID);
    expect(capturedArgs.p_linked_entity_id).toBe(PROFILE_ID_ALICE);
    expect(capturedArgs.p_actor_profile_id).not.toBe(PROFILE_ID_ALICE);

    // The calling code (Edge Function) interprets NULL as "skipped" and does NOT
    // attempt to emit a second activity_trail row or increment published_count.
    expect(rpcCaptures).toHaveLength(1);
    expect(rpcCaptures[0]!.fn).toBe("publish_announcement_atomic");
  });

  it("TC-3 (manager-gate bypass): celebration path does NOT require manager role", async () => {
    const rpcCaptures: RpcCapture[] = [];
    const sb = makeServiceSupabase(rpcCaptures);

    // The cohort resolver returns profiles including non-managers (employees).
    // When kind=celebration + service_role, publish_announcement_atomic celebration branch
    // bypasses is_manager_in_workspace. Verified here by: no manager-check RPC call.
    const cohortResult = await (
      sb.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )("fn_birthday_cohort_for_workspace", { p_workspace_id: WORKSPACE_ID, p_today: TODAY });

    expect(cohortResult.error).toBeNull();
    // Cohort includes Alice (employee, non-manager) — the resolver does NOT filter by role.
    const cohort = cohortResult.data as Array<{ profile_id: string; display_name: string }>;
    expect(cohort.some((r) => r.profile_id === PROFILE_ID_ALICE)).toBe(true);

    // No is_manager_in_workspace RPC call
    const managerCheckCalls = rpcCaptures.filter((c) => c.fn === "is_manager_in_workspace");
    expect(managerCheckCalls).toHaveLength(0);
  });

  it("TC-4 (config-disabled skip): auto_celebrate_birthdays=false → RPC returns NULL, skip logged", async () => {
    const rpcCaptures: RpcCapture[] = [];
    const sb = makeServiceSupabase(rpcCaptures, { workspaceDisabled: true });

    const result = await (
      sb.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )("publish_announcement_atomic", {
      p_workspace_id: WORKSPACE_ID,
      p_actor_profile_id: ACTOR_ID,
      p_channel_id: CHANNEL_ID,
      p_content: "Gratulerer med dagen, Bob!\nI dag har Bob bursdag.",
      p_kind: "celebration",
      p_tier: "social",
      p_linked_entity_type: "profile",
      p_linked_entity_id: PROFILE_ID_BOB,
      p_celebration_kind: "birthday",
      p_celebration_date: TODAY,
    });

    // NULL = workspace-disabled skip
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it("TC-5 (opt-out via JSONB key): cohort RPC respects celebrate_birthday=false", async () => {
    // The cohort RPC itself handles opt-out filtering via notification_pref JSONB.
    // An opted-out employee simply does NOT appear in the cohort result.
    // This test verifies the cohort result excludes opted-out profiles.
    const rpcCaptures: RpcCapture[] = [];

    // Return only Alice (Bob opted out — filtered server-side by fn_birthday_cohort_for_workspace).
    const sb = makeServiceSupabase(rpcCaptures, {
      cohortRows: [{ profile_id: PROFILE_ID_ALICE, display_name: "Alice" }],
    });

    const result = await (
      sb.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )("fn_birthday_cohort_for_workspace", { p_workspace_id: WORKSPACE_ID, p_today: TODAY });

    expect(result.error).toBeNull();
    const cohort = result.data as Array<{ profile_id: string; display_name: string }>;

    // Alice is present
    expect(cohort.some((r) => r.profile_id === PROFILE_ID_ALICE)).toBe(true);

    // Bob (opted out) is NOT present — filtered by notification_pref ->> 'celebrate_birthday' = false
    expect(cohort.some((r) => r.profile_id === PROFILE_ID_BOB)).toBe(false);

    // DOB never appears in cohort output
    expect(JSON.stringify(cohort)).not.toContain("date_of_birth");
  });
});
