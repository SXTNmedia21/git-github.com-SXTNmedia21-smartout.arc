/**
 * Journey — Admin creates court_order consent (happy path)
 *
 * Tests that POST /api/payroll/consent-documents accepts a valid court_order
 * request, returns 201 + consentDocumentId, and the row is persisted in
 * payroll.consent_document with:
 *   - consent_type = 'court_order'
 *   - docuseal_submission_id IS NULL (no DocuSeal envelope needed)
 *   - court_order_reference matching the request body
 *
 * ADR-0311: court_order is the only consent type accepted by this endpoint.
 * ADR-0151: workspace_id server-derived from JWT, never from request body.
 *
 * @see JOURNEY-sma-328-aml-14-15-trekk-consent-manager-applies-trekk-with-consent.md
 * @see PLAN-contracts-compliance-debt-cleanup.md Track B
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3060";

// Seed admin from seed.sql (workspace_id = HQ, role = owner)
const ADMIN_EMAIL = "admin@smartout.local";
const ADMIN_PASSWORD = "testpassword123";
const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
// Anna Olsen (f0000000-...001) is an active employee in HQ workspace
const EMPLOYEE_PROFILE_ID = "f0000000-0000-0000-0000-000000000001";

const COURT_ORDER_REF = `UTL-E2E-CREATE-${Date.now()}`;

const adminClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let createdConsentDocumentId: string | null = null;

async function getAdminJwt(): Promise<string> {
  const { data, error } = await adminClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error ?? !data.session) {
    throw new Error(`Auth failed for ${ADMIN_EMAIL}: ${error?.message ?? "no session"}`);
  }
  return data.session.access_token;
}

test.describe("Journey — Admin creates court_order consent (happy path)", () => {
  test.afterAll(async () => {
    // Cleanup: delete the created consent_document row.
    // Uses service_role (postgres) to bypass RLS.
    if (createdConsentDocumentId) {
      // Must first delete any change_proposal rows referencing this consent
      // (FK RESTRICT on change_proposal.consent_document_id prevents direct delete).
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
  });

  test("POST /api/payroll/consent-documents returns 201 + consentDocumentId", async () => {
    const jwt = await getAdminJwt();

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
        signedDocumentUrl: "https://example.com/e2e-court-order.pdf",
      }),
    });

    expect(res.status).toBe(201);

    const body = (await res.json()) as { ok: boolean; consentDocumentId: string };
    expect(body.ok).toBe(true);
    expect(typeof body.consentDocumentId).toBe("string");
    expect(body.consentDocumentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    createdConsentDocumentId = body.consentDocumentId;
  });

  test("DB row persisted with correct shape (court_order, docuseal_submission_id IS NULL)", async () => {
    // Depends on previous test having run and captured createdConsentDocumentId.
    // If running in isolation: skip gracefully.
    if (!createdConsentDocumentId) {
      test.skip();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (adminClient.schema("payroll") as any)
      .from("consent_document")
      .select(
        "consent_document_id, consent_type, court_order_reference, docuseal_submission_id, status, workspace_id, employee_profile_id",
      )
      .eq("consent_document_id", createdConsentDocumentId)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const row = data as {
      consent_document_id: string;
      consent_type: string;
      court_order_reference: string;
      docuseal_submission_id: string | null;
      status: string;
      workspace_id: string;
      employee_profile_id: string;
    };

    expect(row.consent_type).toBe("court_order");
    expect(row.court_order_reference).toBe(COURT_ORDER_REF);
    // court_order does NOT require DocuSeal — submission_id must be NULL
    expect(row.docuseal_submission_id).toBeNull();
    expect(row.status).toBe("active");
    expect(row.workspace_id).toBe(HQ_WORKSPACE_ID);
    expect(row.employee_profile_id).toBe(EMPLOYEE_PROFILE_ID);
  });
});
