// =============================================================================
// sortie-a-d6-forgery-rejection.spec.ts
//
// Sortie A Phase 4 — D6 forgery-rejection via direct PostgREST
//
// Two tests assert that PostgREST + RLS rejects cross-workspace UPDATE
// attempts made with a JWT belonging to workspace_A against rows owned by
// workspace_B.
//
// Tables under test:
//   - shift_approval   (ADR-0298 §4.1 — WITH CHECK migration in W1)
//   - schedule_shift   (existing admin-OR-employee predicate, regression guard)
//
// Skip gate: test.skip(!process.env.LOCAL_SUPABASE)
//   This spec requires the Supabase local stack + direct PostgREST access.
//   It is NOT run in CI against Supabase Cloud.
//
// RLS block signal — PostgREST surfaces a USING-block as either:
//   a) 403 Forbidden  (42501 mapped by PostgREST)
//   b) 204 No Content with Content-Range: */0  (zero rows matched)
// Both are valid. We assert on whichever the local stack produces.
// A 200 OK with an updated row is an explicit FAILURE.
//
// ADR refs: ADR-0151, ADR-0298, ADR-0299.
// Spec ref:  docs/superpowers/specs/2026-05-13-sortie-a-d6-rls-hardening-design.md §7
// =============================================================================

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { seedWorkspace, seedProfile, seedShift, supabase } from "../helpers/seed";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// ---------------------------------------------------------------------------
// Auth helper — mint a real JWT for a seeded profile's auth user
// ---------------------------------------------------------------------------

async function mintJwtForUser(email: string, password: string): Promise<string | null> {
  if (!SUPABASE_ANON_KEY) return null;
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Seed a shift_approval for a given workspace + shift
// ---------------------------------------------------------------------------

async function seedShiftApproval(workspaceId: string, shiftId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  // daily_reconciliation is a required FK parent of shift_approval.
  // We need a department_id — seed a department on-the-fly.
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: dept, error: deptErr } = await supabase
    .from("department")
    .insert({
      workspace_id: workspaceId,
      name: `ForgerTest Dept ${suffix}`,
      slug: `forger-dept-${suffix}`,
      is_active: true,
    })
    .select("department_id")
    .single();
  if (deptErr || !dept)
    throw new Error(`seedShiftApproval (dept): ${deptErr?.message ?? "no row"}`);

  const { data: recon, error: reconErr } = await supabase
    .from("daily_reconciliation")
    .insert({
      workspace_id: workspaceId,
      department_id: dept.department_id,
      reconciliation_date: today,
      status: "open",
    })
    .select("reconciliation_id")
    .single();
  if (reconErr || !recon)
    throw new Error(`seedShiftApproval (recon): ${reconErr?.message ?? "no row"}`);

  const { data: approval, error: approvalErr } = await supabase
    .from("shift_approval")
    .insert({
      workspace_id: workspaceId,
      reconciliation_id: recon.reconciliation_id,
      shift_id: shiftId,
      status: "pending",
      planned_hours: 8,
    })
    .select("approval_id")
    .single();
  if (approvalErr || !approval)
    throw new Error(`seedShiftApproval (approval): ${approvalErr?.message ?? "no row"}`);

  return approval.approval_id;
}

// ---------------------------------------------------------------------------
// Assert an RLS block — accepts either PostgREST signal:
//   a) status in [400, 403]
//   b) status 204 with Content-Range containing "*/0"
//
// A 200 OK with a populated body is an explicit FAILURE — it means the
// cross-workspace write was accepted and RLS did not block it.
// ---------------------------------------------------------------------------

function assertRlsBlock(status: number, contentRange: string | null, responseBody: string): void {
  const isStatusBlock = status === 403 || status === 401 || status === 400;
  const isZeroRange = status === 204 && (contentRange ?? "").includes("*/0");

  if (!isStatusBlock && !isZeroRange) {
    // Surface the body so debugging is actionable without reading logs separately.
    throw new Error(
      `RLS did NOT block cross-workspace UPDATE. ` +
        `status=${status} Content-Range=${contentRange ?? "(none)"} body=${responseBody.slice(0, 200)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Sortie A: D6 forgery-rejection via direct PostgREST", () => {
  // Skip the entire suite when LOCAL_SUPABASE is not set.
  // This gate prevents accidental runs against Cloud or in CI without a
  // local stack. See spec §7.
  test.skip(!process.env.LOCAL_SUPABASE, "LOCAL_SUPABASE not set — skipping forgery suite");

  // IDs collected during seed — cleaned up afterAll in reverse FK order.
  const approvalIds: string[] = [];
  const reconIds: string[] = [];
  const shiftIds: string[] = [];
  const profileIds: string[] = [];
  const deptIds: string[] = [];
  const workspaceIds: string[] = [];
  const authUserIds: string[] = [];

  // Shared JWT for workspace_A employee — minted once, reused across tests.
  let workspaceAJwt: string | null = null;

  test.beforeAll(async () => {
    // Guard: both keys must be present for the suite to be useful.
    if (!SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      // Not skip — throw so the failure is loud. This is a config problem,
      // not an intended-skip scenario.
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY are required for sortie-a-d6-forgery-rejection",
      );
    }

    // ---------- Workspace A — the forger's workspace ----------
    const wsA = await seedWorkspace({ name: "ForgerTest WS-A" });
    workspaceIds.push(wsA.workspace_id);

    // Seed an auth user + profile in workspace_A.
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const emailA = `forger-a-${suffix}@smartout.local`;
    const passwordA = "test-password-1234";

    const { data: authA, error: authErrA } = await supabase.auth.admin.createUser({
      email: emailA,
      password: passwordA,
      email_confirm: true,
    });
    if (authErrA || !authA.user)
      throw new Error(`beforeAll auth.admin.createUser A: ${authErrA?.message}`);
    authUserIds.push(authA.user.id);

    const profileA = await seedProfile(wsA.workspace_id, {
      user_id: authA.user.id,
      role: "employee",
    });
    profileIds.push(profileA.profile_id);

    // Mint a real JWT for the workspace_A employee.
    workspaceAJwt = await mintJwtForUser(emailA, passwordA);
    if (!workspaceAJwt) throw new Error("beforeAll: could not mint JWT for workspace_A employee");

    // ---------- Workspace B — the victim workspace ----------
    const wsB = await seedWorkspace({ name: "ForgerTest WS-B" });
    workspaceIds.push(wsB.workspace_id);

    // Seed a shift in workspace_B (schedule_shift forgery target).
    const today = new Date().toISOString().slice(0, 10);
    const shiftB = await seedShift(wsB.workspace_id, {
      shift_date: today,
      start_time: "09:00",
      end_time: "17:00",
      status: "completed",
      is_published: true,
    });
    shiftIds.push(shiftB.schedule_shift_id);

    // Seed a shift_approval in workspace_B (shift_approval forgery target).
    // seedShiftApproval also seeds a department + daily_reconciliation inside WS-B.
    const approvalId = await seedShiftApproval(wsB.workspace_id, shiftB.schedule_shift_id);
    approvalIds.push(approvalId);
  });

  test.afterAll(async () => {
    // Reverse FK order: approval → reconciliation → shift → department → profile → workspace → auth user.
    if (approvalIds.length) {
      await supabase.from("shift_approval").delete().in("approval_id", approvalIds);
    }
    if (reconIds.length) {
      await supabase.from("daily_reconciliation").delete().in("reconciliation_id", reconIds);
    }
    // Also clean up reconciliations seeded inside seedShiftApproval (matched by workspace).
    // They have no tracked reconId — delete by workspace_id for the victim workspaces.
    // Safe: the victim workspaces are ephemeral (ForgerTest prefix).
    if (workspaceIds.length) {
      await supabase.from("daily_reconciliation").delete().in("workspace_id", workspaceIds);
      await supabase
        .from("department")
        .delete()
        .in("workspace_id", workspaceIds)
        .like("name", "ForgerTest Dept %");
    }
    if (shiftIds.length) {
      await supabase.from("schedule_shift").delete().in("schedule_shift_id", shiftIds);
    }
    if (profileIds.length) {
      await supabase.from("profile").delete().in("profile_id", profileIds);
    }
    for (const uid of authUserIds) {
      try {
        await supabase.auth.admin.deleteUser(uid);
      } catch {
        // best-effort — leftover auth rows are harmless for E2E
      }
    }
    if (workspaceIds.length) {
      await supabase.from("workspace").delete().in("workspace_id", workspaceIds);
    }
  });

  // --------------------------------------------------------------------------
  // T1: shift_approval — cross-workspace UPDATE must be rejected by RLS
  // --------------------------------------------------------------------------

  test("shift_approval: cross-workspace UPDATE with workspace_A JWT → RLS blocks", async () => {
    if (!workspaceAJwt) {
      test.skip(true, "workspace_A JWT not available");
      return;
    }

    const targetApprovalId = approvalIds[0];
    if (!targetApprovalId) {
      test.skip(true, "no shift_approval seeded for workspace_B");
      return;
    }

    // Direct PostgREST PATCH — bypass the BFF entirely.
    // The JWT carries workspace_A claims; the row belongs to workspace_B.
    const url = `${SUPABASE_URL}/rest/v1/shift_approval?approval_id=eq.${targetApprovalId}`;
    const resp = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${workspaceAJwt}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status: "approved" }),
    });

    const status = resp.status;
    const contentRange = resp.headers.get("Content-Range");
    const body = await resp.text();

    assertRlsBlock(status, contentRange, body);

    // Additional safeguard: confirm the DB row was NOT mutated.
    const { data: row } = await supabase
      .from("shift_approval")
      .select("status")
      .eq("approval_id", targetApprovalId)
      .single();
    expect(row?.status).toBe("pending");
  });

  // --------------------------------------------------------------------------
  // T2: schedule_shift — cross-workspace UPDATE must be rejected by RLS
  // --------------------------------------------------------------------------

  test("schedule_shift: cross-workspace UPDATE with workspace_A JWT → RLS blocks", async () => {
    if (!workspaceAJwt) {
      test.skip(true, "workspace_A JWT not available");
      return;
    }

    const targetShiftId = shiftIds[0];
    if (!targetShiftId) {
      test.skip(true, "no schedule_shift seeded for workspace_B");
      return;
    }

    // Direct PostgREST PATCH — bypass the BFF entirely.
    const url = `${SUPABASE_URL}/rest/v1/schedule_shift?schedule_shift_id=eq.${targetShiftId}`;
    const resp = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${workspaceAJwt}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ role: "FORGED_ROLE" }),
    });

    const status = resp.status;
    const contentRange = resp.headers.get("Content-Range");
    const body = await resp.text();

    assertRlsBlock(status, contentRange, body);

    // Additional safeguard: confirm the DB row was NOT mutated.
    const { data: row } = await supabase
      .from("schedule_shift")
      .select("role")
      .eq("schedule_shift_id", targetShiftId)
      .single();
    expect(row?.role).not.toBe("FORGED_ROLE");
  });
});
