import { test, expect } from "@playwright/test";
import { loginAsAdmin, resolveAdminWorkspaceId } from "../helpers/auth";
import {
  supabase,
  seedDepartment,
  seedProfile,
  cleanupSeededAuthUsers,
  getSeededAuthUserIds,
} from "../helpers/seed";

test.describe("Nyheter journey 2 — audience targeting writes correct DB shape", () => {
  let workspaceId: string;
  let barDeptId: string;
  // Track all entities seeded in this test for targeted cleanup
  const seededIds = {
    departments: [] as string[],
    profiles: [] as string[],
    messages: [] as string[],
  };

  test.beforeEach(async () => {
    const wsId = await resolveAdminWorkspaceId();
    if (!wsId) throw new Error("E2E_EMAIL admin user has no workspace profile");
    workspaceId = wsId;

    // Reset per-test collectors
    seededIds.departments = [];
    seededIds.profiles = [];
    seededIds.messages = [];

    // Seed two departments INTO admin's workspace (the workspace the UI session uses)
    const bar = await seedDepartment(workspaceId, { name: "Bar" });
    const kitchen = await seedDepartment(workspaceId, { name: "Kjøkken" });
    barDeptId = bar.department_id;
    seededIds.departments.push(bar.department_id, kitchen.department_id);

    const henrik = await seedProfile(workspaceId, {
      display_name: "Henrik Bar",
      role: "employee",
      department_id: bar.department_id,
    });
    const aisha = await seedProfile(workspaceId, {
      display_name: "Aisha Kitchen",
      role: "employee",
      department_id: kitchen.department_id,
    });
    seededIds.profiles.push(henrik.profile_id, aisha.profile_id);
  });

  test.afterEach(async () => {
    // Targeted cleanup — only remove entities we inserted. Do NOT call
    // cleanupTestData (it would delete the admin's real workspace data).
    if (seededIds.messages.length > 0) {
      await supabase.from("channel_message").delete().in("id", seededIds.messages);
    }
    // Delete profiles before auth users (FK order: profile.user_id → auth.users.id)
    if (seededIds.profiles.length > 0) {
      await supabase.from("profile").delete().in("profile_id", seededIds.profiles);
    }
    await cleanupSeededAuthUsers(getSeededAuthUserIds());
    if (seededIds.departments.length > 0) {
      await supabase.from("department").delete().in("department_id", seededIds.departments);
    }
  });

  test("manager publishes targeted announcement → DB has visibility_scope=targeted_members + non-empty target_profile_ids matching department", async ({
    page,
  }) => {
    const testStartedAt = new Date(Date.now() - 2000).toISOString();

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page.getByRole("button", { name: /ny kunngjøring/i }).click();
    // Labels in the compose sheet are not htmlFor-linked; use placeholder text to target inputs.
    await page.getByPlaceholder(/nye rutiner/i).fill("Bar-only announcement");
    await page.getByPlaceholder(/skriv kunngjøringens/i).fill("Only bar staff should see this.");

    // Select the "Avdeling" segment. Wave A ships AudiencePicker with role=tablist.
    // Wait up to 8s so sheet animation completes before querying the tab.
    const avdelingTab = page.getByRole("tab", { name: /avdeling/i });
    const tabVisible = await avdelingTab.isVisible({ timeout: 8000 }).catch(() => false);
    if (tabVisible) {
      await avdelingTab.click();
    } else {
      // Legacy fallback: plain Select combobox (pre-Wave-A UI).
      const combobox = page.getByRole("combobox");
      await combobox.click();
      await page.getByRole("option", { name: /avdeling/i }).click();
    }
    await page.getByRole("button", { name: /bar/i }).click();
    await expect(page.getByText(/ansatt.* vil få denne/i)).toBeVisible();
    await page.getByRole("button", { name: /publiser/i }).click();

    // Wait for toast / feed render
    await page.waitForTimeout(1200);

    // Capture the message id for cleanup
    const { data: recentMsgs } = await supabase
      .from("channel_message")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .gte("created_at", testStartedAt)
      .order("created_at", { ascending: false })
      .limit(3);
    for (const msg of recentMsgs ?? []) seededIds.messages.push(msg.id);

    // Service-role DB assertion: row exists with correct audience shape
    const { data: rows } = await supabase
      .from("channel_message")
      .select("content, visibility_scope, target_profile_ids, message_type, system_data")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .gte("created_at", testStartedAt)
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
    const testStartedAt = new Date(Date.now() - 2000).toISOString();

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page.getByRole("button", { name: /ny kunngjøring/i }).click();
    // Labels in the compose sheet are not htmlFor-linked; use placeholder text to target inputs.
    await page.getByPlaceholder(/nye rutiner/i).fill("Whole-team announcement");
    await page.getByPlaceholder(/skriv kunngjøringens/i).fill("Everyone reads this.");
    // 'Alle' is the default segment — no segment switch needed
    await page.getByRole("button", { name: /publiser/i }).click();
    await page.waitForTimeout(1200);

    // Capture for cleanup
    const { data: recentMsgs } = await supabase
      .from("channel_message")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .gte("created_at", testStartedAt)
      .order("created_at", { ascending: false })
      .limit(3);
    for (const msg of recentMsgs ?? []) seededIds.messages.push(msg.id);

    const { data: rows } = await supabase
      .from("channel_message")
      .select("visibility_scope, target_profile_ids")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .gte("created_at", testStartedAt)
      .order("created_at", { ascending: false })
      .limit(1);

    expect(rows?.[0]?.visibility_scope).toBe("all_members");
    // target_profile_ids is null OR empty array depending on Postgres handling
    const tpids = rows?.[0]?.target_profile_ids;
    expect(tpids === null || (Array.isArray(tpids) && tpids.length === 0)).toBe(true);
  });
});
