/**
 * Journey — Non-court_order types rejected (Option B scope gate)
 *
 * Tests that POST /api/payroll/consent-documents rejects all DocuSeal-mediated
 * consent types with 404 + error code `consent_type_requires_docuseal`.
 *
 * Parametrized across all 4 deferred types:
 *   - loan_agreement
 *   - uniform_policy
 *   - union_dues
 *   - other_voluntary
 *
 * Also verifies no consent_document row is inserted on rejection.
 *
 * ADR-0311 / Track A Option B: only court_order is implemented in this sortie.
 * DocuSeal flows for other consent types are deferred to a separate sortie.
 *
 * @see JOURNEY-sma-328-aml-14-15-trekk-consent-manager-applies-trekk-without-consent-rejected.md
 * @see PLAN-contracts-compliance-debt-cleanup.md Track B
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3060";

const ADMIN_EMAIL = "admin@smartout.local";
const ADMIN_PASSWORD = "testpassword123";
const EMPLOYEE_PROFILE_ID = "f0000000-0000-0000-0000-000000000001";
const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

const adminClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// All DocuSeal-mediated types that should be rejected by Option B scope gate
const DEFERRED_CONSENT_TYPES = [
  "loan_agreement",
  "uniform_policy",
  "union_dues",
  "other_voluntary",
] as const;

type DeferredConsentType = (typeof DEFERRED_CONSENT_TYPES)[number];

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

async function countConsentDocumentRows(workspaceId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (adminClient.schema("payroll") as any)
    .from("consent_document")
    .select("consent_document_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(`Count query failed: ${error.message}`);
  return count ?? 0;
}

test.describe("Journey — Non-court_order types rejected (Option B gate)", () => {
  for (const consentType of DEFERRED_CONSENT_TYPES) {
    test(`POST with consentType='${consentType}' → 404 + consent_type_requires_docuseal`, async () => {
      const jwt = await getAdminJwt();

      // Count rows before the request — should remain unchanged after rejection
      const beforeCount = await countConsentDocumentRows(HQ_WORKSPACE_ID);

      const res = await fetch(`${BASE_URL}/api/payroll/consent-documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          employeeProfileId: EMPLOYEE_PROFILE_ID,
          consentType: consentType as DeferredConsentType,
          // courtOrderReference is required for court_order only — omit for deferred types
          courtOrderReference: "DUMMY-REF-SHOULD-BE-IGNORED",
          signedAt: "2026-05-14T10:00:00Z",
          signedDocumentUrl: "https://example.com/deferred.pdf",
        }),
      });

      expect(res.status).toBe(404);

      const body = (await res.json()) as {
        ok: boolean;
        error: string;
        code: string;
        supported_types: string[];
        deferred_types: string[];
      };

      expect(body.ok).toBe(false);
      // error and code fields both carry the machine-readable code
      expect(body.code).toBe("consent_type_requires_docuseal");
      expect(body.supported_types).toContain("court_order");
      expect(body.deferred_types).toContain(consentType);

      // No row should have been inserted
      const afterCount = await countConsentDocumentRows(HQ_WORKSPACE_ID);
      expect(afterCount).toBe(beforeCount);
    });
  }
});
