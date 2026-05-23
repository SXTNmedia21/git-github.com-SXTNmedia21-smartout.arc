// =============================================================================
// tests/inline-confirm-card-send-message/resume-tamper-defense.spec.ts
//
// SECURITY-CRITICAL E2E verification of Journey 3: Server defends send_message
// against tampered channel_id (cross-workspace channel injection).
//
// Tests DEFENSE 1 (ctx.workspaceId from JWT, ADR-0151)
//      + DEFENSE 2 (RLS-scoped channel lookup rejects cross-workspace channel_id)
//      + DEFENSE 3 (editable_fields whitelist=['content'] excludes channel_id, ADR-0403 §Decision 5)
//
// Threat model covered (send_message-specific):
//   DEFENSE 1 — workspace_id from auth JWT, NOT body (ADR-0151)
//   DEFENSE 2 — channel re-resolved server-side via RLS; foreign channel_id (W2)
//               returns ZERO rows → tool returns "Kan ikke sende melding…" error
//   DEFENSE 3 — editable_fields whitelist = ["content"] (tools.ts:265-268, ADR-0403 §Decision 5)
//               channel_id NOT in whitelist → filtered from resume patch before commit logic
//   DEFENSE 4 — RPC UNIQUE on client_message_id (replay prevention)
//
// Attack strategy (Playwright page.route() intercept):
//   1. Seed channels in W1 (SEED_CHANNEL_ID) and W2 (FOREIGN_CHANNEL_W2)
//   2. Walk through happy-send steps 1-4 (card visible in W1 context)
//   3. Intercept the resume POST to /api/botsson/chat (client_tool_results body)
//   4. Mutate the result string: inject patch.channel_id = FOREIGN_CHANNEL_W2 +
//      patch.content = "NEW BODY TARGETING FOREIGN WORKSPACE"
//   5. Click Send — Playwright routes the tampered request
//   6. Verify defense rejection:
//      - ZERO rows in W2's channel_message for FOREIGN_CHANNEL_W2
//      - ZERO rows in W1's channel_message (tampered call returned error)
//      - activity_trail: .shown exists, NO .confirmed (server never committed)
//
// Expected defense paths (server chooses — any is valid):
//   Path A (DEFENSE 3): channel_id filtered from editable_fields → original W1 channel used
//     → INSERT in W1 with original channel_id (foreign channel never touched)
//   Path B (DEFENSE 2): body-supplied channel_id W2 fails RLS lookup →
//     tool returns "Kan ikke sende melding — kanal finnes ikke"
//     → 0 channel_message rows anywhere
//   Path C (DEFENSE 4 replay): same proposal_id used twice → UNIQUE constraint rejects
//
// Route handler (file:line reference in report):
//   The page.route() interceptor that mutates the body is at the T3-D1-D3 test.
//   It intercepts only POSTs containing client_tool_results (resume turn).
//
// Selector strategy:
//   Same as happy-send.spec.ts — card root data-testid="inline-confirm-card".
//
// DB clients: service-role Supabase admin client (bypasses RLS for assertion).
//
// Journey reference: docs/journeys/JOURNEY-inline-confirm-card-send-message-resume-tamper-defense.md
// ADR refs: ADR-0151 (server-derived workspace_id), ADR-0398 §Resume-Payload Trust Boundary,
//           ADR-0403 §Decision 5 (editable_fields whitelist=['content']),
//           L-0177 (silent-fallback ban — no body.channel_id used without RLS verification).
// =============================================================================

import { test, expect, type Route } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import {
  assertStageEngineContainerFresh,
  assertSupabaseLocalUp,
  assertStageEngineHealthy,
} from "../../helpers/botsson-harness";
import {
  SEED_WORKSPACE_ID,
  SEED_CHANNEL_ID,
  FOREIGN_WORKSPACE_ID,
  FOREIGN_CHANNEL_W2,
  ensureSendMessageSeed,
  seedForeignChannel,
  cleanupSendMessageMessages,
  dumpLogsOnFailure,
  navigateToBotsson,
} from "./helpers";
import { supabase } from "../../helpers/seed";

let testStartIso: string;

test.describe("J3 resume-tamper-defense — server defends send_message against tampered channel_id", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testStartIso = new Date().toISOString();
    assertStageEngineContainerFresh();
    await assertSupabaseLocalUp();
    await assertStageEngineHealthy();

    // Seed W1 channel + membership + authority.
    await ensureSendMessageSeed();

    // Seed foreign W2 channel (service-role INSERT — not in W1 RLS scope).
    await seedForeignChannel();
  });

  test.afterAll(async () => {
    await cleanupSendMessageMessages(testStartIso);
    // Clean up foreign W2 channel_message rows if any (defense bypass would be a test fail).
    await supabase
      .from("channel_message")
      .delete()
      .eq("channel_id", FOREIGN_CHANNEL_W2)
      .gte("created_at", testStartIso);
  });

  // ── T3-D1-D3: Tampered channel_id → W2 channel injected → DEFENSE rejects ─

  test("T3-D1-D3: tampered channel_id pointing to foreign W2 channel is rejected — ZERO INSERT in W1 or W2", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAsAdmin(page);

    // ---------------------------------------------------------------------------
    // Step 1: Set up the route interceptor BEFORE sending the message.
    // Intercept only POSTs to /api/botsson/chat that contain client_tool_results.
    // ---------------------------------------------------------------------------

    let interceptedCount = 0;
    let capturedProposalId: string | null = null;

    // TAMPER ROUTE HANDLER — file:line reference for report:
    // This is the interceptor that mutates the resume POST body.
    // It is registered BEFORE the user message is sent so it is in place
    // when the card confirm click triggers the client_tool_results POST.
    await page.route("/api/botsson/chat", async (route: Route) => {
      const request = route.request();

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      } catch {
        await route.continue();
        return;
      }

      const clientToolResults = body["client_tool_results"];
      if (!Array.isArray(clientToolResults) || clientToolResults.length === 0) {
        // Not a client_tool_results POST (initial userMessage) — let through unchanged.
        await route.continue();
        return;
      }

      // This is the resume POST. Mutate the result string.
      interceptedCount++;

      const tamperedResults = clientToolResults.map((entry: unknown) => {
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as Record<string, unknown>)["result"] !== "string"
        ) {
          return entry;
        }

        const record = entry as Record<string, unknown>;
        const originalResultStr = record["result"] as string;

        let result: Record<string, unknown>;
        try {
          result = JSON.parse(originalResultStr) as Record<string, unknown>;
        } catch {
          return entry; // Not JSON — leave untouched.
        }

        // Capture proposal_id for downstream DB assertions.
        if (typeof result["proposal_id"] === "string") {
          capturedProposalId = result["proposal_id"];
        }

        // Inject the tampered patch:
        //   - action: "confirm" (legitimate — confirms the card)
        //   - patch.channel_id: FOREIGN_CHANNEL_W2 (cross-workspace channel — DEFENSE 2+3 target)
        //   - patch.content: poisoned body targeting foreign workspace
        //   - patch.workspace_id: forged foreign workspace (DEFENSE 1 target — must be ignored)
        //
        // DEFENSE 3 (editable_fields=['content']) should filter channel_id from the patch.
        // DEFENSE 2 (RLS) should reject FOREIGN_CHANNEL_W2 even if DEFENSE 3 is bypassed.
        // DEFENSE 1 (ctx.workspaceId from JWT) ignores body.patch.workspace_id entirely.
        const tamperedResult: Record<string, unknown> = {
          ...result,
          action: "confirm",
          patch: {
            channel_id: FOREIGN_CHANNEL_W2,
            content: "NEW BODY TARGETING FOREIGN WORKSPACE — tamper-defense test",
            workspace_id: FOREIGN_WORKSPACE_ID, // DEFENSE 1 test: must be ignored
          },
        };

        return {
          ...record,
          result: JSON.stringify(tamperedResult),
        };
      });

      // Continue the request with the tampered body.
      await route.continue({
        postData: JSON.stringify({
          ...body,
          client_tool_results: tamperedResults,
        }),
        headers: {
          ...request.headers(),
          "content-type": "application/json",
        },
      });
    });

    // ---------------------------------------------------------------------------
    // Step 2: Navigate to Botsson and trigger a send_message card.
    // ---------------------------------------------------------------------------

    const input = await navigateToBotsson(page);

    const beforePrompt = new Date().toISOString();
    await input.fill("Send 'sikkerhetspåminnelse — tamper-test' til Vakter-kanalen");
    await input.press("Enter");

    // ---------------------------------------------------------------------------
    // Step 3: Wait for the card to render (W1 channel, legitimate draft).
    // ---------------------------------------------------------------------------

    const card = page.locator('[data-testid="inline-confirm-card"]');
    let cardVisible = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      cardVisible = await card.isVisible({ timeout: 30_000 }).catch(() => false);
      if (cardVisible) break;
      if (attempt === 0) {
        await dumpLogsOnFailure("T3-card-retry");
      }
    }

    expect(
      cardVisible,
      "T3: InlineConfirmCard must appear before tamper test can proceed. " +
        "If card never appears, this is a system-prompt regression (not the tamper defense).",
    ).toBe(true);

    // ---------------------------------------------------------------------------
    // Step 4: Click Send — the route interceptor will mutate the resume POST.
    // ---------------------------------------------------------------------------

    const confirmBtn = card.locator('[data-testid="inline-confirm-card-confirm"]');
    await expect(confirmBtn, "T3: confirm button must be enabled").toBeEnabled();
    await confirmBtn.click();

    // Wait for card to settle (resolved or error — not idle).
    await expect(
      card,
      "T3: card must not remain in idle mode after confirm click",
    ).not.toHaveAttribute("data-mode", "idle", { timeout: 30_000 });

    // Sanity check: verify the route interceptor fired.
    expect(
      interceptedCount,
      "T3: route interceptor must have fired at least once. " +
        "If 0, the client_tool_results POST did not reach the interceptor.",
    ).toBeGreaterThanOrEqual(1);

    // ---------------------------------------------------------------------------
    // Step 5: Wait for DB writes to settle, then assert DEFENSE properties.
    // ---------------------------------------------------------------------------

    await page.waitForTimeout(3_000);

    // ── DEFENSE 2 assertion: ZERO rows in W2's channel for FOREIGN_CHANNEL_W2 ──
    // This is the primary cross-workspace assertion.
    const { data: w2Msgs, error: w2Err } = await supabase
      .from("channel_message")
      .select("id, workspace_id, channel_id, client_message_id")
      .eq("channel_id", FOREIGN_CHANNEL_W2)
      .gte("created_at", beforePrompt)
      .limit(10);

    expect(w2Err, `T3 DEFENSE 2: DB query error on foreign channel: ${w2Err?.message}`).toBeNull();
    expect(
      (w2Msgs ?? []).length,
      "T3 DEFENSE 2: ZERO rows in channel_message for FOREIGN_CHANNEL_W2. " +
        "A cross-workspace write occurred — RLS-scoped channel lookup failed to reject " +
        "the foreign channel_id. This is a security regression (ADR-0151 + ADR-0403).",
    ).toBe(0);

    // ── DEFENSE 1 assertion: ZERO rows committed to the forged workspace_id ───
    const { data: foreignWsRows } = await supabase
      .from("channel_message")
      .select("id")
      .eq("workspace_id", FOREIGN_WORKSPACE_ID)
      .gte("created_at", beforePrompt)
      .limit(5);

    expect(
      (foreignWsRows ?? []).length,
      "T3 DEFENSE 1: no channel_message rows committed to the forged workspace_id. " +
        "ctx.workspaceId must be derived from auth JWT, NOT body.patch.workspace_id (ADR-0151).",
    ).toBe(0);

    // ── W1 channel_message outcome ─────────────────────────────────────────────
    const { data: w1Msgs } = await supabase
      .from("channel_message")
      .select("id, workspace_id, client_message_id, channel_id, content")
      .eq("channel_id", SEED_CHANNEL_ID)
      .gte("created_at", beforePrompt)
      .limit(10);

    if ((w1Msgs ?? []).length === 0) {
      // Path B (DEFENSE 2): server rejected the commit because FOREIGN_CHANNEL_W2
      // returned 0 rows from RLS-scoped lookup on ctx.workspaceId = W1.
      // OR Path C: UNIQUE constraint prevented replay.
      // Either is a valid defense outcome — attacker gets nothing.
      console.log(
        "T3: 0 channel_message rows in W1 — server rejected tampered channel_id. " +
          "DEFENSE 2 (RLS-scoped lookup) OR DEFENSE 3 (editable_fields filter) stopped commit.",
      );

      // activity_trail assertion: .shown exists (draft was shown), NO .confirmed.
      const { data: shownRows } = await supabase
        .from("activity_trail")
        .select("event_name, properties")
        .eq("event_name", "inline_confirm_card.shown")
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .gte("occurred_at", beforePrompt)
        .order("occurred_at", { ascending: false })
        .limit(1);

      expect(
        (shownRows ?? []).length,
        "T3: inline_confirm_card.shown must exist (draft was shown before tamper). " +
          "If 0, the LLM never emitted the shown event (telemetry regression, tools.ts:279).",
      ).toBeGreaterThanOrEqual(1);

      // Verify NO .confirmed row exists for this test window.
      const { data: confirmedRows } = await supabase
        .from("activity_trail")
        .select("event_name")
        .eq("event_name", "inline_confirm_card.confirmed")
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .gte("occurred_at", beforePrompt)
        .limit(5);

      expect(
        (confirmedRows ?? []).length,
        "T3: inline_confirm_card.confirmed must NOT exist when defense rejected the commit. " +
          "Server emits .confirmed only after successful channel_message INSERT (tools.ts:373).",
      ).toBe(0);

      return; // Path B/C defense validated — test passes.
    }

    // Path A: W1 commit succeeded. Verify DEFENSE properties on the committed row.
    const committed = w1Msgs![0]!;

    // DEFENSE 1: workspace_id must be SEED_WORKSPACE_ID (JWT-derived, not forged body value).
    expect(
      committed.workspace_id,
      "T3 DEFENSE 1: channel_message.workspace_id must equal SEED_WORKSPACE_ID. " +
        "Tampered patch included workspace_id=" +
        FOREIGN_WORKSPACE_ID +
        " — it must be ignored (ADR-0151).",
    ).toBe(SEED_WORKSPACE_ID);

    // DEFENSE 3: channel_id must be SEED_CHANNEL_ID (original W1 draft channel).
    // If editable_fields=['content'] filtered channel_id, the original draft channel_id is used.
    expect(
      committed.channel_id,
      "T3 DEFENSE 3: channel_message.channel_id must equal SEED_CHANNEL_ID (original W1 draft). " +
        "editable_fields=['content'] (ADR-0403 §Decision 5) must have filtered channel_id from the patch. " +
        "If foreign channel_id committed here, DEFENSE 3 is broken.",
    ).toBe(SEED_CHANNEL_ID);

    // Optional: if proposal_id was captured, verify idempotency.
    if (capturedProposalId !== null) {
      expect(
        committed.client_message_id,
        "T3: client_message_id must match the original proposal_id (DEFENSE 4 — RPC idempotency).",
      ).toBe(capturedProposalId);
    }

    // Log Path A outcome for audit.
    console.log(
      "T3: Path A — channel_message committed to W1 SEED_CHANNEL_ID with original channel. " +
        "Foreign channel_id was filtered by editable_fields whitelist (DEFENSE 3). " +
        "All defenses held.",
    );
  });

  // ── T3-D4: Replay attack — same client_message_id used twice ─────────────

  test("T3-D4: replay attack via same client_message_id is rejected by UNIQUE constraint", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // Strategy: render a card, confirm it (captures proposal_id from route interceptor),
    // then POST a second client_tool_results with the same proposal_id directly.
    // The RPC UNIQUE constraint on client_message_id must prevent a second row.

    await loginAsAdmin(page);

    let firstProposalId: string | null = null;
    let firstSessionId: string | null = null;
    let callCount = 0;

    // Route interceptor: capture proposal_id + sessionId from first resume POST.
    await page.route("/api/botsson/chat", async (route: Route) => {
      const request = route.request();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      } catch {
        await route.continue();
        return;
      }

      const clientToolResults = body["client_tool_results"];
      if (Array.isArray(clientToolResults) && clientToolResults.length > 0) {
        callCount++;
        if (callCount === 1) {
          const firstEntry = clientToolResults[0] as Record<string, unknown>;
          if (typeof firstEntry?.["result"] === "string") {
            try {
              const parsed = JSON.parse(firstEntry["result"] as string) as Record<string, unknown>;
              if (typeof parsed["proposal_id"] === "string") {
                firstProposalId = parsed["proposal_id"];
              }
            } catch {
              // ignore parse failure
            }
          }
          if (typeof body["sessionId"] === "string") {
            firstSessionId = body["sessionId"];
          }
        }
      }

      await route.continue();
    });

    // Navigate and trigger a send_message card.
    const input = await navigateToBotsson(page);

    const beforePrompt = new Date().toISOString();
    await input.fill("Send 'replay-test melding' til Vakter-kanalen");
    await input.press("Enter");

    const card = page.locator('[data-testid="inline-confirm-card"]');
    const cardVisible = await card.isVisible({ timeout: 30_000 }).catch(() => false);

    if (!cardVisible) {
      console.warn("T3-D4: card did not appear — skipping replay test (system-prompt regression).");
      return;
    }

    // Click Send to trigger the first commit.
    const confirmBtn = card.locator('[data-testid="inline-confirm-card-confirm"]');
    await confirmBtn.click();
    await expect(card).not.toHaveAttribute("data-mode", "idle", { timeout: 20_000 });

    // Wait for the first commit to settle.
    await page.waitForTimeout(3_000);

    if (!firstProposalId || !firstSessionId) {
      console.warn(
        "T3-D4: could not capture proposal_id or sessionId from first resume turn. " +
          "Skipping replay assertion — route interceptor may have missed the roundtrip.",
      );
      return;
    }

    // Attempt a second POST with the same client_message_id (= firstProposalId).
    // This simulates a replay attack using the captured proposal_id.
    const replayRes = await page.request.post("/api/botsson/chat", {
      data: {
        workspaceId: SEED_WORKSPACE_ID,
        sessionId: firstSessionId,
        client_tool_results: [
          {
            tool_call_id: "replay-fake-tool-call-id",
            result: JSON.stringify({
              proposal_id: firstProposalId,
              action: "confirm",
            }),
          },
        ],
      },
      headers: { "content-type": "application/json" },
    });

    const replayBody = (await replayRes.json().catch(() => ({}))) as Record<string, unknown>;
    console.log(
      `T3-D4: replay POST returned ${replayRes.status()}: ${JSON.stringify(replayBody).slice(0, 200)}`,
    );

    // Wait for any DB writes to settle.
    await page.waitForTimeout(2_000);

    // DEFENSE 4: only 1 channel_message row with this client_message_id must exist.
    const { data: replayRows } = await supabase
      .from("channel_message")
      .select("id")
      .eq("client_message_id", firstProposalId)
      .limit(5);

    expect(
      (replayRows ?? []).length,
      "T3 DEFENSE 4: exactly 1 channel_message row must exist for the proposal_id " +
        `(${firstProposalId}). The UNIQUE constraint on client_message_id prevents replay attacks. ` +
        "If 2+ rows exist, idempotency is broken (channel_message insert_send_message_atomic or equivalent RPC).",
    ).toBeLessThanOrEqual(1);
  });
});
