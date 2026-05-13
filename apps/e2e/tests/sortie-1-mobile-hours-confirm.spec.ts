// =============================================================================
// sortie-1-mobile-hours-confirm.spec.ts
//
// Sortie 1 Phase 11 — Happy-path E2E for:
//   PATCH /api/mobile/shift-approvals/[id]/confirm
//
// Three tests (happy + forgeable-body 422 + no-bearer 401).
//
// Auth: Bearer JWT obtained via Supabase signInWithPassword for
//       admin@smartout.local (SEED_PROFILE_ID, role=admin).
//
// DB verify:
//   shift_approval.status = 'approved' + .approved_by = actor profile_id
//
// Telemetry verify:
//   activity_trail row with event='hours confirmed' + actor_id +
//   entity_type='shift_approval'. Poll up to 20s (fire-and-forget emit).
//
// Seed chain (FK depth):
//   schedule_shift → daily_reconciliation → shift_approval.
//   actor role = admin satisfies isManager guard in confirmHoursAction.
//   Cleaned up afterAll in reverse FK order.
//
// ADR refs: ADR-0132, ADR-0134, ADR-0151, ADR-0298.
// =============================================================================

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  SEED_PROFILE_ID,
  SEED_WORKSPACE_ID,
  assertActivityTrailEvent,
} from "../helpers/botsson-harness";
import { supabase } from "../helpers/seed";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ADMIN_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const ADMIN_PASSWORD = process.env.E2E_PASSWORD ?? "password123";
const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT) || 3060;
const BFF_BASE = `http://127.0.0.1:${E2E_WEB_PORT}`;

const SEED_DEPARTMENT_ID = "d0000000-0000-0000-0000-000000000000";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAdminBearerToken(): Promise<string | null> {
  if (!SERVICE_ROLE_KEY) return null;
  try {
    const anon = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error || !data.session) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Seed a schedule_shift. Returns schedule_shift_id.
 * employee_id = SEED_PROFILE_ID so actor owns the shift (isOwner path).
 * Actor is also admin so isManager = true — either path satisfies auth.
 */
async function seedShift(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("schedule_shift")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      shift_date: today,
      start_time: "10:00",
      end_time: "18:00",
      employee_id: SEED_PROFILE_ID,
      day_category: "afternoon",
      role: "server",
      status: "completed",
      is_published: true,
    })
    .select("schedule_shift_id")
    .single();
  if (error || !data) throw new Error(`seedShift failed: ${error?.message ?? "no data"}`);
  return data.schedule_shift_id;
}

/**
 * Seed a daily_reconciliation for the seeded shift's date.
 * Required FK parent of shift_approval.
 */
async function seedReconciliation(shiftDate: string): Promise<string> {
  const { data, error } = await supabase
    .from("daily_reconciliation")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      department_id: SEED_DEPARTMENT_ID,
      reconciliation_date: shiftDate,
      status: "open",
    })
    .select("reconciliation_id")
    .single();
  if (error || !data) {
    throw new Error(`seedReconciliation failed: ${error?.message ?? "no data"}`);
  }
  return data.reconciliation_id;
}

/**
 * Seed a shift_approval linking reconciliation → shift.
 * Returns approval_id (PK used in BFF path param).
 */
async function seedShiftApproval(reconciliationId: string, shiftId: string): Promise<string> {
  const { data, error } = await supabase
    .from("shift_approval")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      reconciliation_id: reconciliationId,
      shift_id: shiftId,
      status: "pending",
      planned_hours: 8,
    })
    .select("approval_id")
    .single();
  if (error || !data) {
    throw new Error(`seedShiftApproval failed: ${error?.message ?? "no data"}`);
  }
  return data.approval_id;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Sortie 1: PATCH /api/mobile/shift-approvals/[id]/confirm", () => {
  let bearerToken: string | null = null;

  // Track created IDs for cleanup (reverse FK order).
  const approvalIds: string[] = [];
  const reconciliationIds: string[] = [];
  const shiftIds: string[] = [];

  test.beforeAll(async () => {
    bearerToken = await getAdminBearerToken();
  });

  test.afterAll(async () => {
    // Cleanup in reverse FK depth: approval → reconciliation → shift.
    if (approvalIds.length) {
      await supabase.from("shift_approval").delete().in("approval_id", approvalIds);
    }
    if (reconciliationIds.length) {
      await supabase
        .from("daily_reconciliation")
        .delete()
        .in("reconciliation_id", reconciliationIds);
    }
    if (shiftIds.length) {
      await supabase.from("schedule_shift").delete().in("schedule_shift_id", shiftIds);
    }
  });

  // --------------------------------------------------------------------------
  // T1: Happy path — 200 + DB mutation + telemetry
  // --------------------------------------------------------------------------

  test("happy path: valid Bearer + pending approval → 200 + status=approved + activity_trail", async ({
    request,
  }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const sinceIso = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const shiftId = await seedShift();
    shiftIds.push(shiftId);

    const reconciliationId = await seedReconciliation(today);
    reconciliationIds.push(reconciliationId);

    const approvalId = await seedShiftApproval(reconciliationId, shiftId);
    approvalIds.push(approvalId);

    const response = await request.patch(
      `${BFF_BASE}/api/mobile/shift-approvals/${approvalId}/confirm`,
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        data: {},
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.approvalId).toBe(approvalId);

    // Verify DB mutation.
    const { data: row } = await supabase
      .from("shift_approval")
      .select("status, approved_by")
      .eq("approval_id", approvalId)
      .single();
    expect(row?.status).toBe("approved");
    expect(row?.approved_by).toBe(SEED_PROFILE_ID);

    // Verify telemetry — poll up to 20s.
    await assertActivityTrailEvent({
      event: "hours confirmed",
      workspaceId: SEED_WORKSPACE_ID,
      actorId: SEED_PROFILE_ID,
      sinceIso,
      poll: { timeoutMs: 20_000 },
    });
  });

  // --------------------------------------------------------------------------
  // T2: Forgeable body → 422
  // --------------------------------------------------------------------------

  test("forgeable body field → 422, status not mutated", async ({ request }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const shiftId = await seedShift();
    shiftIds.push(shiftId);

    const reconciliationId = await seedReconciliation(today);
    reconciliationIds.push(reconciliationId);

    const approvalId = await seedShiftApproval(reconciliationId, shiftId);
    approvalIds.push(approvalId);

    const response = await request.patch(
      `${BFF_BASE}/api/mobile/shift-approvals/${approvalId}/confirm`,
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        // workspace_id is a forbidden body field.
        data: { workspace_id: "00000000-0000-0000-0000-00000000DEAD" },
      },
    );

    expect(response.status()).toBe(422);

    // Verify DB NOT mutated.
    const { data: row } = await supabase
      .from("shift_approval")
      .select("status")
      .eq("approval_id", approvalId)
      .single();
    expect(row?.status).not.toBe("approved");
  });

  // --------------------------------------------------------------------------
  // T3: Missing Bearer → 401
  // --------------------------------------------------------------------------

  test("missing Bearer → 401", async ({ request }) => {
    const fakeApprovalId = "00000000-0000-0000-0000-000000000001";

    const response = await request.patch(
      `${BFF_BASE}/api/mobile/shift-approvals/${fakeApprovalId}/confirm`,
      {
        data: {},
      },
    );

    expect(response.status()).toBe(401);
  });
});
