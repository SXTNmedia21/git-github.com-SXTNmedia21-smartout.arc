/**
 * HTTP-route integration tests for the observer_request API (Task 14B).
 *
 * These tests exercise the actual Next.js routes (POST /api/observer-requests
 * and PATCH /api/observer-requests/[id]) through Playwright's request client.
 * They replace the earlier spec that bypassed the routes by writing directly
 * to Supabase with the service role (council BLOCKER #4).
 *
 * Scenarios covered:
 *   - POST 201 happy path (owner/admin acting, valid assignment in workspace)
 *   - POST 401 unauthenticated
 *   - POST 403 role below manager (employee)
 *   - POST 404 assignment in a different workspace
 *   - POST 400 Zod validation (invalid UUID)
 *   - PATCH claim → 200; PATCH approve (non-four_eyes) → 200
 *   - PATCH approve on four_eyes-tier protocol → 202 with change_proposal_id
 *   - PATCH reject → 200 with notes
 *
 * Fixtures are seeded via the service role client and cleaned up after each
 * run. This file lives in apps/e2e/governance-training-mvp/ per the task
 * directive; run it with an explicit path:
 *   pnpm exec playwright test governance-training-mvp/observer-request.spec.ts
 */

import { test, expect, request as pwRequest } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function serviceClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for observer_request spec");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Fixture = {
  workspaceId: string;
  otherWorkspaceId: string;
  subjectProfileId: string;
  assignmentQuiz: string; // non-four_eyes tier
  assignmentFourEyes: string; // four_eyes tier
  otherWorkspaceAssignmentId: string; // assignment in different workspace
  createdIds: {
    protocolIds: string[];
    assignmentIds: string[];
    profileIds: string[];
    workspaceIds: string[];
    observerRequestIds: string[];
    changeProposalIds: string[];
    authorityConfigKeys: Array<{ workspace_id: string; capability: string }>;
  };
};

async function seedAuthority(
  db: SupabaseClient,
  workspaceId: string,
  ownerProfileId: string,
  fixture: Fixture,
) {
  const caps: Array<{ capability: string; requires_four_eyes: boolean }> = [
    { capability: "observer_request.create", requires_four_eyes: false },
    { capability: "observer_request.claim", requires_four_eyes: false },
    { capability: "observer_request.approve", requires_four_eyes: false },
  ];
  for (const { capability, requires_four_eyes } of caps) {
    await db.from("engine_authority_config").upsert(
      {
        workspace_id: workspaceId,
        capability,
        level: "confirm",
        min_role: "manager",
        requires_four_eyes,
        updated_by: ownerProfileId,
      },
      { onConflict: "workspace_id,capability" },
    );
    fixture.createdIds.authorityConfigKeys.push({ workspace_id: workspaceId, capability });
  }
}

async function makeProtocol(
  db: SupabaseClient,
  workspaceId: string,
  tier: "quiz" | "four_eyes",
  fixture: Fixture,
): Promise<string> {
  const { data, error } = await db
    .from("protocol")
    .insert({
      workspace_id: workspaceId,
      name: `Test protocol ${tier} ${Date.now()}`,
      evidence_tier: tier,
    })
    .select("protocol_id")
    .single();
  if (error || !data) throw new Error(`seed protocol failed: ${error?.message}`);
  fixture.createdIds.protocolIds.push(data.protocol_id as string);
  return data.protocol_id as string;
}

async function makeAssignment(
  db: SupabaseClient,
  workspaceId: string,
  protocolId: string,
  profileId: string,
  fixture: Fixture,
): Promise<string> {
  const { data, error } = await db
    .from("protocol_assignment")
    .insert({
      workspace_id: workspaceId,
      protocol_id: protocolId,
      profile_id: profileId,
      status: "not_started",
    })
    .select("assignment_id")
    .single();
  if (error || !data) throw new Error(`seed assignment failed: ${error?.message}`);
  fixture.createdIds.assignmentIds.push(data.assignment_id as string);
  return data.assignment_id as string;
}

async function resolveFixture(db: SupabaseClient): Promise<Fixture> {
  // Use existing admin workspace from seed data.
  const { data: workspace, error: wsErr } = await db
    .from("workspace")
    .select("workspace_id")
    .limit(1)
    .single();
  if (wsErr || !workspace) throw new Error("no seeded workspace available for e2e");

  // Find the owner profile used by loginAsAdmin. Default seed email is admin@smartout.local.
  const adminEmail = process.env.E2E_EMAIL ?? "admin@smartout.local";
  const { data: adminUser } = await db.auth.admin
    .listUsers({ page: 1, perPage: 200 })
    .then((r) => ({ data: r.data?.users?.find((u) => u.email === adminEmail) ?? null }));
  if (!adminUser) throw new Error(`admin user ${adminEmail} not found — seed required`);

  const { data: ownerProfile } = await db
    .from("profile")
    .select("profile_id")
    .eq("user_id", adminUser.id)
    .eq("workspace_id", workspace.workspace_id)
    .single();
  if (!ownerProfile) throw new Error("admin profile not found in seeded workspace");

  // Second workspace for the cross-workspace 404 case.
  const { data: otherWorkspace, error: owsErr } = await db
    .from("workspace")
    .insert({ name: `e2e-other-${Date.now()}`, slug: `e2e-other-${Date.now()}` })
    .select("workspace_id")
    .single();
  if (owsErr || !otherWorkspace) throw new Error(`seed other workspace failed: ${owsErr?.message}`);

  const fixture: Fixture = {
    workspaceId: workspace.workspace_id as string,
    otherWorkspaceId: otherWorkspace.workspace_id as string,
    subjectProfileId: "",
    assignmentQuiz: "",
    assignmentFourEyes: "",
    otherWorkspaceAssignmentId: "",
    createdIds: {
      protocolIds: [],
      assignmentIds: [],
      profileIds: [],
      workspaceIds: [otherWorkspace.workspace_id as string],
      observerRequestIds: [],
      changeProposalIds: [],
      authorityConfigKeys: [],
    },
  };

  // Subject profile in the main workspace (reuse the admin profile as subject — the
  // API only checks workspace membership of subject_profile_id, not role).
  fixture.subjectProfileId = ownerProfile.profile_id as string;

  // Seed authority config so gate_action enforces min_role=manager.
  await seedAuthority(db, fixture.workspaceId, ownerProfile.profile_id as string, fixture);

  // Protocols + assignments in main workspace.
  const quizProto = await makeProtocol(db, fixture.workspaceId, "quiz", fixture);
  fixture.assignmentQuiz = await makeAssignment(
    db,
    fixture.workspaceId,
    quizProto,
    ownerProfile.profile_id as string,
    fixture,
  );

  const feProto = await makeProtocol(db, fixture.workspaceId, "four_eyes", fixture);
  fixture.assignmentFourEyes = await makeAssignment(
    db,
    fixture.workspaceId,
    feProto,
    ownerProfile.profile_id as string,
    fixture,
  );

  // Also set requires_four_eyes=true on the approve capability. The route keys
  // on reason='four_eyes_required' AND protocol.evidence_tier='four_eyes', so
  // both conditions must hold for the 202 branch.
  await db
    .from("engine_authority_config")
    .update({ requires_four_eyes: true })
    .eq("workspace_id", fixture.workspaceId)
    .eq("capability", "observer_request.approve");

  // Assignment in OTHER workspace for cross-workspace 404 test. We need a
  // profile in the other workspace to satisfy protocol_assignment FK.
  const { data: otherProfile, error: opfErr } = await db
    .from("profile")
    .insert({
      workspace_id: otherWorkspace.workspace_id as string,
      user_id: adminUser.id,
      role: "employee",
      first_name: "Other",
      last_name: "Test",
    })
    .select("profile_id")
    .single();
  if (opfErr || !otherProfile) throw new Error(`seed other profile failed: ${opfErr?.message}`);
  fixture.createdIds.profileIds.push(otherProfile.profile_id as string);

  const otherProto = await makeProtocol(db, otherWorkspace.workspace_id as string, "quiz", fixture);
  fixture.otherWorkspaceAssignmentId = await makeAssignment(
    db,
    otherWorkspace.workspace_id as string,
    otherProto,
    otherProfile.profile_id as string,
    fixture,
  );

  return fixture;
}

async function cleanupFixture(db: SupabaseClient, fixture: Fixture) {
  if (fixture.createdIds.observerRequestIds.length > 0) {
    await db
      .from("observer_request")
      .delete()
      .in("observer_request_id", fixture.createdIds.observerRequestIds);
  }
  if (fixture.createdIds.changeProposalIds.length > 0) {
    await db
      .from("change_proposal")
      .delete()
      .in("change_proposal_id", fixture.createdIds.changeProposalIds);
  }
  if (fixture.createdIds.assignmentIds.length > 0) {
    await db
      .from("protocol_assignment")
      .delete()
      .in("assignment_id", fixture.createdIds.assignmentIds);
  }
  if (fixture.createdIds.protocolIds.length > 0) {
    await db.from("protocol").delete().in("protocol_id", fixture.createdIds.protocolIds);
  }
  for (const { workspace_id, capability } of fixture.createdIds.authorityConfigKeys) {
    await db
      .from("engine_authority_config")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("capability", capability);
  }
  if (fixture.createdIds.profileIds.length > 0) {
    await db.from("profile").delete().in("profile_id", fixture.createdIds.profileIds);
  }
  if (fixture.createdIds.workspaceIds.length > 0) {
    await db.from("workspace").delete().in("workspace_id", fixture.createdIds.workspaceIds);
  }
}

test.describe("observer_request API routes", () => {
  let fixture: Fixture;
  let db: SupabaseClient;

  test.beforeAll(async () => {
    db = serviceClient();
    fixture = await resolveFixture(db);
  });

  test.afterAll(async () => {
    if (fixture) await cleanupFixture(db, fixture);
  });

  test("POST 201 happy path (admin creates)", async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.request.post("/api/observer-requests", {
      data: {
        workspace_id: fixture.workspaceId,
        protocol_assignment_id: fixture.assignmentQuiz,
        subject_profile_id: fixture.subjectProfileId,
        notes: "happy path",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.observer_request_id).toBeTruthy();
    fixture.createdIds.observerRequestIds.push(body.observer_request_id);
  });

  test("POST 401 unauthenticated", async () => {
    const anon = await pwRequest.newContext();
    const res = await anon.post("/api/observer-requests", {
      data: {
        workspace_id: fixture.workspaceId,
        protocol_assignment_id: fixture.assignmentQuiz,
        subject_profile_id: fixture.subjectProfileId,
      },
    });
    expect(res.status()).toBe(401);
    await anon.dispose();
  });

  test("POST 403 role below manager (employee)", async ({ page }) => {
    await loginAsEmployee(page);
    const res = await page.request.post("/api/observer-requests", {
      data: {
        workspace_id: fixture.workspaceId,
        protocol_assignment_id: fixture.assignmentQuiz,
        subject_profile_id: fixture.subjectProfileId,
      },
    });
    expect(res.status()).toBe(403);
  });

  test("POST 404 assignment in different workspace", async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.request.post("/api/observer-requests", {
      data: {
        workspace_id: fixture.workspaceId,
        protocol_assignment_id: fixture.otherWorkspaceAssignmentId,
        subject_profile_id: fixture.subjectProfileId,
      },
    });
    expect(res.status()).toBe(404);
  });

  test("POST 400 Zod validation fails on invalid UUID", async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.request.post("/api/observer-requests", {
      data: {
        workspace_id: "not-a-uuid",
        protocol_assignment_id: fixture.assignmentQuiz,
        subject_profile_id: fixture.subjectProfileId,
      },
    });
    expect(res.status()).toBe(400);
  });

  test("PATCH claim then approve (non-four_eyes)", async ({ page }) => {
    await loginAsAdmin(page);
    const createRes = await page.request.post("/api/observer-requests", {
      data: {
        workspace_id: fixture.workspaceId,
        protocol_assignment_id: fixture.assignmentQuiz,
        subject_profile_id: fixture.subjectProfileId,
      },
    });
    expect(createRes.status()).toBe(201);
    const { observer_request_id } = await createRes.json();
    fixture.createdIds.observerRequestIds.push(observer_request_id);

    const claimRes = await page.request.patch(
      `/api/observer-requests/${observer_request_id}?action=claim`,
      { data: {} },
    );
    expect(claimRes.status()).toBe(200);
    expect((await claimRes.json()).status).toBe("claimed");

    const approveRes = await page.request.patch(
      `/api/observer-requests/${observer_request_id}?action=approve`,
      { data: { notes: "looks good" } },
    );
    expect(approveRes.status()).toBe(200);
    expect((await approveRes.json()).status).toBe("approved");
  });

  test("PATCH approve on four_eyes tier → 202 with change_proposal_id", async ({ page }) => {
    await loginAsAdmin(page);
    const createRes = await page.request.post("/api/observer-requests", {
      data: {
        workspace_id: fixture.workspaceId,
        protocol_assignment_id: fixture.assignmentFourEyes,
        subject_profile_id: fixture.subjectProfileId,
      },
    });
    expect(createRes.status()).toBe(201);
    const { observer_request_id } = await createRes.json();
    fixture.createdIds.observerRequestIds.push(observer_request_id);

    await page.request.patch(`/api/observer-requests/${observer_request_id}?action=claim`, {
      data: {},
    });

    const approveRes = await page.request.patch(
      `/api/observer-requests/${observer_request_id}?action=approve`,
      { data: {} },
    );
    expect(approveRes.status()).toBe(202);
    const body = await approveRes.json();
    expect(body.change_proposal_id).toBeTruthy();
    expect(body.four_eyes_required).toBe(true);
    fixture.createdIds.changeProposalIds.push(body.change_proposal_id);
  });

  test("PATCH reject → 200 with notes", async ({ page }) => {
    await loginAsAdmin(page);
    const createRes = await page.request.post("/api/observer-requests", {
      data: {
        workspace_id: fixture.workspaceId,
        protocol_assignment_id: fixture.assignmentQuiz,
        subject_profile_id: fixture.subjectProfileId,
      },
    });
    const { observer_request_id } = await createRes.json();
    fixture.createdIds.observerRequestIds.push(observer_request_id);

    const rejectRes = await page.request.patch(
      `/api/observer-requests/${observer_request_id}?action=reject`,
      { data: { notes: "insufficient evidence" } },
    );
    expect(rejectRes.status()).toBe(200);
    const body = await rejectRes.json();
    expect(body.status).toBe("rejected");
  });
});
