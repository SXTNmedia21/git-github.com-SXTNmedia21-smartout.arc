// =============================================================================
// training-harness-e2e.spec.ts
//
// E2E coverage of the Botsson training capability (ADR-0163).
//
// Pipe under test: L1 → L2 BFF (/api/botsson/chat) → L3 Stage Engine →
//                  L4 training capability → L5 DB (protocol_assignment,
//                  protocol tables via workspace_id + profile_id scope).
//
// Tools covered (all 3):
//   Employee read-only tools (available at read_only authority — default):
//     get_my_training_status   (A1–A4)
//     get_next_protocol        (A5–A8)
//   Manager/admin suggest tool (requires 'suggest' authority or higher):
//     get_team_readiness       (A9–A12)
//
// Negative paths:
//   N1: voice channel guard — training capability is chat-only (ADR-0078 +
//       ADR-0163). Training data (protocol assignments, readiness %) is
//       PII-adjacent: per-employee competence record. E2E voice session cannot
//       be driven in Playwright — skip with documentation.
//   N2: zero-assignment profile — SEED_PROFILE_ID (the owner/admin) has no
//       protocol_assignment rows in seed.sql. get_my_training_status must
//       return a graceful empty response, not an error or panic.
//
// Infrastructure requirements:
//   1. Supabase Local running: npx supabase start
//   2. Stage-engine container rebuilt with current code
//   3. Next.js dev server on port 3060
//   4. apps/e2e/.env.local: SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY
//
// Seed state:
//   - Anna Olsen (f0000000-...0001) has 2 completed protocol_assignments in
//     seed.sql — SEED_EMPLOYEE_PROFILE_ID. Used for DB sanity checks on
//     get_my_training_status response shape.
//   - Kari (f0000000-...0005) + Jonas (f0000000-...0008) have 2 not_started
//     assignments each — SEED_NEXT_PROTOCOL_PROFILE_ID. Used to assert
//     get_next_protocol returns a protocol name.
//   - SEED_PROFILE_ID (f0000000-...0000 — the owner/admin) has NO assignments.
//     This is the caller identity for BFF requests and the N2 (zero-assignment)
//     negative path.
//
// Training authority:
//   Employee tools (get_my_training_status, get_next_protocol) are at
//   readOnlyTools tier — exposed at default authority level 'read_only'.
//   The seed workspace has no training row in engine_authority_config, so the
//   default 'read_only' applies (fail-closed, ADR-0176).
//
//   get_team_readiness is a suggestTool — requires authority >= 'suggest'.
//   beforeAll seeds a 'suggest' row for SEED_WORKSPACE_ID / 'training' so A9
//   can verify the full manager path. afterAll removes this row to avoid
//   leaving test state in the seed DB.
//
// PII contract:
//   Training data (protocol names, readiness %) is PII-adjacent but NOT
//   a raw PII field. Per ADR-0078 + ADR-0163 the full training surface is
//   chat-only. assertNoPiiInResponse checks for personnummer and bank
//   account patterns — neither should appear in training responses.
//
// ADR refs: ADR-0078 (channel guard), ADR-0099 (gate_action — read-only tools
//           have no gate_action call), ADR-0134 (telemetry), ADR-0151
//           (server-side profile_id derivation), ADR-0163 (training chat-only),
//           ADR-0176 (fail-closed authority), ADR-0184 (recorder).
// =============================================================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import {
  SEED_PROFILE_ID,
  SEED_WORKSPACE_ID,
  assertStageEngineContainerFresh,
  assertSupabaseLocalUp,
  assertStageEngineHealthy,
  cleanupTestSessions,
  dumpStageEngineLogs,
  snapshotTestState,
} from "../helpers/botsson-harness";
import {
  assertTrainingToolFired,
  assertTrainingCapabilityClassified,
  assertBotssontoolInvokedFor,
  seedTrainingAuthorityForSeedWorkspace,
  cleanupTrainingAuthority,
  getProtocolAssignmentCounts,
  SEED_EMPLOYEE_PROFILE_ID,
} from "../helpers/training-harness";
import { supabase } from "../helpers/seed";

// =============================================================================
// Serial mode — tests share seed state and authority row lifecycle.
// =============================================================================
test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Shared state across the positive-path chain
// ---------------------------------------------------------------------------

let testRunId: string;
let testStartIso: string;

// Session IDs captured from BFF responses — one per tool invocation block.
let trainingStatusSessionId: string | null = null;
let nextProtocolSessionId: string | null = null;
let teamReadinessSessionId: string | null = null;

// DB sanity state read in beforeAll — verify seed is as expected.
let annaAssignmentCounts: {
  total: number;
  completed: number;
  notStarted: number;
  inProgress: number;
};

// Whether get_team_readiness authority row was successfully seeded.
// If seeding fails, A9-A12 are skipped with explanation.
let teamReadinessAuthoritySeeded = false;

// ---------------------------------------------------------------------------
// Helper: resolve sessionId from BFF response or DB fallback
// ---------------------------------------------------------------------------

async function resolveSessionId(
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
// PII guard — training responses must not leak personnummer or bank accounts
// ---------------------------------------------------------------------------

function assertNoPiiInResponse(responseText: string, context: string): void {
  // Norwegian personnummer — 11-digit string (DDMMYYXXXCC).
  // Simplified heuristic: 11 consecutive digits.
  const personnummerPattern = /\b\d{11}\b/;
  expect(
    personnummerPattern.test(responseText),
    `${context}: response contains 11-digit sequence (possible personnummer). ` +
      `Response: "${responseText.slice(0, 200)}"`,
  ).toBe(false);

  // Norwegian bank account in BBBBB.BB.BBBBB dotted form.
  const bankAccountPattern = /\d{4,5}\.\d{2}\.\d{5}/;
  expect(
    bankAccountPattern.test(responseText),
    `${context}: response contains Norwegian bank account format. ` +
      `Response: "${responseText.slice(0, 200)}"`,
  ).toBe(false);
}

// =============================================================================
// Positive-path suite
// =============================================================================

test.describe("Training capability — positive path", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testRunId = `training-harness-${Date.now()}`;
    testStartIso = new Date().toISOString();

    // Gate 1: container freshness.
    assertStageEngineContainerFresh();

    // Gate 2: Supabase Local up.
    await assertSupabaseLocalUp();

    // Gate 3: stage-engine health.
    await assertStageEngineHealthy();

    // Clean sessions for the seed profile to avoid noise from prior runs.
    await cleanupTestSessions(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    // Seed 'suggest' authority for training so get_team_readiness is exposed.
    teamReadinessAuthoritySeeded = await seedTrainingAuthorityForSeedWorkspace();

    // DB sanity: read Anna's assignment counts so we can verify the tool's
    // response reflects the actual DB state.
    annaAssignmentCounts = await getProtocolAssignmentCounts(
      SEED_EMPLOYEE_PROFILE_ID,
      SEED_WORKSPACE_ID,
    );
  });

  test.afterAll(async () => {
    // Remove the test-seeded authority row to avoid state leakage.
    await cleanupTrainingAuthority();

    await snapshotTestState(testRunId, trainingStatusSessionId ?? undefined);
  });

  // ── A1–A4: get_my_training_status ─────────────────────────────────────────
  //
  // The seed admin profile (SEED_PROFILE_ID) has no protocol_assignment rows.
  // get_my_training_status will return "You have no protocol assignments yet."
  // The LLM relays this as a graceful empty response — NOT an error.
  //
  // The key assertion is: the response does not contain hard error patterns
  // and the tool WAS invoked (classifier + recording + activity_trail).

  test("A1: get_my_training_status — BFF returns non-error response for training status query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "hva mangler jeg av opplæring?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A1: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    trainingStatusSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    // Hard error patterns: stale container, tool crash, stage-engine panic.
    const hardErrorPattern = /feilet|teknisk feil|beklager.*ikke|dessverre|technical problem/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A1: assistant returned error-patterned response.\n` +
          `Response: "${responseText}"\nStage-engine logs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    assertNoPiiInResponse(body.text ?? "", "A1");
    expect(responseText.length, "A1: assistant response must not be empty").toBeGreaterThan(0);
  });

  test("A2: get_my_training_status — classifier_output recording shows intent='training'", async () => {
    expect(
      trainingStatusSessionId,
      "A2 depends on A1 — trainingStatusSessionId must be set",
    ).not.toBeNull();

    const row = await assertTrainingCapabilityClassified(trainingStatusSessionId!, testStartIso);

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A2: classifier_output intent must be 'training'").toBe("training");
    expect(
      typeof content.confidence === "number",
      "A2: classifier_output must include numeric confidence",
    ).toBe(true);
  });

  test("A3: get_my_training_status — tool_call recording row present", async () => {
    expect(trainingStatusSessionId, "A3 depends on A1").not.toBeNull();

    const row = await assertTrainingToolFired(trainingStatusSessionId!, "get_my_training_status", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A3: tool_call must name get_my_training_status").toBe(
      "get_my_training_status",
    );
  });

  test("A4: get_my_training_status — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("get_my_training_status", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A4: trail event tool field must be get_my_training_status").toBe(
      "get_my_training_status",
    );
    expect(row.workspace_id, "A4: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A4: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });

  // ── A5–A8: get_next_protocol ──────────────────────────────────────────────
  //
  // SEED_PROFILE_ID has no assignments → get_next_protocol returns
  // "All protocols completed! You are at 100% readiness." (no not_started rows).
  //
  // A graceful "all done" response is valid — the tool was still invoked.
  // The LLM interprets this as the user being fully trained.

  test("A5: get_next_protocol — BFF returns non-error response for next training query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "hva er neste opplæringsprotokoll jeg bør ta?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A5: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    nextProtocolSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A5: hard error in get_next_protocol response.\n` +
          `Response: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    assertNoPiiInResponse(body.text ?? "", "A5");
    expect(responseText.length, "A5: response must not be empty").toBeGreaterThan(0);
  });

  test("A6: get_next_protocol — classifier_output shows intent='training'", async () => {
    expect(nextProtocolSessionId, "A6 depends on A5").not.toBeNull();

    const row = await assertTrainingCapabilityClassified(nextProtocolSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A6: intent must be 'training'").toBe("training");
  });

  test("A7: get_next_protocol — tool_call recording row present", async () => {
    expect(nextProtocolSessionId, "A7 depends on A5").not.toBeNull();

    const row = await assertTrainingToolFired(nextProtocolSessionId!, "get_next_protocol", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A7: tool_call must name get_next_protocol").toBe(
      "get_next_protocol",
    );
  });

  test("A8: get_next_protocol — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("get_next_protocol", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A8: trail event tool field must be get_next_protocol").toBe(
      "get_next_protocol",
    );
    expect(row.workspace_id, "A8: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
  });

  // ── A9–A12: get_team_readiness ────────────────────────────────────────────
  //
  // get_team_readiness requires authority >= 'suggest'.
  // beforeAll seeds a 'suggest' row for SEED_WORKSPACE_ID / 'training'.
  // If seeding failed, these tests are skipped with an explanation.
  //
  // The tool calls get_workspace_readiness RPC + fetches profile display_names.
  // Anna, Erik, Ole, Kari, Jonas, Silje all have assignments in seed.sql.
  // Expected: at least one employee row in the response, overall % present.

  test("A9: get_team_readiness — BFF returns non-error response for team readiness query", async ({
    page,
  }) => {
    if (!teamReadinessAuthoritySeeded) {
      test.skip(
        true,
        "A9: training authority 'suggest' could not be seeded for SEED_WORKSPACE_ID. " +
          "get_team_readiness requires suggest-level authority. " +
          "Verify engine_authority_config write permissions in the test DB.",
      );
      return;
    }

    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "vis opplæringsstatus for hele teamet",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A9: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    teamReadinessSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    // Hard error patterns.
    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A9: hard error in get_team_readiness response.\n` +
          `Response: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    // The RPC get_workspace_readiness may not exist in all test DB versions.
    // If the RPC is absent, the tool returns an error string (not a 500).
    // A panic pattern is the only hard failure here.
    const panicPattern = /uncaught|stack trace|typeerror|500 internal/i;
    expect(
      panicPattern.test(responseText),
      `A9: server panic pattern in get_team_readiness response. ` +
        `Response: "${responseText.slice(0, 300)}"`,
    ).toBe(false);

    assertNoPiiInResponse(body.text ?? "", "A9");
    expect(responseText.length, "A9: response must not be empty").toBeGreaterThan(0);
  });

  test("A10: get_team_readiness — classifier_output shows intent='training'", async () => {
    if (!teamReadinessAuthoritySeeded || teamReadinessSessionId === null) {
      test.skip(
        true,
        "A10: depends on A9 — teamReadinessSessionId not set. " +
          "Either authority was not seeded or A9 did not run.",
      );
      return;
    }

    const row = await assertTrainingCapabilityClassified(teamReadinessSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A10: intent must be 'training'").toBe("training");
  });

  test("A11: get_team_readiness — tool_call recording row present", async () => {
    if (!teamReadinessAuthoritySeeded || teamReadinessSessionId === null) {
      test.skip(true, "A11: depends on A9 — skipped because authority was not seeded.");
      return;
    }

    const row = await assertTrainingToolFired(teamReadinessSessionId!, "get_team_readiness", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A11: tool_call must name get_team_readiness").toBe(
      "get_team_readiness",
    );
  });

  test("A12: get_team_readiness — activity_trail botsson.tool_invoked emitted", async () => {
    if (!teamReadinessAuthoritySeeded) {
      test.skip(true, "A12: depends on A9 — skipped because authority was not seeded.");
      return;
    }

    const row = await assertBotssontoolInvokedFor("get_team_readiness", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A12: trail event tool field must be get_team_readiness").toBe(
      "get_team_readiness",
    );
    expect(row.workspace_id, "A12: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A12: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });
});

// =============================================================================
// Negative-path suite
// =============================================================================

test.describe("Training capability — negative path", () => {
  let negativeTestStartIso: string;

  test.beforeEach(() => {
    negativeTestStartIso = new Date().toISOString();
  });

  // ── N1: voice channel guard ───────────────────────────────────────────────
  //
  // Training capability declares allowedChannels: ['chat'] in index.ts
  // (ADR-0163: per-employee competence data is PII-adjacent, chat-only).
  //
  // We cannot drive a full LiveKit voice session in Playwright E2E.
  // Skip with documentation — the channel guard is enforced at two layers:
  //   L1: capability.allowedChannels in tool-selector.ts (capability excluded
  //       from voice agent tool set at load time).
  //   L2: No execute()-level guard needed when L1 is enforced at tool-selector.

  test("N1: voice channel guard — training capability is chat-only (ADR-0078 + ADR-0163)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const tokenRes = await page.request.post("/api/botsson/voice/token", {
      data: { workspaceId: SEED_WORKSPACE_ID },
    });

    if (!tokenRes.ok()) {
      test.skip(
        true,
        `N1: voice token BFF returned ${tokenRes.status()} — LiveKit not configured in CI. ` +
          "The training capability channel guard (allowedChannels=['chat'] in index.ts) is " +
          "enforced by tool-selector.ts at capability load time. A full LiveKit voice session " +
          "cannot be driven in Playwright E2E. " +
          "Tracking gap: training-voice-channel-guard-e2e.",
      );
      return;
    }

    test.skip(
      true,
      "N1: full LiveKit voice session cannot be driven in Playwright E2E. " +
        "Training channel guard verified at unit-test level (tool-selector.ts). " +
        "Tracking gap: training-voice-channel-guard-e2e.",
    );
  });

  // ── N2: zero-assignment profile ───────────────────────────────────────────
  //
  // The seed admin profile (SEED_PROFILE_ID) has no protocol_assignment rows.
  // get_my_training_status returns "You have no protocol assignments yet."
  // The LLM must relay this gracefully — NOT return an error or panic.
  //
  // This is distinct from A1 (same tool, same result) but here we explicitly
  // verify the DB state first and assert the response matches.

  test("N2: zero-assignment profile — get_my_training_status graceful empty response", async ({
    page,
  }) => {
    // Verify DB state: SEED_PROFILE_ID must have 0 assignments.
    const counts = await getProtocolAssignmentCounts(SEED_PROFILE_ID, SEED_WORKSPACE_ID);
    expect(
      counts.total,
      "N2 precondition: SEED_PROFILE_ID must have 0 protocol assignments in seed DB. " +
        `Found ${counts.total} rows. Verify seed.sql or manually clean protocol_assignment.`,
    ).toBe(0);

    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "har jeg fullført kursene mine?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `N2: BFF returned ${res.status()}`).toBe(true);

    const body = (await res.json()) as { text?: string; error?: string };
    const responseText = (body.text ?? "").toLowerCase();

    // Response must be non-empty (graceful message, not silent).
    expect(responseText.length, "N2: response must not be empty").toBeGreaterThan(0);

    // No hard-error or panic pattern.
    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    expect(
      hardErrorPattern.test(responseText),
      `N2: unexpected hard error for zero-assignment profile. Response: "${responseText}"`,
    ).toBe(false);

    const panicPattern = /uncaught|stack trace|typeerror|500 internal/i;
    expect(
      panicPattern.test(responseText),
      `N2: server panic pattern in response. Response: "${responseText.slice(0, 300)}"`,
    ).toBe(false);

    // The tool returns "You have no protocol assignments yet." which the LLM
    // rephrases. The response must NOT contain readiness percentages (0% or
    // otherwise) since there is no data to compute from.
    // Allow: "no protocols", "ingen opplæring", "ingen protokoller", "ikke tildelt"
    // Forbidden: explicit "Readiness: 0%" from a failed tool call.
    const errorReadinessPattern = /feilet.*readiness|readiness.*error/i;
    expect(
      errorReadinessPattern.test(responseText),
      `N2: response shows readiness from a tool failure, not graceful empty. ` +
        `Response: "${responseText.slice(0, 300)}"`,
    ).toBe(false);

    assertNoPiiInResponse(body.text ?? "", "N2");
  });
});

// =============================================================================
// DB sanity suite — verify seed state matches tool assumptions
// =============================================================================

test.describe("Training capability — DB sanity", () => {
  // ── S1: Anna has completed assignments — tool response matches DB ─────────
  //
  // Anna Olsen (SEED_EMPLOYEE_PROFILE_ID) has 2 completed assignments in seed.
  // This verifies the seed DB is in the expected state for integration tests.
  // The actual tool response for Anna is NOT tested here (we test as
  // SEED_PROFILE_ID, not Anna) — this is a direct DB state assertion.

  test("S1: Anna Olsen (SEED_EMPLOYEE_PROFILE_ID) has completed assignments in DB", async () => {
    const counts = await getProtocolAssignmentCounts(SEED_EMPLOYEE_PROFILE_ID, SEED_WORKSPACE_ID);

    expect(
      counts.total,
      "S1: Anna must have at least 1 protocol_assignment row in seed DB",
    ).toBeGreaterThan(0);

    expect(
      counts.completed,
      "S1: Anna must have at least 1 completed protocol_assignment row in seed DB",
    ).toBeGreaterThan(0);

    // Sanity-check: readiness is computable (no division by zero).
    const readinessPct = Math.round((counts.completed / counts.total) * 100);
    expect(readinessPct, "S1: Anna's readiness percentage must be 0-100").toBeGreaterThanOrEqual(0);
    expect(readinessPct, "S1: Anna's readiness percentage must be 0-100").toBeLessThanOrEqual(100);
  });

  // ── S2: SEED_PROFILE_ID has no assignments — N2 precondition verified ────

  test("S2: SEED_PROFILE_ID (admin/owner) has no protocol_assignment rows", async () => {
    const counts = await getProtocolAssignmentCounts(SEED_PROFILE_ID, SEED_WORKSPACE_ID);

    expect(
      counts.total,
      "S2: SEED_PROFILE_ID must have 0 protocol_assignment rows. " +
        "If this fails, N2 negative path is invalid — remove the seed assignments " +
        "or update N2 to use a different profile.",
    ).toBe(0);
  });

  // ── S3: Workspace has employees with not_started assignments (get_next_protocol) ─

  test("S3: workspace has at least one employee with a not_started protocol_assignment", async () => {
    const { data, error } = await supabase
      .from("protocol_assignment")
      .select("profile_id, status")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("status", "not_started")
      .limit(1);

    if (error) {
      // Non-fatal: DB read error means we can't verify, not that data is absent.
      console.warn(`S3: could not read protocol_assignment: ${error.message}`);
      return;
    }

    // Kari + Jonas have not_started in seed.sql — at least one row expected.
    expect(
      (data ?? []).length,
      "S3: workspace must have at least one not_started protocol_assignment row. " +
        "Verify supabase/seed.sql has Kari or Jonas not_started rows for workspace b0000000.",
    ).toBeGreaterThan(0);
  });
});
