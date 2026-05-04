import { test, expect } from "@playwright/test";
import { loginAsEmployee } from "../helpers/auth";
import { supabase } from "../helpers/seed";

/**
 * journey-help-active-ticket-empty.spec.ts — Journey 2: employee-no-ticket
 *
 * Verifies that an employee with ZERO open helpdesk threads sees NO
 * ActiveTicketBadge on /dashboard/help (M2.1 empty state, graceful absence).
 *
 * The test also confirms the page hasn't crashed and key Tier 0/1/2/3
 * elements are still present — so "no badge" is clearly empty-state, not
 * a broken render.
 *
 * Cleanup: DELETE engine_state rows for the seed employee that match
 * process_id='helpdesk_query_lifecycle' and status not in (resolved,
 * archived, cancelled) before the page load — ensures a deterministic
 * zero-ticket state regardless of prior test runs.
 *
 * Employee login: anna@smartout.local (default loginAsEmployee seed user).
 * Auth pattern mirrors journey-help-v1.spec.ts (M1 commit 3efc604b).
 */

test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("journey:help — Journey 2 — employee with no active tickets sees no badge @help", () => {
  // Seed employee email — matches loginAsEmployee default.
  const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? "anna@smartout.local";

  // Resolved in beforeAll via service-role; used for cleanup + assertions.
  let employeeProfileId: string;
  let employeeWorkspaceId: string;

  test.beforeAll(async () => {
    // ── Resolve employee user_id from auth ────────────────────────────────
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

    // ── Resolve active profile ────────────────────────────────────────────
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

    // ── Cleanup: ensure zero open helpdesk tickets for this employee ──────
    // "Open" = status NOT IN (resolved, archived, cancelled).
    // We look for engine_state rows where the employee is the requester via
    // context->>'requester_profile_id' OR the assignee_id.
    // Service-role is acceptable here because this is a test-setup operation,
    // not an application data path.
    const openStatuses = ["waiting", "open", "in_progress", "pending"];

    const { error: delErr } = await supabase
      .from("engine_state")
      .delete()
      .eq("workspace_id", employeeWorkspaceId)
      .eq("process_id", "helpdesk_query_lifecycle")
      .in("status", openStatuses)
      .or(
        `assignee_id.eq.${employeeProfileId},context->>requester_profile_id.eq.${employeeProfileId}`,
      );

    if (delErr) {
      // Non-fatal: if delete fails (e.g. RLS on service role with wrong config),
      // we skip rather than proceeding with potentially dirty state.
      throw new Error(
        `beforeAll: engine_state cleanup failed: ${delErr.message} — cannot guarantee zero-ticket state`,
      );
    }

    // ── Verify cleanup ────────────────────────────────────────────────────
    const { data: remaining, error: checkErr } = await supabase
      .from("engine_state")
      .select("id, status", { count: "exact", head: false })
      .eq("workspace_id", employeeWorkspaceId)
      .eq("process_id", "helpdesk_query_lifecycle")
      .in("status", openStatuses)
      .or(
        `assignee_id.eq.${employeeProfileId},context->>requester_profile_id.eq.${employeeProfileId}`,
      );

    if (checkErr) {
      throw new Error(`beforeAll: post-cleanup check failed: ${checkErr.message}`);
    }

    if (remaining && remaining.length > 0) {
      throw new Error(
        `beforeAll: cleanup incomplete — ${remaining.length} open helpdesk ticket(s) remain for ${EMPLOYEE_EMAIL}. ` +
          `IDs: [${remaining.map((r: { id: string }) => r.id).join(", ")}]`,
      );
    }
  });

  // ── Journey 2: no badge rendered ─────────────────────────────────────────

  test("Journey 2 — employee with zero open tickets sees NO active-ticket-badge", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await loginAsEmployee(page, EMPLOYEE_EMAIL);

    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    // ── Primary assertion: ActiveTicketBadge MUST be absent ───────────────
    // data-testid="active-ticket-badge" is the root element of ActiveTicketBadge.
    // Absence confirms graceful empty-state — not a badge with 0 count.
    await expect(page.locator('[data-testid="active-ticket-badge"]')).toHaveCount(0);

    // ── Tier 0: PanicBar still renders (page is not crashed) ─────────────
    // PanicBar has role="navigation" + aria-label matching /nødhjelp-meny/i.
    const panicBar = page.getByRole("navigation", { name: /nødhjelp-meny/i });
    await expect(panicBar).toBeVisible({ timeout: 10_000 });

    // ── Tier 1: BotssonChatHero still renders ─────────────────────────────
    // Chat hero: region aria-label matching /spør botsson om hjelp/i.
    const chatHero = page.getByRole("region", { name: /spør botsson om hjelp/i });
    await expect(chatHero).toBeVisible({ timeout: 10_000 });

    // ── Tier 2/3: Quick paths / help categories still render ──────────────
    // Quick paths are data-testid="quick-paths" OR contain at least one
    // recognisable category button. We assert the section count ≥ 1 as a
    // lightweight smoke check — avoids coupling to specific label text.
    // If the component uses a different testid, this falls back to checking
    // that the panic bar buttons include at least one visible "hurtighjelp"
    // style element via role=button within the PanicBar.
    const quickPathsSection = page.locator('[data-testid="quick-paths"]');
    const quickPathCount = await quickPathsSection.count();

    if (quickPathCount === 0) {
      // Fallback: at least one clickable help category button in PanicBar.
      const panicButtons = panicBar.getByRole("button");
      const panicBtnCount = await panicButtons.count();
      expect(
        panicBtnCount,
        "PanicBar must contain at least one help category button",
      ).toBeGreaterThanOrEqual(1);
    } else {
      await expect(quickPathsSection.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  // ── Sanity: DB state confirms zero open tickets after page load ───────────

  test("Journey 2 — DB sanity: no open helpdesk engine_state rows for employee after page load", async () => {
    // Re-query to confirm the cleanup held and no tickets were created by the
    // page render itself (no mutation paths in ActiveTicketBadge per G-RO gate).
    const { data: rows, error } = await supabase
      .from("engine_state")
      .select("id, status", { count: "exact", head: false })
      .eq("workspace_id", employeeWorkspaceId)
      .eq("process_id", "helpdesk_query_lifecycle")
      .not("status", "in", "(resolved,archived,cancelled)")
      .or(
        `assignee_id.eq.${employeeProfileId},context->>requester_profile_id.eq.${employeeProfileId}`,
      );

    expect(error, `engine_state SELECT failed: ${error?.message}`).toBeNull();
    expect(
      rows?.length ?? 0,
      "G-RO gate: page render must NOT create engine_state rows (read-only component)",
    ).toBe(0);
  });
});
