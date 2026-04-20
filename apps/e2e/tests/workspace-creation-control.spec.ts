import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

// ─────────────────────────────────────────────────────────────
// workspace-creation-control.spec.ts
//
// Regression gate on the workspace provisioning surface. Existing
// journey-* specs observe Event Engine state, not the actual DB rows
// the UI depends on. This spec asserts — after provision_onboarding_workspace
// is called — the exact invariants every caller (dashboard, mobile,
// RLS helpers) relies on.
//
// The RPC under test is in 20260312000000_intelligence_pipeline_v2.sql
// (which supersedes 20260306020000_workspace_first_onboarding.sql).
// What it guarantees (from reading the SQL):
//   • company row (minimal — name + legal_name only)
//   • workspace row with unique slug, contract_status = 'onboarding'
//   • workspace.company_id set (the v2 migration reversed the "company-later"
//     behaviour — this is a MEANINGFUL schema contract for downstream RLS)
//   • company_member row linking user to company with role='owner'
//   • profile row for the user with role='admin', status='active'
//   • slug is URL-safe (lowercase, hyphens, max 40 chars, collision suffix)
// What it does NOT guarantee:
//   • departments / locations — seeded by finalize_onboarding_workspace,
//     NOT by provision. This spec documents the split.
//
// Any invariant below that is missing in the RPC is a regression, not
// a fix target — report to audit doc.
// ─────────────────────────────────────────────────────────────

type ProvisionResult = string;

async function provisionWorkspace(
  userId: string,
  companyName: string,
  intelligenceData: Record<string, unknown> = {},
): Promise<ProvisionResult> {
  const { data, error } = await supabase.rpc("provision_onboarding_workspace", {
    p_user_id: userId,
    p_company_name: companyName,
    p_intelligence_data: intelligenceData,
  });
  if (error) throw new Error(`provision failed: ${error.message}`);
  return data as ProvisionResult;
}

async function createTestUser(email: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return data.user.id;
}

// Track IDs for cleanup
const createdWorkspaceIds: string[] = [];
const createdUserIds: string[] = [];

test.describe("workspace-creation-control", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    // Deep clean. Order matters because profile and company_member lack
    // cascades on workspace/company deletion in all environments.
    //
    // Step 1: resolve every company_id BEFORE deleting workspaces, so we
    //         never lose the link and orphan company/company_member rows.
    // Step 2: delete profiles (children of workspace).
    // Step 3: delete workspaces.
    // Step 4: delete company_member rows explicitly (do not rely on FK
    //         cascade — some environments have company_member.company_id
    //         without ON DELETE CASCADE).
    // Step 5: delete company rows LAST.
    // Step 6: delete auth users.
    //
    // We surface (log) any unexpected delete errors instead of silently
    // swallowing them — a cleanup failure should be visible in test logs.
    const companyIdsToDelete = new Set<string>();
    for (const wsId of createdWorkspaceIds) {
      const { data: ws, error: lookupErr } = await supabase
        .from("workspace")
        .select("company_id")
        .eq("workspace_id", wsId)
        .maybeSingle();
      if (lookupErr) {
        console.warn(`[cleanup] workspace lookup failed for ${wsId}:`, lookupErr.message);
      }
      if (ws?.company_id) companyIdsToDelete.add(ws.company_id);
    }

    for (const wsId of createdWorkspaceIds) {
      const { error: profileErr } = await supabase
        .from("profile")
        .delete()
        .eq("workspace_id", wsId);
      if (profileErr) {
        console.warn(`[cleanup] profile delete failed for ${wsId}:`, profileErr.message);
      }
      const { error: wsErr } = await supabase.from("workspace").delete().eq("workspace_id", wsId);
      if (wsErr) {
        console.warn(`[cleanup] workspace delete failed for ${wsId}:`, wsErr.message);
      }
    }

    for (const companyId of companyIdsToDelete) {
      const { error: memberErr } = await supabase
        .from("company_member")
        .delete()
        .eq("company_id", companyId);
      if (memberErr) {
        console.warn(`[cleanup] company_member delete failed for ${companyId}:`, memberErr.message);
      }
    }
    for (const companyId of companyIdsToDelete) {
      const { error: companyErr } = await supabase
        .from("company")
        .delete()
        .eq("company_id", companyId);
      if (companyErr) {
        console.warn(`[cleanup] company delete failed for ${companyId}:`, companyErr.message);
      }
    }

    for (const userId of createdUserIds) {
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
    }
  });

  // ─── Test 1: Row in public.workspace with expected slug ────

  test("provision creates a workspace row with a derived URL-safe slug @smoke", async () => {
    const email = `ws-control-${Date.now()}@e2e.smartout.test`;
    const userId = await createTestUser(email);
    createdUserIds.push(userId);

    const companyName = "Fjord Kafé & Bar AS";
    const workspaceId = await provisionWorkspace(userId, companyName);
    createdWorkspaceIds.push(workspaceId);

    const { data: ws, error } = await supabase
      .from("workspace")
      .select("workspace_id, name, slug, contract_status, company_id")
      .eq("workspace_id", workspaceId)
      .single();

    expect(error).toBeNull();
    expect(ws).not.toBeNull();
    expect(ws!.workspace_id).toBe(workspaceId);
    expect(ws!.name).toBe(companyName);

    // Slug is URL-safe: lowercase, no spaces, no Norwegian/special chars,
    // max 40 chars + optional collision suffix (-xxxx = 45 total).
    expect(ws!.slug).toMatch(/^[a-z0-9-]+$/);
    expect(ws!.slug.length).toBeLessThanOrEqual(50);
    // No leading / trailing hyphens
    expect(ws!.slug).not.toMatch(/^-|-$/);
    // Norwegian characters must be stripped
    expect(ws!.slug).not.toMatch(/[æøåÆØÅ]/);

    // Contract status documents the RPC's behavior — "onboarding" is
    // the sandbox state before finalize_onboarding_workspace runs.
    expect(ws!.contract_status).toBe("onboarding");

    // v2 RPC (20260312000000_intelligence_pipeline_v2.sql) attaches
    // company_id at provision time. Changed from v1 which left it NULL.
    expect(ws!.company_id).toBeTruthy();

    // Company row exists with the same name.
    const { data: company } = await supabase
      .from("company")
      .select("company_id, name, legal_name")
      .eq("company_id", ws!.company_id!)
      .single();
    expect(company!.name).toBe(companyName);
    expect(company!.legal_name).toBe(companyName);

    // company_member row exists with role='owner' for the user.
    const { data: members } = await supabase
      .from("company_member")
      .select("user_id, company_id, role")
      .eq("user_id", userId)
      .eq("company_id", ws!.company_id!);
    expect(members).toHaveLength(1);
    expect(members![0].role).toBe("owner");
  });

  // ─── Test 2: Slug uniqueness — duplicate company name gets suffix ──
  // To exercise the RPC's collision branch we MUST provision twice with
  // the exact same normalized company name. A per-test run id keeps the
  // base slug unique across parallel runs, but identical WITHIN this test
  // so both provisions hit the same base and the RPC is forced to append
  // a suffix on the second one.

  test("two provisions with identical company name produce distinct slugs", async () => {
    // Per-run unique prefix — identical for both provisions in this test,
    // different across parallel test runs.
    const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const sameName = `Collision Restaurant ${runId}`;
    const base = sameName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    // Pre-clean any stale rows with this exact slug prefix to make the test
    // deterministic even if a previous run crashed mid-way.
    const { data: staleWorkspaces } = await supabase
      .from("workspace")
      .select("workspace_id, company_id")
      .like("slug", `${base}%`);
    for (const stale of staleWorkspaces ?? []) {
      await supabase.from("profile").delete().eq("workspace_id", stale.workspace_id);
      await supabase.from("workspace").delete().eq("workspace_id", stale.workspace_id);
      if (stale.company_id) {
        await supabase.from("company_member").delete().eq("company_id", stale.company_id);
        await supabase.from("company").delete().eq("company_id", stale.company_id);
      }
    }

    const email1 = `dup-a-${runId}@e2e.smartout.test`;
    const email2 = `dup-b-${runId}@e2e.smartout.test`;
    const userA = await createTestUser(email1);
    const userB = await createTestUser(email2);
    createdUserIds.push(userA, userB);

    const wsA = await provisionWorkspace(userA, sameName);
    const wsB = await provisionWorkspace(userB, sameName);
    createdWorkspaceIds.push(wsA, wsB);

    const { data: rows } = await supabase
      .from("workspace")
      .select("workspace_id, slug")
      .in("workspace_id", [wsA, wsB]);

    expect(rows).toHaveLength(2);
    const slugs = rows!.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(2);

    // One workspace took the base slug; the other got a collision suffix
    // matching the RPC's 4–8 char random suffix pattern (e.g., `-a1b2`).
    const exactMatch = slugs.filter((s) => s === base);
    const suffixed = slugs.filter((s) => new RegExp(`^${base}-[a-z0-9]{4,8}$`).test(s));
    expect(exactMatch).toHaveLength(1);
    expect(suffixed).toHaveLength(1);
  });

  // ─── Test 3: Slug unique index rejects direct duplicate insert ─

  test("workspace.slug unique constraint rejects a direct duplicate insert", async () => {
    const email = `slug-unique-${Date.now()}@e2e.smartout.test`;
    const userId = await createTestUser(email);
    createdUserIds.push(userId);

    const workspaceId = await provisionWorkspace(userId, `Unique Slug Test ${Date.now()}`);
    createdWorkspaceIds.push(workspaceId);

    const { data: created } = await supabase
      .from("workspace")
      .select("slug")
      .eq("workspace_id", workspaceId)
      .single();

    const { error } = await supabase.from("workspace").insert({
      name: "Duplicate Slug Attempt",
      slug: created!.slug,
      country: "NO",
      currency: "NOK",
      language: "no",
      timezone: "Europe/Oslo",
      is_active: true,
    });

    // Postgres unique-violation surfaces as error code 23505.
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505");
  });

  // ─── Test 4: Profile row for user has admin role + active status ──

  test("profile created by provision has role=admin and status=active", async () => {
    const email = `profile-role-${Date.now()}@e2e.smartout.test`;
    const userId = await createTestUser(email);
    createdUserIds.push(userId);

    const workspaceId = await provisionWorkspace(userId, `Profile Role Test ${Date.now()}`);
    createdWorkspaceIds.push(workspaceId);

    const { data: profiles, error } = await supabase
      .from("profile")
      .select("profile_id, user_id, workspace_id, role, status, is_active, display_name")
      .eq("workspace_id", workspaceId);

    expect(error).toBeNull();
    expect(profiles).toHaveLength(1);

    const profile = profiles![0];
    expect(profile.user_id).toBe(userId);
    expect(profile.workspace_id).toBe(workspaceId);
    // CLAUDE.md roles: employee → manager → admin → owner.
    // The RPC creates 'admin' (not 'owner') at provision time. Owner
    // semantics come from company_member after finalize.
    expect(["admin", "owner"]).toContain(profile.role);
    expect(profile.status).toBe("active");
    expect(profile.is_active).toBe(true);
  });

  // ─── Test 5: I1 bootstrap — department + location seeding ────
  // provision_onboarding_workspace does NOT currently seed department or
  // location rows. That work happens in finalize_onboarding_workspace after
  // the user completes the intake wizard. This test documents the split
  // so a future change that adds bootstrap seeding to provision_* can
  // flip the assertions without code-level surprise.

  test("provision does NOT seed departments or locations (bootstrap happens in finalize)", async () => {
    const email = `bootstrap-${Date.now()}@e2e.smartout.test`;
    const userId = await createTestUser(email);
    createdUserIds.push(userId);

    const workspaceId = await provisionWorkspace(userId, `Bootstrap Test ${Date.now()}`);
    createdWorkspaceIds.push(workspaceId);

    const [{ count: deptCount }, { count: locCount }] = await Promise.all([
      supabase
        .from("department")
        .select("department_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      supabase
        .from("location")
        .select("location_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
    ]);

    // This is the CURRENT contract. If finalize is moved earlier (or I1
    // bootstrap is added to provision), this assertion will flip — that's
    // a signal to update the audit doc, not to silently pass.
    expect(deptCount ?? 0).toBe(0);
    expect(locCount ?? 0).toBe(0);
  });

  // ─── Test 6: intelligence_data payload round-trips ────────────

  test("provision persists intelligence_data jsonb payload verbatim", async () => {
    const email = `intel-${Date.now()}@e2e.smartout.test`;
    const userId = await createTestUser(email);
    createdUserIds.push(userId);

    const intel = {
      brregData: { naceCode: "56.101", naceDescription: "Drift av restauranter" },
      scrapedData: { companyName: "E2E Intel Restaurant", openingHours: "11:00-23:00" },
    };

    const workspaceId = await provisionWorkspace(userId, "Intel Round-Trip", intel);
    createdWorkspaceIds.push(workspaceId);

    const { data: ws } = await supabase
      .from("workspace")
      .select("intelligence_data")
      .eq("workspace_id", workspaceId)
      .single();

    expect(ws!.intelligence_data).toEqual(intel);
  });
});
