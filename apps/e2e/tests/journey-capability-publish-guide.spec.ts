/**
 * journey-capability-publish-guide.spec.ts — L-0125 artefact-assertion E2E.
 *
 * Locks the publish_guide capability's contract at the artefact layer, not
 * the return-shape layer. Mirrors `journey-capability-publish-mission.spec.ts`
 * pattern established by publish_mission (L-0125 normative template).
 *
 * Binding:
 *   - L-0125  Test spirit vs letter: assert the artefact row, not just ok:true.
 *   - ADR-0217 journey_guide DB table — one row per journey_version_id,
 *              UNIQUE constraint, MDX content non-empty.
 *   - ADR-0196 Invariant 11 — no phantom capabilities. Capability must produce
 *              the journey_guide row OR return {ok:false} WITHOUT emitting.
 *   - ADR-0175 journey.run_started emits to 4 destinations; this test
 *              asserts engine_event + activity_trail (both persistent).
 *   - L-0118  every capability tool requires an E2E Trust-Gate test.
 *
 * Router invocation pattern:
 *   The canonical path is Server Action `publishGuideAction`
 *   (apps/web/.../actions/publish-guide.ts) → `publishGuideTool.execute()`.
 *   We drive via Playwright UI click ("Publish Guide" button) — same as the
 *   publish_mission spec pattern. This is NOT a direct capability call
 *   (rubber-stamp pattern killed by L-0125).
 *
 * Idempotent: Test 1 publishes twice to verify UNIQUE ON CONFLICT DO UPDATE
 * produces exactly 1 `journey_guide` row (ADR-0217 §Versioning).
 */

import { test, expect } from "@playwright/test";
import { loginAsPlatformAdmin } from "../helpers/admin-login";
import {
  cleanupJourneyFixtures,
  seedParentJourney,
  ADMIN_PROFILE_ID,
  HQ_WORKSPACE_ID,
  type JourneyFixtureIds,
} from "../helpers/journey-seed";
import { supabase } from "../helpers/seed";

// ── IR fixtures ───────────────────────────────────────────────────────────────

type V2IrFixture = Record<string, unknown>;

/** Minimal valid IR — no system_prompt/mode required for guide publish. */
function validGuideIr(slug: string): V2IrFixture {
  return {
    version: "2.0.0",
    slug,
    title: `Publish Guide E2E ${slug}`,
    module: "testing",
    description: "An E2E test journey for publish_guide artefact assertion.",
    steps: [
      {
        key: "step-intro",
        title: "Open the dashboard",
        action: "Click the dashboard link in the sidebar",
        assertion: "Dashboard header is visible on the page",
        description: "Navigate to the dashboard by clicking the sidebar link.",
      },
      {
        key: "step-confirm",
        title: "Confirm the action",
        action: "Fill the confirmation textbox with 'yes'",
        assertion: "Submit button becomes enabled after text is entered",
        description: "Type 'yes' in the confirmation input to enable Submit.",
      },
    ],
  };
}

/** IR missing title — fails validateIRForGuide(). */
function invalidGuideIrNoTitle(slug: string): V2IrFixture {
  const ir = validGuideIr(slug);
  delete (ir as Record<string, unknown>).title;
  return ir;
}

// ── Seed helper ───────────────────────────────────────────────────────────────

async function seedReadyPublishVersion(opts: {
  workspaceId?: string;
  slug: string;
  ir: V2IrFixture;
}): Promise<{ journey_id: string; journey_version_id: string; slug: string }> {
  const workspaceId = opts.workspaceId ?? HQ_WORKSPACE_ID;
  const parent = await seedParentJourney({ workspaceId, slug: opts.slug });

  const { data, error } = await supabase
    .from("journey_version")
    .insert({
      workspace_id: workspaceId,
      journey_id: parent.journey_id,
      status: "ready_publish",
      ir_json: opts.ir,
      created_by: "e0000000-0000-0000-0000-000000000000",
    })
    .select("journey_version_id")
    .single();

  if (error || !data) {
    throw new Error(`seedReadyPublishVersion (guide) failed: ${error?.message ?? "no row"}`);
  }

  return {
    journey_id: parent.journey_id,
    journey_version_id: (data as { journey_version_id: string }).journey_version_id,
    slug: parent.slug,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });

test.describe("journey.publish_guide — L-0125 artefact assertion @journey-engine", () => {
  const fixtures: JourneyFixtureIds = {
    journey_ids: [],
    journey_version_ids: [],
  };
  const seededGuideIds: string[] = [];

  test.afterEach(async () => {
    if (seededGuideIds.length > 0) {
      await supabase.from("journey_guide").delete().in("id", seededGuideIds);
      seededGuideIds.length = 0;
    }
  });

  test.afterAll(async () => {
    await cleanupJourneyFixtures(fixtures);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 1 — happy path + idempotent upsert
  // ────────────────────────────────────────────────────────────────────────────
  test("publish_guide writes journey_guide row + non-empty MDX + emits run_started", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const since = new Date().toISOString();
    const slug = `e2e-pub-guide-happy-${Date.now()}`;
    const ir = validGuideIr(slug);

    const seeded = await seedReadyPublishVersion({ slug, ir });
    fixtures.journey_ids!.push(seeded.journey_id);
    fixtures.journey_version_ids!.push(seeded.journey_version_id);

    // Navigate to version editor and click "Publish Guide" button.
    await loginAsPlatformAdmin(page);
    await page.goto(`/platform-admin/journeys/versions/${seeded.journey_version_id}`);

    const publishButton = page.getByRole("button", { name: /publish guide/i });
    await expect(publishButton).toBeVisible({ timeout: 10_000 });
    await publishButton.click();

    // Success toast should surface the guide_id prefix.
    await expect(page.getByText(/Guide published/i)).toBeVisible({ timeout: 15_000 });

    // Allow DB writes to settle.
    await page.waitForTimeout(2_000);

    // ── Spirit of L-0118 — artefact assertion: journey_guide row ──────────
    const { data: guides, error: guideErr } = await supabase
      .from("journey_guide")
      .select(
        "id, workspace_id, journey_version_id, slug, version_number, title, mdx_content, is_public, created_at",
      )
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("journey_version_id", seeded.journey_version_id);

    expect(guideErr, `journey_guide SELECT failed: ${guideErr?.message}`).toBeNull();
    expect(guides, "expected journey_guide row after publish").toBeTruthy();
    expect(guides!.length).toBe(1);

    const guide = guides![0] as {
      id: string;
      workspace_id: string;
      journey_version_id: string;
      slug: string;
      version_number: number;
      title: string;
      mdx_content: string;
      is_public: boolean;
    };
    seededGuideIds.push(guide.id);

    // Structural assertions per ADR-0217.
    expect(guide.workspace_id).toBe(HQ_WORKSPACE_ID);
    expect(guide.journey_version_id).toBe(seeded.journey_version_id);
    expect(guide.slug).toBe(slug);
    // is_public=false (ADR-0217 default — public flag is not set by capability).
    expect(guide.is_public).toBe(false);
    // Title must match IR title.
    expect(guide.title).toBe(ir.title as string);

    // MDX content non-empty and contains expected structure.
    expect(guide.mdx_content.length).toBeGreaterThan(0);
    // H1 heading.
    expect(guide.mdx_content).toContain(`# ${ir.title as string}`);
    // Step headings (H2) — 2 steps in the fixture.
    expect(guide.mdx_content).toContain("## Step 1:");
    expect(guide.mdx_content).toContain("## Step 2:");
    // Checklist entries from assertions.
    expect(guide.mdx_content).toContain("- [ ]");

    // ── Idempotent upsert: publish again → still exactly 1 row ────────────
    await publishButton.click();
    await expect(page.getByText(/Guide published/i)).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_000);

    const { data: guidesAfterReplay } = await supabase
      .from("journey_guide")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("journey_version_id", seeded.journey_version_id);

    expect(
      guidesAfterReplay ?? [],
      "UNIQUE ON CONFLICT: re-publish must produce exactly 1 row, not 2",
    ).toHaveLength(1);

    // ── Telemetry — run_started in engine_event + activity_trail ──────────
    const { data: events, error: eventErr } = await supabase
      .from("engine_event")
      .select("id, event_type, payload, workspace_id, fired_at")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event_type", "journey.run_started")
      .gte("fired_at", since);

    expect(eventErr, `engine_event SELECT failed: ${eventErr?.message}`).toBeNull();
    expect(events, "expected engine_event row for journey.run_started").toBeTruthy();
    expect(events!.length).toBeGreaterThanOrEqual(1);

    const { data: trailRows, error: trailErr } = await supabase
      .from("activity_trail")
      .select("id, event, actor_id, workspace_id, created_at")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event", "journey run_started")
      .gte("created_at", since);

    expect(trailErr, `activity_trail SELECT failed: ${trailErr?.message}`).toBeNull();
    expect(trailRows, "expected activity_trail row for journey.run_started").toBeTruthy();
    expect(trailRows!.length).toBeGreaterThanOrEqual(1);
    // ADR-0134: actor_id non-null + matches admin profile.
    const trailActor = (trailRows![0] as { actor_id: string }).actor_id;
    expect(trailActor).toBe(ADMIN_PROFILE_ID);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 2 — validation failure: zero rows, zero emits
  // ────────────────────────────────────────────────────────────────────────────
  test("publish_guide rejects IR without title — zero journey_guide rows, zero emits", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const since = new Date().toISOString();
    const slug = `e2e-pub-guide-reject-${Date.now()}`;
    const ir = invalidGuideIrNoTitle(slug);

    const seeded = await seedReadyPublishVersion({ slug, ir });
    fixtures.journey_ids!.push(seeded.journey_id);
    fixtures.journey_version_ids!.push(seeded.journey_version_id);

    await loginAsPlatformAdmin(page);
    await page.goto(`/platform-admin/journeys/versions/${seeded.journey_version_id}`);

    const publishButton = page.getByRole("button", { name: /publish guide/i });
    await expect(publishButton).toBeVisible({ timeout: 10_000 });
    await publishButton.click();

    // Let the Server Action settle — rejection path is fast.
    await page.waitForTimeout(2_000);

    // ── Negative artefact assertion: no journey_guide row written ─────────
    const { data: guides } = await supabase
      .from("journey_guide")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("journey_version_id", seeded.journey_version_id);

    expect(guides ?? [], "journey_guide row must not exist on validation_failed path").toHaveLength(
      0,
    );

    // ── Negative telemetry: no run_started emitted ────────────────────────
    const { data: events } = await supabase
      .from("engine_event")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event_type", "journey.run_started")
      .gte("fired_at", since);

    expect(
      events ?? [],
      "engine_event run_started must not fire on validation_failed path",
    ).toHaveLength(0);

    const { data: trail } = await supabase
      .from("activity_trail")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event", "journey run_started")
      .gte("created_at", since);

    expect(
      trail ?? [],
      "activity_trail run_started must not fire on validation_failed path",
    ).toHaveLength(0);
  });
});
