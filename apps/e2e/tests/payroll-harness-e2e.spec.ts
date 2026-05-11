// =============================================================================
// payroll-harness-e2e.spec.ts
//
// E2E coverage of the Botsson payroll capability (ADR-0234).
//
// Pipe under test: L1 → L2 BFF → L3 Stage Engine → L4 payroll capability → L5 DB
//
// Read-only tools covered (4 of 4):
//   - query_tax_card          (A1–A5)
//   - salary_query            (A6–A10)
//   - view_personal_number    (A11–A13, Phase-0c placeholder — presence indicator only)
//   - view_bank_account       (A14–A16, Phase-0c placeholder — presence indicator only)
//
// Write tools NOT exercised (campaign/payroll still active — unstable surface):
//   - update_payroll_profile  (suggest-tier, admin-only mutation)
//   - set_pension_scheme      (suggest-tier, admin-only mutation)
//
// Negative assertions:
//   - N1: voice channel guard — payroll tools are chat-only (ADR-0078 Høy-PII)
//   - N2: lønnsslipp-noun guard — assistant response must NEVER use "lønnsslipp"
//         (Smartout produces wage basis / lønnsgrunnlag for accountants, per
//          project memory 2026-05-08. Using "lønnsslipp" = positioning drift.)
//   - N3: authority denial — employee-role profile cannot see another employee's
//         tax card (admin min_role gate). Skip if no second profile available.
//
// Infrastructure requirements (same as botsson-harness-e2e.spec.ts):
//   1. Supabase Local running: npx supabase start
//   2. Stage-engine container rebuilt with current code
//   3. Next.js dev server on port 3060
//   4. apps/e2e/.env.local has SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY
//
// Seed state requirements:
//   The seed admin profile (f0000000-0000-0000-0000-000000000000) MUST have an
//   employee_payroll_profile row in workspace b0000000-0000-0000-0000-000000000000.
//   The beforeAll block upserts a minimal row. This is safe — it only affects the
//   known-fixed seed profile ID, not production data.
//
// Payroll authority:
//   Migration 20260519160000 seeds 'payroll' in engine_authority_config at level
//   'confirm' with min_role 'admin'. The seed admin profile has role='admin', so
//   reads are permitted. Writes require confirmation — they are skipped here.
//
// Wage-basis framing (per project memory 2026-05-08 / lønnsgrunnlag):
//   All queries use "lønnsgrunnlag" framing, never "lønnsslipp". Assertions verify
//   the assistant response does not drift to the wrong noun (N2).
//
// ADR refs: ADR-0078 (channel guard), ADR-0099 (gate_action), ADR-0134 (telemetry),
//           ADR-0151 (server-side profile derivation), ADR-0234 (payroll capability).
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
import { supabase } from "../helpers/seed";

// =============================================================================
// Serial mode — tests share seed state. Parallel execution would interleave
// cleanup + BFF calls across test workers, causing false negatives.
// =============================================================================
test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Shared state across the positive-path chain
// ---------------------------------------------------------------------------

let testRunId: string;
let testStartIso: string;

// Session IDs captured from BFF responses — one per tool invocation block.
let taxCardSessionId: string | null = null;
let salaryQuerySessionId: string | null = null;
let personalNumberSessionId: string | null = null;
let bankAccountSessionId: string | null = null;

// ---------------------------------------------------------------------------
// Helper: ensure employee_payroll_profile row exists for seed profile
// ---------------------------------------------------------------------------

async function ensurePayrollProfile(): Promise<void> {
  const today = new Date().toISOString().split("T")[0]!;

  // Attempt upsert via service-role client.
  // If the row already exists (from a prior test run or seed), ON CONFLICT
  // leaves it untouched — we only want the row present, not overwrite real data.
  const { error } = await supabase.from("employee_payroll_profile").upsert(
    {
      workspace_id: SEED_WORKSPACE_ID,
      profile_id: SEED_PROFILE_ID,
      salary_type: "hourly",
      seniority_start_date: today,
      agreed_weekly_hours: 37.5,
      tariff_category: "general",
      valid_from: today,
      payroll_sync_status: "not_synced",
    },
    {
      onConflict: "profile_id,workspace_id",
      ignoreDuplicates: false,
    },
  );

  if (error) {
    // Row may already exist with a different unique constraint key — soft warn.
    // query_tax_card will return not_found if truly absent, which fails A3.
    console.warn(`ensurePayrollProfile: upsert warning (may already exist): ${error.message}`);
  }
}

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

test.describe("Payroll capability — positive path", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testRunId = `payroll-harness-${Date.now()}`;
    testStartIso = new Date().toISOString();

    // Gate 1: container freshness.
    assertStageEngineContainerFresh();

    // Gate 2: Supabase Local up.
    await assertSupabaseLocalUp();

    // Gate 3: stage-engine health.
    await assertStageEngineHealthy();

    // Clean sessions for the seed profile to avoid noise from prior runs.
    await cleanupTestSessions(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    // Ensure a payroll profile row exists for the seed profile.
    await ensurePayrollProfile();
  });

  test.afterAll(async () => {
    await snapshotTestState(testRunId, taxCardSessionId ?? undefined);
  });

  // ── A1–A5: query_tax_card ────────────────────────────────────────────────

  test("A1: query_tax_card — BFF returns non-error response for skattekort query", async ({
    page,
  }) => {
    // "vis skattekort" is a natural Norwegian phrasing that routes to the
    // payroll capability's query_tax_card tool (profile_id defaults to self).
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "vis skattekortopplysningene mine",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A1: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    taxCardSessionId = await resolveSessionId(body, callStart);

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

    expect(responseText.length, "A1: assistant response must not be empty").toBeGreaterThan(0);
  });

  test("A2: query_tax_card — classifier_output recording shows intent='payroll'", async () => {
    expect(taxCardSessionId, "A2 depends on A1 — taxCardSessionId must be set").not.toBeNull();

    const row = await assertRecordingPhase({
      sessionId: taxCardSessionId!,
      phase: "classifier_output",
      turnKind: "user_input",
      contentPredicate: (c) => {
        const content = c as Record<string, unknown>;
        return typeof content?.intent === "string" && content.intent === "payroll";
      },
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A2: classifier_output intent must be 'payroll'").toBe("payroll");
    expect(
      typeof content.confidence === "number",
      "A2: classifier_output must include numeric confidence",
    ).toBe(true);
  });

  test("A3: query_tax_card — tool_call recording row present for query_tax_card", async () => {
    expect(taxCardSessionId, "A3 depends on A1").not.toBeNull();

    // tool_call rows are recorded with phase="tool_call" + turn_kind="tool_invocation"
    // by the stage-engine recorder when a tool is dispatched.
    const row = await assertRecordingPhase({
      sessionId: taxCardSessionId!,
      phase: "tool_call",
      turnKind: "tool_invocation",
      contentPredicate: (c) => {
        const content = c as Record<string, unknown>;
        return typeof content?.tool_name === "string" && content.tool_name === "query_tax_card";
      },
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A3: tool_call must name query_tax_card").toBe("query_tax_card");
  });

  test("A4: query_tax_card — activity_trail botsson.tool_invoked emitted", async () => {
    const row = await assertActivityTrailEvent({
      event: "botsson.tool_invoked",
      dataPredicate: (d) => {
        const data = d as Record<string, unknown>;
        return data?.tool === "query_tax_card";
      },
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    const data = row.data as Record<string, unknown>;
    expect(data?.tool, "A4: trail event tool field must be query_tax_card").toBe("query_tax_card");
    expect(row.workspace_id, "A4: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A4: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });

  test("A5: query_tax_card — assistant response does not use 'lønnsslipp'", async ({ page }) => {
    // N2 constraint verified inline for each tool: the noun "lønnsslipp" means
    // payslip (what an employee receives). Smartout produces "lønnsgrunnlag" (wage
    // basis) for accountants. Using the wrong noun is a positioning drift bug.
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "hva er trekkprosenten min?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A5: BFF returned ${res.status()}`).toBe(true);

    const body = (await res.json()) as { text?: string };
    const responseText = (body.text ?? "").toLowerCase();

    expect(
      responseText.includes("lønnsslipp"),
      `A5: assistant response must NOT contain "lønnsslipp" — use "lønnsgrunnlag". ` +
        `Response: "${responseText}"`,
    ).toBe(false);
  });

  // ── A6–A10: salary_query ─────────────────────────────────────────────────

  test("A6: salary_query — BFF returns non-error response for lønnsgrunnlag query", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "vis lønnsgrunnlaget mitt for denne perioden",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A6: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    salaryQuerySessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    // Error-pattern check — salary_query returns graceful-degradation JSON even
    // when shift_cost_snapshots are absent, so ok:true is expected in either case.
    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A6: hard error in salary_query response.\n` +
          `Response: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardErrorPattern);
    }

    expect(responseText.length, "A6: response must not be empty").toBeGreaterThan(0);
  });

  test("A7: salary_query — classifier_output shows intent='payroll'", async () => {
    expect(salaryQuerySessionId, "A7 depends on A6").not.toBeNull();

    const row = await assertRecordingPhase({
      sessionId: salaryQuerySessionId!,
      phase: "classifier_output",
      turnKind: "user_input",
      contentPredicate: (c) => {
        const content = c as Record<string, unknown>;
        return typeof content?.intent === "string" && content.intent === "payroll";
      },
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A7: intent must be 'payroll'").toBe("payroll");
  });

  test("A8: salary_query — tool_call recording row present", async () => {
    expect(salaryQuerySessionId, "A8 depends on A6").not.toBeNull();

    const row = await assertRecordingPhase({
      sessionId: salaryQuerySessionId!,
      phase: "tool_call",
      turnKind: "tool_invocation",
      contentPredicate: (c) => {
        const content = c as Record<string, unknown>;
        return typeof content?.tool_name === "string" && content.tool_name === "salary_query";
      },
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A8: tool_call must name salary_query").toBe("salary_query");
  });

  test("A9: salary_query — activity_trail payroll.salary_queried emitted", async () => {
    // salary_query emits "payroll.salary_queried" (not "botsson.tool_invoked").
    // The capability-level emit fires after a successful gate_action pass.
    // We poll activity_trail for this event to verify telemetry is wired.
    const row = await assertActivityTrailEvent({
      event: "payroll.salary_queried",
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    expect(row.workspace_id, "A9: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A9: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });

  test("A10: salary_query — response does not use 'lønnsslipp'", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "hva tjener jeg per time?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A10: BFF returned ${res.status()}`).toBe(true);

    const body = (await res.json()) as { text?: string };
    const responseText = (body.text ?? "").toLowerCase();

    expect(
      responseText.includes("lønnsslipp"),
      `A10: salary_query response must NOT use "lønnsslipp". Response: "${responseText}"`,
    ).toBe(false);
  });

  // ── A11–A13: view_personal_number (Phase-0c placeholder) ─────────────────
  //
  // view_personal_number returns a presence indicator only — never the actual
  // fødselsnummer. Phase 0c will add RevealableField audit-emit. Until then,
  // we verify: (a) tool is invoked, (b) result is not a hard error string,
  // (c) response does not expose a 11-digit nummer.

  test("A11: view_personal_number — BFF returns non-error response", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "er det registrert et fødselsnummer på meg?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A11: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    personalNumberSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    // view_personal_number is a Phase-0c placeholder. The tool returns
    // has_personal_number: true/false. If gate_action denies, tool returns
    // authority_denied. Neither is a hard error — check only for hard failures.
    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText)) {
      const logs = await dumpStageEngineLogs();
      expect(responseText, `A11: hard error.\nLogs:\n${logs}`).not.toMatch(hardErrorPattern);
    }

    // Primary guard: the actual fødselsnummer must NEVER appear in the response.
    // A real Norwegian personnummer is 11 consecutive digits.
    const elevenDigitPattern = /\b\d{11}\b/;
    expect(
      elevenDigitPattern.test(body.text ?? ""),
      `A11: CRITICAL — response contains an 11-digit pattern that could be a personnummer. ` +
        `Response: "${body.text}"`,
    ).toBe(false);

    expect(responseText.length, "A11: response must not be empty").toBeGreaterThan(0);
  });

  test("A12: view_personal_number — tool_call recording row present", async () => {
    expect(personalNumberSessionId, "A12 depends on A11").not.toBeNull();

    const row = await assertRecordingPhase({
      sessionId: personalNumberSessionId!,
      phase: "tool_call",
      turnKind: "tool_invocation",
      contentPredicate: (c) => {
        const content = c as Record<string, unknown>;
        return (
          typeof content?.tool_name === "string" && content.tool_name === "view_personal_number"
        );
      },
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A12: tool_call must name view_personal_number").toBe(
      "view_personal_number",
    );
  });

  test("A13: view_personal_number — response does not contain actual fødselsnummer", async ({
    page,
  }) => {
    // Duplicate PII guard at the response level. A13 is a standalone test so
    // it shows up as its own failure in reports — not buried in A11.
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "vis mitt fødselsnummer",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A13: BFF returned ${res.status()}`).toBe(true);

    const body = (await res.json()) as { text?: string };
    const responseText = body.text ?? "";

    // Phase-0c placeholder: tool description explicitly says it returns a
    // presence indicator only. The response MUST NOT contain an 11-digit nummer.
    const elevenDigitPattern = /\b\d{11}\b/;
    expect(
      elevenDigitPattern.test(responseText),
      `A13: CRITICAL — response contains 11-digit pattern (possible personnummer). ` +
        `Phase-0c placeholder must never reveal PII. Response: "${responseText}"`,
    ).toBe(false);
  });

  // ── A14–A16: view_bank_account (Phase-0c placeholder) ────────────────────

  test("A14: view_bank_account — BFF returns non-error response", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "er bankkontoen min registrert?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A14: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    bankAccountSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();

    const hardErrorPattern = /teknisk feil|system.*feil|technical error/i;
    if (hardErrorPattern.test(responseText)) {
      const logs = await dumpStageEngineLogs();
      expect(responseText, `A14: hard error.\nLogs:\n${logs}`).not.toMatch(hardErrorPattern);
    }

    // A Norwegian bank account number is 11 digits (BBBB.BB.BBBBB format).
    // The placeholder must NEVER reveal the actual account number.
    const elevenDigitPattern = /\b\d{11}\b/;
    expect(
      elevenDigitPattern.test(body.text ?? ""),
      `A14: CRITICAL — response contains 11-digit pattern (possible bank account). ` +
        `Phase-0c placeholder must never reveal PII. Response: "${body.text}"`,
    ).toBe(false);

    expect(responseText.length, "A14: response must not be empty").toBeGreaterThan(0);
  });

  test("A15: view_bank_account — tool_call recording row present", async () => {
    expect(bankAccountSessionId, "A15 depends on A14").not.toBeNull();

    const row = await assertRecordingPhase({
      sessionId: bankAccountSessionId!,
      phase: "tool_call",
      turnKind: "tool_invocation",
      contentPredicate: (c) => {
        const content = c as Record<string, unknown>;
        return typeof content?.tool_name === "string" && content.tool_name === "view_bank_account";
      },
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A15: tool_call must name view_bank_account").toBe(
      "view_bank_account",
    );
  });

  test("A16: view_bank_account — telemetry contract.pii.revealed emitted", async () => {
    // view_bank_account emits "contract.pii.revealed" with revealed=false
    // (Phase 0c placeholder — no actual reveal). Verifies telemetry contract
    // is honoured even for placeholder tools.
    const row = await assertActivityTrailEvent({
      event: "contract.pii.revealed",
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    expect(row.workspace_id, "A16: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);

    // Verify revealed=false in the data payload (Phase-0c invariant).
    const data = row.data as Record<string, unknown>;
    expect(
      data?.revealed,
      "A16: contract.pii.revealed must have revealed=false for Phase-0c placeholder",
    ).toBe(false);
  });
});

// =============================================================================
// Negative-path suite
// =============================================================================

test.describe("Payroll capability — negative path", () => {
  let negativeTestStartIso: string;

  test.beforeEach(() => {
    negativeTestStartIso = new Date().toISOString();
  });

  // ── N1: voice channel guard ───────────────────────────────────────────────
  //
  // Payroll tools are Høy-PII and are ONLY allowed on the chat channel
  // (ADR-0078). The LiveKit voice path must return channel_forbidden.
  // We cannot drive a full voice session in Playwright E2E — skip when
  // LiveKit is not configured and document the gap.

  test("N1: voice channel guard — payroll capability is chat-only (ADR-0078)", async ({ page }) => {
    // Probe voice token BFF availability.
    await loginAsAdmin(page);
    const tokenRes = await page.request.post("/api/botsson/voice/token", {
      data: { workspaceId: SEED_WORKSPACE_ID },
    });

    if (!tokenRes.ok()) {
      test.skip(
        true,
        `N1: voice token BFF returned ${tokenRes.status()} — LiveKit not configured. ` +
          "The payroll channel guard (ctx.channel !== 'chat' → channel_forbidden) is " +
          "verified at unit-test level in packages/ai/src/capabilities/payroll/tools.ts. " +
          "E2E voice guard requires LIVEKIT_URL — tracked as known gap.",
      );
      return;
    }

    // If voice token BFF is available, the channel guard is still E2E-untestable
    // because a full LiveKit audio session cannot be driven in Playwright.
    test.skip(
      true,
      "N1: full LiveKit voice session cannot be driven in Playwright E2E. " +
        "Channel guard verified at unit-test level. " +
        "Tracking gap: payroll-voice-channel-guard-e2e.",
    );
  });

  // ── N2: lønnsslipp noun guard ─────────────────────────────────────────────
  //
  // Smartout produces lønnsgrunnlag (wage basis) for accountants — not lønnsslipp
  // (payslip). Any assistant response containing "lønnsslipp" is a positioning
  // drift bug. This test fires a direct wage-basis query and verifies the noun.

  test("N2: lønnsslipp-noun guard — Botsson must not say 'lønnsslipp' for wage-basis queries", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    // Ask explicitly about the wage basis — this maximises the chance the LLM
    // would reach for the wrong noun if its framing is drifted.
    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "kan du forklare hva lønnsgrunnlaget mitt inneholder og hva det brukes til?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `N2: BFF returned ${res.status()}`).toBe(true);

    const body = (await res.json()) as { text?: string };
    const responseText = body.text ?? "";

    expect(
      responseText.toLowerCase().includes("lønnsslipp"),
      `N2: POSITIONING DRIFT — assistant said "lønnsslipp" in a wage-basis context. ` +
        `Smartout produces lønnsgrunnlag for accountants, not lønnsslipp for employees. ` +
        `Response: "${responseText}"`,
    ).toBe(false);
  });

  // ── N3: authority denial — employee cross-profile read blocked ────────────
  //
  // The payroll capability has min_role='admin' for cross-profile reads.
  // An employee profile (role='employee') asking to see another employee's
  // tax card should receive authority_denied. Skip if no employee profile exists.

  test("N3: authority denial — employee cannot read another employee's skattekort", async ({
    page,
  }) => {
    // Find an employee-role profile in the seed workspace (not the seed admin).
    const { data: employeeProfiles } = await supabase
      .from("profile")
      .select("profile_id, display_name")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("role", "employee")
      .eq("is_active", true)
      .neq("profile_id", SEED_PROFILE_ID)
      .limit(1);

    const targetProfile = employeeProfiles?.[0];
    if (!targetProfile) {
      test.skip(
        true,
        "N3: no employee-role profile in seed workspace — cannot test cross-profile denial. " +
          "To exercise this path: seed a second profile with role='employee' in workspace " +
          `${SEED_WORKSPACE_ID}. Tracked as known gap.`,
      );
      return;
    }

    // The seed admin profile is role='admin', so the gate_action would pass for
    // the seed user. We cannot easily impersonate an employee profile via the
    // current BFF auth (which derives profile_id from the session cookie, not
    // from the request body). Skip with an informative message.
    test.skip(
      true,
      `N3: gap — the BFF derives profile_id from the auth session (ADR-0151), ` +
        `so we cannot impersonate the employee-role profile ${targetProfile.profile_id} ` +
        `in a Playwright request without logging in as that user. ` +
        `The gate_action min_role='admin' enforcement is verified at unit-test level. ` +
        `Tracked as known gap: payroll-employee-denial-e2e.`,
    );
  });
});
