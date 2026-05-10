import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase, seedWorkspace, seedDepartment, seedProfile } from "../helpers/seed";
import { cleanupTestData } from "../helpers/cleanup";

test.describe("Nyheter journey 2 — audience targeting writes correct DB shape", () => {
  let workspaceId: string;
  let barDeptId: string;

  test.beforeEach(async () => {
    const ws = await seedWorkspace({ name: "Strøm Mat & Bar", slug: "strom-mat-og-bar" });
    workspaceId = ws.workspace_id;
    const bar = await seedDepartment(workspaceId, { name: "Bar" });
    const kitchen = await seedDepartment(workspaceId, { name: "Kjøkken" });
    barDeptId = bar.department_id;
    await seedProfile(workspaceId, {
      display_name: "Henrik Bar",
      role: "employee",
      department_id: bar.department_id,
    });
    await seedProfile(workspaceId, {
      display_name: "Aisha Kitchen",
      role: "employee",
      department_id: kitchen.department_id,
    });
  });

  test.afterEach(async () => {
    await cleanupTestData(workspaceId);
  });

  test("manager publishes targeted announcement → DB has visibility_scope=targeted_members + non-empty target_profile_ids matching department", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page.getByRole("button", { name: /ny kunngjøring/i }).click();
    await page.getByLabel(/tittel/i).fill("Bar-only announcement");
    await page.getByLabel(/melding/i).fill("Only bar staff should see this.");

    await page.getByRole("tab", { name: /avdeling/i }).click();
    await page.getByRole("button", { name: /bar/i }).click();
    await expect(page.getByText(/ansatt.* vil få denne/i)).toBeVisible();
    await page.getByRole("button", { name: /publiser/i }).click();

    // Wait for either toast or feed render (the spec doesn't depend on workspace-context)
    await page.waitForTimeout(1200);

    // Service-role DB assertion: row exists with correct audience shape
    const { data: rows } = await supabase
      .from("channel_message")
      .select("content, visibility_scope, target_profile_ids, message_type, system_data")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .order("created_at", { ascending: false })
      .limit(1);

    const row = rows?.[0];
    expect(row).toBeDefined();
    expect(row?.content).toMatch(/Bar-only announcement/);
    expect(row?.visibility_scope).toBe("targeted_members");
    expect(Array.isArray(row?.target_profile_ids)).toBe(true);
    expect((row?.target_profile_ids as string[]).length).toBeGreaterThan(0);
    expect((row?.system_data as { audience_kind?: string } | null)?.audience_kind).toBe(
      "department",
    );

    // Cross-check: every profile_id in target list belongs to Bar department
    const { data: barProfiles } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .eq("department_id", barDeptId);
    const barIds = new Set((barProfiles ?? []).map((p) => p.profile_id));
    for (const targetId of row?.target_profile_ids as string[]) {
      expect(barIds.has(targetId)).toBe(true);
    }
  });

  test("manager publishes 'Alle' audience → DB has visibility_scope=all_members + null/empty target_profile_ids", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page.getByRole("button", { name: /ny kunngjøring/i }).click();
    await page.getByLabel(/tittel/i).fill("Whole-team announcement");
    await page.getByLabel(/melding/i).fill("Everyone reads this.");
    // 'Alle' is the default segment — no segment switch needed
    await page.getByRole("button", { name: /publiser/i }).click();
    await page.waitForTimeout(1200);

    const { data: rows } = await supabase
      .from("channel_message")
      .select("visibility_scope, target_profile_ids")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .order("created_at", { ascending: false })
      .limit(1);

    expect(rows?.[0]?.visibility_scope).toBe("all_members");
    // target_profile_ids is null OR empty array depending on Postgres handling
    const tpids = rows?.[0]?.target_profile_ids;
    expect(tpids === null || (Array.isArray(tpids) && tpids.length === 0)).toBe(true);
  });
});
