// =============================================================================
// helpers/contract-intake-harness.ts
//
// Contract-intake–capability assertion helpers for
// contract-intake-harness-e2e.spec.ts.
//
// Builds on base helpers in botsson-harness.ts.  This file adds:
//
//   assertIntakeToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertIntakeCapabilityClassified(sessionId, sinceIso, poll?)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'contract_intake'.
//
//   assertIntakeToolInvokedFor(toolName, sinceIso, opts?)
//     — polls activity_trail for "botsson.tool_invoked" with data.tool
//       matching the given tool name.
//
//   assertNoPiiInIntakeResponse(text, context)
//     — assert that response text does NOT contain raw PII patterns
//       (11-digit personnummer / bank account number).
//
//   ensureSeededContractForIntake()
//     — ensure the seed profile has an employment_contract in status
//       'pending_data' so get_intake_progress can find a contract_id.
//       Returns the contract_id.
//
// ADR refs: ADR-0078 (channel guard — PII intake is chat-only),
//           ADR-0099 (gate_action), ADR-0134 (telemetry),
//           ADR-0151 (profile_id server-derived), ADR-0184 (recorder).
// =============================================================================

import { expect } from "@playwright/test";
import {
  assertRecordingPhase,
  assertActivityTrailEvent,
  type RecordingRow,
  type ActivityTrailRow,
  SEED_WORKSPACE_ID,
  SEED_PROFILE_ID,
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
// assertIntakeToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a `tool_call` row naming the given tool.
 * Returns the matched row.
 */
export async function assertIntakeToolFired(
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
// assertIntakeCapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'contract_intake'.  Returns the matched row.
 */
export async function assertIntakeCapabilityClassified(
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
      return typeof content?.intent === "string" && content.intent === "contract_intake";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertIntakeToolInvokedFor
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for a "botsson.tool_invoked" event where data.tool
 * matches the given tool name.
 */
export async function assertIntakeToolInvokedFor(
  toolName: string,
  sinceIso: string,
  opts: {
    workspaceId?: string;
    actorId?: string;
    poll?: PollOptions;
  } = {},
): Promise<ActivityTrailRow> {
  return assertActivityTrailEvent({
    event: "botsson.tool_invoked",
    workspaceId: opts.workspaceId ?? SEED_WORKSPACE_ID,
    actorId: opts.actorId ?? SEED_PROFILE_ID,
    dataPredicate: (d) => {
      const data = d as Record<string, unknown>;
      return data?.tool === toolName;
    },
    sinceIso,
    poll: opts.poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertNoPiiInIntakeResponse
// ---------------------------------------------------------------------------

/**
 * Assert that the response text does NOT contain raw PII: 11-digit sequences
 * (personnummer / bank account), or Norwegian dotted bank account format.
 *
 * get_intake_progress explicitly must NOT echo back actual PII values — it
 * only returns group-level completion status ('done' | 'pending').
 */
export function assertNoPiiInIntakeResponse(responseText: string, context: string): void {
  // 11 consecutive digits = personnummer or bank account
  const elevenDigitPattern = /\b\d{11}\b/;
  expect(
    elevenDigitPattern.test(responseText),
    `${context}: CRITICAL — response contains an 11-digit pattern (possible PII). ` +
      `Response: "${responseText.slice(0, 200)}"`,
  ).toBe(false);

  // Norwegian bank account in BBBBB.BB.BBBBB dotted form
  const bankAccountPattern = /\d{4,5}\.\d{2}\.\d{5}/;
  expect(
    bankAccountPattern.test(responseText),
    `${context}: response contains Norwegian bank account format. ` +
      `Response: "${responseText.slice(0, 200)}"`,
  ).toBe(false);
}

// ---------------------------------------------------------------------------
// ensureSeededContractForIntake
// ---------------------------------------------------------------------------

/**
 * Ensure the seed profile has an employment_contract with status
 * 'pending_data' so get_intake_progress can find a contract_id and
 * engine_state lookup is exercised.  Returns the contract_id.
 *
 * Idempotent — re-uses any existing pending_data row; only inserts
 * a new row if none exist for the seed profile.
 */
export async function ensureSeededContractForIntake(): Promise<string | null> {
  // Try to find an existing pending_data contract for the seed profile.
  const { data: existing } = await supabase
    .from("employment_contract")
    .select("contract_id")
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .eq("profile_id", SEED_PROFILE_ID)
    .eq("status", "pending_data")
    .limit(1);

  if (existing && existing.length > 0) {
    return (existing[0]?.contract_id as string) ?? null;
  }

  // Also accept any non-declined contract if pending_data is not present.
  const { data: anyContract } = await supabase
    .from("employment_contract")
    .select("contract_id, status")
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .eq("profile_id", SEED_PROFILE_ID)
    .neq("status", "declined")
    .limit(1);

  if (anyContract && anyContract.length > 0) {
    return (anyContract[0]?.contract_id as string) ?? null;
  }

  // Insert a minimal row with status='pending_data' so intake tools can
  // look it up.
  const today = new Date().toISOString().split("T")[0]!;
  const { data: inserted, error } = await supabase
    .from("employment_contract")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      profile_id: SEED_PROFILE_ID,
      status: "pending_data",
      employment_form: "permanent",
      employment_category: "fast",
      position_title: "Servitør (E2E intake seed)",
      start_date: today,
      agreed_weekly_hours: 37.5,
      employment_percentage: 100,
      notice_period_months: 1,
      trial_period_months: 6,
      break_minutes_per_day: 30,
      overtime_agreement_type: "legal_default",
      source: "e2e-contract-intake-harness-seed",
    })
    .select("contract_id")
    .single();

  if (error || !inserted) {
    console.warn(
      `ensureSeededContractForIntake: insert failed: ${error?.message ?? "no row"}. ` +
        "get_intake_progress contract_id will be null; test degrades to progress-fields-only assertion.",
    );
    return null;
  }

  return inserted.contract_id as string;
}
