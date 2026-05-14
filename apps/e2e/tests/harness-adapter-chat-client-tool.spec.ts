// =============================================================================
// harness-adapter-chat-client-tool.spec.ts
//
// Full-pipe E2E for the HarnessAdapter chat roundtrip (ADR-0327 Phase 3+3.5).
//
// What this tests (client tools only — NOT capability tools):
//
//   Positive path (A1–A9):
//     A1  stage-engine freshness check — container started AFTER latest dev commit
//     A2  HARNESS_ADAPTER_CHAT === "true" env guard; skip when off
//     A3  /dashboard/notifications page loads and renders
//     A4  /api/botsson/chat request body carries client_tools[] including "getUnreadCount"
//         (intercepted before the request leaves the browser)
//     A5  /api/botsson/chat response carries client_tool_calls[] naming "getUnreadCount"
//         (intercepted on the BFF response)
//     A6  Browser executes the tool implementation: second /api/botsson/chat request body
//         carries client_tool_results[] with the call_id from A5
//     A7  Final assistant message includes a numeric unread count OR the word "ulest"
//         (confirms the round-trip completed and the LLM consumed the result)
//     A8  activity_trail: botsson.tool_invoked row with data.tool containing
//         "getUnreadCount" — poll 15s (same pattern as botsson-harness-e2e.spec.ts A8)
//
//   Negative path (N1 — separate describe, guarded by flag OFF):
//     N1  When HARNESS_ADAPTER_CHAT !== "true": /api/botsson/chat request does NOT
//         include client_tools field for "getUnreadCount". Guarded by test.skip when
//         flag is ON — cannot flip env in one Playwright run (see HANDOFF).
//
// Architecture notes:
//   Phase 3 wired HARNESS_ADAPTER_CHAT-gated tool resolution in stage-engine:
//     services/stage-engine/src/core/chat-tool-resolver.ts — resolveChatTools()
//     merges capability tools + client_tools from request body.
//   Phase 3.5 wired browser-side roundtrip:
//     BotssonChat.tsx executes client tool implementations, then re-submits
//     with client_tool_results[].
//   BotssonProvider accumulates useRegisterTools() registrations.
//   /dashboard/notifications mounts NotificationsToolsBridge via
//     apps/web/src/app/dashboard/notifications/_tools/notifications-tools-bridge.tsx
//     which calls useRegisterTools("notifications", tools).
//   getUnreadCount returns { unreadCount, activeFilter } — no parameters needed.
//
// Why a direct-API approach (not typing into BotssonChat textarea):
//   The /dashboard/notifications page hosts BotssonChat inside DashboardShell.
//   The test DOES navigate to this page so BotssonProvider and the bridge mount,
//   then it intercepts the /api/botsson/chat requests the BotssonChat component
//   sends when a message is submitted via the DOM. This is more robust than
//   reading window state and correctly exercises the real client path.
//
// Observation boundaries:
//   A4/A5/A6 use page.route() intercept on the BFF route — this is the only
//   reliable way to inspect request bodies + response bodies without modifying
//   production code. Route interception does NOT block the request — we fulfil
//   it and capture the payload.
//
// Freshness check: same contract as botsson-harness-e2e.spec.ts — container
//   must have started AFTER the latest development commit.
//
// Recorder flush delay: activity_trail writes are async (same as botsson-harness
//   spec). All DB assertions poll with 15s timeout.
//
// ADR refs:
//   ADR-0327  HarnessAdapter — client-tool roundtrip in chat
//   ADR-0184  Agent session recorder
//   ADR-0134  Telemetry contract (every mutation emits)
//   ADR-0151  Server-side profile_id derivation
//
// Environment setup (REQUIRED):
//   1. Supabase Local running: `npx supabase start`
//   2. Stage-engine container rebuilt from latest code:
//      cd infra && docker compose -f docker-compose.yml -f docker-compose.override.yml \
//        --env-file ../.env.template --env-file .env.local build --no-cache stage-engine
//      infra/.env.local must have SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//      OPENROUTER_API_KEY, STAGE_ENGINE_API_KEY — non-op:// values.
//   3. stage-engine must be started with HARNESS_ADAPTER_CHAT=true
//      (add to infra/.env.local or docker-compose.override.yml).
//   4. Next.js dev server on port 3060 (op run wrap or SKIP_WEB_SERVER=1).
//   5. HARNESS_ADAPTER_CHAT=true must also be set in apps/e2e/.env.local so
//      the E2E knows which test branch to take.
//   6. PostgREST 14 compat: see botsson-harness-e2e.spec.ts header note.
// =============================================================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import {
  SEED_PROFILE_ID,
  SEED_WORKSPACE_ID,
  assertStageEngineContainerFresh,
  assertSupabaseLocalUp,
  assertStageEngineHealthy,
  assertActivityTrailEvent,
  dumpStageEngineLogs,
  snapshotTestState,
} from "../helpers/botsson-harness";
import { supabase } from "../helpers/seed";

// ---------------------------------------------------------------------------
// Shared state filled by the positive-path test chain (in order)
// ---------------------------------------------------------------------------

let testRunId: string;
let testStartIso: string;
let capturedCallId: string | null = null; // A5 → A6

// ---------------------------------------------------------------------------
// Runtime feature-flag check (process-level — not per-page)
// ---------------------------------------------------------------------------

const HARNESS_ADAPTER_CHAT = process.env.HARNESS_ADAPTER_CHAT === "true";

// ---------------------------------------------------------------------------
// Helper: send a chat message via BotssonChat DOM interaction
//
// Why DOM + intercept rather than page.request.post():
//   - page.request.post() bypasses BotssonProvider and the bridge component,
//     so client_tools[] would never be populated.
//   - DOM interaction triggers BotssonChat.tsx's submit handler which reads
//     the BotssonProvider's registered tools and assembles client_tools[].
//   - We intercept the outbound fetch to capture the request body, let it
//     proceed, and capture the response body on the way back.
// ---------------------------------------------------------------------------

type InterceptedTurn = {
  requestBody: Record<string, unknown>;
  responseBody: Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendChatMessageViaDom(
  page: any,
  message: string,
  opts?: {
    /** Max ms to wait for the BFF request after hitting Enter (default 30 000). */
    requestTimeoutMs?: number;
  },
): Promise<InterceptedTurn> {
  const timeoutMs = opts?.requestTimeoutMs ?? 30_000;

  // We need to capture the FIRST request that carries the user message AND
  // the subsequent requests (roundtrip). Set up a single-use route intercept
  // that captures request/response for the first matching POST.
  let resolveFirst: (turn: InterceptedTurn) => void;
  const firstTurnPromise = new Promise<InterceptedTurn>((res) => {
    resolveFirst = res;
  });

  let handled = false;
  await page.route("**/api/botsson/chat", async (route) => {
    const req = route.request();
    let reqBody: Record<string, unknown> = {};
    try {
      reqBody = (JSON.parse(req.postData() ?? "{}") as Record<string, unknown>);
    } catch {
      // Ignore parse errors — still fulfil the route.
    }

    // Fulfil the request so it reaches the server.
    const response = await route.fetch();
    let resBody: Record<string, unknown> = {};
    try {
      resBody = (await response.json()) as Record<string, unknown>;
    } catch {
      // Non-JSON response — leave resBody empty.
    }

    // Deliver a clone of the real response to the page.
    await route.fulfill({
      status: response.status(),
      headers: Object.fromEntries(response.headers()),
      body: JSON.stringify(resBody),
    });

    // Capture only the first turn that carries userMessage (not the roundtrip).
    if (!handled && reqBody.userMessage) {
      handled = true;
      resolveFirst({ requestBody: reqBody, responseBody: resBody });
    }
  });

  // Locate the BotssonChat textarea. The component renders a textarea with
  // placeholder "Skriv en melding til Botsson" (confirmed in E2E recorder spec).
  const textarea = page.locator('textarea[placeholder*="Botsson"]');
  await textarea.waitFor({ state: "visible", timeout: 15_000 });
  await textarea.fill(message);

  // Submit. BotssonChat submits on Enter (no Shift).
  await textarea.press("Enter");

  // Wait for the intercepted first turn with a hard timeout.
  const firstTurn = await Promise.race([
    firstTurnPromise,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`sendChatMessageViaDom: no BFF request seen after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);

  // Remove the route so subsequent assertions are not polluted.
  await page.unroute("**/api/botsson/chat");

  return firstTurn;
}

// ---------------------------------------------------------------------------
// Helper: wait for the second BFF turn (roundtrip with client_tool_results)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForRoundtripTurn(
  page: any,
  opts?: { timeoutMs?: number },
): Promise<InterceptedTurn> {
  const timeoutMs = opts?.timeoutMs ?? 30_000;

  let resolveRoundtrip: (turn: InterceptedTurn) => void;
  const roundtripPromise = new Promise<InterceptedTurn>((res) => {
    resolveRoundtrip = res;
  });

  let handled = false;
  await page.route("**/api/botsson/chat", async (route) => {
    const req = route.request();
    let reqBody: Record<string, unknown> = {};
    try {
      reqBody = (JSON.parse(req.postData() ?? "{}") as Record<string, unknown>);
    } catch {
      // Ignore parse errors.
    }

    const response = await route.fetch();
    let resBody: Record<string, unknown> = {};
    try {
      resBody = (await response.json()) as Record<string, unknown>;
    } catch {
      // Non-JSON response.
    }

    await route.fulfill({
      status: response.status(),
      headers: Object.fromEntries(response.headers()),
      body: JSON.stringify(resBody),
    });

    // The roundtrip request is identified by the presence of client_tool_results.
    if (!handled && Array.isArray(reqBody.client_tool_results) && reqBody.client_tool_results.length > 0) {
      handled = true;
      resolveRoundtrip({ requestBody: reqBody, responseBody: resBody });
    }
  });

  const roundtrip = await Promise.race([
    roundtripPromise,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`waitForRoundtripTurn: no roundtrip request seen after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);

  await page.unroute("**/api/botsson/chat");
  return roundtrip;
}

// =============================================================================
// POSITIVE PATH — A1 through A8
// =============================================================================

test.describe("HarnessAdapter chat client-tool roundtrip (positive path)", () => {
  // A1 through A8 share captured state (callId) — must run serially.
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testRunId = `harness-adapter-${Date.now()}`;
    testStartIso = new Date().toISOString();

    // Gate 1: container freshness (same contract as botsson-harness-e2e.spec.ts).
    assertStageEngineContainerFresh();

    // Gate 2: Supabase Local up.
    await assertSupabaseLocalUp();

    // Gate 3: stage-engine healthy.
    await assertStageEngineHealthy();
  });

  test.afterAll(async () => {
    // Snapshot for post-failure inspection — does NOT delete data.
    await snapshotTestState(testRunId);
  });

  // ── A1: stage-engine freshness ────────────────────────────────────────────

  test("A1: stage-engine container is fresh (started after latest dev commit)", () => {
    // assertStageEngineContainerFresh() in beforeAll already ran — this test
    // is a named checkpoint so a freshness failure shows as "A1 failed" in the
    // Playwright report, not as an anonymous beforeAll crash.
    // The call below is a no-op if it already passed in beforeAll; if it threw
    // there, the whole suite is skipped. This secondary call makes the failure
    // visible per the spec naming convention.
    assertStageEngineContainerFresh();
  });

  // ── A2: HARNESS_ADAPTER_CHAT flag guard ───────────────────────────────────

  test("A2: HARNESS_ADAPTER_CHAT=true is set (flag guard)", () => {
    test.skip(
      !HARNESS_ADAPTER_CHAT,
      "HARNESS_ADAPTER_CHAT is not 'true' — set it in apps/e2e/.env.local and restart " +
        "the stage-engine container with the same flag. Positive path requires the flag ON.",
    );

    expect(
      HARNESS_ADAPTER_CHAT,
      "A2: HARNESS_ADAPTER_CHAT must be 'true'. " +
        "Set HARNESS_ADAPTER_CHAT=true in apps/e2e/.env.local and in infra/.env.local, " +
        "then rebuild + restart the stage-engine container.",
    ).toBe(true);
  });

  // ── A3: page loads ────────────────────────────────────────────────────────

  test("A3: /dashboard/notifications page loads and renders the notification list", async ({
    page,
  }) => {
    test.skip(!HARNESS_ADAPTER_CHAT, "Depends on A2 flag");

    await loginAsAdmin(page);
    await page.goto("/dashboard/notifications");

    // Wait for the page header to appear — confirms RSC hydration completed.
    // The page renders an <h1> with the notifications title (i18n key "page.title").
    // We do not assert the exact Norwegian text to avoid i18n brittleness — just
    // confirm a heading exists.
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });

    // Confirm the bridge mounted: BotssonChat textarea must be present (rendered
    // by DashboardShell which wraps every /dashboard/* route).
    await expect(
      page.locator('textarea[placeholder*="Botsson"]'),
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── A4: outbound request carries client_tools[] with getUnreadCount ───────

  test("A4: /api/botsson/chat request body includes client_tools[] with 'getUnreadCount'", async ({
    page,
  }) => {
    test.skip(!HARNESS_ADAPTER_CHAT, "Depends on A2 flag");

    await loginAsAdmin(page);
    await page.goto("/dashboard/notifications");

    // Ensure page is hydrated before interacting.
    await expect(page.locator('textarea[placeholder*="Botsson"]')).toBeVisible({ timeout: 15_000 });

    // Send the trigger message via DOM — this exercises the real BotssonProvider
    // → client_tools assembly path.
    const { requestBody } = await sendChatMessageViaDom(
      page,
      "Use the getUnreadCount tool now to tell me how many unread notifications I have.",
    );

    // A4 primary: client_tools[] must be present and non-empty.
    const clientTools = requestBody.client_tools as Array<{
      temporaryTool?: { modelToolName?: string };
    }> | undefined;

    if (!clientTools || clientTools.length === 0) {
      const logs = await dumpStageEngineLogs();
      expect(
        clientTools,
        "A4: request body does not contain client_tools[] — BotssonProvider may not have " +
          "collected the notifications bridge tools. Verify NotificationsToolsBridge mounts " +
          "on this page and useRegisterTools('notifications', tools) is called.\n\n" +
          `Request body keys: ${Object.keys(requestBody).join(", ")}\n\n` +
          `Stage-engine logs:\n${logs}`,
      ).not.toBeUndefined();
    }

    // A4 secondary: at least one entry must name "getUnreadCount".
    const hasGetUnreadCount = (clientTools ?? []).some(
      (t) => t.temporaryTool?.modelToolName === "getUnreadCount",
    );

    expect(
      hasGetUnreadCount,
      `A4: client_tools[] does not include a tool with modelToolName='getUnreadCount'. ` +
        `Found: ${JSON.stringify((clientTools ?? []).map((t) => t.temporaryTool?.modelToolName))}`,
    ).toBe(true);
  });

  // ── A5: response carries client_tool_calls[] naming getUnreadCount ────────

  test("A5: /api/botsson/chat response includes client_tool_calls[] naming 'getUnreadCount'", async ({
    page,
  }) => {
    test.skip(!HARNESS_ADAPTER_CHAT, "Depends on A2 flag");

    await loginAsAdmin(page);
    await page.goto("/dashboard/notifications");
    await expect(page.locator('textarea[placeholder*="Botsson"]')).toBeVisible({ timeout: 15_000 });

    const { responseBody } = await sendChatMessageViaDom(
      page,
      "Use the getUnreadCount tool now to tell me how many unread notifications I have.",
    );

    // A5 primary: client_tool_calls[] must be present.
    const clientToolCalls = responseBody.client_tool_calls as Array<{
      tool_call_id?: string;
      name?: string;
      arguments?: Record<string, unknown>;
    }> | undefined;

    if (!clientToolCalls || clientToolCalls.length === 0) {
      const logs = await dumpStageEngineLogs();
      expect(
        clientToolCalls,
        "A5: BFF response does not contain client_tool_calls[]. " +
          "Possible causes: (1) LLM chose not to invoke getUnreadCount despite explicit instruction, " +
          "(2) stage-engine resolveChatTools() did not surface client tools (check HARNESS_ADAPTER_CHAT " +
          "in container env), (3) chat-tool-resolver.ts merge logic dropped the tool definition.\n\n" +
          `Response body keys: ${Object.keys(responseBody).join(", ")}\n` +
          `Response text: "${String(responseBody.text ?? "").substring(0, 300)}"\n\n` +
          `Stage-engine logs:\n${logs}`,
      ).not.toBeUndefined();
    }

    // A5 secondary: one of the calls must name "getUnreadCount".
    const getUnreadCountCall = (clientToolCalls ?? []).find((c) => c.name === "getUnreadCount");

    if (!getUnreadCountCall) {
      const logs = await dumpStageEngineLogs();
      expect(
        getUnreadCountCall,
        `A5: client_tool_calls[] does not include a call to 'getUnreadCount'. ` +
          `Found: ${JSON.stringify((clientToolCalls ?? []).map((c) => c.name))}\n\n` +
          `Stage-engine logs:\n${logs}`,
      ).not.toBeUndefined();
    }

    // Store call_id for A6 dependency verification.
    capturedCallId = getUnreadCountCall?.tool_call_id ?? null;

    expect(
      capturedCallId,
      "A5: getUnreadCount call_id is missing — cannot verify A6 roundtrip.",
    ).not.toBeNull();
  });

  // ── A6: browser executes tool, second request carries client_tool_results ──

  test("A6: second /api/botsson/chat request carries client_tool_results[] with getUnreadCount result", async ({
    page,
  }) => {
    test.skip(!HARNESS_ADAPTER_CHAT, "Depends on A2 flag");
    expect(
      capturedCallId,
      "A6 depends on A5 — capturedCallId must be set. Did A5 pass?",
    ).not.toBeNull();

    await loginAsAdmin(page);
    await page.goto("/dashboard/notifications");
    await expect(page.locator('textarea[placeholder*="Botsson"]')).toBeVisible({ timeout: 15_000 });

    // Set up the roundtrip interceptor BEFORE sending the message that triggers
    // the first-turn + roundtrip chain.
    const roundtripPromiseSetup = waitForRoundtripTurn(page, { timeoutMs: 60_000 });

    // Send the same trigger message — the full chain is:
    //   turn 1: browser → BFF (with client_tools)
    //   turn 1 response: BFF → browser (with client_tool_calls for getUnreadCount)
    //   BotssonChat executes getUnreadCount() implementation
    //   turn 2: browser → BFF (with client_tool_results)
    await page.locator('textarea[placeholder*="Botsson"]').fill(
      "Use the getUnreadCount tool now to tell me how many unread notifications I have.",
    );
    await page.locator('textarea[placeholder*="Botsson"]').press("Enter");

    let roundtrip: InterceptedTurn;
    try {
      roundtrip = await roundtripPromiseSetup;
    } catch (err) {
      const logs = await dumpStageEngineLogs();
      throw new Error(
        `A6: no roundtrip (client_tool_results) request seen within 60s.\n\n` +
          `This means BotssonChat did not execute the getUnreadCount tool implementation ` +
          `and re-submit. Verify BotssonChat.tsx Phase 3.5 roundtrip logic.\n\n` +
          `Stage-engine logs:\n${logs}\n\nOriginal error: ${String(err)}`,
      );
    }

    const clientToolResults = roundtrip.requestBody.client_tool_results as Array<{
      tool_call_id?: string;
      result?: string;
      is_error?: boolean;
    }> | undefined;

    expect(
      Array.isArray(clientToolResults) && clientToolResults.length > 0,
      `A6: roundtrip request has no client_tool_results[]. ` +
        `Request body keys: ${Object.keys(roundtrip.requestBody).join(", ")}`,
    ).toBe(true);

    // Find the result matching the capturedCallId from A5.
    const getUnreadCountResult = (clientToolResults ?? []).find(
      (r) => r.tool_call_id === capturedCallId,
    );

    expect(
      getUnreadCountResult,
      `A6: client_tool_results[] does not contain an entry with tool_call_id='${capturedCallId}'. ` +
        `Found ids: ${JSON.stringify((clientToolResults ?? []).map((r) => r.tool_call_id))}`,
    ).not.toBeUndefined();

    // The implementation returns JSON with { unreadCount, activeFilter }.
    let parsedResult: Record<string, unknown> = {};
    try {
      parsedResult = JSON.parse(getUnreadCountResult!.result ?? "{}") as Record<string, unknown>;
    } catch {
      // Unparseable result — assert below will fail with a clear message.
    }

    expect(
      typeof parsedResult.unreadCount === "number",
      `A6: getUnreadCount tool result must contain a numeric 'unreadCount' field. ` +
        `Got: ${JSON.stringify(parsedResult)}`,
    ).toBe(true);

    expect(
      getUnreadCountResult!.is_error,
      "A6: getUnreadCount tool execution must not be flagged as an error",
    ).not.toBe(true);
  });

  // ── A7: final assistant message contains a numeric count or "ulest" ────────

  test("A7: final assistant message references the unread count (tool result consumed)", async ({
    page,
  }) => {
    test.skip(!HARNESS_ADAPTER_CHAT, "Depends on A2 flag");

    await loginAsAdmin(page);
    await page.goto("/dashboard/notifications");
    await expect(page.locator('textarea[placeholder*="Botsson"]')).toBeVisible({ timeout: 15_000 });

    // Capture the LAST response in the chain (after the roundtrip).
    // The final BFF response (turn 2) is the LLM's answer after consuming the
    // tool result — it should mention a number or the word "ulest".
    //
    // Strategy: collect all /api/botsson/chat responses in order; the last one
    // is the LLM final reply.
    const responses: Record<string, unknown>[] = [];

    await page.route("**/api/botsson/chat", async (route) => {
      const response = await route.fetch();
      let resBody: Record<string, unknown> = {};
      try {
        resBody = (await response.json()) as Record<string, unknown>;
      } catch {
        // Non-JSON response.
      }
      await route.fulfill({
        status: response.status(),
        headers: Object.fromEntries(response.headers()),
        body: JSON.stringify(resBody),
      });
      responses.push(resBody);
    });

    await page.locator('textarea[placeholder*="Botsson"]').fill(
      "Use the getUnreadCount tool now to tell me how many unread notifications I have.",
    );
    await page.locator('textarea[placeholder*="Botsson"]').press("Enter");

    // Wait for at least 2 BFF calls (turn 1 + roundtrip turn) and then the
    // final assistant message to appear in the chat UI.
    // The assistant message is rendered as [data-role="assistant"] per the
    // E2E recorder spec (confirmed: BotssonChat uses data-role="assistant").
    await expect(
      page.locator('[data-role="assistant"]').last(),
    ).toBeVisible({ timeout: 60_000 });

    await page.unroute("**/api/botsson/chat");

    // The final assistant text — from the last response that has a `text` field.
    const finalResponseBody = [...responses].reverse().find((r) => typeof r.text === "string");
    const finalText = ((finalResponseBody?.text as string | undefined) ?? "").toLowerCase();

    // Accept: a digit (e.g. "0 uleste", "3 uleste") OR the Norwegian word "ulest".
    // Both patterns confirm the LLM consumed the getUnreadCount result.
    const hasDigit = /\d/.test(finalText);
    const hasUlest = finalText.includes("ulest");

    if (!hasDigit && !hasUlest) {
      const logs = await dumpStageEngineLogs();
      expect(
        hasDigit || hasUlest,
        `A7: final assistant message does not mention a numeric count or 'ulest'. ` +
          `Response: "${finalText.substring(0, 500)}"\n\n` +
          `All BFF response texts: ${JSON.stringify(responses.map((r) => String(r.text ?? "").substring(0, 100)))}\n\n` +
          `Stage-engine logs:\n${logs}`,
      ).toBe(true);
    }

    expect(hasDigit || hasUlest, "A7: final response must reference unread count or 'ulest'").toBe(
      true,
    );
  });

  // ── A8: activity_trail botsson.tool_invoked for getUnreadCount ────────────

  test("A8: activity_trail has botsson.tool_invoked row for getUnreadCount", async ({ page }) => {
    test.skip(!HARNESS_ADAPTER_CHAT, "Depends on A2 flag");

    // Trigger a full round-trip (same message as A4–A7) so the telemetry row
    // is emitted. testStartIso filters to this test run only.
    await loginAsAdmin(page);
    // Navigate to any dashboard page to establish auth cookies — /Botsson is
    // unreachable in DashboardShell context; use the notification page.
    await page.goto("/dashboard/notifications");
    await expect(page.locator('textarea[placeholder*="Botsson"]')).toBeVisible({ timeout: 15_000 });

    // Fire-and-forget — we only need the trail row, not the full round-trip check.
    await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        userMessage:
          "Use the getUnreadCount tool now to tell me how many unread notifications I have.",
      },
      headers: { "content-type": "application/json" },
    });

    // Poll activity_trail for a botsson.tool_invoked row naming getUnreadCount.
    // The tool is a client tool — the stage-engine records the invocation via
    // the harness recorder when it dispatches client_tool_calls to the browser.
    // 15s poll mirrors the pattern in botsson-harness-e2e.spec.ts A8.
    const row = await assertActivityTrailEvent({
      event: "botsson.tool_invoked",
      dataPredicate: (d) => {
        const data = d as Record<string, unknown>;
        // data.tool can be "getUnreadCount" (exact) or a string containing it.
        const tool = String(data?.tool ?? "");
        return tool === "getUnreadCount" || tool.includes("getUnreadCount");
      },
      sinceIso: testStartIso,
      poll: { timeoutMs: 15_000 },
    });

    const data = row.data as Record<string, unknown>;
    expect(
      String(data?.tool ?? "").includes("getUnreadCount"),
      `A8: tool field must contain 'getUnreadCount'. Got: ${JSON.stringify(data?.tool)}`,
    ).toBe(true);

    expect(row.workspace_id, "A8: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "A8: actor_id must match seed profile").toBe(SEED_PROFILE_ID);
  });
});

// =============================================================================
// NEGATIVE PATH — N1: flag OFF → client_tools NOT sent for getUnreadCount
// =============================================================================

test.describe("HarnessAdapter chat client-tool roundtrip (negative path — flag OFF)", () => {
  test.describe.configure({ mode: "serial" });

  // N1: When the flag is ON, this block is skipped. The intent is to verify
  // that without HARNESS_ADAPTER_CHAT, the BFF request does not carry
  // client_tools[]. In practice this requires a container restart with the flag
  // off — impossible in a single Playwright run. Document the gap explicitly.
  //
  // The test IS runnable if a second Playwright run is executed with the flag
  // off (HARNESS_ADAPTER_CHAT unset or "false" in .env.local). In that case
  // the positive path is skipped and this block runs.

  test("N1: without HARNESS_ADAPTER_CHAT, /api/botsson/chat request omits client_tools for getUnreadCount", async ({
    page,
  }) => {
    test.skip(
      HARNESS_ADAPTER_CHAT,
      "N1 runs only when HARNESS_ADAPTER_CHAT is NOT 'true'. " +
        "To run the negative path: set HARNESS_ADAPTER_CHAT=false in apps/e2e/.env.local, " +
        "restart stage-engine without the flag, and re-run this spec. " +
        "Env-flip in a single Playwright run is infeasible — see HANDOFF for detail.",
    );

    // Navigate to the notifications page so BotssonProvider + bridge mount.
    await loginAsAdmin(page);
    await page.goto("/dashboard/notifications");
    await expect(
      page.locator('textarea[placeholder*="Botsson"]'),
    ).toBeVisible({ timeout: 15_000 });

    let capturedRequestBody: Record<string, unknown> = {};

    await page.route("**/api/botsson/chat", async (route) => {
      try {
        capturedRequestBody = (JSON.parse(
          route.request().postData() ?? "{}",
        ) as Record<string, unknown>);
      } catch {
        // Ignore.
      }
      const response = await route.fetch();
      await route.fulfill({
        status: response.status(),
        headers: Object.fromEntries(response.headers()),
        body: await response.text(),
      });
    });

    await page.locator('textarea[placeholder*="Botsson"]').fill(
      "Use the getUnreadCount tool now to tell me how many unread notifications I have.",
    );
    await page.locator('textarea[placeholder*="Botsson"]').press("Enter");

    // Wait briefly for the request to be captured.
    await page.waitForTimeout(5_000);
    await page.unroute("**/api/botsson/chat");

    // N1 primary: client_tools must be absent OR empty when flag is off.
    // Stage-engine resolver should not surface client tools when the feature is disabled.
    const clientTools = capturedRequestBody.client_tools as Array<{
      temporaryTool?: { modelToolName?: string };
    }> | undefined;

    const hasGetUnreadCount =
      Array.isArray(clientTools) &&
      clientTools.some((t) => t.temporaryTool?.modelToolName === "getUnreadCount");

    expect(
      hasGetUnreadCount,
      "N1: client_tools[] should NOT contain 'getUnreadCount' when HARNESS_ADAPTER_CHAT is off. " +
        `Found: ${JSON.stringify((clientTools ?? []).map((t) => t.temporaryTool?.modelToolName))}`,
    ).toBe(false);

    // N1 secondary: no activity_trail botsson.tool_invoked row for getUnreadCount.
    const negStartIso = new Date(Date.now() - 10_000).toISOString();
    await new Promise((r) => setTimeout(r, 5_000)); // Give trail time to write (if it would).

    const { data: trailRows } = await supabase
      .from("activity_trail")
      .select("event, data")
      .eq("event", "botsson.tool_invoked")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .gte("created_at", negStartIso);

    const getUnreadCountTrailRow = (trailRows ?? []).find((r) => {
      const d = r.data as Record<string, unknown>;
      return String(d?.tool ?? "").includes("getUnreadCount");
    });

    expect(
      getUnreadCountTrailRow,
      "N1: activity_trail must NOT have a botsson.tool_invoked row for 'getUnreadCount' " +
        "when the flag is off. If this fails, the tool resolver is leaking client tools " +
        "even when HARNESS_ADAPTER_CHAT is disabled.",
    ).toBeUndefined();
  });
});
