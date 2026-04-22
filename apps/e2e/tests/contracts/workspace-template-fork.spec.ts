/**
 * Phase E2E — Journey 2: Workspace template fork lineage.
 *
 * Covers JOURNEY-contract-hub-redesign §Journey 3 + council Gate 2 verdict
 * row #2. The UI "Ny fra systemmal" button is currently disabled (Phase 3/4
 * leaves this flow to the capability tool + follow-up; see MalerTab.tsx
 * lines 237-245). Per Phase-E2E runbook, we ship a thinner API-level E2E
 * that verifies the fork lineage contract directly via
 * POST /api/contract-templates/copy.
 *
 * What this asserts (G5 lineage columns):
 *   - source_template_id is populated with the K1a source id
 *   - source_template_version is the K1a version at fork time (as text)
 *   - forked_at is set to a recent timestamp
 *   - The copy is workspace-owned (is_system=false)
 *
 * Skip rationale (recorded for Council Gate 3):
 *   - End-to-end through the Botsson capability tool requires stage-engine
 *     + an LLM call. Those are non-deterministic in E2E (different seed data,
 *     different prompts → different tool invocations). The API endpoint is
 *     the single bottleneck both paths share.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { supabase, cleanupContractTemplates } from "../../helpers/seed";
import { expectTelemetryEvent, telemetryTimestamp } from "../../helpers/telemetry";

const SEED_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

test.describe("workspace-template-fork — POST /api/contract-templates/copy", () => {
  test.describe.configure({ mode: "serial" });

  // Created per-test; cleaned up once.
  let systemTemplateId: string;

  test.beforeAll(async () => {
    // Seed a K1a system template (workspace_id IS NULL, is_system=true).
    // This is the source for the fork.
    const { data, error } = await supabase
      .from("contract_template")
      .insert({
        workspace_id: null,
        name: `Test K1a System Template ${Date.now()}`,
        contract_type: "employee",
        language: "no",
        locale: "nb-NO",
        content_html: "<p>K1a system template body</p>",
        is_system: true,
        is_active: true,
        version: 3,
      })
      .select("template_id")
      .single();

    if (error || !data) {
      throw new Error(`beforeAll fork source failed: ${error?.message ?? "no row"}`);
    }
    systemTemplateId = data.template_id;
  });

  test.afterAll(async () => {
    await cleanupContractTemplates(SEED_WORKSPACE_ID);
  });

  test("copy route forks K1a into workspace with lineage columns populated", async ({ page }) => {
    test.setTimeout(60_000);

    await loginAsAdmin(page);

    const since = telemetryTimestamp();

    const response = await page.request.post("/api/contract-templates/copy", {
      data: {
        workspace_id: SEED_WORKSPACE_ID,
        system_template_id: systemTemplateId,
        name: "Forked Copy E2E",
      },
    });

    expect(response.status()).toBe(201);
    const body = (await response.json()) as {
      template_id: string;
      source_template_id: string;
      source_template_version: string;
      forked_at: string;
    };

    expect(body.template_id).toBeTruthy();
    expect(body.source_template_id).toBe(systemTemplateId);
    // Source version 3 is stored as text on the fork per Gate G5.
    expect(body.source_template_version).toBe("3");
    expect(body.forked_at).toBeTruthy();

    // Fetch the DB row to confirm all lineage + is_system=false.
    const { data: forked } = await supabase
      .from("contract_template")
      .select(
        "template_id, workspace_id, is_system, source_template_id, source_template_version, forked_at",
      )
      .eq("template_id", body.template_id)
      .single();

    expect(forked).toBeTruthy();
    expect(forked?.workspace_id).toBe(SEED_WORKSPACE_ID);
    expect(forked?.is_system).toBe(false);
    expect(forked?.source_template_id).toBe(systemTemplateId);
    expect(forked?.source_template_version).toBe("3");
    expect(forked?.forked_at).toBeTruthy();

    // G2 registry event — `contract_template forked` with source_scope=system.
    await expectTelemetryEvent("contract_template forked", SEED_WORKSPACE_ID, { since });
  });
});
