// =============================================================================
// helpers/contract-harness.ts
//
// Contract-capability–specific assertion helpers for contract-harness-e2e.spec.ts.
//
// Builds on the base assertion helpers in botsson-harness.ts (pollUntil,
// assertRecordingPhase, assertActivityTrailEvent).  This file adds:
//
//   assertContractToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertBotssontoolInvokedFor(toolName, sinceIso, opts)
//     — polls activity_trail for "botsson.tool_invoked" with data.tool matching
//       the given tool name.  Wraps assertActivityTrailEvent with a dataPredicate.
//
//   seedContractTemplateForWorkspace(workspaceId)
//     — inserts a minimal system template (workspace_id IS NULL, is_system=true)
//       so list_employee_templates returns at least one row in E2E runs that
//       start with an empty DB.  Returns template_id.
//
// ADR refs: ADR-0078 (channel guard), ADR-0099 (gate_action),
//           ADR-0134 (telemetry), ADR-0184 (recorder), ADR-0151 (profile_id).
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
  /** Polling timeout in ms (default 15 000) */
  timeoutMs?: number;
  /** Polling interval in ms (default 600) */
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// assertContractToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a `tool_call` row naming the given tool.
 * Returns the matched row.
 *
 * Mirrors the `assertScheduleToolFired`-style helper used in
 * schedule-harness-e2e.spec.ts.
 */
export async function assertContractToolFired(
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
// assertBotssontoolInvokedFor
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for a "botsson.tool_invoked" event where data.tool
 * matches the given tool name.
 *
 * The Vercel AI adapter (packages/ai/src/adapters/vercel-ai.ts) emits this
 * event for every tool invocation regardless of capability — so all read-only
 * contract tools produce this event automatically.
 */
export async function assertBotssontoolInvokedFor(
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
// seedSystemTemplateIfAbsent
// ---------------------------------------------------------------------------

/**
 * Ensure at least one system contract template (workspace_id IS NULL,
 * is_system=true, is_active=true) exists so list_employee_templates returns
 * a non-empty result during E2E runs that start with a clean DB.
 *
 * Returns the template_id of either a pre-existing row or the newly inserted
 * one.  Idempotent — safe to call in beforeAll.
 */
export async function seedSystemTemplateIfAbsent(): Promise<string> {
  const { data: existing } = await supabase
    .from("contract_template")
    .select("template_id")
    .is("workspace_id", null)
    .eq("is_system", true)
    .eq("is_active", true)
    .eq("contract_type", "employee")
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0]!.template_id as string;
  }

  const { data: inserted, error } = await supabase
    .from("contract_template")
    .insert({
      workspace_id: null,
      name: "Standard ansettelsesavtale (E2E seed)",
      description: "Seeded by contract-harness E2E helper",
      contract_type: "employee",
      language: "no",
      locale: "nb-NO",
      content_html: "<p>Standard template body for E2E tests.</p>",
      is_system: true,
      is_active: true,
      version: 1,
      created_by: SEED_PROFILE_ID,
    })
    .select("template_id")
    .single();

  if (error || !inserted) {
    // System template insert may be RLS-blocked in some configurations —
    // warn and return a sentinel rather than hard-failing beforeAll.
    console.warn(
      `seedSystemTemplateIfAbsent: could not insert system template: ${error?.message ?? "no row"}. ` +
        "list_employee_templates will return empty; A1 will degrade gracefully.",
    );
    return "00000000-0000-0000-0000-000000000000";
  }

  return inserted.template_id as string;
}

// ---------------------------------------------------------------------------
// assertContractCapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'contract'.  Returns the matched row.
 */
export async function assertContractCapabilityClassified(
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
      return typeof content?.intent === "string" && content.intent === "contract";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertNoPiiInResponse
// ---------------------------------------------------------------------------

/**
 * Assert that the response text does NOT contain patterns that look like raw
 * PII: Norwegian fødselsnummer (11 digits), bank account numbers, or raw
 * personnummer sequences.
 *
 * Called for read tools that touch sensitive data fields.
 */
export function assertNoPiiInResponse(responseText: string, context: string): void {
  // 11 consecutive digits (personnummer / bank account / phone)
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
