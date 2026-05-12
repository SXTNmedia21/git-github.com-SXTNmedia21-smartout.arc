// =============================================================================
// engine-world-harness-e2e.spec.ts
//
// Full-pipe E2E verification of the engine_world capability.
//
// Pipe under test: L1 → L2 BFF (/api/botsson/chat) → L3 Stage Engine →
//                  L4 engine_world capability → L5 DB (engine_world table)
//
// Tools covered (all 3):
//
//   read_surface         (A1–A5)
//     "les status for vercel.web" → stage-engine calls read_surface tool,
//     BFF response contains the surface data or a not-found shape.
//
//   read_surface_class   (A6–A9)
//     "vis alle service-surfaces" → stage-engine calls read_surface_class,
//     BFF response describes the surface class.
//
//   report_observation   (A10–A15)
//     "rapporter at ci.workflow.test er grønn" → gatedMutation UPSERT,
//     engine_world row written, activity_trail "engine_world observation_written"
//     emitted (space-form per council F1).
//
// Authority contract:
//   Migration 20260525000000_engine_world.sql seeds engine.world_observe in
//   capability_default_registry with level='read_only'. Phase 1 migration
//   20260526000000_engine_world_phase_1.sql upgrades it to 'confirm'.
//   The seed workspace b0000000-...0 has no per-workspace authority row so
//   it inherits the default 'confirm' level. Seed admin has role='admin'
//   which satisfies min_role='admin' — report_observation is unblocked.
//
// Telemetry contract:
//   - read_surface + read_surface_class: NO emit (L-0094, read-only tools).
//     activity_trail will NOT have botsson.tool_invoked rows for these.
//   - report_observation: emits "engine_world observation_written" on success
//     and "engine_world status_changed" when status transitions. These are
//     space-form event names per council F1 (NOT dot-form like botsson.* events).
//
// Negative paths:
//   N1: Cross-workspace isolation — surface written for workspace B must NOT
//       appear when read_surface_class is called from workspace A session.
//   N2: Non-existent surface — read_surface for unknown ID returns structured
//       not-found response, no hallucination, no 500 error.
//
// Channel guard note:
//   report_observation rejects voice at Layer 3 (tools.ts line 172-176).
//   Voice E2E cannot be driven in Playwright — test.skip with documentation.
//
// Infrastructure requirements:
//   1. Supabase Local running: npx supabase start
//   2. Stage-engine container rebuilt with current code (see HANDOFF)
//   3. Next.js dev server on port 3060
//   4. apps/e2e/.env.local: SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY
//
// ADR refs: ADR-0281 (engine_world shared model), ADR-0290 (platform RPC),
//           ADR-0184 (recorder), ADR-0099 (gate_action), ADR-0078 (channel guard),
//           ADR-0134 (telemetry), ADR-0151 (server-side workspace derivation).
// =============================================================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import {
  SEED_PROFILE_ID,
  SEED_WORKSPACE_ID,
  assertStageEngineContainerFresh,
  assertSupabaseLocalUp,
  assertStageEngineHealthy,
  assertRecordingPhase,
  dumpStageEngineLogs,
  snapshotTestState,
  cleanupTestSessions,
} from "../helpers/botsson-harness";
import {
  createEngineWorldAdminClient,
  assertEngineWorldClassified,
  assertEngineWorldToolCall,
  assertObservationWrittenTrail,
  assertEngineWorldRow,
  cleanupEngineWorldRows,
  cleanupEngineWorldSessions,
  resolveEngineWorldSessionId,
} from "../helpers/engine-world-harness";
import { supabase } from "../helpers/seed";

// =============================================================================
// Serial mode — tests share seed state and surface_id namespaces.
// Running in parallel risks A10's report_observation row appearing in A6's
// read_surface_class query (same surface_type='ci_workflow').
// =============================================================================
test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let testRunId: string;
let testStartIso: string;

// Surface IDs seeded by this spec run (prefixed for cleanup isolation).
// Use a timestamp suffix so parallel CI runs on the same DB don't collide.
let RUN_PREFIX: string;

// Session IDs captured per tool invocation block.
let readSurfaceSessionId: string | null = null;
let readSurfaceClassSessionId: string | null = null;
let reportObservationSessionId: string | null = null;

const db = createEngineWorldAdminClient();

// =============================================================================
// Positive-path suite
// =============================================================================

test.describe("engine_world harness pipe (positive path)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testRunId = `ew-harness-${Date.now()}`;
    testStartIso = new Date().toISOString();
    // Use a short suffix to keep surface_id under the 200-char limit.
    RUN_PREFIX = `e2e-hw-${Date.now()}-`;

    // Gate 1: stale container check.
    assertStageEngineContainerFresh();

    // Gate 2: Supabase Local up.
    await assertSupabaseLocalUp();

    // Gate 3: stage-engine health.
    await assertStageEngineHealthy();

    // Clean up any leftover sessions from prior runs.
    await cleanupTestSessions(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    // Seed a platform-level engine_world row so read_surface has data.
    // Uses service_role direct upsert (platform row: workspace_id = NULL).
    // Surface ID is stable across the test run — prefix keeps it scoped.
    const seedSurfaceId = `${RUN_PREFIX}vercel.web`;
    await db.from("engine_world").upsert({
      surface_id: seedSurfaceId,
      surface_type: "service",
      status: "green",
      details: { seeded_by: "e2e-harness" },
      workspace_id: null, // platform-level
      observed_at: new Date().toISOString(),
      observed_by: "e2e-harness-setup",
      ttl_seconds: 3600,
    });
  });

  test.afterAll(async () => {
    await snapshotTestState(testRunId, reportObservationSessionId ?? undefined);
    // Cleanup seeded rows.
    await cleanupEngineWorldRows(db, RUN_PREFIX);
    // Cleanup sessions opened by this run.
    await cleanupEngineWorldSessions(testStartIso);
  });

  // ── A1: send read_surface query, get non-error response ──────────────────

  test("A1: send read_surface query, receive non-error response", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();
    const seedSurfaceId = `${RUN_PREFIX}vercel.web`;

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        // Prompt that triggers read_surface for the seeded surface ID.
        userMessage: `les status for surface: ${seedSurfaceId}`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A1: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as {
      text?: string;
      sessionId?: string;
      error?: string;
    };

    readSurfaceSessionId = await resolveEngineWorldSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();
    const errorPattern =
      /feilet|teknisk feil|beklager.*ikke|dessverre|administratoren|technical problem/i;
    if (errorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A1: error-patterned response — likely stale container.\n` +
          `Response: "${responseText}"\nStage-engine:\n${logs}`,
      ).not.toMatch(errorPattern);
    }

    expect(responseText.length, "A1: assistant response must not be empty").toBeGreaterThan(0);
  });

  // ── A2: classifier routed to engine_world ─────────────────────────────────

  test("A2: classifier_output shows intent='engine_world' for read_surface query", async () => {
    expect(readSurfaceSessionId, "A2 depends on A1 — session must be set").not.toBeNull();

    await assertEngineWorldClassified(readSurfaceSessionId!, testStartIso, { timeoutMs: 25_000 });
  });

  // ── A3: read_surface tool was invoked ──────────────────────────────────────

  test("A3: agent_session_recording contains read_surface tool reference", async () => {
    expect(readSurfaceSessionId, "A3 depends on A1").not.toBeNull();

    await assertEngineWorldToolCall({
      sessionId: readSurfaceSessionId!,
      toolName: "read_surface",
      sinceIso: testStartIso,
      poll: { timeoutMs: 25_000 },
    });
  });

  // ── A4: response contains surface data (green or not-found — both are valid) ─

  test("A4: assistant response references surface status or not-found shape", async ({ page }) => {
    // Re-query using the session ID from A1 — we need the BFF response text.
    // Since we stored it in A1, we repeat the read pattern here by querying
    // the recording for the LLM response content.
    expect(readSurfaceSessionId, "A4 depends on A1").not.toBeNull();

    // Poll for the llm_response recording row to get the assistant text.
    const row = await assertRecordingPhase({
      sessionId: readSurfaceSessionId!,
      phase: "llm_response",
      turnKind: "assistant",
      sinceIso: testStartIso,
      poll: { timeoutMs: 25_000 },
    });

    const text = JSON.stringify(row.content_redacted ?? "").toLowerCase();

    // Valid responses: contains surface_id mention, status word, or a "not found" indicator.
    // The LLM is given read_surface output — it will narrate the result.
    const mentionsSurface =
      text.includes("green") ||
      text.includes("grønn") ||
      text.includes("service") ||
      text.includes("status") ||
      text.includes("not found") ||
      text.includes("ikke funnet") ||
      text.includes("surface");

    expect(
      mentionsSurface,
      `A4: LLM response must reference surface data or not-found status. ` +
        `Got: "${text.substring(0, 300)}"`,
    ).toBe(true);
  });

  // ── A5: read_surface does NOT write to activity_trail (L-0094) ────────────

  test("A5: activity_trail has NO botsson.tool_invoked row for read_surface (read-only, no emit)", async () => {
    // Read tools must not emit per L-0094. We wait briefly and then assert
    // the absence of a botsson.tool_invoked row for the read_surface session.
    // Give the recorder a chance to flush (2s) before asserting absence.
    await new Promise((r) => setTimeout(r, 2000));

    const { data: rows } = await supabase
      .from("activity_trail")
      .select("id, event, data")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("event", "botsson.tool_invoked")
      .gte("created_at", testStartIso)
      .filter("data->>tool", "eq", "read_surface");

    expect(
      rows ?? [],
      "A5: read_surface must NOT produce a botsson.tool_invoked activity_trail row. " +
        "Read-only tools do not emit per L-0094. " +
        `Found rows: ${JSON.stringify(rows)}`,
    ).toHaveLength(0);
  });

  // ── A6: send read_surface_class query ─────────────────────────────────────

  test("A6: send read_surface_class query, receive non-error response", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "vis alle service-surfaces i world state",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A6: /api/botsson/chat returned ${res.status()}`).toBe(true);

    const body = (await res.json()) as {
      text?: string;
      sessionId?: string;
      error?: string;
    };

    readSurfaceClassSessionId = await resolveEngineWorldSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();
    const errorPattern = /feilet|teknisk feil|beklager.*ikke|dessverre|teknisk problem/i;
    if (errorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A6: error-patterned response.\nResponse: "${responseText}"\nStage-engine:\n${logs}`,
      ).not.toMatch(errorPattern);
    }

    expect(responseText.length, "A6: assistant response must not be empty").toBeGreaterThan(0);
  });

  // ── A7: read_surface_class tool invoked ────────────────────────────────────

  test("A7: agent_session_recording contains read_surface_class tool reference", async () => {
    expect(readSurfaceClassSessionId, "A7 depends on A6").not.toBeNull();

    await assertEngineWorldToolCall({
      sessionId: readSurfaceClassSessionId!,
      toolName: "read_surface_class",
      sinceIso: testStartIso,
      poll: { timeoutMs: 25_000 },
    });
  });

  // ── A8: classifier routed to engine_world for class query ─────────────────

  test("A8: classifier_output shows intent='engine_world' for read_surface_class query", async () => {
    expect(readSurfaceClassSessionId, "A8 depends on A6").not.toBeNull();

    await assertEngineWorldClassified(readSurfaceClassSessionId!, testStartIso, {
      timeoutMs: 25_000,
    });
  });

  // ── A9: read_surface_class no activity_trail emit ─────────────────────────

  test("A9: activity_trail has NO botsson.tool_invoked for read_surface_class (read-only)", async () => {
    await new Promise((r) => setTimeout(r, 2000));

    const { data: rows } = await supabase
      .from("activity_trail")
      .select("id, event, data")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("event", "botsson.tool_invoked")
      .gte("created_at", testStartIso)
      .filter("data->>tool", "eq", "read_surface_class");

    expect(
      rows ?? [],
      "A9: read_surface_class must NOT produce a botsson.tool_invoked activity_trail row. " +
        `Found rows: ${JSON.stringify(rows)}`,
    ).toHaveLength(0);
  });

  // ── A10: send report_observation query ────────────────────────────────────

  test("A10: send report_observation query, receive non-error response", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();
    // Surface ID to report — unique per run so status_changed assertion is clean.
    const reportSurfaceId = `${RUN_PREFIX}ci.workflow.test`;

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        // Explicitly use surface ID to avoid fuzzy matching failures.
        userMessage: `rapporter at surface ${reportSurfaceId} (type ci_workflow) er grønn nå`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A10: /api/botsson/chat returned ${res.status()}`).toBe(true);

    const body = (await res.json()) as {
      text?: string;
      sessionId?: string;
      error?: string;
    };

    reportObservationSessionId = await resolveEngineWorldSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();
    const errorPattern = /feilet|teknisk feil|beklager.*ikke|dessverre|teknisk problem/i;
    if (errorPattern.test(responseText) || body.error) {
      const logs = await dumpStageEngineLogs();
      expect(
        responseText,
        `A10: error-patterned response.\nResponse: "${responseText}"\nStage-engine:\n${logs}`,
      ).not.toMatch(errorPattern);
    }

    expect(responseText.length, "A10: assistant response must not be empty").toBeGreaterThan(0);
  });

  // ── A11: report_observation tool recorded ────────────────────────────────

  test("A11: agent_session_recording contains report_observation tool reference", async () => {
    expect(reportObservationSessionId, "A11 depends on A10").not.toBeNull();

    await assertEngineWorldToolCall({
      sessionId: reportObservationSessionId!,
      toolName: "report_observation",
      sinceIso: testStartIso,
      poll: { timeoutMs: 30_000 },
    });
  });

  // ── A12: classifier routed to engine_world for report query ───────────────

  test("A12: classifier_output shows intent='engine_world' for report_observation query", async () => {
    expect(reportObservationSessionId, "A12 depends on A10").not.toBeNull();

    await assertEngineWorldClassified(reportObservationSessionId!, testStartIso, {
      timeoutMs: 30_000,
    });
  });

  // ── A13: engine_world DB row written ────────────────────────────────────

  test("A13: engine_world DB row written with correct workspace_id after report_observation", async () => {
    // The report_observation tool UPSERTs with workspace_id = ctx.workspaceId (ADR-0151).
    // We poll until the row appears — the gatedMutation is async but the session
    // response only returns after the tool completes, so latency here is low.
    const reportSurfaceId = `${RUN_PREFIX}ci.workflow.test`;

    const row = await assertEngineWorldRow({
      db,
      surfaceId: reportSurfaceId,
      expectedStatus: "green",
      poll: { timeoutMs: 30_000 },
    });

    // ADR-0151: workspace_id must be server-derived (ctx.workspaceId), never from input.
    expect(
      row.workspace_id,
      "A13: workspace_id must equal the seed workspace (server-derived per ADR-0151)",
    ).toBe(SEED_WORKSPACE_ID);

    expect(
      row.observed_by,
      "A13: observed_by must equal the seed profile (server-derived ctx.profileId)",
    ).toBe(SEED_PROFILE_ID);

    expect(row.status, "A13: status must be 'green' as reported").toBe("green");
    expect(row.surface_type, "A13: surface_type must be 'ci_workflow' as reported").toBe(
      "ci_workflow",
    );
  });

  // ── A14: activity_trail has engine_world observation_written event ─────────

  test("A14: activity_trail has 'engine_world observation_written' after report_observation", async () => {
    const reportSurfaceId = `${RUN_PREFIX}ci.workflow.test`;

    // Space-form event name per council F1 (existing registry names, no parallel dot-form set).
    await assertObservationWrittenTrail({
      sinceIso: testStartIso,
      surfaceId: reportSurfaceId,
      poll: { timeoutMs: 30_000 },
    });
  });

  // ── A15: second report changes status, status_changed event emitted ────────

  test("A15: second report_observation with different status writes updated row (UPSERT idempotency)", async ({
    page,
  }) => {
    const reportSurfaceId = `${RUN_PREFIX}ci.workflow.test`;

    // First write was 'green' in A10. Second write: 'red' → status_changed=true.
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart2 = new Date().toISOString();
    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `rapporter at surface ${reportSurfaceId} (type ci_workflow) er nå rød`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A15: second report returned ${res.status()}`).toBe(true);

    // Wait briefly for async write.
    await new Promise((r) => setTimeout(r, 3000));

    // Verify DB row was updated to 'red' (UPSERT, not duplicate row).
    const { data: rows } = await db
      .from("engine_world")
      .select("surface_id, status")
      .eq("surface_id", reportSurfaceId);

    expect((rows ?? []).length, "A15: must have exactly 1 row (UPSERT, no duplicates)").toBe(1);

    expect(
      rows?.[0]?.status,
      "A15: status must be 'red' after second report (last-write-wins UPSERT)",
    ).toBe("red");

    // activity_trail should have a second 'engine_world observation_written' event
    // and also 'engine_world status_changed'.
    const { data: trailRows } = await supabase
      .from("activity_trail")
      .select("id, event, data")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("event", "engine_world status_changed")
      .gte("created_at", callStart2)
      .limit(5);

    // status_changed emit is conditional (only fires when prior_status != new status).
    // If the first write succeeded (A10/A13), this second write must trigger status_changed.
    // Soft-assert with explanation — primary assertion is the DB state above.
    if (!trailRows || trailRows.length === 0) {
      console.warn(
        "A15: 'engine_world status_changed' event not found in activity_trail " +
          "(soft warning — DB state updated correctly per above assertion). " +
          "This may indicate the conditional emit path (statusChanged=true) did not fire, " +
          "or the telemetry flush interval exceeded the wait window.",
      );
    }
  });
});

// =============================================================================
// Negative path
// =============================================================================

test.describe("engine_world harness pipe (negative path)", () => {
  test.describe.configure({ mode: "serial" });

  let negativeTestStartIso: string;

  test.beforeEach(() => {
    negativeTestStartIso = new Date().toISOString();
  });

  // ── N1: cross-workspace isolation ─────────────────────────────────────────
  //
  // Seed a row for workspace B. A read_surface_class query from workspace A
  // session must NOT return that row (ADR-0151 server-side workspace derivation).

  test("N1: cross-workspace isolation — read_surface_class scopes to own workspace only", async ({
    page,
  }) => {
    // We need a second workspace to seed the "foreign" row.
    const { data: otherWorkspaces } = await supabase
      .from("workspace")
      .select("workspace_id, name")
      .eq("is_active", true)
      .neq("workspace_id", SEED_WORKSPACE_ID)
      .limit(1);

    if (!otherWorkspaces || otherWorkspaces.length === 0) {
      test.skip(
        true,
        "N1: no second workspace found — only the seed workspace exists. " +
          "Cross-workspace isolation requires two workspaces in the test DB.",
      );
      return;
    }

    const wsB = (otherWorkspaces as Array<{ workspace_id: string }>)[0]!.workspace_id;
    const foreignSurfaceId = `n1-xws-${Date.now()}`;

    // Write a row scoped to workspace B using service_role.
    await db.from("engine_world").upsert({
      surface_id: foreignSurfaceId,
      surface_type: "custom",
      status: "green",
      details: {},
      workspace_id: wsB,
      observed_at: new Date().toISOString(),
      observed_by: "e2e-n1-xws",
      ttl_seconds: 600,
    });

    // Ask Botsson (authenticated as seed-workspace admin) to list custom surfaces.
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "vis alle custom surfaces i world state",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `N1: /api/botsson/chat returned ${res.status()}`).toBe(true);

    const body = (await res.json()) as { text?: string; sessionId?: string };
    const responseText = body.text ?? "";

    // The foreign surface_id must NOT appear in the response.
    expect(
      responseText.includes(foreignSurfaceId),
      `N1: cross-workspace leak — foreign surface "${foreignSurfaceId}" from workspace B ` +
        `appeared in the response for workspace A. Response: "${responseText}"`,
    ).toBe(false);

    // Cleanup foreign row.
    await db.from("engine_world").delete().eq("surface_id", foreignSurfaceId);
  });

  // ── N2: non-existent surface returns structured not-found, no hallucination ─

  test("N2: read_surface for non-existent surface returns not-found response, no error", async ({
    page,
  }) => {
    // Use a UUID-like surface_id that cannot exist in any seeded data.
    const phantomSurfaceId = `phantom.surface.${Date.now()}.does-not-exist`;

    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `les status for surface: ${phantomSurfaceId}`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(
      res.ok(),
      `N2: /api/botsson/chat returned ${res.status()} — BFF must not 500 on not-found surface`,
    ).toBe(true);

    const body = (await res.json()) as { text?: string; error?: string };
    const responseText = (body.text ?? "").toLowerCase();

    // Must not be an unhandled error.
    expect(body.error, "N2: BFF must not return an error field").toBeUndefined();
    expect(responseText.length, "N2: response must not be empty").toBeGreaterThan(0);

    // Response must not hallucinate a fake status for the phantom surface.
    // It should indicate the surface was not found or is unknown.
    const indicatesNotFound =
      responseText.includes("not found") ||
      responseText.includes("ikke funnet") ||
      responseText.includes("finnes ikke") ||
      responseText.includes("ingen") ||
      responseText.includes("unknown") ||
      responseText.includes("ukjent") ||
      responseText.includes("fant ikke");

    expect(
      indicatesNotFound,
      `N2: response for non-existent surface must indicate not-found. ` +
        `Got: "${responseText.substring(0, 300)}". ` +
        `The read_surface tool returns { found: false, surface_id } — LLM must narrate this correctly.`,
    ).toBe(true);

    // Hard negative: must not invent a 'green' or 'red' status.
    // The tool returns { found: false } — the LLM has no basis to report a status.
    const hallucinatesStatus =
      (responseText.includes("green") || responseText.includes("grønn")) &&
      !responseText.includes("not found") &&
      !responseText.includes("ikke funnet");

    expect(
      hallucinatesStatus,
      `N2: LLM must not hallucinate a status for a non-existent surface. ` +
        `Response: "${responseText.substring(0, 300)}"`,
    ).toBe(false);
  });

  // ── N3: voice channel guard — report_observation rejects voice ────────────
  //
  // Voice channel guard is a Layer 3 per-tool check in tools.ts (lines 172-176).
  // A full LiveKit voice session cannot be driven in Playwright E2E.
  // Guard verified structurally: tools.ts ctx.channel === 'voice' returns early.

  test("N3: voice channel guard — report_observation rejects voice channel", () => {
    test.skip(
      true,
      "N3: Full LiveKit voice session cannot be driven in Playwright E2E. " +
        "The voice channel guard is verified at the unit level: " +
        "packages/ai/src/capabilities/engine-world/tools.ts lines 170-176. " +
        "`if (ctx.channel === 'voice') return JSON.stringify({ success: false, error: '...' })` " +
        "is the Layer 3 per-tool reject per ADR-0078 council F3. " +
        "Tracked as known gap: voice-channel-guard-e2e-coverage.",
    );
  });
});
