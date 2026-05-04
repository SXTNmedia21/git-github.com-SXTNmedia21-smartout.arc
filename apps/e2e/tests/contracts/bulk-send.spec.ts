/**
 * Phase E2E — Journey 4: Bulk-send published template to multiple employees.
 *
 * Covers JOURNEY-contract-bulk-send + council Gate 2 verdict row #4.
 *
 * Two layers:
 *
 * 1. API shape test — POST /api/employment-contracts/bulk returns
 *    { batch_id, counts, results[] } for a valid published template.
 *    Verifies `counts.sent + counts.pending + counts.failed == profile_ids.length`.
 *    Note: downstream `/send` often returns 503 (DocuSeal not configured in
 *    local E2E), so we accept `failed` outcomes — the contract is the
 *    envelope shape, not the signing success.
 *
 * 2. Template gate — deprecated template returns 400.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import {
  cleanupContractTemplates,
  cleanupEmployeeBatch,
  seedDeprecatedTemplate,
  seedEmployeeBatch,
  seedPublishedTemplate,
} from "../../helpers/seed";

const SEED_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

test.describe("bulk-send — /api/employment-contracts/bulk envelope + gates", () => {
  test.describe.configure({ mode: "serial" });

  let publishedTemplateId: string;
  let deprecatedTemplateId: string;
  let profileIds: string[];

  test.beforeAll(async () => {
    const published = await seedPublishedTemplate({
      workspace_id: SEED_WORKSPACE_ID,
      name: "Test Published for BulkSend",
    });
    publishedTemplateId = published.template_id;

    const deprecated = await seedDeprecatedTemplate({
      workspace_id: SEED_WORKSPACE_ID,
      name: "Test Deprecated for BulkSend",
    });
    deprecatedTemplateId = deprecated.template_id;

    const batch = await seedEmployeeBatch({ workspace_id: SEED_WORKSPACE_ID, count: 3 });
    profileIds = batch.map((p) => p.profile_id);
  });

  test.afterAll(async () => {
    await cleanupEmployeeBatch(SEED_WORKSPACE_ID);
    await cleanupContractTemplates(SEED_WORKSPACE_ID);
  });

  test("published template — returns batch_id + counts + per-profile results", async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsAdmin(page);

    const response = await page.request.post("/api/employment-contracts/bulk", {
      data: {
        workspace_id: SEED_WORKSPACE_ID,
        template_id: publishedTemplateId,
        profile_ids: profileIds,
      },
    });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      batch_id: string;
      template_id: string;
      counts: { sent: number; pending: number; failed: number };
      results: Array<{ profile_id: string; status: string }>;
    };

    // batch_id is a fresh UUID per call.
    expect(body.batch_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(body.template_id).toBe(publishedTemplateId);

    // Per-profile outcomes exist and sum equals input count.
    expect(body.results.length).toBe(profileIds.length);
    const total = body.counts.sent + body.counts.pending + body.counts.failed;
    expect(total).toBe(profileIds.length);

    // Every input profile_id is present in results.
    const seen = new Set(body.results.map((r) => r.profile_id));
    for (const id of profileIds) {
      expect(seen.has(id)).toBe(true);
    }
  });

  test("deprecated template — 400 with explicit error", async ({ page }) => {
    test.setTimeout(30_000);
    await loginAsAdmin(page);

    const response = await page.request.post("/api/employment-contracts/bulk", {
      data: {
        workspace_id: SEED_WORKSPACE_ID,
        template_id: deprecatedTemplateId,
        profile_ids: profileIds,
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error.toLowerCase()).toMatch(/deprecated/);
  });

  test("empty profile_ids — 400 (zod min(1))", async ({ page }) => {
    test.setTimeout(30_000);
    await loginAsAdmin(page);

    const response = await page.request.post("/api/employment-contracts/bulk", {
      data: {
        workspace_id: SEED_WORKSPACE_ID,
        template_id: publishedTemplateId,
        profile_ids: [],
      },
    });

    expect(response.status()).toBe(400);
  });
});
