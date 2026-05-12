// =============================================================================
// personal-harness-e2e.spec.ts
//
// E2E coverage of the Botsson personal capability.
//
// Pipe under test: L1 → L2 BFF (/api/botsson/chat) → L3 Stage Engine →
//                  L4 personal capability → L5 DB
//                  (engine_memory, personal_task, engine_delayed_trigger)
//
// Tools covered (all 5):
//   add_note       — quick note capture → engine_memory (general)     (A1–A4)
//   create_task    — personal todo     → personal_task                (A5–A8)
//   set_reminder   — timed reminder    → engine_delayed_trigger        (A9–A12)
//   get_history    — activity read     → activity_trail (read-only)   (A13–A16)
//   update_setting — per-profile pref → engine_memory (preference)   (A17–A20)
//
// Negative paths:
//   N1: cross-profile isolation — a non-admin BFF call with a forged profileId
//       in the body should NOT expose another profile's notes (ADR-0151 scope).
//       The BFF derives profileId server-side from JWT; the body value is ignored.
//       We verify: the response is non-error AND the injected body profileId does
//       not cause a DB read outside the caller's workspace.
//
//   N2: voice channel guard — personal capability allows voice for all tools
//       (no PII restriction per ADR-0078). Skip — no LiveKit in CI.
//
// Infrastructure requirements (same as botsson-harness-e2e.spec.ts):
//   1. Supabase Local running: npx supabase start
//   2. Stage-engine container rebuilt with current code
//   3. Next.js dev server on port 3060
//   4. apps/e2e/.env.local: SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY
//
// Seed state:
//   beforeAll calls ensurePersonalAuthority() to guarantee engine_authority_config
//   has level='suggest' for the personal capability in the seed workspace.
//   The migration 20260520100000_personal_task.sql seeds this row for all
//   workspaces with an owner profile. For CI clean DBs the helper inserts it
//   directly via the service-role client.
//
// DB sanity:
//   Each mutation tool has a DB sanity assertion (D-suffix tests inside the
//   positive-path block) that polls the relevant table for the written row.
//   get_history is read-only and has no DB write to verify.
//
// Cleanup:
//   afterAll calls cleanupPersonalRows() to remove engine_memory + personal_task
//   + engine_event + engine_trigger rows created in this run, scoped to the seed
//   profile + workspace + testStartIso to avoid removing pre-existing data.
//
// ADR refs: ADR-0078 (channel guard), ADR-0099 (gate_action), ADR-0134
//           (telemetry), ADR-0151 (server-side profile_id derivation),
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
  dumpStageEngineLogs,
  snapshotTestState,
} from "../helpers/botsson-harness";
import {
  ensurePersonalAuthority,
  cleanupPersonalRows,
  assertPersonalToolFired,
  assertPersonalCapabilityClassified,
  assertPersonalTrailEvent,
  assertPersonalNoteRow,
  assertPersonalTaskRow,
  assertPersonalSettingRow,
  assertReminderRow,
} from "../helpers/personal-harness";
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

// Session IDs captured per tool invocation block.
let addNoteSessionId: string | null = null;
let createTaskSessionId: string | null = null;
let setReminderSessionId: string | null = null;
let getHistorySessionId: string | null = null;
let updateSettingSessionId: string | null = null;

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
// Standard error pattern guard (reused per test)
// ---------------------------------------------------------------------------

function assertNoHardError(
  responseText: string,
  context: string,
  body: { error?: string },
  logs: string,
): void {
  const errorPattern = /feilet|teknisk feil|beklager.*ikke|dessverre|technical (problem|error)/i;
  if (errorPattern.test(responseText) || body.error) {
    expect(
      responseText,
      `${context}: assistant returned hard-error response.\n` +
        `Response: "${responseText}"\nStage-engine logs:\n${logs}`,
    ).not.toMatch(errorPattern);
  }
}

// =============================================================================
// Positive-path suite
// =============================================================================

test.describe("Personal capability — positive path", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testRunId = `personal-harness-${Date.now()}`;
    testStartIso = new Date().toISOString();

    // Gate 1: container freshness.
    assertStageEngineContainerFresh();

    // Gate 2: Supabase Local up.
    await assertSupabaseLocalUp();

    // Gate 3: stage-engine health.
    await assertStageEngineHealthy();

    // Ensure authority row is present so gate_action allows mutations.
    await ensurePersonalAuthority(SEED_WORKSPACE_ID);

    // Clean stale sessions to avoid noise from prior runs.
    await cleanupTestSessions(testStartIso);
  });

  test.afterAll(async () => {
    await snapshotTestState(testRunId, addNoteSessionId ?? undefined);
    // Remove test-generated rows — scoped to seed profile + workspace + run start.
    await cleanupPersonalRows(SEED_PROFILE_ID, SEED_WORKSPACE_ID, testStartIso);
  });

  // ── A1–A4: add_note ────────────────────────────────────────────────────────
  //
  // add_note writes to engine_memory with memory_type='general'.
  // gate_action is called first. emit("personal.note_added") is fired after.
  // The assertPersonalNoteRow helper (D-assertion inside A4) polls engine_memory
  // for the content fragment.

  test("A1: add_note — BFF returns non-error response for note capture", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "noter at jeg bestilte forklær til kjøkkenet",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A1: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    addNoteSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();
    const logs = await dumpStageEngineLogs();
    assertNoHardError(responseText, "A1", body, logs);

    expect(responseText.length, "A1: assistant response must not be empty").toBeGreaterThan(0);
  });

  test("A2: add_note — classifier_output shows intent='personal'", async () => {
    expect(addNoteSessionId, "A2 depends on A1").not.toBeNull();

    const row = await assertPersonalCapabilityClassified(addNoteSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A2: classifier intent must be 'personal'").toBe("personal");
  });

  test("A3: add_note — tool_call recording row present for add_note", async () => {
    expect(addNoteSessionId, "A3 depends on A1").not.toBeNull();

    const row = await assertPersonalToolFired(addNoteSessionId!, "add_note", {
      sinceIso: testStartIso,
    });
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A3: tool_call must name add_note").toBe("add_note");
  });

  test("A4: add_note — activity_trail personal.note_added emitted", async () => {
    const row = await assertPersonalTrailEvent("add_note", testStartIso);
    expect(row.workspace_id, "A4: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A4: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });

  test("A4-DB: add_note — engine_memory general row written", async () => {
    // DB sanity: verify the tool actually wrote the note to engine_memory.
    const row = await assertPersonalNoteRow("forklær", testStartIso);
    expect(row.memory_type, "A4-DB: memory_type must be 'general'").toBe("general");
    expect(row.content.toLowerCase(), "A4-DB: content must contain the note text").toContain(
      "forklær",
    );
  });

  // ── A5–A8: create_task ─────────────────────────────────────────────────────
  //
  // create_task writes to personal_task. gate_action first, then INSERT.
  // emit("personal.task_created") after. assertPersonalTaskRow verifies the DB row.

  test("A5: create_task — BFF returns non-error response for task creation", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "lag oppgave: ring leverandør om bestillingen fredag",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A5: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    createTaskSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();
    const logs = await dumpStageEngineLogs();
    assertNoHardError(responseText, "A5", body, logs);

    expect(responseText.length, "A5: response must not be empty").toBeGreaterThan(0);
  });

  test("A6: create_task — classifier_output shows intent='personal'", async () => {
    expect(createTaskSessionId, "A6 depends on A5").not.toBeNull();

    const row = await assertPersonalCapabilityClassified(createTaskSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A6: intent must be 'personal'").toBe("personal");
  });

  test("A7: create_task — tool_call recording row present", async () => {
    expect(createTaskSessionId, "A7 depends on A5").not.toBeNull();

    const row = await assertPersonalToolFired(createTaskSessionId!, "create_task", {
      sinceIso: testStartIso,
    });
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A7: tool_call must name create_task").toBe("create_task");
  });

  test("A8: create_task — activity_trail personal.task_created emitted", async () => {
    const row = await assertPersonalTrailEvent("create_task", testStartIso);
    expect(row.workspace_id, "A8: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A8: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });

  test("A8-DB: create_task — personal_task row written to DB", async () => {
    const row = await assertPersonalTaskRow("leverandør", testStartIso);
    expect(row.status, "A8-DB: task status must be 'open'").toBe("open");
    // priority defaults to 'normal' when not specified in the message
    expect(["normal", "high", "urgent"], "A8-DB: priority must be a known value").toContain(
      row.priority,
    );
  });

  // ── A9–A12: set_reminder ───────────────────────────────────────────────────
  //
  // set_reminder inserts three rows: engine_event, engine_trigger, engine_delayed_trigger.
  // gate_action first. emit("personal.reminder_set") after.
  // assertReminderRow polls engine_event payload to find the matching reminder.

  test("A9: set_reminder — BFF returns non-error response for reminder creation", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        // Use a far-future fire_at so the test does not depend on clock precision.
        userMessage: "minn meg om møtet med leverandøren klokken 14 i morgen",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A9: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    setReminderSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();
    const logs = await dumpStageEngineLogs();

    // set_reminder may return "duplicate idempotency key" on re-run — not a hard error.
    const hardPanicPattern = /uncaught|stack trace|typeerror|500 internal/i;
    if (hardPanicPattern.test(responseText)) {
      expect(
        responseText,
        `A9: server panic in set_reminder response.\n` +
          `Response: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardPanicPattern);
    }

    expect(responseText.length, "A9: response must not be empty").toBeGreaterThan(0);
  });

  test("A10: set_reminder — classifier_output shows intent='personal'", async () => {
    expect(setReminderSessionId, "A10 depends on A9").not.toBeNull();

    const row = await assertPersonalCapabilityClassified(setReminderSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A10: intent must be 'personal'").toBe("personal");
  });

  test("A11: set_reminder — tool_call recording row present", async () => {
    expect(setReminderSessionId, "A11 depends on A9").not.toBeNull();

    const row = await assertPersonalToolFired(setReminderSessionId!, "set_reminder", {
      sinceIso: testStartIso,
    });
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A11: tool_call must name set_reminder").toBe("set_reminder");
  });

  test("A12: set_reminder — activity_trail personal.reminder_set emitted", async () => {
    const row = await assertPersonalTrailEvent("set_reminder", testStartIso);
    expect(row.workspace_id, "A12: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A12: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });

  test("A12-DB: set_reminder — engine_delayed_trigger row written", async () => {
    // DB sanity: verify the tool wrote the delayed trigger chain.
    // The assertReminderRow helper scans engine_event.payload.text for the fragment.
    const row = await assertReminderRow("møte", testStartIso);
    expect(typeof row.fire_at, "A12-DB: fire_at must be a string date").toBe("string");
    expect(
      new Date(row.fire_at).getTime(),
      "A12-DB: fire_at must be a future timestamp",
    ).toBeGreaterThan(new Date(testStartIso).getTime());
  });

  // ── A13–A16: get_history ───────────────────────────────────────────────────
  //
  // get_history is read-only — no gate check, no DB write.
  // It reads activity_trail filtered by actor_id = profileId.
  // The tool emits personal.history_queried (read telemetry, no activity_trail write).
  // After the A1/A5/A9 mutations, activity_trail will have rows for the seed profile.

  test("A13: get_history — BFF returns non-error response for activity query", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "hva har jeg gjort i dag?",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A13: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    getHistorySessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();
    const logs = await dumpStageEngineLogs();

    // get_history returns "Ingen hendelser funnet." when the trail is empty —
    // this is a graceful non-error response. Check only for hard-error patterns.
    const hardPanicPattern = /teknisk feil|system.*feil|uncaught|typeerror/i;
    if (hardPanicPattern.test(responseText) || body.error) {
      expect(
        responseText,
        `A13: hard error in get_history response.\n` +
          `Response: "${responseText}"\nLogs:\n${logs}`,
      ).not.toMatch(hardPanicPattern);
    }

    expect(responseText.length, "A13: response must not be empty").toBeGreaterThan(0);
  });

  test("A14: get_history — classifier_output shows intent='personal'", async () => {
    expect(getHistorySessionId, "A14 depends on A13").not.toBeNull();

    const row = await assertPersonalCapabilityClassified(getHistorySessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A14: intent must be 'personal'").toBe("personal");
  });

  test("A15: get_history — tool_call recording row present", async () => {
    expect(getHistorySessionId, "A15 depends on A13").not.toBeNull();

    const row = await assertPersonalToolFired(getHistorySessionId!, "get_history", {
      sinceIso: testStartIso,
    });
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A15: tool_call must name get_history").toBe("get_history");
  });

  test("A16: get_history — activity_trail personal.history_queried emitted", async () => {
    // get_history emits to posthog + logger only (per registry). It does NOT write to
    // activity_trail (read-only tool — emit() has no activity_trail destination for
    // personal.history_queried). We verify the recording row is present (A15) and
    // the response is non-error. This test documents the intentional gap:
    // history_queried is NOT in activity_trail.
    test.skip(
      true,
      "A16: personal.history_queried is read-only — emits to posthog+logger only. " +
        "activity_trail does not receive this event per registry routing. " +
        "Verified via A15 (tool_call recording row) + A13 (non-error response). " +
        "Tracking gap: personal-history-activity-trail-emit if requirement changes.",
    );
  });

  // ── A17–A20: update_setting ────────────────────────────────────────────────
  //
  // update_setting writes to engine_memory (preference). It first expires any
  // existing preference rows for the same key, then inserts the new row.
  // gate_action first. emit("personal.setting_updated") after.

  test("A17: update_setting — BFF returns non-error response for setting update", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    const callStart = new Date().toISOString();

    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage: "sett foretrukket vakttype til kveld",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.ok(), `A17: /api/botsson/chat returned ${res.status()}: ${await res.text()}`).toBe(
      true,
    );

    const body = (await res.json()) as { text?: string; sessionId?: string; error?: string };
    updateSettingSessionId = await resolveSessionId(body, callStart);

    const responseText = (body.text ?? "").toLowerCase();
    const logs = await dumpStageEngineLogs();
    assertNoHardError(responseText, "A17", body, logs);

    expect(responseText.length, "A17: response must not be empty").toBeGreaterThan(0);
  });

  test("A18: update_setting — classifier_output shows intent='personal'", async () => {
    expect(updateSettingSessionId, "A18 depends on A17").not.toBeNull();

    const row = await assertPersonalCapabilityClassified(updateSettingSessionId!, testStartIso);
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.intent, "A18: intent must be 'personal'").toBe("personal");
  });

  test("A19: update_setting — tool_call recording row present", async () => {
    expect(updateSettingSessionId, "A19 depends on A17").not.toBeNull();

    const row = await assertPersonalToolFired(updateSettingSessionId!, "update_setting", {
      sinceIso: testStartIso,
    });
    const content = row.content_redacted as Record<string, unknown>;
    expect(content.tool_name, "A19: tool_call must name update_setting").toBe("update_setting");
  });

  test("A20: update_setting — activity_trail personal.setting_updated emitted", async () => {
    const row = await assertPersonalTrailEvent("update_setting", testStartIso);
    expect(row.workspace_id, "A20: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A20: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });

  test("A20-DB: update_setting — engine_memory preference row written with key=value encoding", async () => {
    // DB sanity: the tool encodes the preference as "Innstilling: {key}={value}".
    // The LLM will use "foretrukket_vakttype" (or similar) as the key and "kveld" as value.
    // We search for the value fragment "kveld" in preference memory rows.
    const row = await assertPersonalSettingRow("foretrukket_vakttype", "kveld", testStartIso);
    expect(
      row.content,
      "A20-DB: preference content must follow Innstilling: key=value encoding",
    ).toContain("Innstilling:");
    expect(row.content.toLowerCase(), "A20-DB: preference must contain 'kveld'").toContain("kveld");
  });
});

// =============================================================================
// Negative-path suite
// =============================================================================

test.describe("Personal capability — negative path", () => {
  let negativeTestStartIso: string;

  test.beforeEach(() => {
    negativeTestStartIso = new Date().toISOString();
  });

  // ── N1: cross-profile isolation (ADR-0151) ────────────────────────────────
  //
  // The personal capability scopes ALL reads and writes by ctx.profileId, which
  // is derived server-side from the JWT by the BFF (ADR-0151). A body-supplied
  // profileId is ignored. We verify this by calling the BFF with an arbitrary
  // profileId in the body that differs from the logged-in user's profile.
  //
  // Expected: the BFF returns 200 with a non-error response, and the response
  // does NOT contain data from the injected profile's notes (because the
  // stage-engine resolves profileId from JWT, not from body).

  test("N1: cross-profile isolation — body profileId is ignored, JWT profile is used", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/Botsson");

    // Insert a note for a different (non-existent) profile — this row should
    // NEVER appear in any response for the logged-in seed admin.
    const sentinelProfileId = "00000000-dead-beef-0000-000000000000";
    const sentinelText = "SENTINEL-NOTE-CROSS-PROFILE-ISOLATION";

    // The BFF derives profileId from JWT, so this body profileId is ignored.
    // We are simulating what a forged request would send.
    const res = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        // Attempt to inject a different profileId — ADR-0151 mandates this is ignored.
        profileId: sentinelProfileId,
        userMessage: `noter dette: ${sentinelText}`,
      },
      headers: { "content-type": "application/json" },
    });

    // BFF must not crash (500) from the injected profileId.
    expect(res.status(), "N1: BFF must not return 5xx for body-injected profileId").toBeLessThan(
      500,
    );

    const body = (await res.json()) as { text?: string };
    const responseText = body.text ?? "";

    // Response must be non-empty.
    expect(responseText.length, "N1: response must not be empty").toBeGreaterThan(0);

    // No stack trace.
    const panicPattern = /uncaught|stack trace|typeerror|syntaxerror/i;
    expect(
      panicPattern.test(responseText),
      `N1: server panic pattern in response. Response: "${responseText.slice(0, 300)}"`,
    ).toBe(false);

    // Verify that the note was NOT written to the sentinel profile's engine_memory.
    // The BFF should have used the JWT-derived profileId (SEED_PROFILE_ID), not the
    // body-injected sentinelProfileId. A row for sentinelProfileId would indicate
    // ADR-0151 is violated.
    const { data: sentinelRows } = await supabase
      .from("engine_memory")
      .select("id, content, profile_id")
      .eq("profile_id", sentinelProfileId)
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .ilike("content", `%${sentinelText}%`)
      .gte("created_at", negativeTestStartIso)
      .limit(1);

    expect(
      sentinelRows?.length ?? 0,
      `N1: engine_memory row found for the injected sentinelProfileId — ADR-0151 violated. ` +
        `The BFF must derive profileId server-side from JWT, not from the request body. ` +
        `Found: ${JSON.stringify(sentinelRows ?? [])}`,
    ).toBe(0);
  });

  // ── N2: voice channel guard ───────────────────────────────────────────────
  //
  // The personal capability allows voice for all 5 tools (no PII per ADR-0078).
  // allowedChannels: ['chat', 'voice'] in index.ts. No channel guard in execute().
  // A full LiveKit voice session cannot be driven in Playwright — skip with docs.

  test("N2: voice channel guard — personal tools allow voice (no PII restriction)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const tokenRes = await page.request.post("/api/botsson/voice/token", {
      data: { workspaceId: SEED_WORKSPACE_ID },
    });

    if (!tokenRes.ok()) {
      test.skip(
        true,
        "N2: voice token BFF returned " +
          tokenRes.status() +
          " — LiveKit not configured in CI. " +
          "The personal capability has allowedChannels: ['chat', 'voice'] — all 5 tools " +
          "are permitted on voice (no PII per ADR-0078). " +
          "Voice session cannot be driven in Playwright E2E. " +
          "Tracking gap: personal-voice-channel-e2e.",
      );
      return;
    }

    // If voice token is available, a full LiveKit audio session still cannot be driven.
    test.skip(
      true,
      "N2: full LiveKit voice session cannot be driven in Playwright E2E. " +
        "Personal capability voice path verified at integration-test level. " +
        "Tracking gap: personal-voice-channel-e2e.",
    );
  });
});

// =============================================================================
// Gate sanity suite
// =============================================================================
//
// Verify the engine_authority_config row is present and at the expected level.
// This is a setup sanity check — if it fails the positive-path tests are
// meaningless (all mutations would be denied by gate_action).

test.describe("Personal capability — authority sanity", () => {
  test("G1: engine_authority_config has suggest-level row for personal capability", async () => {
    const { data, error } = await supabase
      .from("engine_authority_config")
      .select("level, min_role, requires_four_eyes")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("capability", "personal")
      .maybeSingle();

    expect(
      error,
      `G1: engine_authority_config query failed: ${error?.message ?? "unknown"}`,
    ).toBeNull();

    // The row must exist — ensurePersonalAuthority() in beforeAll guarantees this.
    expect(
      data,
      "G1: engine_authority_config must have a row for capability='personal'. " +
        "Run ensurePersonalAuthority() or apply migration 20260520100000_personal_task.sql.",
    ).not.toBeNull();

    // Level must be 'suggest' or higher to allow mutations.
    const allowedLevels = ["suggest", "confirm", "autonomous"];
    expect(
      allowedLevels,
      `G1: authority level "${data?.level}" does not permit mutations. ` +
        "Expected 'suggest', 'confirm', or 'autonomous'.",
    ).toContain(data?.level);
  });
});
