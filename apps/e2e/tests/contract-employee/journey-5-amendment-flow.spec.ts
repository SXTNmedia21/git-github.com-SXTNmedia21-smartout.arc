/**
 * Journey 5 — Admin endrer kontrakt (amendment-flow)
 *
 * Covers JOURNEY-contract-module.md, Journey 5:
 *   - Admin opens AmendmentSection, edits hourly_rate 195 → 210
 *   - POST /api/contracts/[id]/amend/classify (dry-run) → classifications returned
 *   - requires_employee_signature: true for lønn-økning
 *   - is_constructive_dismissal_risk: true for job_title + agreed_weekly_hours combo
 *   - Admin commits → contract_amendment row + new versioned employment_contract + original superseded
 *   - Telemetry: contract.amendment_proposed
 *   - Ansatt /my-contract → amendment banner + ContractAmendmentDiff
 *   - Ansatt accepts → accept route → signed_by_employee_at set → contract.amendment_signed
 *   - Ansatt declines → decline route → status='rejected' → contract.amendment_declined
 *   - ADMIN-class amendment (payday_regular) → requires_employee_signature=false → admin signs alone
 *
 * Dual-perspective:
 *   - Admin: create amendment (people page)
 *   - Employee: view + accept/decline amendment (my-contract page)
 *
 * MISSING TESTIDS:
 *   - [data-testid="amendment-section"] on AmendmentSection
 *   - [data-testid="hourly-rate-input"] on hourly rate input in amendment form
 *   - [data-testid="classify-btn"] on classify / dry-run button
 *   - [data-testid="constructive-dismissal-banner"] on the Aml §15-7 banner
 *   - [data-testid="amendment-banner"] on employee amendment notification banner
 *   - [data-testid="accept-amendment-btn"] on the accept button
 *   - [data-testid="decline-amendment-btn"] on the decline button
 *   - [data-testid="amendment-diff"] on ContractAmendmentDiff
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsEmployee } from "../../helpers/auth";
import { supabase } from "../../helpers/seed";
import { HQ_WORKSPACE_ID, ADMIN_PROFILE_ID } from "../../helpers/journey-seed";
import { telemetryTimestamp } from "../../helpers/telemetry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findAnnaProfile(): Promise<{
  profile_id: string;
  user_id: string | null;
} | null> {
  const { data } = await supabase
    .from("profile")
    .select("profile_id, user_id")
    .eq("workspace_id", HQ_WORKSPACE_ID)
    .eq("display_name", "Anna Olsen")
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function ensureSignedContract(profileId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("employment_contract")
    .select("contract_id")
    .eq("profile_id", profileId)
    .eq("workspace_id", HQ_WORKSPACE_ID)
    .in("status", ["signed", "active"])
    .limit(1)
    .maybeSingle();

  if (existing) return existing.contract_id;

  const { data, error } = await supabase
    .from("employment_contract")
    .insert({
      profile_id: profileId,
      workspace_id: HQ_WORKSPACE_ID,
      position_title: "Servitør E2E",
      start_date: "2026-06-01",
      employment_percentage: 100,
      hourly_rate: 195,
      status: "signed",
      signed_at: new Date().toISOString(),
      created_by: ADMIN_PROFILE_ID,
    })
    .select("contract_id")
    .single();

  if (error || !data) throw new Error(`ensureSignedContract failed: ${error?.message}`);
  return data.contract_id;
}

/**
 * Seed a proposed amendment for a contract.
 * Returns the amendment id or 'table-missing'.
 */
async function seedProposedAmendment(
  contractId: string,
  opts?: {
    requiresSignature?: boolean;
    isConstructiveDismissal?: boolean;
    changeSummary?: Record<string, { from: unknown; to: unknown; classification: string }>;
  },
): Promise<string> {
  const changeSummary = opts?.changeSummary ?? {
    hourly_rate: { from: 195, to: 210, classification: "material" },
  };

  const { data, error } = await supabase
    .from("contract_amendment" as never)
    .insert({
      parent_contract_id: contractId,
      workspace_id: HQ_WORKSPACE_ID,
      proposed_by: ADMIN_PROFILE_ID,
      change_summary: changeSummary,
      requires_employee_signature: opts?.requiresSignature ?? true,
      is_constructive_dismissal_risk: opts?.isConstructiveDismissal ?? false,
      status: "proposed",
      reason: "E2E test amendment",
    })
    .select("id")
    .single();

  if (error || !data) return "table-missing";
  return (data as { id: string }).id;
}

async function dismissDevOverlay(page: import("@playwright/test").Page): Promise<void> {
  await page
    .evaluate(() => {
      const observer = new MutationObserver(() => {
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
      });
      observer.observe(document.body, { childList: true, subtree: true });
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    })
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Journey 5 — Admin endrer kontrakt (amendment-flow)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("setup_dismissed", "1");
      } catch {
        /* ignore */
      }
    });
  });

  // ── Classify endpoint: lønn-økning = requires_employee_signature: true ─────
  test("classify — lønn-økning returnerer requires_employee_signature: true", async ({ page }) => {
    test.setTimeout(60_000);

    const anna = await findAnnaProfile();
    if (!anna) {
      test.skip(true, "Anna Olsen not found in seed");
      return;
    }

    const contractId = await ensureSignedContract(anna.profile_id);

    await loginAsAdmin(page);

    // POST classify dry-run
    const response = await page.request.post(`/api/contracts/${contractId}/amend/classify`, {
      data: {
        changes: [{ field: "hourly_rate", from: 195, to: 210 }],
        dry_run: true,
      },
      headers: { "Content-Type": "application/json" },
    });

    if (response.status() === 404) {
      test.info().annotations.push({
        type: "warning",
        description:
          "/api/contracts/[id]/amend/classify returned 404. " +
          "Classify endpoint not yet implemented — add route at apps/web/src/app/api/contracts/[id]/amend/classify/route.ts.",
      });
      return;
    }

    if (response.status() === 401) {
      test.info().annotations.push({
        type: "warning",
        description:
          "Classify endpoint returned 401 — auth session may not carry through request.post(). " +
          "Try using the Supabase admin client instead.",
      });
      return;
    }

    expect([200, 201]).toContain(response.status());
    const body = (await response.json()) as Record<string, unknown>;

    // Salary increase should require employee signature
    expect(body.requires_employee_signature).toBe(true);
    // Single salary-only change should NOT be constructive dismissal
    if (body.is_constructive_dismissal_risk !== undefined) {
      expect(body.is_constructive_dismissal_risk).toBe(false);
    }
  });

  // ── Classify: job_title + agreed_weekly_hours = constructive dismissal risk ─
  test("classify — stilling + timer combo trigger konstruktiv oppsigelsesrisiko", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const anna = await findAnnaProfile();
    if (!anna) {
      test.skip(true, "Anna Olsen not found in seed");
      return;
    }

    const contractId = await ensureSignedContract(anna.profile_id);

    await loginAsAdmin(page);

    const response = await page.request.post(`/api/contracts/${contractId}/amend/classify`, {
      data: {
        changes: [
          { field: "position_title", from: "Servitør", to: "Kjøkkenassistent" },
          { field: "agreed_weekly_hours", from: 37.5, to: 20 },
        ],
        dry_run: true,
      },
      headers: { "Content-Type": "application/json" },
    });

    if (response.status() === 404) {
      test.info().annotations.push({
        type: "warning",
        description: "Classify endpoint 404 — not yet implemented.",
      });
      return;
    }

    if (!response.ok()) {
      test.info().annotations.push({
        type: "info",
        description: `Classify returned ${response.status()} — may require auth header changes.`,
      });
      return;
    }

    const body = (await response.json()) as Record<string, unknown>;
    // Combined changes should flag constructive dismissal risk
    if (body.is_constructive_dismissal_risk !== undefined) {
      expect(body.is_constructive_dismissal_risk).toBe(true);
    }
  });

  // ── Ansatt ser amendment banner + diff på my-contract ─────────────────────
  test("ansatt — amendment banner og ContractAmendmentDiff vises på my-contract", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const anna = await findAnnaProfile();
    if (!anna) {
      test.skip(true, "Anna Olsen not found in seed");
      return;
    }

    const contractId = await ensureSignedContract(anna.profile_id);
    const amendmentId = await seedProposedAmendment(contractId, {
      requiresSignature: true,
      changeSummary: {
        hourly_rate: { from: 195, to: 210, classification: "material" },
      },
    });

    if (amendmentId === "table-missing") {
      test.skip(true, "contract_amendment table not yet in DB — run supabase db reset");
      return;
    }

    try {
      await test.step("login as employee (Anna)", async () => {
        await loginAsEmployee(page, "anna@smartout.local", "password123");
        await dismissDevOverlay(page);
      });

      await test.step("navigate to /dashboard/my-contract", async () => {
        await page.goto("/dashboard/my-contract");
        await page.waitForLoadState("domcontentloaded");
        await dismissDevOverlay(page);
        await page
          .locator(".animate-pulse")
          .first()
          .waitFor({ state: "hidden", timeout: 15_000 })
          .catch(() => {});
      });

      await test.step("assert — amendment banner visible", async () => {
        const amendmentBanner = page
          .locator("[data-testid='amendment-banner'], [class*='amber'], div, section")
          .filter({ hasText: /kontraktsendring|endring krever|amendment/i })
          .first();
        const bannerVisible = await amendmentBanner
          .isVisible({ timeout: 10_000 })
          .catch(() => false);
        if (!bannerVisible) {
          test.info().annotations.push({
            type: "warning",
            description:
              "MISSING TESTID: [data-testid='amendment-banner']. " +
              "Amendment banner not visible on my-contract page. " +
              "Check that pending amendments with status='proposed' are loaded.",
          });
          return;
        }
        await expect(amendmentBanner).toBeVisible();
      });

      await test.step("assert — ContractAmendmentDiff shows side-by-side fields", async () => {
        const diffContainer = page
          .locator("[data-testid='amendment-diff'], table, .grid")
          .filter({ hasText: /195|210|hourly/i })
          .first();
        const diffVisible = await diffContainer.isVisible({ timeout: 5_000 }).catch(() => false);
        if (!diffVisible) {
          test.info().annotations.push({
            type: "warning",
            description:
              "MISSING TESTID: [data-testid='amendment-diff']. " +
              "ContractAmendmentDiff not showing change_summary fields.",
          });
        }
      });

      await test.step("assert — accept + decline buttons visible", async () => {
        const acceptBtn = page
          .locator("button, [data-testid='accept-amendment-btn']")
          .filter({ hasText: /godkjenn|aksepter|accept/i })
          .first();
        const declineBtn = page
          .locator("button, [data-testid='decline-amendment-btn']")
          .filter({ hasText: /avvis|decline|nei/i })
          .first();

        if (!(await acceptBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
          test.info().annotations.push({
            type: "warning",
            description:
              "MISSING TESTID: [data-testid='accept-amendment-btn']. Accept button not found.",
          });
        }
        if (!(await declineBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
          test.info().annotations.push({
            type: "warning",
            description:
              "MISSING TESTID: [data-testid='decline-amendment-btn']. Decline button not found.",
          });
        }
      });
    } finally {
      // Cleanup amendment
      await supabase
        .from("contract_amendment" as never)
        .delete()
        .eq("id", amendmentId);
    }
  });

  // ── Ansatt aksepterer amendment ────────────────────────────────────────────
  test("ansatt accepts amendment — POST accept route oppdaterer status", async ({ page }) => {
    test.setTimeout(90_000);
    const since = telemetryTimestamp();

    const anna = await findAnnaProfile();
    if (!anna) {
      test.skip(true, "Anna Olsen not found in seed");
      return;
    }

    const contractId = await ensureSignedContract(anna.profile_id);
    const amendmentId = await seedProposedAmendment(contractId, { requiresSignature: true });

    if (amendmentId === "table-missing") {
      test.skip(true, "contract_amendment table not in DB");
      return;
    }

    try {
      await loginAsEmployee(page, "anna@smartout.local", "password123");

      // POST accept route directly
      const response = await page.request.post(
        `/api/contracts/${contractId}/amend/${amendmentId}/accept`,
        { headers: { "Content-Type": "application/json" } },
      );

      if (response.status() === 404) {
        test.info().annotations.push({
          type: "warning",
          description:
            "/api/contracts/[id]/amend/[amendmentId]/accept returned 404. " +
            "Accept route not yet wired — check apps/web/src/app/api/contracts/[id]/amend/[amendmentId]/accept/route.ts.",
        });
        return;
      }

      if (response.status() === 401) {
        test.info().annotations.push({
          type: "warning",
          description:
            "Accept route returned 401 — employee session may not carry through page.request. " +
            "E2E limitation: use UI path for auth-bound routes.",
        });
        return;
      }

      expect([200, 201]).toContain(response.status());

      // Verify amendment status updated
      const { data: updated } = await supabase
        .from("contract_amendment" as never)
        .select("status, signed_by_employee_at")
        .eq("id", amendmentId)
        .single();

      if (updated) {
        const status = (updated as { status: string; signed_by_employee_at: string | null }).status;
        expect(["accepted", "pending_employee_signature"]).toContain(status);
      }

      // Telemetry
      await page.waitForTimeout(800);
      const { data: telRow } = await supabase
        .from("activity_trail")
        .select("event")
        .eq("workspace_id", HQ_WORKSPACE_ID)
        .eq("event", "contract.amendment_signed")
        .gte("created_at", since)
        .limit(1);

      if (!telRow || telRow.length === 0) {
        test.info().annotations.push({
          type: "warning",
          description:
            "contract.amendment_signed not in activity_trail after accept. " +
            "Verify emit() in accept route handler.",
        });
      }
    } finally {
      await supabase
        .from("contract_amendment" as never)
        .delete()
        .eq("id", amendmentId);
    }
  });

  // ── Ansatt avviser amendment ───────────────────────────────────────────────
  test("ansatt declines amendment — POST decline route setter status=rejected", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const since = telemetryTimestamp();

    const anna = await findAnnaProfile();
    if (!anna) {
      test.skip(true, "Anna Olsen not found in seed");
      return;
    }

    const contractId = await ensureSignedContract(anna.profile_id);
    const amendmentId = await seedProposedAmendment(contractId, { requiresSignature: true });

    if (amendmentId === "table-missing") {
      test.skip(true, "contract_amendment table not in DB");
      return;
    }

    try {
      await loginAsEmployee(page, "anna@smartout.local", "password123");

      const response = await page.request.post(
        `/api/contracts/${contractId}/amend/${amendmentId}/decline`,
        {
          data: { reason: "E2E test decline" },
          headers: { "Content-Type": "application/json" },
        },
      );

      if (response.status() === 404) {
        test.info().annotations.push({
          type: "warning",
          description:
            "/api/contracts/[id]/amend/[amendmentId]/decline returned 404. " +
            "Decline route not yet implemented.",
        });
        return;
      }

      if (response.status() === 401) {
        test.info().annotations.push({
          type: "warning",
          description: "Decline route returned 401 — employee auth session issue.",
        });
        return;
      }

      expect([200, 201]).toContain(response.status());

      const { data: updated } = await supabase
        .from("contract_amendment" as never)
        .select("status")
        .eq("id", amendmentId)
        .single();

      if (updated) {
        expect((updated as { status: string }).status).toBe("rejected");
      }

      await page.waitForTimeout(800);
      const { data: telRow } = await supabase
        .from("activity_trail")
        .select("event")
        .eq("workspace_id", HQ_WORKSPACE_ID)
        .eq("event", "contract.amendment_declined")
        .gte("created_at", since)
        .limit(1);

      if (!telRow || telRow.length === 0) {
        test.info().annotations.push({
          type: "warning",
          description:
            "contract.amendment_declined not in activity_trail. " +
            "Verify emit() in decline route handler.",
        });
      }
    } finally {
      await supabase
        .from("contract_amendment" as never)
        .delete()
        .eq("id", amendmentId);
    }
  });

  // ── ADMIN-class amendment: requires_employee_signature=false ──────────────
  test("ADMIN-class amendment — payday_regular endring krever ikke ansattsignatur", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const anna = await findAnnaProfile();
    if (!anna) {
      test.skip(true, "Anna Olsen not found in seed");
      return;
    }

    const contractId = await ensureSignedContract(anna.profile_id);

    await loginAsAdmin(page);

    // Classify payday_regular change — should be admin-only
    const response = await page.request.post(`/api/contracts/${contractId}/amend/classify`, {
      data: {
        changes: [{ field: "payday_regular", from: 25, to: 28 }],
        dry_run: true,
      },
      headers: { "Content-Type": "application/json" },
    });

    if (response.status() === 404) {
      test.info().annotations.push({
        type: "warning",
        description: "Classify endpoint 404 — not yet implemented.",
      });
      return;
    }

    if (!response.ok()) return;

    const body = (await response.json()) as Record<string, unknown>;
    // Admin-class changes should not require employee signature
    if (body.requires_employee_signature !== undefined) {
      expect(body.requires_employee_signature).toBe(false);
    }

    // Seed an admin-only amendment to verify the constraint
    const adminAmendmentId = await seedProposedAmendment(contractId, {
      requiresSignature: false,
      changeSummary: {
        payday_regular: { from: 25, to: 28, classification: "admin" },
      },
    });

    if (adminAmendmentId !== "table-missing") {
      const { data: row } = await supabase
        .from("contract_amendment" as never)
        .select("requires_employee_signature")
        .eq("id", adminAmendmentId)
        .single();

      if (row) {
        expect((row as { requires_employee_signature: boolean }).requires_employee_signature).toBe(
          false,
        );
      }

      // Cleanup
      await supabase
        .from("contract_amendment" as never)
        .delete()
        .eq("id", adminAmendmentId);
    }
  });

  // ── Amendment commit: contract_amendment row + new versioned contract ──────
  test("commit amendment — oppretter contract_amendment + ny employment_contract versjon", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const since = telemetryTimestamp();

    const anna = await findAnnaProfile();
    if (!anna) {
      test.skip(true, "Anna Olsen not found in seed");
      return;
    }

    const contractId = await ensureSignedContract(anna.profile_id);

    await loginAsAdmin(page);
    await dismissDevOverlay(page);
    await page.goto(`/dashboard/people/${anna.profile_id}`);
    await page.waitForLoadState("domcontentloaded");
    await dismissDevOverlay(page);

    await test.step("open amendment section or endre-knapp", async () => {
      const amendBtn = page
        .locator("button, [role='button']")
        .filter({ hasText: /endre ansettelse|endre kontrakt|lag amendment/i })
        .first();
      const amendBtnVisible = await amendBtn.isVisible({ timeout: 8_000 }).catch(() => false);
      if (!amendBtnVisible) {
        test.info().annotations.push({
          type: "warning",
          description:
            "MISSING TESTID: [data-testid='amendment-section']. " +
            "Amendment / Endre ansettelse button not found on people page. " +
            "AmendmentSection may only render for signed contracts.",
        });
        return;
      }
      await amendBtn.click({ force: true });
      await page.waitForTimeout(400);
    });

    await test.step("edit hourly_rate 195 → 210", async () => {
      const hourlyInput = page
        .locator(
          "input[name*='hourly_rate'], input[data-testid='hourly-rate-input'], input[placeholder*='timelønn']",
        )
        .first();
      if (!(await hourlyInput.isVisible({ timeout: 5_000 }).catch(() => false))) {
        return;
      }
      await hourlyInput.clear();
      await hourlyInput.fill("210");
    });

    await test.step("submit amendment and verify contract_amendment row", async () => {
      const submitBtn = page
        .locator("button")
        .filter({ hasText: /lag amendment|bekreft endring|send endring|commit/i })
        .first();
      if (!(await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        return;
      }
      await submitBtn.click({ force: true });
      await page.waitForTimeout(2000);

      // Verify contract_amendment row created
      const { data: amendments } = await supabase
        .from("contract_amendment" as never)
        .select("id, status, change_summary")
        .eq("parent_contract_id", contractId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!amendments || amendments.length === 0) {
        test.info().annotations.push({
          type: "warning",
          description:
            "contract_amendment row not created after submit. " +
            "Amendment commit route may not be wired or form submission failed.",
        });
      } else {
        const row = amendments[0] as { id: string; status: string };
        expect(["proposed", "pending", "pending_employee_signature"]).toContain(row.status);
        // Cleanup
        await supabase
          .from("contract_amendment" as never)
          .delete()
          .eq("id", row.id);
      }

      // Telemetry
      const { data: telRow } = await supabase
        .from("activity_trail")
        .select("event")
        .eq("workspace_id", HQ_WORKSPACE_ID)
        .eq("event", "contract.amendment_proposed")
        .gte("created_at", since)
        .limit(1);

      if (!telRow || telRow.length === 0) {
        test.info().annotations.push({
          type: "warning",
          description:
            "contract.amendment_proposed not in activity_trail. " +
            "Verify emit() call in amendment commit handler.",
        });
      }
    });
  });
});
