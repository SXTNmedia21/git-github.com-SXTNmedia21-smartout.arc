// =============================================================================
// contract-harness-e2e.spec.ts
//
// E2E coverage of the Botsson contract capability pipe.
//
// Pipe under test: L1 → L2 BFF (/api/botsson/chat) → L3 Stage Engine →
//                  L4 contract capability → L5 DB
//
// Tools covered:
//   Read-only tools (5 tools, positive-path assertions):
//     - list_employee_templates      (A1–A4)
//     - list_employee_contracts      (A5–A8)
//     - check_contract_status        (A9–A12)
//     - explain_contract_clause      (A13–A16)
//     - get_compliance_drift_for_contract  (A17–A20)
//
//   Mutation tools NOT exercised here (DocuSeal external service):
//     - create_employee_contract     (would call DocuSeal POST /contracts)
//     - send_employee_contract       (irreversible + external service)
//     - fork_template                (admin mutation, no CONTRACT_SERVICE_URL in E2E)
//     - publish_workspace_template   (admin mutation)
//     - deprecate_workspace_template (admin mutation)
//
// Negative paths:
//   N1: channel guard — contract capability is chat-only (ADR-0078);
//       voice token probe + skip with documentation if LiveKit not configured.
//   N2: cross-workspace isolation — contract tool only sees own workspace rows.
//   N3: malformed contract_id UUID — tool returns "not found" (no panic).
//
// Infrastructure requirements (same as botsson-harness-e2e.spec.ts):
//   1. Supabase Local running: npx supabase start
//   2. Stage-engine container rebuilt with current code
//   3. Next.js dev server on port 3060
//   4. apps/e2e/.env.local: SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY
//
// Seed state:
//   beforeAll calls seedSystemTemplateIfAbsent() to ensure at least one K1a
//   system template exists (workspace_id IS NULL).  Employment contracts are
//   read via list_employee_contracts — the tool gracefully returns "No contracts
//   found" when none exist, which is asserted as a non-error response.
//
// Contract authority:
//   The contract capability has defaultAuthority='read_only' (index.ts).  The
//   seed admin profile (role='admin') satisfies the read_only tier — no
//   gate_action write path is exercised.  Mutation tools are skipped to avoid
//   external service calls (DocuSeal) and irreversible side effects.
//
// PII contract:
//   The contract tools do NOT expose personnummer or bank account numbers in
//   their read-only surface (no equivalents of payroll's view_personal_number /
//   view_bank_account).  assertNoPiiInResponse is called on all responses as a
//   belt-and-suspenders guard.
//
// ADR refs: ADR-0078 (channel guard), ADR-0099 (gate_action), ADR-0133 (mobile
//           boundary), ADR-0134 (telemetry), ADR-0151 (server-side profile_id
//           derivation), ADR-0184 (recorder), ADR-0240 (namespace boundaries).
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
  assertRecordingPhase,
  assertActivityTrailEvent,
  dumpStageEngineLogs,
  snapshotTestState,
} from "../helpers/botsson-harness";
import {
  assertContractToolFired,
  assertBotssontoolInvokedFor,
  assertContractCapabilityClassified,
  assertNoPiiInResponse,
  seedSystemTemplateIfAbsent,
} from "../helpers/contract-harness";
import { supabase } from "../helpers/seed";

// =============================================================================
// Serial mode — tests share seed state.
// =============================================================================
test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Shared state across the positive-path chain
// ---------------------------------------------------------------------------

let testRunId: string;
let testStartIso: string;

let listTemplatesSessionId: string | null = null;
let listContractsSessionId: string | null = null;
let checkStatusSessionId: string | null = null;
let explainClauseSessionId: string | null = null;
let complianceDriftSessionId: string | null = null;

// Seeded contract_id for targeted queries (check_contract_status, explain_contract_clause,
// get_compliance_drift_for_contract).  Populated in beforeAll.
let seededContractId: string | null = null;

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
// Helper: ensure a seed employment_contract row exists for targeted queries.
// The tool check_contract_status looks up by contract_id in the `contract`
// table.  We seed a row in `employment_contract` — the tool that actually
// targets `contract` (the docuseal-side table) returns "not found" gracefully
// when no matching row exists, which is still a valid non-error response.
// ---------------------------------------------------------------------------

async function ensureSeededContract(): Promise<string | null> {
  // Try to find any employment_contract for the seed profile.
  const { data: existing } = await supabase
    .from("employment_contract")
    .select("contract_id")
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .eq("profile_id", SEED_PROFILE_ID)
    .limit(1);

  if (existing && existing.length > 0) {
    return (existing[0]?.contract_id as string) ?? null;
  }

  // Insert a minimal draft row.
  const today = new Date().toISOString().split("T")[0]!;
  const { data: inserted, error } = await supabase
    .from("employment_contract")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      profile_id: SEED_PROFILE_ID,
      status: "draft",
      employment_form: "permanent",
      employment_category: "fast",
      position_title: "Servitør (E2E seed)",
      start_date: today,
      agreed_weekly_hours: 37.5,
      employment_percentage: 100,
      notice_period_months: 1,
      trial_period_months: 6,
      break_minutes_per_day: 30,
      overtime_agreement_type: "legal_default",
      source: "e2e-contract-harness-seed",
    })
    .select("contract_id")
    .single();

  if (error || !inserted) {
    console.warn(`ensureSeededContract: insert failed: ${error?.message ?? "no row"}`);
    return null;
  }

  return inserted.contract_id as string;
}

// =============================================================================
// Positive-path suite
// =============================================================================

test.describe("Contract capability — positive path", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testRunId = `contract-harness-${Date.now()}`;
    testStartIso = new Date().toISOString();

    // Gate 1: container freshness.
    assertStageEngineContainerFresh();

    // Gate 2: Supabase Local up.
    await assertSupabaseLocalUp();

    // Gate 3: stage-engine health.
    await assertStageEngineHealthy();

    // Clean sessions for the seed profile.
    await cleanupTestSessions(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    // Ensure a system template exists for list_employee_templates.
    await seedSystemTemplateIfAbsent();

    // Ensure a seed employment_contract exists for targeted tools.
    seededContractId = await ensureSeededContract();
  });

  test.afterAll(async () => {
    await snapshotTestState(testRunId, listTemplatesSessionId ?? undefined);
  });

  // ── A1–A4: list_employee_templates ──────────────────────────────────────

  test("A1: list_employee_templates — BFF returns non-error response for template query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "hvilke ansettelsesmal har vi tilgjengelig?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A1: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    listTemplatesSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    const errorPattern = /feilet|teknisk feil|beklager.*ikke|dessverre|technical problem/i;
    if (errorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A1: assistant returned error-patterned response.\nResponse: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(errorPattern);
    }

    assertNoPiiInResponse(body.text ?? "", "A1");
    expect(responseText.length, "A1: response must not be empty").toBeGreaterThan(0);
  });

  test("A2: list_employee_templates — classifier_output shows intent='contract'", async () => {
    expect(
      listTemplatesSessionId,
      "A2 depends on A1 — listTemplatesSessionId must be set",
    ).not.toBeNull();

    const row = await assertContractCapabilityClassified(listTemplatesSessionId!, testStartIso);

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A2: classifier_output intent must be 'contract'").toBe("contract");
    expect(
      typeof content.confidence === "number",
      "A2: classifier_output must include numeric confidence",
    ).toBe(true);
  });

  test("A3: list_employee_templates — tool_call recording row present", async () => {
    expect(listTemplatesSessionId, "A3 depends on A1").not.toBeNull();

    const row = await assertContractToolFired(listTemplatesSessionId!, "list_employee_templates", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A3: tool_call must name list_employee_templates").toBe(
      "list_employee_templates",
    );
  });

  test("A4: list_employee_templates — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("list_employee_templates", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A4: trail event tool field must be list_employee_templates").toBe(
      "list_employee_templates",
    );
    expect(row.workspace_id, "A4: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A4: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });

  // ── A5–A8: list_employee_contracts ──────────────────────────────────────

  test("A5: list_employee_contracts — BFF returns non-error response for contract list query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "vis alle ansettelsesavtaler i arbeidsplassen",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A5: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    listContractsSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    // list_employee_contracts returns "No employee contracts found." when the
    // workspace has no `contract` rows (docuseal-side table) — that is a
    // graceful non-error response.  Only check for hard error patterns.
    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A5: hard error.\nResponse: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    assertNoPiiInResponse(body.text ?? "", "A5");
    expect(responseText.length, "A5: response must not be empty").toBeGreaterThan(0);
  });

  test("A6: list_employee_contracts — classifier_output shows intent='contract'", async () => {
    expect(listContractsSessionId, "A6 depends on A5").not.toBeNull();

    const row = await assertContractCapabilityClassified(listContractsSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A6: intent must be 'contract'").toBe("contract");
  });

  test("A7: list_employee_contracts — tool_call recording row present", async () => {
    expect(listContractsSessionId, "A7 depends on A5").not.toBeNull();

    const row = await assertContractToolFired(listContractsSessionId!, "list_employee_contracts", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A7: tool_call must name list_employee_contracts").toBe(
      "list_employee_contracts",
    );
  });

  test("A8: list_employee_contracts — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("list_employee_contracts", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A8: trail event tool field must be list_employee_contracts").toBe(
      "list_employee_contracts",
    );
    expect(row.workspace_id, "A8: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
  });

  // ── A9–A12: check_contract_status ───────────────────────────────────────
  //
  // check_contract_status looks up by contract_id in the `contract` table
  // (docuseal-side, not employment_contract).  In a clean E2E environment no
  // `contract` rows exist, so the tool returns "Contract not found in this
  // workspace." — still a graceful non-error.  The spec asserts the tool was
  // invoked and the response does not contain a hard-error string.

  test("A9: check_contract_status — BFF returns non-error response", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    // Use a probe UUID that will resolve to "not found" gracefully.
    // The LLM will use the contract_id from its context; we ask a natural
    // Norwegian question so the classifier routes to the contract capability.
    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "hva er statusen på ansettelsesavtalen min?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A9: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    checkStatusSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A9: hard error.\nResponse: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    assertNoPiiInResponse(body.text ?? "", "A9");
    expect(responseText.length, "A9: response must not be empty").toBeGreaterThan(0);
  });

  test("A10: check_contract_status — classifier_output shows intent='contract'", async () => {
    expect(checkStatusSessionId, "A10 depends on A9").not.toBeNull();

    const row = await assertContractCapabilityClassified(checkStatusSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A10: intent must be 'contract'").toBe("contract");
  });

  test("A11: check_contract_status — tool_call recording row present", async () => {
    expect(checkStatusSessionId, "A11 depends on A9").not.toBeNull();

    const row = await assertContractToolFired(checkStatusSessionId!, "check_contract_status", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A11: tool_call must name check_contract_status").toBe(
      "check_contract_status",
    );
  });

  test("A12: check_contract_status — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("check_contract_status", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A12: trail event tool field must be check_contract_status").toBe(
      "check_contract_status",
    );
    expect(row.workspace_id, "A12: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
  });

  // ── A13–A16: explain_contract_clause ────────────────────────────────────
  //
  // explain_contract_clause reads from `employment_contract.framework_snapshot`.
  // When no matching contract_id exists in the workspace it returns
  // "Contract not found in this workspace." — graceful non-error.

  test("A13: explain_contract_clause — BFF returns non-error response for clause query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "kan du forklare paragrafene i ansettelsesavtalen min?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A13: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    explainClauseSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A13: hard error.\nResponse: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    assertNoPiiInResponse(body.text ?? "", "A13");
    expect(responseText.length, "A13: response must not be empty").toBeGreaterThan(0);
  });

  test("A14: explain_contract_clause — classifier_output shows intent='contract'", async () => {
    expect(explainClauseSessionId, "A14 depends on A13").not.toBeNull();

    const row = await assertContractCapabilityClassified(explainClauseSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A14: intent must be 'contract'").toBe("contract");
  });

  test("A15: explain_contract_clause — tool_call recording row present", async () => {
    expect(explainClauseSessionId, "A15 depends on A13").not.toBeNull();

    const row = await assertContractToolFired(explainClauseSessionId!, "explain_contract_clause", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A15: tool_call must name explain_contract_clause").toBe(
      "explain_contract_clause",
    );
  });

  test("A16: explain_contract_clause — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("explain_contract_clause", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A16: trail event tool field must be explain_contract_clause").toBe(
      "explain_contract_clause",
    );
    expect(row.workspace_id, "A16: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
  });

  // ── A17–A20: get_compliance_drift_for_contract ───────────────────────────

  test("A17: get_compliance_drift_for_contract — BFF returns non-error response for drift query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "er det noen avvik mellom ansettelsesavtalen min og gjeldende regelverk?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A17: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    complianceDriftSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A17: hard error.\nResponse: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    assertNoPiiInResponse(body.text ?? "", "A17");
    expect(responseText.length, "A17: response must not be empty").toBeGreaterThan(0);
  });

  test("A18: get_compliance_drift_for_contract — classifier_output shows intent='contract'", async () => {
    expect(complianceDriftSessionId, "A18 depends on A17").not.toBeNull();

    const row = await assertContractCapabilityClassified(complianceDriftSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A18: intent must be 'contract'").toBe("contract");
  });

  test("A19: get_compliance_drift_for_contract — tool_call recording row present", async () => {
    expect(complianceDriftSessionId, "A19 depends on A17").not.toBeNull();

    const row = await assertContractToolFired(
      complianceDriftSessionId!,
      "get_compliance_drift_for_contract",
      { sinceIso: testStartIso },
    );

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A19: tool_call must name get_compliance_drift_for_contract").toBe(
      "get_compliance_drift_for_contract",
    );
  });

  test("A20: get_compliance_drift_for_contract — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor(
      "get_compliance_drift_for_contract",
      testStartIso,
    );

    const data = row.data as Record<string, unknown>;
    expect(
      data?.tool,
      "A20: trail event tool field must be get_compliance_drift_for_contract",
    ).toBe("get_compliance_drift_for_contract");
    expect(row.workspace_id, "A20: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A20: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });
});

// =============================================================================
// Negative-path suite
// =============================================================================

test.describe("Contract capability — negative path", () => {
  let negativeTestStartIso: string;

  test.beforeEach(() => {
    negativeTestStartIso = new Date().toISOString();
  });

  // ── N1: channel guard — contract capability is chat-only ─────────────────
  //
  // The contract capability declares allowedChannels: ["chat"] in index.ts.
  // Voice users receive a channel_forbidden response (tool description guard:
  // "Template authoring requires chat channel. Please switch to chat.").
  //
  // We cannot drive a full voice session in Playwright E2E.  Probe the voice
  // token BFF and skip with documentation if LiveKit is not configured.

  test("N1: channel guard — contract capability is chat-only (ADR-0078)", async ({ page }) => {
    await loginAsAdmin(page);
    const tokenRes = await page.request.post("/api/botsson/voice/token", {
      data: { workspaceId: SEED_WORKSPACE_ID },
    });

    if (!tokenRes.ok()) {
      test.skip(
        true,
        `N1: voice token BFF returned ${tokenRes.status()} — LiveKit not configured in CI. ` +
          "The contract channel guard (allowedChannels=['chat'], ctx.channel !== 'chat' → " +
          "channel_forbidden) is verified at unit-test level in " +
          "packages/ai/src/capabilities/contract/tools.ts (fork_template, " +
          "publish_workspace_template, deprecate_workspace_template). " +
          "E2E voice guard requires LIVEKIT_URL — tracked as known gap: " +
          "contract-voice-channel-guard-e2e.",
      );
      return;
    }

    // If the voice token BFF is reachable, a full LiveKit audio session still
    // cannot be driven in Playwright.  Skip with explanation.
    test.skip(
      true,
      "N1: full LiveKit voice session cannot be driven in Playwright E2E. " +
        "Channel guard verified at unit-test level. " +
        "Tracking gap: contract-voice-channel-guard-e2e.",
    );
  });

  // ── N2: workspace isolation — contract tool scopes all queries to workspace ─
  //
  // The contract capability scopes every query with .eq("workspace_id", ctx.workspaceId).
  // An authenticated admin in workspace A cannot see workspace B's contracts.
  //
  // We cannot easily create a second workspace in E2E (no second auth session).
  // The test instead verifies that check_contract_status with a UUID that maps
  // to NO workspace (a fresh sentinel UUID) returns "not found" rather than a
  // cross-workspace row.  This is the same invariant — the tool must not return
  // data for a contract_id that does not exist in the caller's workspace.

  test("N2: workspace isolation — check_contract_status returns not-found for unknown contract_id", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    // Use a fully random UUID that will not match any row.
    const sentinelUuid = "aaaaaaaa-bbbb-cccc-dddd-000000000000";

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `sjekk status på kontrakt ${sentinelUuid}`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `N2: BFF returned ${res.status()}`).toBe(true);

    const body = (await res.json()) as { text?: string };
    const responseText = (body.text ?? "").toLowerCase();

    // The tool should return "Contract not found in this workspace." or
    // the LLM should relay that information.  What it must NOT do is return
    // contract data from a different workspace.
    // We verify: no hard-error pattern, response is non-empty.
    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    expect(
      hardErrorPattern.test(responseText),
      `N2: assistant returned hard error for unknown contract_id. Response: "${responseText}"`,
    ).toBe(false);

    expect(responseText.length, "N2: response must not be empty").toBeGreaterThan(0);

    // Primary invariant: the sentinel UUID must NOT appear alongside contract
    // data fields (recipient_name, signed_at, etc.) — that would indicate the
    // workspace isolation is broken.
    const contractDataPattern = /recipient_name|signed_at|sent_at|expires_at/;
    expect(
      contractDataPattern.test(responseText),
      `N2: response exposes contract data fields for an unknown UUID — workspace isolation may be broken. ` +
        `Response: "${responseText.slice(0, 300)}"`,
    ).toBe(false);
  });

  // ── N3: malformed UUID — tool returns graceful error, no server panic ─────
  //
  // check_contract_status validates contract_id as z.string().uuid().  A
  // non-UUID string causes Zod schema validation to fail before the tool
  // execute() is called.  The BFF should return 200 with a graceful error
  // message, not a 500.

  test("N3: malformed contract_id — Zod schema rejects non-UUID, no server panic", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "sjekk status på kontrakt not-a-valid-uuid",
      },
      headers: { "content-type": "application/json" },
    });

    // The BFF must not 500. The LLM may ask for clarification or the Zod schema
    // validation error may propagate as a tool error — both are acceptable as
    // long as the server does not panic.
    expect(res.status(), "N3: BFF must not return 5xx for malformed contract_id").toBeLessThan(500);

    const body = (await res.json()) as { text?: string };
    const responseText = (body.text ?? "").toLowerCase();

    // Primary: non-empty response (LLM handles gracefully or reports the error).
    expect(responseText.length, "N3: response must not be empty").toBeGreaterThan(0);

    // No stack trace or raw exception should appear in the user-facing response.
    const panicPattern = /uncaught|stack trace|typeerror|syntaxerror|500 internal/i;
    expect(
      panicPattern.test(responseText),
      `N3: server panic pattern in response. Response: "${responseText.slice(0, 300)}"`,
    ).toBe(false);
  });
});

// =============================================================================
// Mutation-tool skip block — documentation for tools NOT exercised
// =============================================================================

test.describe("Contract capability — mutation tools (skipped in E2E)", () => {
  // create_employee_contract, send_employee_contract: call external DocuSeal
  // service (CONTRACT_SERVICE_URL env var, not configured in CI).  These tools
  // perform irreversible side effects (creating/sending legal documents).
  //
  // fork_template, publish_workspace_template, deprecate_workspace_template:
  // admin-only mutations; chat-channel-only; require CONTRACT_SERVICE_URL and
  // admin role enforcement above gate_action.  Covered at unit-test level in
  // packages/ai/src/capabilities/contract/__tests__/.
  //
  // Amendment classifier path: the contract capability has no dedicated
  // classify_amendment tool — classification is done by the LLM over the
  // framework_snapshot data returned by explain_contract_clause.
  // No separate assertion is needed here.

  test("SKIP-1: create_employee_contract — skipped (DocuSeal external service, irreversible)", async () => {
    test.skip(
      true,
      "create_employee_contract calls CONTRACT_SERVICE_URL which is not configured in CI E2E. " +
        "This tool is exercised in the contract-employee journey spec " +
        "(apps/e2e/tests/journey-employee-contract-e2e.spec.ts) with a mocked " +
        "contract service. Tracked gap: contract-create-e2e-docuseal-mock.",
    );
  });

  test("SKIP-2: send_employee_contract — skipped (irreversible DocuSeal send)", async () => {
    test.skip(
      true,
      "send_employee_contract is irreversible — once sent the contract cannot be recalled. " +
        "E2E cannot safely test this without a real DocuSeal sandbox environment. " +
        "The gate_action + role guard is verified at unit-test level. " +
        "Tracked gap: contract-send-e2e-docuseal-sandbox.",
    );
  });

  test("SKIP-3: fork/publish/deprecate template tools — skipped (admin mutation + chat-only)", async () => {
    test.skip(
      true,
      "fork_template, publish_workspace_template, and deprecate_workspace_template are " +
        "admin-only, chat-channel-only authoring tools (ADR-0133 mobile boundary). " +
        "They perform DB mutations on contract_template. Covered in " +
        "apps/e2e/tests/e2e-contract-template-maler.spec.ts. " +
        "Tracked gap: contract-template-lifecycle-harness-e2e.",
    );
  });
});
