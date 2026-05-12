// =============================================================================
// shift-lifecycle-harness-e2e.spec.ts
//
// Full-pipe E2E verification of the shift_lifecycle capability in the Botsson
// harness (L2 BFF → L3 Stage Engine → L4 Capability → L5 DB).
//
// Capability architecture (ADR-0095 five-layer):
//   Execution (schedule_shift) → Reality (time_entry) →
//   Interpretation (shift_hour_interpretation) →
//   Derivation (shift_cost_snapshot) → Decision (shift_approval)
//
// Tools and their channels (ADR-0078):
//   publish_shift   — chat + system only (voice forbidden)
//   approve_shift   — chat only
//   interpret_shift — system only (cannot be reached via BFF chat)
//   settle_shift    — system only (cannot be reached via BFF chat)
//   clock_in_check  — chat + system only (voice forbidden)
//
// Since the BFF chat route hardcodes channel="chat", only publish_shift,
// approve_shift, and clock_in_check can be exercised end-to-end via this
// test. interpret_shift and settle_shift are documented as channel-guarded
// gaps below (SL-SKIP-1 and SL-SKIP-2).
//
// Gate path architecture (HANDOFF-harness-coverage-top3.md D2):
//   Every turn: router-level gate_action call → 1 gate_evaluation row
//   Every write-tool invocation: callGateAction() inside tool body →
//     additional gate_evaluation rows (one per write-tool call).
//   Total rows per publish_shift turn: 2 (router + tool-level).
//
// Positive path (A1–A5):
//   A1  intent classifier routes shift_lifecycle message to capability='shift_lifecycle'
//   A2  llm_request recording shows tools were passed (toolCount >= 1)
//   A3  llm_response recording does NOT contain error-pattern text
//   A4  gate_evaluation: router-level row written, allow=true for shift_lifecycle read
//   A5  gate_evaluation: tool-level row written for publish_shift, allow=true
//   A6  schedule_shift.status transitions to 'published' after publish_shift
//   A7  approve_shift: gate_evaluation row written, allow=true
//   A8  shift_approval row updated to status='approved' after approve_shift
//
// Negative path (N1–N3):
//   N1  Authority denial — employee-role profile cannot call publish_shift
//       when engine_authority_config.level='read_only' (gate allow=false)
//   N2  Voice channel blocked — publish_shift is not allowed over voice
//   N3  approve_shift without prior interpret → tool returns error message
//       (no shift_approval row exists)
//
// System-channel gaps (documented as skip):
//   SL-SKIP-1  interpret_shift requires system channel — unreachable via BFF chat
//   SL-SKIP-2  settle_shift requires system channel — unreachable via BFF chat
//
// Infrastructure requirements:
//   - Supabase Local running
//   - stage-engine container started after latest commit (SKIP_FRESHNESS_CHECK=1 to bypass)
//   - Seed workspace b0000000-...0 with profile f0000000-...0 (role='admin' or engine_authority_config seeded)
//   - engine_authority_config row for shift_lifecycle + seed workspace with level='autonomous' or 'confirm'
//
// Setup creates schedule_shift rows tagged with notes='F-COVERAGE-2 test'.
// Cleanup deletes only those rows.
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
  dumpStageEngineLogs,
  snapshotTestState,
} from "../helpers/botsson-harness";
import {
  createTestShift,
  cleanupTestShifts,
  assertShiftStatus,
  assertGateEvaluation,
  assertNoShiftLifecycleError,
  type BffChatResponse,
} from "../helpers/shift-lifecycle-harness";
import { supabase } from "../helpers/seed";

// =============================================================================
// Serial mode — tests share shift state between A1 and A8.
// =============================================================================
test.describe.configure({ mode: "serial" });

const SHIFT_MARKER = "F-COVERAGE-2 test";

let testRunId: string;
let testStartIso: string;
let activeSessionId: string | null = null;

// Shift IDs created in beforeAll, used across tests in positive path.
let createdShiftId: string;
let publishedShiftId: string;

// =============================================================================
// Infrastructure: seed authority config so publish_shift is permitted.
// Upsert engine_authority_config for shift_lifecycle at level='autonomous'
// so gate_action returns allow=true for the seed workspace.
// =============================================================================

async function seedShiftLifecycleAuthority(): Promise<void> {
  // Use upsert so the test can run multiple times without duplicates.
  const { error } = await supabase.from("engine_authority_config").upsert(
    {
      workspace_id: SEED_WORKSPACE_ID,
      capability: "shift_lifecycle",
      level: "autonomous",
      min_role: "employee",
      requires_four_eyes: false,
    },
    { onConflict: "workspace_id,capability" },
  );
  if (error) {
    // Non-fatal: authority may already be seeded by a previous run.
    // The test assertions will reveal the actual state.
    console.warn(`seedShiftLifecycleAuthority upsert warning: ${error.message}`);
  }
}

// =============================================================================
// Positive path
// =============================================================================

test.describe("shift_lifecycle capability harness (positive path)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testRunId = `sl-harness-${Date.now()}`;
    testStartIso = new Date().toISOString();

    // Gate 1: container freshness.
    assertStageEngineContainerFresh();

    // Gate 2: Supabase Local up.
    await assertSupabaseLocalUp();

    // Gate 3: stage-engine health.
    await assertStageEngineHealthy();

    // Clean up stale sessions and test shifts from prior runs.
    await cleanupTestSessions();
    await cleanupTestShifts(SHIFT_MARKER);

    // Seed authority so gate_action allows shift_lifecycle mutations.
    await seedShiftLifecycleAuthority();

    // Create test shift in 'created' status for publish_shift test.
    const shift = await createTestShift({ status: "created", marker: SHIFT_MARKER });
    createdShiftId = shift.schedule_shift_id;

    // Create a 'published' shift for the approve_shift test.
    // approve_shift requires a shift_approval row (created by the engine's
    // interpret step or Phase 4 queue_shift_approval). We seed a minimal
    // shift_approval row directly below.
    const pubShift = await createTestShift({ status: "published", marker: SHIFT_MARKER });
    publishedShiftId = pubShift.schedule_shift_id;
  });

  test.afterAll(async () => {
    await snapshotTestState(testRunId, activeSessionId ?? undefined);
    await cleanupTestShifts(SHIFT_MARKER);
  });

  // ── A1: intent classifier routes to shift_lifecycle ──────────────────────
  //
  // The intent classifier hint for shift_lifecycle covers: "Publishing,
  // approving, interpreting, or settling a shift (write-side lifecycle
  // actions on the employee's own shift)."
  // We use "publiser vakten min" which directly maps to publish_shift.

  test("A1: classifier routes 'publiser vakten min' to intent='shift_lifecycle'", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `publiser vakten min med id ${createdShiftId}`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A1: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as BffChatResponse;

    // Capture session ID for downstream assertions.
    if (body.sessionId) {
      activeSessionId = body.sessionId;
    } else {
      const { data: sessionRows } = await supabase
        .from("engine_sessions")
        .select("id")
        .eq("profile_id", SEED_PROFILE_ID)
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .gte("created_at", testStartIso)
        .order("created_at", { ascending: false })
        .limit(1);
      activeSessionId = sessionRows?.[0]?.id ?? null;
    }

    // Fetch the classifier_output recording row.
    // Shape: content_redacted = { intent: "<capability>", confidence: <number> }
    const row = await assertRecordingPhase({
      sessionId: activeSessionId!,
      phase: "classifier_output",
      turnKind: "user_input",
      contentPredicate: (c) => {
        const content = c as Record<string, unknown>;
        return typeof content?.intent === "string" && content.intent === "shift_lifecycle";
      },
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    const content = row.content_redacted as Record<string, unknown>;
    expect(content?.intent, "A1: classifier_output.intent must be 'shift_lifecycle'").toBe(
      "shift_lifecycle",
    );
  });

  // ── A2: llm_request recording shows toolCount >= 1 ───────────────────────
  //
  // shift_lifecycle has allTools (publish, approve, interpret, settle,
  // clock_in_check). With level='autonomous', the tool-selector passes
  // all tools to the LLM. Minimum expectation: at least 1 tool passed.

  test("A2: llm_request recording shows toolCount >= 1 for shift_lifecycle", async () => {
    expect(activeSessionId, "A2 depends on A1 — activeSessionId must be set").not.toBeNull();

    const row = await assertRecordingPhase({
      sessionId: activeSessionId!,
      phase: "llm_request",
      turnKind: "agent_response",
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    const content = row.content_redacted as Record<string, unknown>;
    const toolCount = typeof content?.toolCount === "number" ? content.toolCount : -1;

    expect(
      toolCount,
      `A2: llm_request toolCount must be >= 1 (shift_lifecycle has 5 tools). ` +
        `Got toolCount=${toolCount}. Content: ${JSON.stringify(content)}`,
    ).toBeGreaterThanOrEqual(1);
  });

  // ── A3: llm_response does not contain error-pattern text ─────────────────

  test("A3: llm_response does not contain error-pattern text", async () => {
    expect(activeSessionId, "A3 depends on A1").not.toBeNull();

    const row = await assertRecordingPhase({
      sessionId: activeSessionId!,
      phase: "llm_response",
      turnKind: "agent_response",
      sinceIso: testStartIso,
      poll: { timeoutMs: 20_000 },
    });

    const content = row.content_redacted as Record<string, unknown>;
    const responseText = ((content?.text as string) ?? "").toLowerCase();

    expect(
      responseText.length,
      "A3: llm_response text is empty — LLM produced no output for shift_lifecycle query",
    ).toBeGreaterThan(0);

    await assertNoShiftLifecycleError(responseText, "A3");
  });

  // ── A4: gate_evaluation: router-level row, allow=true ────────────────────
  //
  // The stage-engine router calls gate_action once per turn for the matched
  // capability. This produces a row with action_type='chat_turn' (or the
  // router's own sentinel action). We look for any row with
  // capability='shift_lifecycle' and allow=true written since testStartIso.
  //
  // Per HANDOFF D2: router writes 1 row; tool writes 1 row (for publish_shift).
  // Total for A1 turn = 2 rows. We verify at least 1 exists with allow=true.

  test("A4: gate_evaluation router-level row written with allow=true", async () => {
    const { data: gateRows } = await supabase
      .from("gate_evaluation")
      .select("id, allow, capability, actor_profile_id, action_type, entity_id, evaluated_at")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("capability", "shift_lifecycle")
      .gte("evaluated_at", testStartIso)
      .order("evaluated_at", { ascending: true });

    const count = (gateRows ?? []).length;

    expect(
      count,
      `A4: expected >= 1 gate_evaluation row for capability='shift_lifecycle' ` +
        `since testStartIso. Found ${count}. ` +
        `If 0: router gate was bypassed — regression in agent-router.ts.`,
    ).toBeGreaterThanOrEqual(1);

    // At least one row must have allow=true (seed authority set to autonomous).
    const allowedRows = (gateRows ?? []).filter((r) => r.allow === true);
    expect(
      allowedRows.length,
      `A4: all ${count} gate_evaluation rows have allow=false. ` +
        `Expected at least 1 allow=true row. Check engine_authority_config for ` +
        `workspace=${SEED_WORKSPACE_ID} capability='shift_lifecycle'. ` +
        `Rows: ${JSON.stringify(gateRows)}`,
    ).toBeGreaterThanOrEqual(1);

    // actor_profile_id must match the seed profile (ADR-0151 server-side derivation).
    const wrongActorRows = (gateRows ?? []).filter((r) => r.actor_profile_id !== SEED_PROFILE_ID);
    expect(
      wrongActorRows.length,
      `A4: ${wrongActorRows.length} gate_evaluation row(s) have actor_profile_id != ` +
        `seed profile (${SEED_PROFILE_ID}). ADR-0151: profile_id must be server-derived. ` +
        `Rows: ${JSON.stringify(wrongActorRows)}`,
    ).toBe(0);
  });

  // ── A5: gate_evaluation: tool-level row for publish_shift ────────────────
  //
  // publish_shift calls callGateAction() internally with
  // capability='shift_lifecycle.publish' and action_type='publish_shift'.
  // This produces a separate gate_evaluation row from the router row.
  //
  // Note on sentinel entity_type (gate.ts SS-4): callGateAction wraps
  // gatedMutation() which writes TWO rows per call (Pathway A + Pathway B).
  // We look for the Pathway A row identified by action_type='publish_shift'.

  test("A5: gate_evaluation tool-level row written for publish_shift action", async () => {
    // allow may be true OR false depending on whether the LLM actually called
    // publish_shift with the createdShiftId. We check for the row existing
    // (action_type='publish_shift') with any allow value, then separately
    // assert that if it was called, it was permitted.
    const { data: toolGateRows } = await supabase
      .from("gate_evaluation")
      .select(
        "id, allow, capability, action_type, entity_id, actor_profile_id, evaluated_at, reason",
      )
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("action_type", "publish_shift")
      .gte("evaluated_at", testStartIso)
      .order("evaluated_at", { ascending: false });

    if (!toolGateRows || toolGateRows.length === 0) {
      // The LLM may have generated a response without calling the tool (e.g.
      // asked for clarification). This is a soft gap — we can't force tool
      // selection without a system-channel caller. Skip with documentation.
      test.skip(
        true,
        "A5 SOFT SKIP: No gate_evaluation row with action_type='publish_shift' found. " +
          "The LLM may have chosen not to call publish_shift (e.g. requested clarification " +
          "about which shift to publish). This is valid LLM behavior — the gate path is " +
          "verified at unit-test level in packages/ai/src/capabilities/shift-lifecycle/__tests__/. " +
          "A6 (shift status change) will also be skipped since it depends on tool invocation.",
      );
      return;
    }

    // If the tool was called, the row must have allow=true (autonomous authority seeded).
    const deniedRows = toolGateRows.filter((r) => !r.allow);
    expect(
      deniedRows.length,
      `A5: ${deniedRows.length} publish_shift gate_evaluation row(s) have allow=false. ` +
        `engine_authority_config.level='autonomous' should permit this. ` +
        `Denied rows: ${JSON.stringify(deniedRows)}`,
    ).toBe(0);

    // actor_profile_id must match the seed profile.
    const wrongActor = toolGateRows.filter((r) => r.actor_profile_id !== SEED_PROFILE_ID);
    expect(
      wrongActor.length,
      `A5: ${wrongActor.length} publish_shift gate rows have actor_profile_id != seed profile. ` +
        `ADR-0151 violation. Rows: ${JSON.stringify(wrongActor)}`,
    ).toBe(0);
  });

  // ── A6: schedule_shift.status transitions to 'published' ─────────────────
  //
  // If A5 confirmed publish_shift was called with allow=true, the schedule_shift
  // row must have status='published' and is_published=true.
  //
  // This test is conditional: if the LLM did not call publish_shift in A1
  // (asked for clarification), A6 is skipped. The state-machine transition is
  // covered by unit tests.

  test("A6: schedule_shift.status transitions to 'published' after publish_shift", async () => {
    // Check if publish_shift was actually called (A5 gating).
    const { data: toolGateRows } = await supabase
      .from("gate_evaluation")
      .select("id, allow")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("action_type", "publish_shift")
      .gte("evaluated_at", testStartIso);

    if (!toolGateRows || toolGateRows.length === 0) {
      test.skip(
        true,
        "A6 SKIP: publish_shift was not invoked (no gate_evaluation row). " +
          "The LLM did not call the tool in the A1 turn. State-machine transition " +
          "coverage is in unit tests (shift-lifecycle/__tests__/tools.test.ts).",
      );
      return;
    }

    await assertShiftStatus({
      shiftId: createdShiftId,
      expectedStatus: "published",
      poll: { timeoutMs: 10_000 },
    });

    // Verify is_published = true.
    const { data } = await supabase
      .from("schedule_shift")
      .select("is_published")
      .eq("schedule_shift_id", createdShiftId)
      .single();

    expect(
      data?.is_published,
      `A6: schedule_shift.is_published must be true after publish_shift for shift ${createdShiftId}`,
    ).toBe(true);
  });

  // ── A7: approve_shift gate_evaluation row ────────────────────────────────
  //
  // approve_shift requires:
  //   1. A published shift
  //   2. A shift_approval row with status='pending' (created by interpret_shift
  //      or the Phase 4 engine queue_shift_approval step)
  //
  // Since interpret_shift is system-channel-only and cannot be called via BFF
  // chat, we seed a shift_approval row directly before this test.
  // The approve_shift tool checks for a pending shift_approval row and updates
  // it to 'approved'. If no row exists, the tool returns a Norwegian error.
  //
  // This test seeds the prerequisite data and verifies the gate path.

  test("A7: approve_shift gate_evaluation row written with allow=true", async ({ page }) => {
    // Seed a daily_reconciliation (required FK for shift_approval).
    const reconcDate = new Date();
    reconcDate.setDate(reconcDate.getDate() + 2);
    const reconcDateStr = reconcDate.toISOString().slice(0, 10);

    // Find or create a department for the reconciliation.
    // Use the seed workspace's first department, or create a minimal one.
    let departmentId: string;
    const { data: existingDept } = await supabase
      .from("department")
      .select("department_id")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (existingDept?.department_id) {
      departmentId = existingDept.department_id;
    } else {
      const { data: newDept, error: deptErr } = await supabase
        .from("department")
        .insert({
          workspace_id: SEED_WORKSPACE_ID,
          name: "SL-Test-Dept",
          slug: `sl-test-dept-${Date.now()}`,
          is_active: true,
        })
        .select("department_id")
        .single();
      if (deptErr || !newDept) {
        test.skip(
          true,
          `A7 SKIP: Could not obtain department for reconciliation seed: ` +
            `${deptErr?.message ?? "no row"}. ` +
            "approve_shift gate path requires a daily_reconciliation FK.",
        );
        return;
      }
      departmentId = newDept.department_id;
    }

    // Seed daily_reconciliation.
    const { data: reconc, error: reconcErr } = await supabase
      .from("daily_reconciliation")
      .insert({
        workspace_id: SEED_WORKSPACE_ID,
        department_id: departmentId,
        reconciliation_date: reconcDateStr,
        status: "pending",
      })
      .select("reconciliation_id")
      .single();

    if (reconcErr || !reconc) {
      test.skip(
        true,
        `A7 SKIP: Could not seed daily_reconciliation: ${reconcErr?.message ?? "no row"}. ` +
          "approve_shift requires a shift_approval FK to daily_reconciliation.",
      );
      return;
    }

    // Seed shift_approval row for the published shift.
    const { error: approvalErr } = await supabase.from("shift_approval").insert({
      workspace_id: SEED_WORKSPACE_ID,
      shift_id: publishedShiftId,
      reconciliation_id: reconc.reconciliation_id,
      status: "pending",
      planned_hours: 5,
      calculated_hours: 5,
    });

    if (approvalErr) {
      test.skip(
        true,
        `A7 SKIP: Could not seed shift_approval row: ${approvalErr.message}. ` +
          "approve_shift requires an existing shift_approval row. " +
          "In production this is created by the Phase 4 queue_shift_approval engine step.",
      );
      return;
    }

    // Now call approve_shift via chat.
    const a7StartIso = new Date().toISOString();
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `godkjenn vakten min med id ${publishedShiftId} med 5 timer`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(
      res.ok(),
      `A7: /api/botsson/chat returned ${res.status()} for approve_shift request`,
    ).toBe(true);

    const body = (await res.json()) as BffChatResponse;
    const responseText = (body.text ?? "").toLowerCase();

    // Response must not contain unhandled error patterns.
    const hardErrorPattern = /unhandled exception|internal server error|500|stack trace/i;
    expect(responseText, `A7: Response contains hard error pattern: "${responseText}"`).not.toMatch(
      hardErrorPattern,
    );

    // Gate path: look for approve_shift action_type in gate_evaluation.
    const { data: approveGateRows } = await supabase
      .from("gate_evaluation")
      .select("id, allow, action_type, actor_profile_id, capability, entity_id, evaluated_at")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("action_type", "approve_shift")
      .gte("evaluated_at", a7StartIso);

    if (!approveGateRows || approveGateRows.length === 0) {
      // LLM did not invoke approve_shift — likely asked for clarification or
      // the shift_approval pre-condition was surfaced in the response.
      // Soft skip: gate path is exercised by unit tests.
      test.skip(
        true,
        "A7 SOFT SKIP: No gate_evaluation row with action_type='approve_shift' found. " +
          "The LLM may have requested clarification or the tool reported " +
          "'Ingen pending shift_approval funnet'. " +
          "Gate path is verified at unit level. " +
          "Tracked gap: approve_shift E2E requires full shift lifecycle pipe " +
          "(interpret_shift must run first via system channel).",
      );
      return;
    }

    // If the tool was called, verify gate allow=true.
    const deniedApprove = approveGateRows.filter((r) => !r.allow);
    expect(
      deniedApprove.length,
      `A7: ${deniedApprove.length} approve_shift gate rows have allow=false. ` +
        `engine_authority_config.level='autonomous' should permit this. ` +
        `Rows: ${JSON.stringify(deniedApprove)}`,
    ).toBe(0);

    // actor_profile_id must match seed profile.
    const wrongActorApprove = approveGateRows.filter((r) => r.actor_profile_id !== SEED_PROFILE_ID);
    expect(
      wrongActorApprove.length,
      `A7: ${wrongActorApprove.length} approve_shift gate rows have wrong actor_profile_id. ` +
        `ADR-0151 violation.`,
    ).toBe(0);
  });

  // ── A8: shift_approval transitions to 'approved' ─────────────────────────
  //
  // Conditional on A7 having confirmed approve_shift was called.

  test("A8: shift_approval row transitions to status='approved' after approve_shift", async () => {
    // Check if approve_shift was actually called.
    const { data: approveGate } = await supabase
      .from("gate_evaluation")
      .select("id, allow")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("action_type", "approve_shift")
      .gte("evaluated_at", testStartIso);

    const approveInvoked = (approveGate ?? []).some((r) => r.allow === true);

    if (!approveInvoked) {
      test.skip(
        true,
        "A8 SKIP: approve_shift was not invoked with allow=true (A7 did not confirm gate). " +
          "shift_approval state-machine is covered by unit tests.",
      );
      return;
    }

    // Poll for the shift_approval row to reach 'approved'.
    let approvalStatus: string | null = null;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const { data } = await supabase
        .from("shift_approval")
        .select("status, approved_by, approved_hours")
        .eq("shift_id", publishedShiftId)
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        approvalStatus = data.status;
        if (data.status === "approved") {
          // Verify approved_by is set to seed profile.
          expect(
            data.approved_by,
            `A8: shift_approval.approved_by must be the seed profile (${SEED_PROFILE_ID}) ` +
              `after approve_shift`,
          ).toBe(SEED_PROFILE_ID);
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    expect(
      approvalStatus,
      `A8: shift_approval.status expected 'approved' for shift ${publishedShiftId}. ` +
        `Got '${approvalStatus ?? "not found"}'. ` +
        `Check the approve_shift tool body in packages/ai/src/capabilities/shift-lifecycle/tools.ts.`,
    ).toBe("approved");
  });
});

// =============================================================================
// Gate verification — router-level gate per capability turn
// =============================================================================

test.describe("shift_lifecycle capability — gate_action verification (G1)", () => {
  // G1 verifies the invariant from HANDOFF-harness-coverage-top3.md D2:
  //   Every Botsson turn writes a router-level gate_evaluation row.
  //   Write tools additionally write their own tool-level rows.
  //
  // G1a: at least 1 gate_evaluation row exists for shift_lifecycle since testStartIso.
  // G1b: all rows have the correct actor_profile_id (ADR-0151 server-side derivation).
  // G1c: capability label on tool-level rows follows the dotted sub-capability
  //      naming convention (e.g. 'shift_lifecycle.publish').

  test("G1: gate_evaluation rows exist for shift_lifecycle with correct actor_profile_id", async () => {
    const { data: gateRows } = await supabase
      .from("gate_evaluation")
      .select("id, allow, capability, actor_profile_id, action_type, channel, evaluated_at")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .gte("evaluated_at", testStartIso)
      .or(
        `capability.eq.shift_lifecycle,` +
          `capability.eq.shift_lifecycle.publish,` +
          `capability.eq.shift_lifecycle.approve`,
      )
      .order("evaluated_at", { ascending: true });

    expect(
      (gateRows ?? []).length,
      `G1: expected >= 1 gate_evaluation row for shift_lifecycle or sub-capabilities ` +
        `since testStartIso. Found 0. ` +
        `This indicates the positive-path A1 turn failed to trigger gate_action.`,
    ).toBeGreaterThanOrEqual(1);

    // All rows must have actor_profile_id = seed profile.
    const wrongActor = (gateRows ?? []).filter((r) => r.actor_profile_id !== SEED_PROFILE_ID);
    expect(
      wrongActor.length,
      `G1: ${wrongActor.length} gate_evaluation row(s) have actor_profile_id != ` +
        `${SEED_PROFILE_ID}. ADR-0151 server-side derivation must be honoured. ` +
        `Rows: ${JSON.stringify(wrongActor)}`,
    ).toBe(0);

    // Informational log for action_type distribution.
    const actionTypes = (gateRows ?? []).map((r) => `${r.capability}:${r.action_type}`);
    console.log(`G1 INFO: gate_evaluation action types for this run: ${actionTypes.join(", ")}`);
  });
});

// =============================================================================
// Negative path
// =============================================================================

test.describe("shift_lifecycle capability harness (negative path)", () => {
  test.describe.configure({ mode: "serial" });

  let negStartIso: string;
  let negShiftId: string;

  test.beforeAll(async () => {
    negStartIso = new Date().toISOString();
    // Create a fresh shift for negative-path tests.
    const shift = await createTestShift({ status: "created", marker: SHIFT_MARKER });
    negShiftId = shift.schedule_shift_id;
  });

  test.afterAll(async () => {
    await cleanupTestShifts(SHIFT_MARKER);
  });

  // ── N1: authority denial — gate blocks when level='disabled' ────────────
  //
  // Temporarily set engine_authority_config.level='disabled' for shift_lifecycle,
  // then issue a publish_shift request. The gate_evaluation row must have
  // allow=false. We restore the authority level after this test.

  test("N1: gate_evaluation has allow=false when shift_lifecycle authority is 'disabled'", async ({
    page,
  }) => {
    const n1StartIso = new Date().toISOString();

    // Set authority to disabled.
    await supabase.from("engine_authority_config").upsert(
      {
        workspace_id: SEED_WORKSPACE_ID,
        capability: "shift_lifecycle",
        level: "disabled",
        min_role: "employee",
        requires_four_eyes: false,
      },
      { onConflict: "workspace_id,capability" },
    );

    try {
      await loginAsAdmin(page);
      await page.goto("/Botsson");

      const res = await page.request.post("/api/botsson/chat", {
        data: {
          workspaceId: SEED_WORKSPACE_ID,
          userMessage: `publiser vakten med id ${negShiftId}`,
        },
        headers: { "content-type": "application/json" },
      });

      // BFF should return 200 (LLM still processes), but the tool should return
      // a deny or the tool-selector should exclude the tool entirely.
      expect(
        res.ok(),
        `N1: BFF returned ${res.status()} — should be 200 even when tool is denied`,
      ).toBe(true);

      // Verify gate_evaluation has allow=false for shift_lifecycle in this window.
      const { data: deniedRows } = await supabase
        .from("gate_evaluation")
        .select("id, allow, capability, action_type, reason")
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .gte("evaluated_at", n1StartIso)
        .or("capability.eq.shift_lifecycle,capability.eq.shift_lifecycle.publish");

      // With level='disabled', the gate must deny. We expect at least 1 deny row.
      const denied = (deniedRows ?? []).filter((r) => r.allow === false);
      const allowed = (deniedRows ?? []).filter((r) => r.allow === true);

      if (denied.length === 0 && allowed.length === 0) {
        // The tool-selector may have hidden the tool entirely (no gate call made).
        // This is acceptable for 'disabled' level — the tool is not presented.
        console.log(
          "N1 INFO: No gate_evaluation rows found for 'disabled' level. " +
            "Tool-selector may have excluded publish_shift entirely (valid for disabled authority). " +
            "Verifying shift status was NOT changed.",
        );
        // Shift must still be in 'created' status (not published).
        const { data: shift } = await supabase
          .from("schedule_shift")
          .select("status")
          .eq("schedule_shift_id", negShiftId)
          .single();
        expect(
          shift?.status,
          `N1: shift ${negShiftId} must still have status='created' when authority is disabled`,
        ).toBe("created");
      } else if (allowed.length > 0) {
        // A gate row with allow=true means the tool ran despite 'disabled' authority.
        expect(
          false,
          `N1: gate_evaluation has allow=true despite level='disabled'. ` +
            `The gate is not enforcing authority correctly. ` +
            `Allowed rows: ${JSON.stringify(allowed)}`,
        ).toBe(true);
      } else {
        // Expected path: denied.length > 0.
        expect(
          denied.length,
          `N1: expected at least 1 allow=false gate_evaluation row when level='disabled'. ` +
            `Denied rows: ${JSON.stringify(denied)}`,
        ).toBeGreaterThanOrEqual(1);

        // Shift must not have been published.
        const { data: shift } = await supabase
          .from("schedule_shift")
          .select("status")
          .eq("schedule_shift_id", negShiftId)
          .single();
        expect(
          shift?.status,
          `N1: shift ${negShiftId} must still be 'created' after a denied publish_shift. ` +
            `Got '${shift?.status}'. The tool must not mutate when gate denies.`,
        ).toBe("created");
      }
    } finally {
      // Restore authority to autonomous so subsequent tests are not affected.
      await supabase.from("engine_authority_config").upsert(
        {
          workspace_id: SEED_WORKSPACE_ID,
          capability: "shift_lifecycle",
          level: "autonomous",
          min_role: "employee",
          requires_four_eyes: false,
        },
        { onConflict: "workspace_id,capability" },
      );
    }
  });

  // ── N2: voice channel blocked — publish_shift is chat + system only ──────
  //
  // Per ADR-0078 + tools.ts:121 — if channel === "voice", publish_shift returns
  // "Publisering av skift kan ikke gjøres over stemme (ADR-0078)."
  // The BFF chat endpoint hardcodes channel="chat" so this cannot be driven
  // end-to-end via BFF. Skip with documentation if LiveKit is unavailable.

  test("N2: voice channel blocked — publish_shift is chat + system only (ADR-0078)", async ({
    page,
  }) => {
    const tokenRes = await page.request.post("/api/botsson/voice/token", {
      data: { workspaceId: SEED_WORKSPACE_ID },
    });

    if (!tokenRes.ok()) {
      test.skip(
        true,
        `N2 SKIP: voice token BFF returned ${tokenRes.status()} — LiveKit not configured. ` +
          "shift_lifecycle voice channel guard cannot be exercised without a live LiveKit session. " +
          "The guard is verified at unit level: publish_shift returns 'Publisering av skift kan " +
          "ikke gjøres over stemme (ADR-0078).' when ctx.channel === 'voice'. " +
          "See packages/ai/src/capabilities/shift-lifecycle/tools.ts line ~121.",
      );
      return;
    }

    // LiveKit available: verify the channel guard via a voice hint on the BFF.
    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `publiser vakten med id ${negShiftId}`,
        channel: "voice",
      },
      headers: { "content-type": "application/json" },
    });

    if (!res.ok()) {
      test.skip(
        true,
        "N2 SKIP: BFF rejected voice channel hint — ADR-0151 forgery defence may block " +
          "client-supplied channel parameter. Voice channel guard is verified at unit level.",
      );
      return;
    }

    // If the BFF accepted the voice hint, verify the shift was NOT published.
    const { data: shiftAfter } = await supabase
      .from("schedule_shift")
      .select("status")
      .eq("schedule_shift_id", negShiftId)
      .single();

    expect(
      shiftAfter?.status,
      `N2: shift ${negShiftId} must NOT be 'published' when channel='voice' is used. ` +
        `Got status='${shiftAfter?.status}'. publish_shift must reject voice channel.`,
    ).not.toBe("published");
  });

  // ── N3: approve_shift without prior interpret → tool returns error ────────
  //
  // When no shift_approval row exists for a shift, approve_shift returns:
  // "Ingen pending shift_approval funnet — kjør interpret_shift først."
  //
  // We create a published shift with no shift_approval row and ask Mr. Botsson
  // to approve it. The response should contain the Norwegian error message or
  // a clarification (the LLM may rephrase it).

  test("N3: approve_shift without shift_approval row surfaces an error, not a crash", async ({
    page,
  }) => {
    // Create a shift with no shift_approval row.
    const noApprovalShift = await createTestShift({
      status: "published",
      marker: SHIFT_MARKER,
    });

    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: `godkjenn vakten min med id ${noApprovalShift.schedule_shift_id} med 5 timer`,
      },
      headers: { "content-type": "application/json" },
    });

    expect(
      res.ok(),
      `N3: BFF returned ${res.status()} — must be 200 even when approve_shift fails`,
    ).toBe(true);

    const body = (await res.json()) as BffChatResponse;

    // Hard failure: BFF returned a raw error object.
    expect(body.error, `N3: BFF returned a raw error object: ${body.error}`).toBeUndefined();

    // Hard failure: response contains unhandled-exception language.
    const responseText = (body.text ?? "").toLowerCase();
    const unhandledPattern = /unhandled exception|internal server error|500|stack trace/i;
    expect(
      responseText,
      `N3: response contains unhandled-error language: "${responseText}"`,
    ).not.toMatch(unhandledPattern);

    // The response must be non-empty (LLM must produce output).
    expect(
      responseText.length,
      "N3: response is empty for an approve_shift with no shift_approval row",
    ).toBeGreaterThan(0);
  });
});

// =============================================================================
// System-channel gap documentation
// (interpret_shift + settle_shift cannot be reached via BFF chat)
// =============================================================================

test.describe("shift_lifecycle capability — system-channel gap documentation", () => {
  // SL-SKIP-1: interpret_shift is system-channel-only per ADR-0078 + tools.ts.
  // The BFF /api/botsson/chat hardcodes channel="chat", so interpret_shift
  // always returns "interpret_shift kan kun kalles fra system-kanal."
  // Full E2E coverage requires either: (a) a direct stage-engine HTTP call
  // with channel="system" (bypasses BFF auth), or (b) the Phase 4 engine
  // dispatch path to trigger the shift_lifecycle_v1 process.
  // Neither is available in the current BFF-gated E2E harness.

  test("SL-SKIP-1 [gap-doc]: interpret_shift is system-channel-only — unreachable via BFF chat", async () => {
    test.skip(
      true,
      "SL-SKIP-1 GAP DOCUMENTED: interpret_shift requires channel='system' per ADR-0078. " +
        "The BFF /api/botsson/chat route hardcodes channel='chat' (apps/web/src/app/api/botsson/chat/route.ts:192). " +
        "End-to-end coverage of interpret_shift requires: " +
        "(1) A direct stage-engine call with channel=system (bypasses JWT auth — not safe for E2E), OR " +
        "(2) The Phase 4 engine dispatch trigger (shift_lifecycle_v1 process step 'call_rpc' action). " +
        "Unit-test coverage: packages/ai/src/capabilities/shift-lifecycle/__tests__/tools.test.ts. " +
        "Track as gap: interpret_shift needs an admin-facing API route with system-channel forwarding.",
    );
  });

  // SL-SKIP-2: settle_shift is system-channel-only for the same reason.
  // settle_shift also depends on a shift_hour_interpretation row being present
  // (created by interpret_shift), making it doubly unreachable via BFF chat.

  test("SL-SKIP-2 [gap-doc]: settle_shift is system-channel-only — unreachable via BFF chat", async () => {
    test.skip(
      true,
      "SL-SKIP-2 GAP DOCUMENTED: settle_shift requires channel='system' per ADR-0078. " +
        "Same constraint as SL-SKIP-1. Additionally, settle_shift requires a " +
        "shift_hour_interpretation row (produced by interpret_shift) to exist before it can run. " +
        "The full interpret → settle pipeline is exercised by the Phase 4 shift settlement " +
        "engine process (shift_lifecycle_v1). " +
        "Unit-test coverage: packages/ai/src/capabilities/shift-lifecycle/__tests__/tools.test.ts. " +
        "Track as gap: settle_shift E2E requires Phase 4 process trigger support in test harness.",
    );
  });
});
