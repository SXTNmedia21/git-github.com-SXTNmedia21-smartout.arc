/**
 * platform-admin-authors-journey — end-to-end Playwright spec
 *
 * SCAFFOLD generated from FLOW.md (ADR-0222 §"e2e.spec.ts is generated from
 * FLOW.md"). This is the documented contract; live integration is deferred.
 *
 * To run:
 *   pnpm --filter @smartout/e2e exec playwright test platform-admin-authors-journey
 *
 * Prerequisites:
 *   - Local Supabase running (npx supabase start)
 *   - Web dev server on :3060 (op run --env-file=.env.template -- pnpm --filter web dev)
 *   - Stage-engine container healthy (docker ps | grep stage-engine)
 *   - Seed user admin@smartout.local with godmode=true
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3060";

test.describe("platform-admin-authors-journey", () => {
  test("authors a new journey via the 6-phase wizard", async ({ page, request }) => {
    // ── Phase 0 — Login ──────────────────────────────────────────────
    // TODO use admin-login helper from apps/e2e/helpers/admin-login.ts
    // Expected: cookies set, /dashboard reachable
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', "admin@smartout.local");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/platform-admin/);

    // ── Phase 1 — Create wizard session ─────────────────────────────
    // POST /api/platform-admin/journeys/wizard creates a wizard_session row.
    // TODO assert response shape: { wizard_session_id, status: "active" }
    const createRes = await request.post(`${BASE}/api/platform-admin/journeys/wizard`, {
      data: { workspaceId: "<TODO seed workspace>" },
    });
    expect(createRes.status()).toBe(201);
    const session = await createRes.json();
    const wizardSessionId: string = session.wizard_session_id;

    await page.goto(`${BASE}/platform-admin/journeys/wizard/${wizardSessionId}`);

    // ── Phase 2 — Discovery ─────────────────────────────────────────
    // FLOW.md row 1: save_draft({phase: discovery, draft})
    // TODO send userMessage via wizard textarea
    // TODO wait for assistant response
    // TODO assert wizard_session.draft_journey contains 'title' AND 'trigger_description'
    // TODO assert wizard_session.current_phase = 'classification'

    // ── Phase 3 — Classification ────────────────────────────────────
    // FLOW.md row 2: check_duplicates + lookup_journeys + save_draft
    // TODO assert tool calls fire (visible via SSE / wizard log)
    // TODO assert draft contains module + actor + platform + priority + tags

    // ── Phase 4 — Steps ─────────────────────────────────────────────
    // FLOW.md row 3: save_draft({phase: steps})
    // TODO assert draft.steps is array of length ≥ 1

    // ── Phase 5 — Testing ───────────────────────────────────────────
    // FLOW.md row 4: save_draft({phase: testing})
    // TODO assert draft.test_assertion + preconditions

    // ── Phase 6 — Documentation ─────────────────────────────────────
    // FLOW.md row 5: save_draft({phase: documentation})
    // TODO assert draft.doc_title + outcomes blocks

    // ── Phase 7 — Review + Publish ──────────────────────────────────
    // FLOW.md row 6: agent shows summary, awaits "godkjent"
    // FLOW.md row 7: publish_draft({confirm: true})
    // TODO send "godkjent" via textarea
    // TODO assert publish_draft tool call fires
    // TODO assert journey row exists with status = 'ready_test'
    // TODO assert journey_version row exists with ir_json populated
    // TODO assert wizard_session.status = 'completed'

    // ── Phase 8 — Mission published ─────────────────────────────────
    // FLOW.md row 8: agent chains journey.publish_mission(version_id)
    // TODO assert engine_missions row exists with id = journey_<slug>_v1
    // TODO assert engine_missions.is_active = false (per ADR-0194)
    // TODO assert engine_stages rows exist (one per IR step)

    // ── Telemetry assertions ────────────────────────────────────────
    // TODO assert activity_trail has rows for:
    //   - journey_authoring phase_advanced (×5 — phases 1-5)
    //   - journey_authoring journey_published (×1 — phase 7)
    //   - journey run_started (×1 — phase 8 via publish_mission)
  });

  test("refuses publish_draft when user has not confirmed", async ({ request: _request }) => {
    // TODO simulate Review-phase agent calling publish_draft({confirm: false})
    // Expected: tool returns "Refused to publish: user has not confirmed..."
    // Assert: no journey row created, no journey_version row, wizard_session.status still 'active'
  });

  test("refuses publish_draft when wizardSessionId missing", async ({ request: _request }) => {
    // TODO simulate stage-engine NOT forwarding wizard_session_id
    // Expected: save_draft + publish_draft return missing wizardSessionId error
    // Assert: 0 wizard_session updates, 0 journey rows, 0 journey_version rows
  });

  test("rejects voice channel for journey_authoring capability", async ({ request: _request }) => {
    // TODO POST /agent/chat with channel="voice" and intent journey_authoring
    // Expected: capability allowedChannels: ["chat"] rejects voice
    // Assert: error response, no tool execution
  });
});
