// =============================================================================
// helpers/shift-lifecycle-harness.ts
//
// Assertion helpers for the shift-lifecycle capability E2E spec.
// Extends the shared botsson-harness infrastructure with shift-state-machine
// assertions and test-data factories scoped to the seed workspace.
//
// Capability contract:
//   - publish_shift / approve_shift are chat-channel tools that call
//     callGateAction() internally, writing a gate_evaluation row per call.
//   - interpret_shift / settle_shift are system-channel-only — they cannot
//     be reached via the BFF chat route (hardcoded channel:"chat").
//   - All write tools emit telemetry via @smartout/telemetry.
//
// ADR refs: ADR-0095 (five-layer lifecycle), ADR-0099 (gate_action),
//           ADR-0078 (channel guard), ADR-0134 (telemetry),
//           ADR-0151 (server-side profile_id derivation).
// =============================================================================

import { expect } from "@playwright/test";
import { SEED_PROFILE_ID, SEED_WORKSPACE_ID, dumpStageEngineLogs } from "./botsson-harness";
import { supabase } from "./seed";

export { SEED_PROFILE_ID, SEED_WORKSPACE_ID };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

export type TestShiftRow = {
  schedule_shift_id: string;
  workspace_id: string;
  employee_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
  is_published: boolean;
};

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

// ---------------------------------------------------------------------------
// Polling
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
// Test-shift factory
// ---------------------------------------------------------------------------

/**
 * Create a schedule_shift in the seed workspace tagged with a notes marker
 * so it can be cleaned up after the test without touching real shifts.
 *
 * @param status   Initial shift_status enum value (default: 'created').
 * @param marker   Notes marker for cleanup scoping (default: 'F-COVERAGE-2 test').
 */
export async function createTestShift(opts: {
  status?: "created" | "assigned" | "published" | "active" | "completed" | "unpublished";
  marker?: string;
  employeeId?: string;
}): Promise<TestShiftRow> {
  const status = opts.status ?? "created";
  const marker = opts.marker ?? "F-COVERAGE-2 test";
  const employeeId = opts.employeeId ?? SEED_PROFILE_ID;

  // Use a shift date 2 days in the future so it never conflicts with
  // today's operational shifts in the seed workspace.
  const d = new Date();
  d.setDate(d.getDate() + 2);
  const shiftDate = d.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("schedule_shift")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      shift_date: shiftDate,
      start_time: "09:00:00",
      end_time: "14:00:00",
      employee_id: employeeId,
      day_category: "morning",
      role: "server",
      status,
      is_published: status === "published",
      notes: marker,
    })
    .select(
      "schedule_shift_id, workspace_id, employee_id, shift_date, start_time, end_time, status, is_published",
    )
    .single();

  if (error || !data) {
    throw new Error(`createTestShift failed: ${error?.message ?? "no row returned"}`);
  }
  return data as TestShiftRow;
}

/**
 * Delete test shifts created with the given marker.
 * Also cascades to shift_approval rows referencing those shifts.
 */
export async function cleanupTestShifts(marker = "F-COVERAGE-2 test"): Promise<void> {
  // Fetch IDs first so we can clean FK children.
  const { data: shifts } = await supabase
    .from("schedule_shift")
    .select("schedule_shift_id")
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .eq("notes", marker);

  if (!shifts || shifts.length === 0) return;
  const ids = shifts.map((s) => s.schedule_shift_id);

  // shift_approval has a FK on shift_id → must delete children first.
  await supabase.from("shift_approval").delete().in("shift_id", ids);
  // shift_hour_interpretation also references the shift.
  await supabase.from("shift_hour_interpretation").delete().in("shift_id", ids);
  // shift_cost_snapshot cascades from interpretation — if interpretation is
  // gone, snapshot is already gone. Delete directly too for safety.
  await supabase.from("shift_cost_snapshot").delete().in("schedule_shift_id", ids);

  await supabase.from("schedule_shift").delete().in("schedule_shift_id", ids);
}

// ---------------------------------------------------------------------------
// DB assertion: shift status
// ---------------------------------------------------------------------------

/**
 * Poll until schedule_shift.status matches the expected value.
 * Fails with a diagnostic dump on timeout.
 */
export async function assertShiftStatus(opts: {
  shiftId: string;
  expectedStatus: string;
  poll?: PollOptions;
}): Promise<void> {
  let actualStatus: string | null = null;
  try {
    await pollUntil(async () => {
      const { data } = await supabase
        .from("schedule_shift")
        .select("status")
        .eq("schedule_shift_id", opts.shiftId)
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .single();
      if (!data) return null;
      actualStatus = data.status;
      return data.status === opts.expectedStatus ? data.status : null;
    }, opts.poll);
  } catch {
    const logs = await dumpStageEngineLogs();
    expect(
      actualStatus,
      `assertShiftStatus: shift ${opts.shiftId} expected status='${opts.expectedStatus}' ` +
        `but got '${actualStatus ?? "not found"}'.\n\nStage-engine logs:\n${logs}`,
    ).toBe(opts.expectedStatus);
  }
}

// ---------------------------------------------------------------------------
// DB assertion: gate_evaluation row
// ---------------------------------------------------------------------------

/**
 * Poll until gate_evaluation has a row for the given capability + action_type
 * for the seed profile since sinceIso.
 *
 * Per HANDOFF-harness-coverage-top3.md D2: gate_action fires at ROUTER level
 * for every turn (one router-level row per turn), AND the shift_lifecycle
 * write tools call callGateAction() internally (one tool-level row per
 * write-tool invocation). This helper targets tool-level rows via the
 * action_type field.
 */
export async function assertGateEvaluation(opts: {
  capability: string;
  actionType: string;
  expectedAllow: boolean;
  sinceIso: string;
  actorId?: string;
  entityId?: string;
  poll?: PollOptions;
}): Promise<GateEvalRow> {
  const actorId = opts.actorId ?? SEED_PROFILE_ID;
  let result: GateEvalRow | undefined;

  try {
    result = await pollUntil(async () => {
      let q = supabase
        .from("gate_evaluation")
        .select(
          "id, workspace_id, actor_profile_id, capability, action_type, allow, channel, reason, entity_id, evaluated_at",
        )
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .eq("actor_profile_id", actorId)
        .eq("capability", opts.capability)
        .eq("action_type", opts.actionType)
        .eq("allow", opts.expectedAllow)
        .gte("evaluated_at", opts.sinceIso);

      if (opts.entityId) {
        q = q.eq("entity_id", opts.entityId);
      }

      const { data } = await q.order("evaluated_at", { ascending: false }).limit(5);
      if (!data || data.length === 0) return null;
      return data[0] as GateEvalRow;
    }, opts.poll);
  } catch {
    // Build a diagnostic dump of recent gate_evaluation rows.
    const { data: recent } = await supabase
      .from("gate_evaluation")
      .select(
        "id, capability, action_type, allow, actor_profile_id, entity_id, evaluated_at, reason",
      )
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .gte("evaluated_at", opts.sinceIso)
      .order("evaluated_at", { ascending: false })
      .limit(20);

    const dump = JSON.stringify(recent ?? [], null, 2);
    expect(
      null,
      `assertGateEvaluation: no row found for capability='${opts.capability}' ` +
        `action_type='${opts.actionType}' allow=${opts.expectedAllow} ` +
        `actor_profile_id=${actorId}` +
        (opts.entityId ? ` entity_id=${opts.entityId}` : "") +
        `.\n\nRecent gate_evaluation rows:\n${dump}`,
    ).not.toBeNull();
    throw new Error("unreachable");
  }

  return result;
}

// ---------------------------------------------------------------------------
// BFF response shape
// ---------------------------------------------------------------------------

export type BffChatResponse = {
  text?: string;
  sessionId?: string;
  error?: string;
};

/**
 * Assert the BFF response text does not contain Norwegian/English error patterns.
 */
export async function assertNoShiftLifecycleError(
  responseText: string,
  label: string,
): Promise<void> {
  const errorPattern =
    /feil ved|teknisk feil|beklager.*ikke|dessverre.*feilet|could not complete|internal server error/i;
  if (errorPattern.test(responseText)) {
    const logs = await dumpStageEngineLogs();
    expect(
      responseText,
      `${label}: assistant returned error-patterned response: "${responseText}"\n\n` +
        `Stage-engine logs:\n${logs}`,
    ).not.toMatch(errorPattern);
  }
  expect(responseText.length, `${label}: assistant response is empty`).toBeGreaterThan(0);
}
