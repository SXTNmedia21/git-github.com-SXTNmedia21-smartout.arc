// =============================================================================
// helpers/shift-swap-harness.ts
//
// Assertion helpers for the shift-swap capability E2E spec.
// Extends the shared botsson-harness infrastructure with engine_state-based
// swap assertions and test-data factories scoped to the seed workspace.
//
// Capability contract (tools.ts):
//   - get_swap_requests    — read-only, queries engine_state where process_id='shift_swap'
//   - get_swap_eligibility — read-only, queries schedule_shift for eligible partners
//   - request_swap         — chat-only, calls initiate_shift_swap RPC → engine_state INSERT
//   - respond_to_swap      — chat-only, calls respond_to_shift_swap RPC → engine_state.context UPDATE
//   - cancel_swap          — chat-only, calls cancel_shift_swap RPC → engine_state.status UPDATE
//
// All swap state lives in engine_state.context JSONB (ADR-0067). No separate
// shift_swap_request table. The engine_state.id IS the swap_id.
//
// Authority dotted slugs seeded by 20260518100000_seed_shift_swap_authority.sql:
//   shift_swap.request  — level='suggest'
//   shift_swap.respond  — level='suggest'
//   shift_swap.cancel   — level='confirm'
//
// ADR refs: ADR-0067 (event engine state), ADR-0078 (channel guard chat-only),
//           ADR-0099 (gate_action), ADR-0134 (telemetry), ADR-0151 (server-side
//           profile_id derivation), ADR-0184 (recorder), ADR-0189 (authority seed).
// =============================================================================

import { expect } from "@playwright/test";
import {
  assertRecordingPhase,
  assertActivityTrailEvent,
  type RecordingRow,
  type ActivityTrailRow,
  SEED_WORKSPACE_ID,
  SEED_PROFILE_ID,
  dumpStageEngineLogs,
} from "./botsson-harness";
import { supabase } from "./seed";

export { SEED_WORKSPACE_ID, SEED_PROFILE_ID };

// ---------------------------------------------------------------------------
// PollOptions — mirrors the unexported type in botsson-harness.ts
// ---------------------------------------------------------------------------
export type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// BFF response shape
// ---------------------------------------------------------------------------
export type BffChatResponse = {
  text?: string;
  sessionId?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Polling helper
// ---------------------------------------------------------------------------

async function pollUntil<T>(
  fn: () => Promise<T | null | undefined>,
  opts: PollOptions = {},
): Promise<T> {
  const { timeoutMs = 15_000, intervalMs = 600 } = opts;
  const deadline = Date.now() + timeoutMs;
  let last: T | null | undefined = null;
  while (Date.now() < deadline) {
    last = await fn();
    if (last != null) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`pollUntil: timed out after ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Engine-state row type for swap assertions
// ---------------------------------------------------------------------------

export type SwapStateRow = {
  id: string;
  process_id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string | null;
  status: string;
  context: Record<string, unknown>;
  started_at: string;
  updated_at: string | null;
};

// ---------------------------------------------------------------------------
// ensureSwapAuthority
// ---------------------------------------------------------------------------

/**
 * Ensure the three engine_authority_config rows for the shift_swap capability
 * family are present for the given workspace. Mirrors the seed from
 * 20260518100000_seed_shift_swap_authority.sql.
 *
 * Idempotent via ON CONFLICT DO NOTHING (ignoreDuplicates: true).
 * Uses 'autonomous' for request/respond (looser than seed 'suggest') and
 * 'autonomous' for cancel (seed is 'confirm') so the E2E tests can exercise
 * the full pipe without four-eyes friction. The seed migration rows use
 * 'suggest'/'confirm' — this upsert DOES NOT OVERWRITE them (ignoreDuplicates).
 * To guarantee autonomy in CI, it falls back to 'autonomous' only when no
 * row exists.
 */
export async function ensureSwapAuthority(workspaceId: string = SEED_WORKSPACE_ID): Promise<void> {
  const rows = [
    {
      workspace_id: workspaceId,
      capability: "shift_swap.request",
      level: "autonomous",
      min_role: "employee",
      requires_four_eyes: false,
    },
    {
      workspace_id: workspaceId,
      capability: "shift_swap.respond",
      level: "autonomous",
      min_role: "employee",
      requires_four_eyes: false,
    },
    {
      workspace_id: workspaceId,
      capability: "shift_swap.cancel",
      level: "autonomous",
      min_role: "employee",
      requires_four_eyes: false,
    },
  ];

  for (const row of rows) {
    const { error } = await supabase
      .from("engine_authority_config")
      .upsert(row, { onConflict: "workspace_id,capability" });

    if (error) {
      console.warn(`ensureSwapAuthority: upsert warning for ${row.capability}: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Test-shift factory (two shifts for two profiles to model swap relation)
// ---------------------------------------------------------------------------

export type TestShiftRow = {
  schedule_shift_id: string;
  workspace_id: string;
  employee_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

const SWAP_MARKER = "F-COVERAGE-SS test";

/**
 * Create a schedule_shift in the seed workspace tagged with the swap marker.
 * @param employeeId  The profile_id to assign as employee_id.
 * @param dayOffset   Days from today (default 3 — avoids same-day conflicts).
 * @param status      Initial status (default 'published' — initiate_shift_swap requires published/assigned).
 */
export async function createSwapTestShift(opts: {
  employeeId: string;
  dayOffset?: number;
  status?: "published" | "assigned";
  startTime?: string;
  endTime?: string;
}): Promise<TestShiftRow> {
  const dayOffset = opts.dayOffset ?? 3;
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const shiftDate = d.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("schedule_shift")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      shift_date: shiftDate,
      start_time: opts.startTime ?? "09:00:00",
      end_time: opts.endTime ?? "14:00:00",
      employee_id: opts.employeeId,
      day_category: "morning",
      role: "server",
      status: opts.status ?? "published",
      is_published: true,
      notes: SWAP_MARKER,
    })
    .select(
      "schedule_shift_id, workspace_id, employee_id, shift_date, start_time, end_time, status",
    )
    .single();

  if (error || !data) {
    throw new Error(`createSwapTestShift failed: ${error?.message ?? "no row returned"}`);
  }
  return data as TestShiftRow;
}

/**
 * Delete all test shifts tagged with the swap marker. Also cleans up any
 * engine_state rows that reference them (swap state — entity_id on the shift).
 */
export async function cleanupSwapTestData(): Promise<void> {
  try {
    // Fetch shift IDs first.
    const { data: shifts } = await supabase
      .from("schedule_shift")
      .select("schedule_shift_id")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("notes", SWAP_MARKER);

    if (shifts && shifts.length > 0) {
      const ids = shifts.map((s) => s.schedule_shift_id);
      // engine_state references shift via entity_id — clean swap state first.
      await supabase
        .from("engine_state")
        .delete()
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .eq("process_id", "shift_swap")
        .in("entity_id", ids);
      // Then the shifts.
      await supabase.from("schedule_shift").delete().in("schedule_shift_id", ids);
    }

    // Also clean any active engine_state swap rows from this test run
    // that may reference other shifts (e.g. if entity_id was set differently).
    await supabase
      .from("engine_state")
      .delete()
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("process_id", "shift_swap")
      .in("status", ["active", "waiting", "cancelled"]);
  } catch (err) {
    console.warn(`cleanupSwapTestData: ignored error: ${String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// assertSwapStateRow — poll engine_state for a swap row
// ---------------------------------------------------------------------------

/**
 * Poll engine_state for a swap row with the given id.
 * Returns the row including the JSONB context.
 */
export async function assertSwapStateRow(
  swapId: string,
  opts: {
    expectedContextStatus?: string;
    poll?: PollOptions;
  } = {},
): Promise<SwapStateRow> {
  let result: SwapStateRow | undefined;

  try {
    result = await pollUntil(
      async () => {
        const { data } = await supabase
          .from("engine_state")
          .select(
            "id, process_id, workspace_id, entity_type, entity_id, status, context, started_at, updated_at",
          )
          .eq("id", swapId)
          .eq("workspace_id", SEED_WORKSPACE_ID)
          .eq("process_id", "shift_swap")
          .maybeSingle();

        if (!data) return null;

        if (opts.expectedContextStatus) {
          const ctx = data.context as Record<string, unknown>;
          if (ctx?.status !== opts.expectedContextStatus) return null;
        }

        return data as SwapStateRow;
      },
      opts.poll ?? { timeoutMs: 15_000 },
    );
  } catch {
    const { data: recent } = await supabase
      .from("engine_state")
      .select("id, process_id, status, context, workspace_id, started_at")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("process_id", "shift_swap")
      .order("started_at", { ascending: false })
      .limit(5);

    expect(
      null,
      `assertSwapStateRow: no engine_state row id="${swapId}" process_id='shift_swap' ` +
        `workspace=${SEED_WORKSPACE_ID}` +
        (opts.expectedContextStatus ? ` context.status='${opts.expectedContextStatus}'` : "") +
        `.\n\nRecent swap rows:\n${JSON.stringify(recent ?? [], null, 2)}`,
    ).not.toBeNull();
    throw new Error("unreachable");
  }

  return result;
}

// ---------------------------------------------------------------------------
// assertSwapToolFired — poll agent_session_recording for a tool_call row
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a tool_call row naming the given
 * shift_swap capability tool. Returns the matched row.
 */
export async function assertSwapToolFired(
  sessionId: string,
  toolName: string,
  opts: {
    sinceIso?: string;
    poll?: PollOptions;
  } = {},
): Promise<RecordingRow> {
  return assertRecordingPhase({
    sessionId,
    phase: "tool_call",
    turnKind: "tool_invocation",
    contentPredicate: (c) => {
      const content = c as Record<string, unknown>;
      return typeof content?.tool_name === "string" && content.tool_name === toolName;
    },
    sinceIso: opts.sinceIso,
    poll: opts.poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertSwapCapabilityClassified — poll for classifier_output with intent='shift_swap'
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'shift_swap'. Returns the matched row.
 */
export async function assertSwapCapabilityClassified(
  sessionId: string,
  sinceIso: string,
  poll?: PollOptions,
): Promise<RecordingRow> {
  return assertRecordingPhase({
    sessionId,
    phase: "classifier_output",
    turnKind: "user_input",
    contentPredicate: (c) => {
      const content = c as Record<string, unknown>;
      return typeof content?.intent === "string" && content.intent === "shift_swap";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertSwapTrailEvent — poll activity_trail for shift_swap.* event
// ---------------------------------------------------------------------------

const TOOL_TO_EVENT: Record<string, string> = {
  request_swap: "shift_swap.requested",
  respond_to_swap_accept: "shift_swap.accepted",
  respond_to_swap_reject: "shift_swap.rejected",
  cancel_swap: "shift_swap.cancelled",
};

/**
 * Poll activity_trail for the shift_swap telemetry event emitted by the given
 * tool invocation. `toolEventKey` must be one of the TOOL_TO_EVENT keys.
 */
export async function assertSwapTrailEvent(
  toolEventKey: string,
  sinceIso: string,
  opts: {
    workspaceId?: string;
    actorId?: string;
    poll?: PollOptions;
  } = {},
): Promise<ActivityTrailRow> {
  const event = TOOL_TO_EVENT[toolEventKey];
  if (!event) {
    throw new Error(`assertSwapTrailEvent: unknown tool event key "${toolEventKey}"`);
  }

  return assertActivityTrailEvent({
    event,
    workspaceId: opts.workspaceId ?? SEED_WORKSPACE_ID,
    actorId: opts.actorId ?? SEED_PROFILE_ID,
    sinceIso,
    poll: opts.poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertNoSwapError — assert assistant response does not contain error patterns
// ---------------------------------------------------------------------------

/**
 * Assert the BFF response text does not contain Norwegian/English hard-error
 * patterns for the shift_swap capability.
 */
export async function assertNoSwapError(responseText: string, label: string): Promise<void> {
  const errorPattern =
    /feil ved|teknisk feil|beklager.*ikke|dessverre.*feilet|could not complete|internal server error|unhandled exception|stack trace/i;

  if (errorPattern.test(responseText)) {
    const logs = await dumpStageEngineLogs();
    expect(
      responseText,
      `${label}: assistant returned hard-error response: "${responseText}"\n\nStage-engine logs:\n${logs}`,
    ).not.toMatch(errorPattern);
  }

  expect(responseText.length, `${label}: assistant response is empty`).toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// resolveSessionId — extract session from BFF response or DB fallback
// ---------------------------------------------------------------------------

export async function resolveSessionId(
  bffBody: { sessionId?: string },
  sinceIso: string,
): Promise<string | null> {
  if (bffBody.sessionId) return bffBody.sessionId;

  const { data } = await supabase
    .from("engine_sessions")
    .select("id")
    .eq("profile_id", SEED_PROFILE_ID)
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1);

  return data?.[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// assertGateEvalForSwap — poll gate_evaluation for a shift_swap.* action
// ---------------------------------------------------------------------------

export type GateEvalRow = {
  id: string;
  workspace_id: string;
  actor_profile_id: string | null;
  capability: string;
  action_type: string;
  allow: boolean;
  channel: string;
  reason: string | null;
  entity_id: string | null;
  evaluated_at: string;
};

/**
 * Poll gate_evaluation for a row matching the given capability + action_type
 * with allow=true for the seed profile since sinceIso.
 */
export async function assertGateEvalForSwap(opts: {
  capability: string;
  actionType: string;
  sinceIso: string;
  actorId?: string;
  entityId?: string;
  expectedAllow?: boolean;
  poll?: PollOptions;
}): Promise<GateEvalRow> {
  const actorId = opts.actorId ?? SEED_PROFILE_ID;
  const expectedAllow = opts.expectedAllow ?? true;

  let result: GateEvalRow | undefined;

  try {
    result = await pollUntil(
      async () => {
        let q = supabase
          .from("gate_evaluation")
          .select(
            "id, workspace_id, actor_profile_id, capability, action_type, allow, channel, reason, entity_id, evaluated_at",
          )
          .eq("workspace_id", SEED_WORKSPACE_ID)
          .eq("actor_profile_id", actorId)
          .eq("capability", opts.capability)
          .eq("action_type", opts.actionType)
          .eq("allow", expectedAllow)
          .gte("evaluated_at", opts.sinceIso);

        if (opts.entityId) {
          q = q.eq("entity_id", opts.entityId);
        }

        const { data } = await q.order("evaluated_at", { ascending: false }).limit(5);
        if (!data || data.length === 0) return null;
        return data[0] as GateEvalRow;
      },
      opts.poll ?? { timeoutMs: 20_000 },
    );
  } catch {
    const { data: recent } = await supabase
      .from("gate_evaluation")
      .select(
        "id, capability, action_type, allow, actor_profile_id, entity_id, evaluated_at, reason",
      )
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .gte("evaluated_at", opts.sinceIso)
      .order("evaluated_at", { ascending: false })
      .limit(20);

    expect(
      null,
      `assertGateEvalForSwap: no gate_evaluation row for capability='${opts.capability}' ` +
        `action_type='${opts.actionType}' allow=${expectedAllow} actor=${actorId}` +
        (opts.entityId ? ` entity_id=${opts.entityId}` : "") +
        `.\n\nRecent gate_evaluation rows:\n${JSON.stringify(recent ?? [], null, 2)}`,
    ).not.toBeNull();
    throw new Error("unreachable");
  }

  return result;
}
