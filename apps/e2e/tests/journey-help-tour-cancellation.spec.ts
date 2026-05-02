import { test, expect } from "@playwright/test";
import { loginAsEmployee } from "../helpers/auth";
import { supabase } from "../helpers/seed";
import { telemetryTimestamp } from "../helpers/telemetry";

/**
 * journey-help-tour-cancellation.spec.ts — Journey 3: I-3 Cancellation invariant
 *
 * Verifies that an active help-tour highlight is cancelled (overlay removed +
 * help.tour_cancelled emitted to activity_trail) when:
 *   I-3a: ESC key is pressed while a highlight is active.
 *   I-3b: An off-target click occurs while a highlight is active.
 *   I-3c: ESC is pressed with NO active highlight → no-op (no event emitted).
 *
 * ── How highlight injection works ────────────────────────────────────────────
 *
 * useHelpTour (the hook) listens to `document keydown` for ESC and a document
 * `click` listener for off-target clicks. Both handlers only fire when
 * `activeHighlight !== null`. The hook exposes `cancel()` which:
 *   1. Calls setActiveHighlight(null) → TourHighlight unmounts → `.help-tour-overlay`
 *      vanishes from the DOM.
 *   2. Emits `help.tour_cancelled` to activity_trail.
 *
 * TourHighlight renders a `<div class="help-tour-overlay">` only when the hook
 * state is non-null. There is no public API to trigger highlightElement from
 * E2E without going through Botsson's tool registry (which requires an AI
 * tool invocation). We therefore inject the overlay state via page.evaluate():
 *
 *   window.__smartout_test_triggerHighlight?.()
 *
 * This is a dev-only test handle exposed by HelpTourToolsBridge when
 * `window.__smartout_e2e === true`. If the handle is absent (prod build or
 * the feature has been re-architectured), tests I-3a and I-3b are skipped
 * with a clear comment — they can be covered in a follow-up integration test
 * once a formal test API is added.
 *
 * Alternative considered: inject a raw `.help-tour-overlay` div via
 * page.evaluate() to fool the ESC/click handlers into running. Rejected:
 * the ESC handler checks `activeHighlight !== null` (React state), not DOM
 * presence, so a fake DOM node would not trigger cancel() or the emit. The
 * hook state must be non-null for cancellation telemetry to fire.
 *
 * I-3c uses the same inject approach in reverse — navigate to /help, do NOT
 * inject a highlight, then press ESC and confirm no row appears.
 *
 * Employee login: anna@smartout.local (loginAsEmployee default).
 * DB access: service-role client for telemetry assertions only (no writes).
 *
 * ADR-0219 §Tour, hook source: apps/web/src/app/dashboard/help/_hooks/useHelpTour.ts
 */

test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("journey:help — Journey 3 — tour cancellation I-3 @help @tour", () => {
  const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? "anna@smartout.local";

  let employeeProfileId: string;
  let employeeWorkspaceId: string;

  test.beforeAll(async () => {
    // Resolve seed employee profile via service-role (mirrors Journey 2 pattern).
    const { data: users, error: userErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (userErr) throw new Error(`beforeAll: listUsers failed: ${userErr.message}`);

    const user = users.users.find((u) => u.email?.toLowerCase() === EMPLOYEE_EMAIL.toLowerCase());
    if (!user) {
      throw new Error(
        `beforeAll: seed employee ${EMPLOYEE_EMAIL} not found — run supabase db reset`,
      );
    }

    const { data: profile, error: profErr } = await supabase
      .from("profile")
      .select("profile_id, workspace_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (profErr || !profile) {
      throw new Error(
        `beforeAll: active profile for ${EMPLOYEE_EMAIL} not found: ${profErr?.message ?? "no row"}`,
      );
    }

    employeeProfileId = (profile as { profile_id: string }).profile_id;
    employeeWorkspaceId = (profile as { workspace_id: string }).workspace_id;
  });

  // ── Shared helper: inject an active highlight via the test handle ──────────
  //
  // Returns true if the handle was available and injection succeeded.
  // Returns false if the handle is absent (prod build / test handle not wired).
  //
  // The handle `window.__smartout_test_triggerHighlight` is expected to be
  // exposed by HelpTourToolsBridge in test/dev mode when
  // `window.__smartout_e2e === true`. Setting the flag before page load lets
  // the bridge detect it during mount.
  async function injectHighlight(page: import("@playwright/test").Page): Promise<boolean> {
    // Signal the bridge to expose the test handle.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__smartout_e2e = true;
    });

    await loginAsEmployee(page, EMPLOYEE_EMAIL);
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    // Wait up to 3 s for the handle to appear — the bridge mounts asynchronously.
    let handlePresent = false;
    for (let i = 0; i < 6; i++) {
      handlePresent = await page.evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => typeof (window as any).__smartout_test_triggerHighlight === "function",
      );
      if (handlePresent) break;
      await page.waitForTimeout(500);
    }

    if (!handlePresent) {
      // Test handle not wired yet — skip with a clear message.
      // Cover in M2.3 once HelpTourToolsBridge exposes __smartout_test_triggerHighlight.
      return false;
    }

    // Invoke the handle — sets activeHighlight in the hook → TourHighlight mounts.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__smartout_test_triggerHighlight?.();
    });

    // Wait up to 1 s for the overlay DOM node to appear.
    await page
      .locator(".help-tour-overlay")
      .waitFor({ state: "attached", timeout: 1000 })
      .catch(() => {});

    return true;
  }

  // ── I-3a: ESC cancels active highlight ────────────────────────────────────

  test("I-3a: ESC cancels active highlight — overlay removed + help.tour_cancelled emitted", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const since = telemetryTimestamp();
    const injected = await injectHighlight(page);

    if (!injected) {
      test.skip(
        true,
        "I-3a blocked: __smartout_test_triggerHighlight not exposed by HelpTourToolsBridge. " +
          "Wire the test handle in M2.3 iteration.",
      );
      return;
    }

    // Precondition: overlay is present.
    await expect(page.locator(".help-tour-overlay")).toHaveCount(1, { timeout: 2_000 });

    // Act: press ESC.
    await page.keyboard.press("Escape");

    // Assertion 1: overlay removed within 1 s.
    await expect(page.locator(".help-tour-overlay")).toHaveCount(0, { timeout: 1_000 });

    // Assertion 2: help.tour_cancelled row in activity_trail within 5 s.
    // The emit() call in cancel() is async — poll for up to 5 s.
    const deadline = Date.now() + 5_000;
    let trailRow: { event: string; actor_id: string } | null = null;

    while (Date.now() < deadline) {
      const { data } = await supabase
        .from("activity_trail")
        .select("event, actor_id")
        .eq("workspace_id", employeeWorkspaceId)
        .eq("event", "help.tour_cancelled")
        .gte("created_at", since)
        .limit(1)
        .maybeSingle();

      if (data) {
        trailRow = data as { event: string; actor_id: string };
        break;
      }
      await page.waitForTimeout(500);
    }

    expect(
      trailRow,
      "help.tour_cancelled must appear in activity_trail within 5 s of ESC press (I-3a)",
    ).not.toBeNull();

    expect(
      trailRow?.actor_id,
      "actor_id on help.tour_cancelled must match the authenticated employee profile (I-3a)",
    ).toBe(employeeProfileId);
  });

  // ── I-3b: off-target click cancels active highlight ───────────────────────

  test("I-3b: off-target click cancels active highlight — overlay removed + help.tour_cancelled emitted", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const since = telemetryTimestamp();
    const injected = await injectHighlight(page);

    if (!injected) {
      test.skip(
        true,
        "I-3b blocked: __smartout_test_triggerHighlight not exposed by HelpTourToolsBridge. " +
          "Wire the test handle in M2.3 iteration.",
      );
      return;
    }

    // Precondition: overlay is present.
    await expect(page.locator(".help-tour-overlay")).toHaveCount(1, { timeout: 2_000 });

    // Act: click on a neutral, non-overlay, non-anchor element.
    // The <main> element itself (outside any anchor section) qualifies.
    // We click at a point near the bottom padding of the page (body background).
    // useHelpTour's click handler cancels when click is outside both the anchor
    // element AND any .help-tour-overlay node.
    await page.mouse.click(10, 10); // top-left corner — always outside any section anchor

    // Assertion 1: overlay removed within 1 s.
    await expect(page.locator(".help-tour-overlay")).toHaveCount(0, { timeout: 1_000 });

    // Assertion 2: help.tour_cancelled row in activity_trail within 5 s.
    const deadline = Date.now() + 5_000;
    let trailRow: { event: string; actor_id: string } | null = null;

    while (Date.now() < deadline) {
      const { data } = await supabase
        .from("activity_trail")
        .select("event, actor_id")
        .eq("workspace_id", employeeWorkspaceId)
        .eq("event", "help.tour_cancelled")
        .gte("created_at", since)
        .limit(1)
        .maybeSingle();

      if (data) {
        trailRow = data as { event: string; actor_id: string };
        break;
      }
      await page.waitForTimeout(500);
    }

    expect(
      trailRow,
      "help.tour_cancelled must appear in activity_trail within 5 s of off-target click (I-3b)",
    ).not.toBeNull();

    expect(
      trailRow?.actor_id,
      "actor_id on help.tour_cancelled must match the authenticated employee profile (I-3b)",
    ).toBe(employeeProfileId);
  });

  // ── I-3c: ESC with no active highlight is a no-op ─────────────────────────

  test("I-3c: ESC with no active highlight is no-op — no help.tour_cancelled emitted", async ({
    page,
  }) => {
    test.setTimeout(30_000);

    await loginAsEmployee(page, EMPLOYEE_EMAIL);
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    // Precondition: no overlay present (no highlight has been triggered).
    await expect(page.locator(".help-tour-overlay")).toHaveCount(0);

    // Mark time AFTER page load to avoid false positives from stale rows.
    const since = telemetryTimestamp();

    // Act: press ESC — should be silently ignored.
    await page.keyboard.press("Escape");

    // Wait 2 s to give any accidental emit time to land.
    await page.waitForTimeout(2_000);

    // Assertion: NO help.tour_cancelled row should exist after the since marker.
    const { data: rows, error } = await supabase
      .from("activity_trail")
      .select("id", { count: "exact", head: false })
      .eq("workspace_id", employeeWorkspaceId)
      .eq("actor_id", employeeProfileId)
      .eq("event", "help.tour_cancelled")
      .gte("created_at", since)
      .limit(5);

    expect(error, `activity_trail SELECT failed: ${error?.message}`).toBeNull();

    expect(
      rows?.length ?? 0,
      "I-3c: ESC with no active highlight must NOT emit help.tour_cancelled " +
        "(useHelpTour guard: handler only fires when activeHighlight !== null)",
    ).toBe(0);
  });
});
