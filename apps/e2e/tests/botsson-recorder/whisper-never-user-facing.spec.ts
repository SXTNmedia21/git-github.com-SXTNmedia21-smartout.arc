// ============================================
// whisper-never-user-facing.spec.ts
// ADR-0078 + ADR-0185 enforcement — whispers written by Platform Admin
// are metadata-only system-prompt context. They must NEVER appear in
// assistant output (chat response, voice transcript, notification, any
// user-visible surface).
//
// The invariant (stated as a DB-layer predicate):
//   For every row R in agent_session_recording where R.session_id = S and
//   R.turn_kind IN ('agent_response','tool_result'), there is NO whisper W
//   in agent_session_whisper with W.session_id = S such that
//   W.content is a substring of JSON.stringify(R.content_redacted).
//
// This invariant is strictly stronger than any DOM-level scan of the Arena
// chat. DOM scans miss leakage through:
//   - log view payloads rendered from recorder rows
//   - tool result previews rendered from recorder rows
//   - future replay mirrors that read from recorder rows
//   - mobile surfaces that read the same recorder rows via different UI
// If the invariant holds at the DB row level, none of those surfaces can
// leak. That is why we assert at the recorder table.
//
// Test flow (deterministic, no LLM required):
//   1. Seed the recorder with one agent_response row for a stable synthetic
//      session_id via stage-engine's `POST /recorder/_test_probe`. The
//      probe content is a constant string that does NOT contain the
//      whisper token — so any subsequent appearance of the token in the
//      row would indicate leakage.
//   2. Insert a whisper for that same session_id via the BFF. This
//      exercises the full auth + authority gate + emit pipeline — not
//      just a direct DB write — so we catch regressions in the BFF path
//      that might accidentally route whisper content into user-visible
//      telemetry or the recorder table.
//   3. Assert the whisper row exists in agent_session_whisper with the
//      exact token.
//   4. Assert NO agent_response / tool_result row for the session contains
//      the whisper token. This is the ADR-0078 invariant.
//
// Why this works without driving Emma / prompt-builder through an LLM:
//   The prompt-builder IS the path where a bug could leak whisper text
//   into an agent_response. By snapshotting recorder rows before the
//   whisper insert (step 1) and after (step 3/4), we catch any regression
//   where the whisper insert itself spills into the recorder table — which
//   is the only way the DB invariant could be violated without a live
//   turn. A separate integration test covers the prompt-builder path end
//   to end (services/stage-engine/src/core/__tests__/prompt-builder-whispers.test.ts)
//   which verifies the <admin_note> wrapping is strictly system-prompt only.
// ============================================

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAsAdmin } from "../../helpers/auth";

// Unique token — improbable to appear anywhere else in recorder content.
const WHISPER_TOKEN = "XYZ_WHISPER_PROBE_42_DO_NOT_LEAK";

// Must match TEST_PROBE_SESSION in services/stage-engine/src/routes/recorder-metrics.ts
const PROBE_SESSION_ID = "00000000-0000-4000-8000-000000000001";
const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

const STAGE_ENGINE_URL =
  process.env.STAGE_ENGINE_URL ??
  process.env.NEXT_PUBLIC_STAGE_ENGINE_URL ??
  "http://127.0.0.1:5010";
const STAGE_ENGINE_API_KEY =
  process.env.STAGE_ENGINE_API_KEY ?? "test-dev-api-key-for-local-e2e-12345";

test.describe("Whisper isolation (ADR-0078 + ADR-0185)", () => {
  test("whisper content never surfaces in recorded assistant turns", async ({ page }) => {
    await loginAsAdmin(page);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY must be set for the E2E run").toBeTruthy();
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 0. Clean slate — remove any prior probe rows for this session so
    //    counts are deterministic across test reruns.
    await admin.from("agent_session_recording").delete().eq("session_id", PROBE_SESSION_ID);
    await admin.from("agent_session_whisper").delete().eq("session_id", PROBE_SESSION_ID);

    // 1. Seed an agent_response row via the stage-engine probe (fire-and-
    //    forget flush path). Probe ensures force-fail is OFF so the row
    //    actually lands.
    const probeRes = await page.request.post(
      `${STAGE_ENGINE_URL}/recorder/_test_probe?force_fail=0`,
      {
        headers: { "x-api-key": STAGE_ENGINE_API_KEY },
      },
    );
    expect(probeRes.ok(), `stage-engine probe unreachable (${probeRes.status()})`).toBe(true);

    // Wait for the flush to land the row. Flush interval is 500ms. The
    // probe endpoint already waits 800ms internally, but we add a small
    // buffer for Supabase REST-Realtime replication.
    await new Promise((r) => setTimeout(r, 400));

    const { data: preRows, error: preErr } = await admin
      .from("agent_session_recording")
      .select("id, turn_kind, content_redacted")
      .eq("session_id", PROBE_SESSION_ID)
      .in("turn_kind", ["agent_response", "tool_result"]);
    expect(preErr).toBeNull();
    expect(
      preRows?.length ?? 0,
      "probe did not produce an agent_response row — stage-engine flush path broken?",
    ).toBeGreaterThan(0);

    // Defence-in-depth: the probe content must not contain the token
    // before we even try the whisper path. If this ever fires, the probe
    // template changed and this test needs to be updated (or — worse —
    // something is salting the token into default probe content).
    for (const r of preRows ?? []) {
      expect(JSON.stringify(r.content_redacted ?? {})).not.toContain(WHISPER_TOKEN);
    }

    // 2. Insert whisper via BFF (exercises auth + C4 authority gate +
    //    emit contract end-to-end).
    const whisperRes = await page.request.post("/api/botsson/recorder/whisper", {
      data: {
        session_id: PROBE_SESSION_ID,
        content: `Intern note — husk dette tokenet: ${WHISPER_TOKEN}`,
      },
    });
    expect(
      whisperRes.ok(),
      `whisper POST failed: ${whisperRes.status()} ${await whisperRes.text()}`,
    ).toBe(true);

    // 3. Verify the whisper is recorded as the caller intended (content
    //    preserved, workspace scoped correctly).
    const { data: whispers, error: whisperErr } = await admin
      .from("agent_session_whisper")
      .select("content, workspace_id, is_consumed")
      .eq("session_id", PROBE_SESSION_ID)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(whisperErr).toBeNull();
    expect(whispers?.[0]?.content, "whisper content missing").toContain(WHISPER_TOKEN);
    expect(whispers?.[0]?.workspace_id).toBe(HQ_WORKSPACE_ID);
    // is_consumed stays false until the prompt-builder fires — that path
    // needs a live LLM turn. We don't assert on it here (a separate unit
    // test covers the consumption flag flip).

    // 4. THE ADR-0078 INVARIANT — run ONE more probe after the whisper
    //    insert so any regression where the whisper path spills into the
    //    recorder table would surface. Then re-query.
    const postProbe = await page.request.post(
      `${STAGE_ENGINE_URL}/recorder/_test_probe?force_fail=0`,
      {
        headers: { "x-api-key": STAGE_ENGINE_API_KEY },
      },
    );
    expect(postProbe.ok()).toBe(true);
    await new Promise((r) => setTimeout(r, 400));

    const { data: postRows, error: postErr } = await admin
      .from("agent_session_recording")
      .select("id, turn_kind, content_redacted")
      .eq("session_id", PROBE_SESSION_ID)
      .in("turn_kind", ["agent_response", "tool_result"]);
    expect(postErr).toBeNull();
    expect(postRows?.length ?? 0).toBeGreaterThan(0);

    for (const row of postRows ?? []) {
      const serialized = JSON.stringify(row.content_redacted ?? {});
      expect(
        serialized.includes(WHISPER_TOKEN),
        `whisper token leaked into ${row.turn_kind} turn ${row.id}`,
      ).toBe(false);
    }

    // 5. Clean up — remove probe + whisper rows so the next test starts
    //    from a known-empty state. Failure to clean is not fatal (the
    //    clean step at top of the next run will handle it) but we do it
    //    here to keep artefact tables small between runs.
    await admin.from("agent_session_recording").delete().eq("session_id", PROBE_SESSION_ID);
    await admin.from("agent_session_whisper").delete().eq("session_id", PROBE_SESSION_ID);
  });
});
