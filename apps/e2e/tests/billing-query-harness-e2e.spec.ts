// =============================================================================
// billing-query-harness-e2e.spec.ts
//
// E2E coverage of the Botsson billing_query capability (ADR-0118).
//
// Pipe under test: L1 → L2 BFF (/api/botsson/chat) → L3 Stage Engine →
//                  L4 billing_query capability → L5 DB (invoice, usage_snapshot,
//                  invoice_dispatch tables via resolveCompanyId → company_id scope)
//
// Read-only tools covered (all 6):
//   - list_my_invoices          (A1–A4)
//   - get_my_invoice            (A5–A8)
//   - explain_invoice_basis     (A9–A12)
//   - list_overdue_invoices     (A13–A16)
//   - list_invoice_dispatches   (A17–A20)
//   - get_usage_snapshot        (A21–A24)
//
// No mutation tools — billing_query has tools=[] and readOnlyTools=[all 6].
// The agent cannot mark invoices paid, void, or issue credit notes.
//
// Negative paths:
//   N1: voice channel guard — billing_query is chat-only (ADR-0078).
//       All 6 tools call requireChatChannel() and return an error if
//       ctx.channel !== 'chat'.  E2E voice session cannot be driven in
//       Playwright — skip with documentation.
//   N2: cross-workspace isolation — sentinel UUID not in caller's workspace
//       returns "not found" without leaking data from other companies.
//   N3: malformed invoice_id — Zod schema rejects non-UUID, no server panic.
//
// Infrastructure requirements:
//   1. Supabase Local running: npx supabase start
//   2. Stage-engine container rebuilt with current code
//   3. Next.js dev server on port 3060
//   4. apps/e2e/.env.local: SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY
//
// Seed state:
//   beforeAll calls seedInvoiceForSeedCompanyIfAbsent() to ensure at least
//   one invoice exists for company a0000000-...0 (the seed workspace company).
//   Tools return graceful empty-list or "not found" when data is absent —
//   both are valid non-error responses for assertion purposes.
//
// Billing authority:
//   Migration 20260417170000_billing_query_authority_seed.sql seeds
//   billing_query at level 'read_only' for the seed workspaces.
//   The seed admin profile (role='admin') satisfies the read_only tier.
//
// Channel guard (ADR-0078):
//   All billing tools are chat-only. requireChatChannel() guards every
//   execute() body. This is belt-and-suspenders — the capability also
//   declares allowedChannels: ['chat'] in index.ts.
//
// Financial PII contract:
//   Invoice amounts, totals, and periods are NOT PII — they are the
//   legitimate narration output of billing tools. assertNoFinancialPiiInResponse
//   guards against raw IBAN/card-number sequences only.
//
// resolveCompanyId security note:
//   resolveCompanyId reads workspace.company_id via the service-role client.
//   Every tool verifies the resolved company_id before returning data —
//   this is the workspace→company scope boundary (ADR-0118).
//
// ADR refs: ADR-0078 (channel guard), ADR-0099 (gate_action),
//           ADR-0118 (billing engine C3 commercial consumer),
//           ADR-0134 (telemetry), ADR-0151 (server-side profile_id derivation),
//           ADR-0184 (recorder), ADR-0240 (namespace boundaries).
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
  assertBillingToolFired,
  assertBillingCapabilityClassified,
  assertBotssontoolInvokedFor,
  assertNoFinancialPiiInResponse,
  seedInvoiceForSeedCompanyIfAbsent,
  SEED_INVOICE_ID,
} from "../helpers/billing-harness";
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

// Session IDs captured from BFF responses — one per tool invocation block.
let listInvoicesSessionId: string | null = null;
let getInvoiceSessionId: string | null = null;
let explainBasisSessionId: string | null = null;
let listOverdueSessionId: string | null = null;
let listDispatchesSessionId: string | null = null;
let usageSnapshotSessionId: string | null = null;

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

// =============================================================================
// Positive-path suite
// =============================================================================

test.describe("Billing-query capability — positive path", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testRunId = `billing-query-harness-${Date.now()}`;
    testStartIso = new Date().toISOString();

    // Gate 1: container freshness.
    assertStageEngineContainerFresh();

    // Gate 2: Supabase Local up.
    await assertSupabaseLocalUp();

    // Gate 3: stage-engine health.
    await assertStageEngineHealthy();

    // Clean sessions for the seed profile to avoid noise from prior runs.
    await cleanupTestSessions(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    // Ensure at least one invoice exists for the seed company so
    // list_my_invoices returns a non-empty result.
    await seedInvoiceForSeedCompanyIfAbsent();
  });

  test.afterAll(async () => {
    await snapshotTestState(testRunId, listInvoicesSessionId ?? undefined);
  });

  // ── A1–A4: list_my_invoices ──────────────────────────────────────────────

  test("A1: list_my_invoices — BFF returns non-error response for invoice list query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "vis fakturaene våre",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A1: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    listInvoicesSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    // Error-pattern check: stale container or tool failure manifests as apology.
    const errorPattern = /feilet|teknisk feil|beklager.*ikke|dessverre|technical problem/i;
    if (errorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A1: assistant returned error-patterned response.\n` +
          `Response: "${responseText}"\nStage-engine logs:\n${logs}`,
      ).not.toMatch(errorPattern);
    }

    assertNoFinancialPiiInResponse(body.text ?? "", "A1");
    expect(responseText.length, "A1: assistant response must not be empty").toBeGreaterThan(0);
  });

  test("A2: list_my_invoices — classifier_output recording shows intent='billing_query'", async () => {
    expect(
      listInvoicesSessionId,
      "A2 depends on A1 — listInvoicesSessionId must be set",
    ).not.toBeNull();

    const row = await assertBillingCapabilityClassified(listInvoicesSessionId!, testStartIso);

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A2: classifier_output intent must be 'billing_query'").toBe(
      "billing_query",
    );
    expect(
      typeof content.confidence === "number",
      "A2: classifier_output must include numeric confidence",
    ).toBe(true);
  });

  test("A3: list_my_invoices — tool_call recording row present for list_my_invoices", async () => {
    expect(listInvoicesSessionId, "A3 depends on A1").not.toBeNull();

    const row = await assertBillingToolFired(listInvoicesSessionId!, "list_my_invoices", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A3: tool_call must name list_my_invoices").toBe("list_my_invoices");
  });

  test("A4: list_my_invoices — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("list_my_invoices", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A4: trail event tool field must be list_my_invoices").toBe(
      "list_my_invoices",
    );
    expect(row.workspace_id, "A4: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A4: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });

  // ── A5–A8: get_my_invoice ────────────────────────────────────────────────
  //
  // get_my_invoice looks up a specific invoice_id with company_id scope check.
  // The seeded invoice (SEED_INVOICE_ID) belongs to the seed company — the LLM
  // can be guided to call the tool with that ID.  When no invoice_id is known,
  // the tool returns "Invoice not found." gracefully — still a non-error response.

  test("A5: get_my_invoice — BFF returns non-error response for single invoice query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `vis detaljer for faktura ${SEED_INVOICE_ID}`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A5: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    getInvoiceSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    // get_my_invoice returns the invoice data OR "Invoice not found." — both OK.
    // Check only for hard error patterns.
    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A5: hard error in get_my_invoice response.\n` +
          `Response: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    assertNoFinancialPiiInResponse(body.text ?? "", "A5");
    expect(responseText.length, "A5: response must not be empty").toBeGreaterThan(0);
  });

  test("A6: get_my_invoice — classifier_output shows intent='billing_query'", async () => {
    expect(getInvoiceSessionId, "A6 depends on A5").not.toBeNull();

    const row = await assertBillingCapabilityClassified(getInvoiceSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A6: intent must be 'billing_query'").toBe("billing_query");
  });

  test("A7: get_my_invoice — tool_call recording row present", async () => {
    expect(getInvoiceSessionId, "A7 depends on A5").not.toBeNull();

    const row = await assertBillingToolFired(getInvoiceSessionId!, "get_my_invoice", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A7: tool_call must name get_my_invoice").toBe("get_my_invoice");
  });

  test("A8: get_my_invoice — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("get_my_invoice", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A8: trail event tool field must be get_my_invoice").toBe("get_my_invoice");
    expect(row.workspace_id, "A8: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
  });

  // ── A9–A12: explain_invoice_basis ────────────────────────────────────────
  //
  // explain_invoice_basis calls the get_invoice_basis RPC.
  // It refuses draft invoices and non-existent invoice_ids gracefully.
  // The seed invoice status is 'paid' — RPC should execute.
  // If the RPC is not yet deployed (CI clean DB), the tool returns an
  // error string from the DB driver — this is still a non-panic response.

  test("A9: explain_invoice_basis — BFF returns non-error response for basis explanation", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `forklar grunnlaget for faktura ${SEED_INVOICE_ID}`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A9: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    explainBasisSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    // explain_invoice_basis may return "RPC not found" if get_invoice_basis is
    // not deployed in the test DB — the tool propagates the error string as-is.
    // Hard-failure (5xx from BFF) is NOT acceptable; a graceful DB error is OK.
    const hardPanicPattern = /uncaught|stack trace|typeerror|500 internal/i;
    if (hardPanicPattern.test(responseText)) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A9: server panic pattern in explain_invoice_basis response.\n` +
          `Response: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardPanicPattern);
    }

    assertNoFinancialPiiInResponse(body.text ?? "", "A9");
    expect(responseText.length, "A9: response must not be empty").toBeGreaterThan(0);
  });

  test("A10: explain_invoice_basis — classifier_output shows intent='billing_query'", async () => {
    expect(explainBasisSessionId, "A10 depends on A9").not.toBeNull();

    const row = await assertBillingCapabilityClassified(explainBasisSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A10: intent must be 'billing_query'").toBe("billing_query");
  });

  test("A11: explain_invoice_basis — tool_call recording row present", async () => {
    expect(explainBasisSessionId, "A11 depends on A9").not.toBeNull();

    const row = await assertBillingToolFired(explainBasisSessionId!, "explain_invoice_basis", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A11: tool_call must name explain_invoice_basis").toBe(
      "explain_invoice_basis",
    );
  });

  test("A12: explain_invoice_basis — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("explain_invoice_basis", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A12: trail event tool field must be explain_invoice_basis").toBe(
      "explain_invoice_basis",
    );
    expect(row.workspace_id, "A12: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
  });

  // ── A13–A16: list_overdue_invoices ───────────────────────────────────────
  //
  // list_overdue_invoices queries invoices with status='overdue'.
  // The seed invoice is 'paid' — the tool will return an empty list, which
  // is a valid graceful response.  The days_overdue enrichment logic is
  // only exercised when actual overdue rows exist.

  test("A13: list_overdue_invoices — BFF returns non-error response for overdue query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "er det noen forfalte fakturaer?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A13: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    listOverdueSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    // The tool may return empty list JSON "[]" — the LLM narrates "no overdue invoices".
    // That is NOT an error response.
    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A13: hard error in list_overdue_invoices response.\n` +
          `Response: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    assertNoFinancialPiiInResponse(body.text ?? "", "A13");
    expect(responseText.length, "A13: response must not be empty").toBeGreaterThan(0);
  });

  test("A14: list_overdue_invoices — classifier_output shows intent='billing_query'", async () => {
    expect(listOverdueSessionId, "A14 depends on A13").not.toBeNull();

    const row = await assertBillingCapabilityClassified(listOverdueSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A14: intent must be 'billing_query'").toBe("billing_query");
  });

  test("A15: list_overdue_invoices — tool_call recording row present", async () => {
    expect(listOverdueSessionId, "A15 depends on A13").not.toBeNull();

    const row = await assertBillingToolFired(listOverdueSessionId!, "list_overdue_invoices", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A15: tool_call must name list_overdue_invoices").toBe(
      "list_overdue_invoices",
    );
  });

  test("A16: list_overdue_invoices — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("list_overdue_invoices", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A16: trail event tool field must be list_overdue_invoices").toBe(
      "list_overdue_invoices",
    );
    expect(row.workspace_id, "A16: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A16: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });

  // ── A17–A20: list_invoice_dispatches ────────────────────────────────────
  //
  // list_invoice_dispatches returns dispatch rows from invoice_dispatch.
  // For the seed invoice there are no dispatch rows (the tool returns []).
  // The PII masking logic (maskEmail / sanitiseTarget) is only exercised
  // when dispatch rows exist — we verify the tool is invoked and no panic occurs.

  test("A17: list_invoice_dispatches — BFF returns non-error response for dispatch query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `ble faktura ${SEED_INVOICE_ID} sendt, og til hvem?`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A17: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    listDispatchesSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A17: hard error in list_invoice_dispatches response.\n` +
          `Response: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    // The dispatch response must NOT contain raw email addresses — maskEmail()
    // must have run if dispatch rows exist.  We assert no unmasked email pattern
    // that shows more than the first character before '@'.
    const unmaskedEmailPattern = /\b[a-z]{2,}[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
    if (unmaskedEmailPattern.test(body.text ?? "")) {
      // Check it is a masked form: first char + "***" before "@"
      const maskedEmailPattern = /[a-z]\*{3}@[a-z0-9.-]+\.[a-z]{2,}/i;
      expect(
        maskedEmailPattern.test(body.text ?? ""),
        `A17: response contains an unmasked email address. ` +
          `list_invoice_dispatches must mask recipient PII (maskEmail). ` +
          `Response: "${(body.text ?? "").slice(0, 200)}"`,
      ).toBe(true);
    }

    assertNoFinancialPiiInResponse(body.text ?? "", "A17");
    expect(responseText.length, "A17: response must not be empty").toBeGreaterThan(0);
  });

  test("A18: list_invoice_dispatches — classifier_output shows intent='billing_query'", async () => {
    expect(listDispatchesSessionId, "A18 depends on A17").not.toBeNull();

    const row = await assertBillingCapabilityClassified(listDispatchesSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A18: intent must be 'billing_query'").toBe("billing_query");
  });

  test("A19: list_invoice_dispatches — tool_call recording row present", async () => {
    expect(listDispatchesSessionId, "A19 depends on A17").not.toBeNull();

    const row = await assertBillingToolFired(listDispatchesSessionId!, "list_invoice_dispatches", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A19: tool_call must name list_invoice_dispatches").toBe(
      "list_invoice_dispatches",
    );
  });

  test("A20: list_invoice_dispatches — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("list_invoice_dispatches", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A20: trail event tool field must be list_invoice_dispatches").toBe(
      "list_invoice_dispatches",
    );
    expect(row.workspace_id, "A20: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
  });

  // ── A21–A24: get_usage_snapshot ──────────────────────────────────────────
  //
  // get_usage_snapshot queries usage_snapshot by company_id + workspace_id +
  // period.  No usage_snapshot rows are seeded for the seed workspace — the
  // tool returns "No snapshot found for this workspace + period." gracefully.
  // The assertion verifies: tool was called, no hard error, no panic.

  test("A21: get_usage_snapshot — BFF returns non-error response for usage query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    // Ask for the January 2026 usage snapshot for the seed workspace.
    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `vis bruksstatistikken for arbeidsplassen ${SEED_WORKSPACE_ID} i januar 2026 (periode fra 2026-01-01 til 2026-01-31)`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A21: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    usageSnapshotSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    // "No snapshot found" is a graceful non-error.  Only check hard failure.
    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A21: hard error in get_usage_snapshot response.\n` +
          `Response: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    assertNoFinancialPiiInResponse(body.text ?? "", "A21");
    expect(responseText.length, "A21: response must not be empty").toBeGreaterThan(0);
  });

  test("A22: get_usage_snapshot — classifier_output shows intent='billing_query'", async () => {
    expect(usageSnapshotSessionId, "A22 depends on A21").not.toBeNull();

    const row = await assertBillingCapabilityClassified(usageSnapshotSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A22: intent must be 'billing_query'").toBe("billing_query");
  });

  test("A23: get_usage_snapshot — tool_call recording row present", async () => {
    expect(usageSnapshotSessionId, "A23 depends on A21").not.toBeNull();

    const row = await assertBillingToolFired(usageSnapshotSessionId!, "get_usage_snapshot", {
      sinceIso: testStartIso,
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A23: tool_call must name get_usage_snapshot").toBe(
      "get_usage_snapshot",
    );
  });

  test("A24: get_usage_snapshot — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertBotssontoolInvokedFor("get_usage_snapshot", testStartIso);

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A24: trail event tool field must be get_usage_snapshot").toBe(
      "get_usage_snapshot",
    );
    expect(row.workspace_id, "A24: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A24: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });
});

// =============================================================================
// Negative-path suite
// =============================================================================

test.describe("Billing-query capability — negative path", () => {
  let negativeTestStartIso: string;

  test.beforeEach(() => {
    negativeTestStartIso = new Date().toISOString();
  });

  // ── N1: voice channel guard ───────────────────────────────────────────────
  //
  // All billing tools call requireChatChannel() in their execute() body and
  // return "Error: billing tools are chat-only." when ctx.channel !== 'chat'.
  // The capability also declares allowedChannels: ['chat'] in index.ts.
  //
  // We cannot drive a full LiveKit voice session in Playwright E2E.
  // Skip with documentation — the channel guard is verified at unit-test level.

  test("N1: voice channel guard — billing_query is chat-only (ADR-0078)", async ({ page }) => {
    await loginAsAdmin(page);
    const tokenRes = await page.request.post("/api/botsson/voice/token", {
      data: { workspaceId: SEED_WORKSPACE_ID },
    });

    if (!tokenRes.ok()) {
      test.skip(
        true,
        `N1: voice token BFF returned ${tokenRes.status()} — LiveKit not configured in CI. ` +
          "The billing_query channel guard (requireChatChannel() in every tool execute() body + " +
          "allowedChannels=['chat'] in capability index.ts) is verified at unit-test level. " +
          "E2E voice guard requires a full LiveKit session — tracked as known gap: " +
          "billing-query-voice-channel-guard-e2e.",
      );
      return;
    }

    // If voice token BFF is available, a full LiveKit audio session still cannot
    // be driven in Playwright.
    test.skip(
      true,
      "N1: full LiveKit voice session cannot be driven in Playwright E2E. " +
        "Channel guard verified at unit-test level. " +
        "Tracking gap: billing-query-voice-channel-guard-e2e.",
    );
  });

  // ── N2: cross-workspace / cross-company isolation ─────────────────────────
  //
  // get_my_invoice with an invoice_id that belongs to a DIFFERENT company
  // must return "Invoice does not belong to your company." — NOT the invoice data.
  //
  // The billing seed companies (a1000000-...) have invoices that belong to their
  // own workspaces.  The seed admin is in workspace b0000000 (company a0000000).
  // Querying a Villa Mat invoice (fa000001-...) should be denied by the
  // company_id scope check in get_my_invoice.execute().

  test("N2: cross-company isolation — get_my_invoice denies invoice from different company", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    // Use a Villa Mat invoice_id (company a1000000) — accessible via DB but
    // scoped to a different company than the caller's workspace.
    const villaMatInvoiceId = "fa000001-0000-0000-0000-000000000001";

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `vis detaljer for faktura ${villaMatInvoiceId}`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `N2: BFF returned ${res.status()}`).toBe(true);

    const body = (await res.json()) as { text?: string };
    const responseText = (body.text ?? "").toLowerCase();

    // The tool returns "Invoice does not belong to your company." which the LLM
    // relays to the user.  The invoice DATA must not appear in the response.
    // We verify: no Villa Mat-specific amounts or company fields are returned.
    const villaMatAmountPattern = /3125|villa mat/i;
    expect(
      villaMatAmountPattern.test(body.text ?? ""),
      `N2: response contains Villa Mat invoice data for a cross-company invoice_id. ` +
        `company_id scope check in get_my_invoice.execute() may be broken. ` +
        `Response: "${(body.text ?? "").slice(0, 300)}"`,
    ).toBe(false);

    // Primary: response must be non-empty (graceful denial, not silent).
    expect(responseText.length, "N2: response must not be empty").toBeGreaterThan(0);

    // No hard-error panic.
    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    expect(
      hardErrorPattern.test(responseText),
      `N2: unexpected hard error for cross-company invoice query. Response: "${responseText}"`,
    ).toBe(false);
  });

  // ── N3: malformed invoice_id — Zod schema rejects, no server panic ────────
  //
  // get_my_invoice requires z.string().uuid().  A non-UUID string causes Zod
  // schema validation to fail before execute() is called.  The BFF must return
  // 200 with a graceful message, not a 500.

  test("N3: malformed invoice_id — Zod schema rejects non-UUID, no server panic", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "vis faktura not-a-valid-uuid",
      },
      headers: { "content-type": "application/json" },
    });

    // The BFF must not 500.
    expect(res.status(), "N3: BFF must not return 5xx for malformed invoice_id").toBeLessThan(500);

    const body = (await res.json()) as { text?: string };
    const responseText = (body.text ?? "").toLowerCase();

    // Non-empty response — LLM handles gracefully or reports the schema error.
    expect(responseText.length, "N3: response must not be empty").toBeGreaterThan(0);

    // No stack trace or raw exception in the user-facing response.
    const panicPattern = /uncaught|stack trace|typeerror|syntaxerror|500 internal/i;
    expect(
      panicPattern.test(responseText),
      `N3: server panic pattern in response. Response: "${responseText.slice(0, 300)}"`,
    ).toBe(false);
  });
});

// =============================================================================
// PII masking inline verification — list_invoice_dispatches email guard
// =============================================================================
//
// The maskEmail() function in tools.ts must mask the `email`/`to` field in
// dispatch rows before the LLM sees them.  A direct DB read here confirms
// the seed invoice has no dispatch rows (so the PII path is not exercised
// in A17) — and documents where to add dispatch rows to exercise masking
// in a future test run.

test.describe("Billing-query capability — email masking verification", () => {
  test("M1: seed invoice has no dispatch rows — document gap for masking coverage", async () => {
    // Direct DB read to confirm dispatch table state for the seed invoice.
    const { data: dispatches } = await supabase
      .from("invoice_dispatch")
      .select("channel, status, created_at")
      .eq("invoice_id", SEED_INVOICE_ID)
      .limit(5);

    if (!dispatches || dispatches.length === 0) {
      // Expected state for a freshly seeded E2E invoice.  Document the gap.
      test.skip(
        true,
        "M1: seed invoice has no invoice_dispatch rows — maskEmail() PII path not exercised. " +
          "To exercise: insert a dispatch row for SEED_INVOICE_ID with " +
          "target={email:'test@example.com'} and re-run A17. " +
          "Tracked gap: billing-query-email-masking-e2e.",
      );
      return;
    }

    // If dispatch rows somehow exist, verify channel is known.
    const knownChannels = ["email", "api", "webhook", "manual"];
    for (const d of dispatches) {
      expect(
        knownChannels.includes(d.channel as string),
        `M1: unexpected dispatch channel "${d.channel}"`,
      ).toBe(true);
    }
  });
});
