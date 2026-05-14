/**
 * Journey — court_order consent → trekk proposal (full happy path)
 *
 * End-to-end flow:
 *   Step 1 (admin): POST /api/payroll/consent-documents → court_order consent created
 *   Step 2 (manager): POST /api/payroll/propose-line-override → deduction proposal with
 *                      consent_document_id referencing the consent from Step 1
 *   Step 3: Assert change_proposal row persisted with correct consent_document_id FK
 *
 * This is an API-level test (no browser UI). The LineOverrideModal UI flow is tested
 * via the payroll E2E suite; this spec focuses on the two-API happy path and FK linkage.
 *
 * Prerequisites (seeded in beforeAll):
 *   - A payroll.period (open status) in HQ workspace
 *   - A schedule_shift in HQ workspace assigned to EMPLOYEE_PROFILE_ID
 *   - A payroll.calculation row linking period ↔ shift ↔ profile
 *   - A payroll.calculation_line row (the line to override)
 *
 * All fixtures are cleaned up in afterAll.
 *
 * ADR-0292: propose-line-override creates change_proposal (not direct calc write)
 * ADR-0311: deduction consent validated server-side before change_proposal INSERT
 * ADR-0151: workspace_id server-derived from JWT
 *
 * @see JOURNEY-sma-328-aml-14-15-trekk-consent-manager-applies-trekk-with-consent.md
 * @see PLAN-contracts-compliance-debt-cleanup.md Track B
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3060";

// Seed admin — owner in HQ workspace (from seed.sql)
const ADMIN_EMAIL = "admin@smartout.local";
const ADMIN_PASSWORD = "testpassword123";

// Seed manager — Erik Pedersen (f0000000-...002, role=manager, active in HQ workspace)
const MANAGER_EMAIL = "erik@smartout.local";
const MANAGER_PASSWORD = "testpassword123";

const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
// Anna Olsen — active employee in HQ workspace
const EMPLOYEE_PROFILE_ID = "f0000000-0000-0000-0000-000000000001";
// Erik Pedersen — manager in HQ workspace
const MANAGER_PROFILE_ID = "f0000000-0000-0000-0000-000000000002";
// Kitchen department (from seed.sql: d0000000-...001)
const KITCHEN_DEPT_ID = "d0000000-0000-0000-0000-000000000001";

const COURT_ORDER_REF = `UTL-E2E-TREKK-${Date.now()}`;

const adminClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// IDs created by beforeAll — cleaned up in afterAll
let seededShiftId: string | null = null;
let seededPeriodId: string | null = null;
let seededCalcId: string | null = null;
let seededCalcLineId: string | null = null;
let createdConsentDocumentId: string | null = null;
let createdProposalId: string | null = null;

async function getJwt(email: string, password: string): Promise<string> {
  const { data, error } = await adminClient.auth.signInWithPassword({ email, password });
  if (error ?? !data.session) {
    throw new Error(`Auth failed for ${email}: ${error?.message ?? "no session"}`);
  }
  return data.session.access_token;
}

test.describe("Journey — court_order consent → trekk proposal (happy path)", () => {
  test.beforeAll(async () => {
    // ── Step A: seed schedule_shift ─────────────────────────────────────────
    const { data: shift, error: shiftErr } = await adminClient
      .from("schedule_shift")
      .insert({
        workspace_id: HQ_WORKSPACE_ID,
        employee_id: EMPLOYEE_PROFILE_ID,
        shift_date: "2026-05-15",
        role: "Kokk",
        start_time: "08:00:00",
        end_time: "16:00:00",
        work_hours: 8,
        breaks: 30,
        day_category: "morning",
        status: "completed",
        is_published: true,
      })
      .select("schedule_shift_id")
      .single();

    if (shiftErr ?? !shift) {
      throw new Error(`Seed shift failed: ${shiftErr?.message ?? "no data"}`);
    }
    seededShiftId = shift.schedule_shift_id as string;

    // ── Step B: seed payroll.period ─────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: period, error: periodErr } = await (adminClient.schema("payroll") as any)
      .from("period")
      .insert({
        workspace_id: HQ_WORKSPACE_ID,
        start_date: "2026-05-01",
        end_date: "2026-05-31",
        status: "open",
      })
      .select("id")
      .single();

    if (periodErr ?? !period) {
      // Period may already exist (unique constraint). Try to find it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (adminClient.schema("payroll") as any)
        .from("period")
        .select("id")
        .eq("workspace_id", HQ_WORKSPACE_ID)
        .eq("start_date", "2026-05-01")
        .eq("end_date", "2026-05-31")
        .maybeSingle();
      if (!existing) {
        throw new Error(`Seed period failed: ${periodErr?.message ?? "no data"}`);
      }
      seededPeriodId = (existing as { id: string }).id;
    } else {
      seededPeriodId = (period as { id: string }).id;
    }

    // ── Step C: seed payroll.calculation ───────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: calc, error: calcErr } = await (adminClient.schema("payroll") as any)
      .from("calculation")
      .insert({
        workspace_id: HQ_WORKSPACE_ID,
        period_id: seededPeriodId,
        schedule_shift_id: seededShiftId,
        profile_id: EMPLOYEE_PROFILE_ID,
        shift_date: "2026-05-15",
        scheduled_start: "2026-05-15T08:00:00+02:00",
        scheduled_end: "2026-05-15T16:00:00+02:00",
        gross_minutes: 480,
        break_minutes_paid: 0,
        break_minutes_unpaid: 30,
        net_working_minutes: 450,
        base_rate: 200.0,
        base_pay: 1500.0,
        total_supplements: 0,
        total_deductions: 0,
        total_pay: 1500.0,
        calculation_version: 1,
      })
      .select("id")
      .single();

    if (calcErr ?? !calc) {
      throw new Error(`Seed calculation failed: ${calcErr?.message ?? "no data"}`);
    }
    seededCalcId = (calc as { id: string }).id;

    // ── Step D: seed payroll.calculation_line ──────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: calcLine, error: calcLineErr } = await (adminClient.schema("payroll") as any)
      .from("calculation_line")
      .insert({
        workspace_id: HQ_WORKSPACE_ID,
        calculation_id: seededCalcId,
        salary_code: "100",
        line_type: "base",
        description: "Grunnlønn",
        hours: 7.5,
        rate: 200.0,
        amount: 1500.0,
      })
      .select("id")
      .single();

    if (calcLineErr ?? !calcLine) {
      throw new Error(`Seed calculation_line failed: ${calcLineErr?.message ?? "no data"}`);
    }
    seededCalcLineId = (calcLine as { id: string }).id;
  });

  test.afterAll(async () => {
    // Cleanup in dependency order (deepest FK first)
    if (createdProposalId) {
      await adminClient
        .from("change_proposal")
        .delete()
        .eq("change_proposal_id", createdProposalId);
    }
    if (createdConsentDocumentId) {
      // Remove any remaining proposals referencing this consent
      await adminClient
        .from("change_proposal")
        .delete()
        .eq("consent_document_id", createdConsentDocumentId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.schema("payroll") as any)
        .from("consent_document")
        .delete()
        .eq("consent_document_id", createdConsentDocumentId);
    }
    if (seededCalcLineId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.schema("payroll") as any)
        .from("calculation_line")
        .delete()
        .eq("id", seededCalcLineId);
    }
    if (seededCalcId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.schema("payroll") as any)
        .from("calculation")
        .delete()
        .eq("id", seededCalcId);
    }
    // Only delete the period if we created it (avoid breaking shared period)
    if (seededPeriodId) {
      // Check no other calculations reference it before deleting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (adminClient.schema("payroll") as any)
        .from("calculation")
        .select("id", { count: "exact", head: true })
        .eq("period_id", seededPeriodId);
      if ((count ?? 0) === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient.schema("payroll") as any)
          .from("period")
          .delete()
          .eq("id", seededPeriodId)
          .eq("workspace_id", HQ_WORKSPACE_ID);
      }
    }
    if (seededShiftId) {
      await adminClient.from("schedule_shift").delete().eq("schedule_shift_id", seededShiftId);
    }
  });

  // ── Test 1: Admin creates court_order consent ────────────────────────────
  test("Step 1 — admin creates court_order consent → 201 + consentDocumentId", async () => {
    const jwt = await getJwt(ADMIN_EMAIL, ADMIN_PASSWORD);

    const res = await fetch(`${BASE_URL}/api/payroll/consent-documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        employeeProfileId: EMPLOYEE_PROFILE_ID,
        consentType: "court_order",
        courtOrderReference: COURT_ORDER_REF,
        signedAt: "2026-05-14T10:00:00Z",
        signedDocumentUrl: "https://example.com/e2e-trekk-court-order.pdf",
      }),
    });

    expect(res.status).toBe(201);

    const body = (await res.json()) as { ok: boolean; consentDocumentId: string };
    expect(body.ok).toBe(true);
    expect(typeof body.consentDocumentId).toBe("string");

    createdConsentDocumentId = body.consentDocumentId;
  });

  // ── Test 2: Manager proposes trekk with court_order consent ──────────────
  test("Step 2 — manager proposes trekk deduction with consent_document_id → 200", async () => {
    // Depends on Step 1 capturing createdConsentDocumentId and seededPeriodId.
    if (!createdConsentDocumentId || !seededPeriodId || !seededCalcLineId) {
      test.skip();
      return;
    }

    const jwt = await getJwt(MANAGER_EMAIL, MANAGER_PASSWORD);

    const res = await fetch(`${BASE_URL}/api/payroll/propose-line-override`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        workspace_id: HQ_WORKSPACE_ID,
        period_id: seededPeriodId,
        calculation_line_id: seededCalcLineId,
        proposed_amount: -500, // negative = trekk
        reason: "Lovpålagt utleggstrekk per namsmannens ordre",
        category: "deduction",
        consent_document_id: createdConsentDocumentId,
        deduction_type: "court_order",
      }),
    });

    const responseBody = (await res.json()) as {
      ok: boolean;
      change_proposal_id?: string;
      error?: string;
    };
    // Accept both 200 and possible failure scenarios: if period constraints differ, log the error
    if (res.status !== 200) {
      // Log for debugging — don't fail silently
      console.error(
        `[journey-court-order-then-trekk] propose-line-override failed: ${res.status} — ${JSON.stringify(responseBody)}`,
      );
    }
    expect(res.status).toBe(200);
    expect(responseBody.ok).toBe(true);
    expect(typeof responseBody.change_proposal_id).toBe("string");

    createdProposalId = responseBody.change_proposal_id ?? null;
  });

  // ── Test 3: DB row has correct consent_document_id FK linkage ────────────
  test("Step 3 — change_proposal row has consent_document_id FK linking to step 1 consent", async () => {
    if (!createdProposalId || !createdConsentDocumentId) {
      test.skip();
      return;
    }

    const { data, error } = await adminClient
      .from("change_proposal")
      .select("change_proposal_id, consent_document_id, deduction_type, kind, status")
      .eq("change_proposal_id", createdProposalId)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const row = data as {
      change_proposal_id: string;
      consent_document_id: string | null;
      deduction_type: string | null;
      kind: string;
      status: string;
    };

    // FK linkage: consent_document_id must match the consent from Step 1
    expect(row.consent_document_id).toBe(createdConsentDocumentId);
    expect(row.deduction_type).toBe("court_order");
    expect(row.kind).toBe("wage_line_override");
    expect(row.status).toBe("pending");
  });
});
