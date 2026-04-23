// ============================================
// schedule-wrong-day-replay.spec.ts
// Acceptance test for ADR-0184 Q17: a Platform Admin can replay a past
// Emma session that chose the wrong day for `schedule.shift_created`,
// drill into the TurnTimeline, inspect classifier/LLM/tool payloads,
// flag the offending turn, and queue a whisper correcting Emma.
//
// ---------------------------------------------------------------------
// Phase 2d harness strategy (SEED-THEN-DRILL, not LIVE-LLM):
//
// The original draft required a LIVE OpenRouter turn so that both a
// live Guardian session AND recorder rows existed. That's flaky and
// expensive. This revision seeds both directly:
//
//   (a) engine_sessions: one row, status='active', workspace=HQ. The
//       Guardian WebSocket's `sendSessionList()` reads this on connect
//       and pushes it to useGuardianSocket (see services/stage-engine/
//       src/core/guardian-bus.ts: sendSessionList).
//
//   (b) agent_session_recording: three rows for that session —
//       - phase=classifier_output turn_kind=user_input
//       - phase=llm_request turn_kind=tool_call with content
//         referencing "schedule.shift_created"
//       - phase=tool_exec turn_kind=tool_result
//       RLS grants the admin/owner read access via jwt_admin_read_asr.
//
// Both requirements depend on full local stack: Supabase Local +
// stage-engine :5010 + web :3060 + NEXT_PUBLIC_STAGE_ENGINE_URL set for
// the browser-side WS client. The global-setup + start-local-next-app
// scripts wire (a)–(c). The test cleans up after itself.
// ============================================

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAsAdmin } from "../../helpers/auth";

// Stable UUIDs so reruns are idempotent. Session id chosen to NOT collide
// with the whisper-never-user-facing probe id.
const SEED_SESSION_ID = "00000000-0000-4000-8000-000000000042";
const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

test.describe("Platform Admin — schedule wrong-day replay (ADR-0184 Q17)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("admin drills a flagged session → expands turn → flags + whispers", async ({ page }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY must be set").toBeTruthy();
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 0. Clean slate for determinism across reruns.
    await admin.from("agent_session_recording").delete().eq("session_id", SEED_SESSION_ID);
    await admin.from("agent_session_whisper").delete().eq("session_id", SEED_SESSION_ID);
    await admin.from("engine_sessions").delete().eq("id", SEED_SESSION_ID);

    // 1. Seed active Guardian-visible session. profile name embedded in
    //    context lets SessionList label the row with a readable display name.
    const { error: sessErr } = await admin.from("engine_sessions").insert({
      id: SEED_SESSION_ID,
      workspace_id: HQ_WORKSPACE_ID,
      channel: "chat",
      status: "active",
      mode: "agent",
      context: {
        profile: { display_name: "E2E Replay Test User" },
      },
    });
    expect(sessErr, `engine_sessions seed failed: ${sessErr?.message}`).toBeNull();

    // 2. Seed recorder rows. Phase strings must match the recorder enum
    //    (see agent_session_recording_phase_check in migrations). The
    //    content of the llm_request turn references "schedule.shift_created"
    //    so step 6 (expanded JSON) can assert on it.
    const baseRow = {
      session_id: SEED_SESSION_ID,
      workspace_id: HQ_WORKSPACE_ID,
    };
    const { error: turnsErr } = await admin.from("agent_session_recording").insert([
      {
        ...baseRow,
        turn_index: 0,
        turn_kind: "user_input",
        phase: "classifier_output",
        content_redacted: {
          classifier: { intent: "schedule.shift_created", confidence: 0.92 },
        },
        meta: { source: "e2e_replay_seed" },
      },
      {
        ...baseRow,
        turn_index: 1,
        turn_kind: "tool_call",
        phase: "llm_request",
        content_redacted: {
          tool_calls: [
            {
              name: "schedule.shift_created",
              args: { date: "2026-04-30", reason: "wrong day (should be 29)" },
            },
          ],
        },
        meta: { source: "e2e_replay_seed" },
      },
      {
        ...baseRow,
        turn_index: 2,
        turn_kind: "tool_result",
        phase: "tool_exec",
        content_redacted: { ok: true, shift_id: "deadbeef-0000-0000-0000-000000000001" },
        meta: { source: "e2e_replay_seed" },
      },
    ]);
    expect(turnsErr, `recorder seed failed: ${turnsErr?.message}`).toBeNull();

    // 3. Navigate to Guardian. The page defaults to "Oversikt" — we must
    //    switch to "Live Monitor" for SessionList to mount.
    await page.goto("/platform-admin/guardian", { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: /live monitor/i }).click();

    // 4. Find our seeded session in the left rail. SessionList rows are
    //    <button type="button">; the recorder overlay shows turn-count as
    //    "<n>t" so filtering on /\dt$/ finds rows that have recorder rows.
    const sessionRow = page.getByRole("button").filter({ hasText: /\dt$/ }).first();
    await expect(sessionRow).toBeVisible({ timeout: 15_000 });
    await sessionRow.click();

    // 5. Switch the right pane to the Replay tab so TurnTimeline renders.
    await page.getByRole("button", { name: "Replay", exact: true }).click();

    // 6. classifier_output badge is emitted by agent-router.ts per
    //    ADR-0184 §3.2. Appears as TurnCard phase badge (rounded, mono font).
    //    The preview text also includes the JSON payload but the badge is
    //    always first.
    await expect(page.getByText("classifier_output").first()).toBeVisible({ timeout: 10_000 });

    // 7. Expand the llm_request row. Click the TurnCard button — the phase
    //    badge contains the text. AnimatePresence reveals the JSON dump.
    //    Target via `.locator("button", { hasText })` so we click the card
    //    wrapper (not just the inner span).
    const llmRow = page.locator("button", { hasText: "llm_request" }).first();
    await expect(llmRow).toBeVisible();
    await llmRow.click();

    // 8. Expanded region shows the full content_redacted JSON including
    //    the schedule.shift_created tool call. This is why an admin would
    //    come here for the wrong-day bug.
    await expect(page.getByText(/schedule\.shift_created/).first()).toBeVisible();

    // 9. Flag the turn. The per-turn flag button is opacity:0 + group-hover
    //    only. Playwright's .click() will still work on hidden-by-opacity
    //    elements as long as they occupy the layout and have pointer-events.
    //    Register dialog handler BEFORE click since window.prompt() blocks.
    page.once("dialog", (dialog) => dialog.accept("wrong date selected — admin replay"));
    const flagTurn = page.getByRole("button", { name: "Flag turn" }).first();
    await flagTurn.click();

    // 10. Open AdminActionDrawer via the "Actions" toolbar button.
    await page.getByRole("button", { name: /open admin actions drawer/i }).click();
    await expect(page.getByRole("dialog", { name: /session admin actions/i })).toBeVisible();

    // 11. Whisper + submit. Placeholder text from AdminActionDrawer.tsx.
    const whisperBox = page.getByPlaceholder(/Skriv en instruks/i);
    await whisperBox.fill("Brukeren mente tirsdag 29. april — ikke onsdag 30.");
    await page.getByRole("button", { name: "Send whisper" }).click();

    // 12. Success: drawer clears whisper text on 2xx. Non-OK would keep the
    //     value populated and this assertion would time out — correct
    //     failure mode per ADR-0185.
    await expect(whisperBox).toHaveValue("", { timeout: 10_000 });

    // 13. Clean up seeded rows (test is idempotent thanks to step 0 too).
    await admin.from("agent_session_recording").delete().eq("session_id", SEED_SESSION_ID);
    await admin.from("agent_session_whisper").delete().eq("session_id", SEED_SESSION_ID);
    await admin.from("engine_sessions").delete().eq("id", SEED_SESSION_ID);
  });
});
