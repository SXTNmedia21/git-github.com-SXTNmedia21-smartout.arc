// packages/ai/src/capabilities/legal/aml-14-15.ts
//
// Shared validation utility for Aml. §14-15 tredje ledd nr. 1-6 (wage deduction consent).
// SMA-328 — ADR-0311 (Trekk-samtykke som payroll-domain artifact).
//
// What: Validates that a payroll.consent_document row exists, is active, owned by the
//       correct profile + workspace, and has not expired. Returns a structured result.
//
// Why:  Shared between two consumers to avoid duplication:
//       1. BFF route (propose-line-override) calls this directly — server-side enforcement.
//       2. validateAml1415 capability tool wraps this + adds channel guard + emit().
//       Single rule logic = single point of truth. No divergence risk.
//
// L-0177: fail-fast on workspace_id mismatch (no silent fallback to wrong workspace).
// ADR-0151: workspace_id is always server-derived at call site — never from client body.
// ADR-0311: paragraph_ref = "Aml. §14-15 tredje ledd nr. 1-6" (hardcoded invariant).

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Output shape ────────────────────────────────────────────────────────────

export type Aml1415ValidationStatus =
  | "passes"
  | "consent_missing"
  | "consent_expired"
  | "consent_type_mismatch"
  | "workspace_mismatch"
  | "skip";

export type Aml1415ValidationResult = {
  pass: boolean;
  status: Aml1415ValidationStatus;
  paragraph: "Aml. §14-15 tredje ledd nr. 1-6";
  consent_document_id: string | null;
  signed_at: string | null;
  expires_at: string | null;
  validator_version: string;
};

const VALIDATOR_VERSION = "aml-14-15-2024-07-payroll-v1" as const;
const PARAGRAPH = "Aml. §14-15 tredje ledd nr. 1-6" as const;

// ── Shared utility ──────────────────────────────────────────────────────────

/**
 * Validate a payroll.consent_document row against Aml. §14-15 tredje ledd nr. 1-6.
 *
 * Called directly from:
 *   - BFF route `/api/payroll/propose-line-override` (server-side enforcement, no agent context)
 *   - `validateAml1415` capability tool (wraps + adds channel guard + emit)
 *
 * Returns a structured Aml1415ValidationResult. Caller decides how to surface errors.
 *
 * L-0176: body is the source of truth. Docstring describes the implemented body.
 */
export async function validateAml1415Logic(
  consentDocumentId: string,
  profileId: string,
  workspaceId: string,
  supabaseAdmin: SupabaseClient,
): Promise<Aml1415ValidationResult> {
  // Step 1: Load the consent_document row via admin client (read_only — no service-role escalation).
  // Uses admin.schema("payroll") to reach the payroll schema (matching run-deviation-checks pattern).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabaseAdmin.schema("payroll") as any)
    .from("consent_document")
    .select(
      "consent_document_id, workspace_id, employee_profile_id, consent_type, status, signed_at, expires_at",
    )
    .eq("consent_document_id", consentDocumentId)
    .maybeSingle();

  if (error || !row) {
    // Row not found or DB error — treat as missing consent.
    return {
      pass: false,
      status: "consent_missing",
      paragraph: PARAGRAPH,
      consent_document_id: consentDocumentId,
      signed_at: null,
      expires_at: null,
      validator_version: VALIDATOR_VERSION,
    };
  }

  // Step 2: L-0177 fail-fast — workspace mismatch means wrong tenant.
  // No silent fallback. Caller must surface this as 403.
  if (row.workspace_id !== workspaceId) {
    return {
      pass: false,
      status: "workspace_mismatch",
      paragraph: PARAGRAPH,
      consent_document_id: consentDocumentId,
      signed_at: null,
      expires_at: null,
      validator_version: VALIDATOR_VERSION,
    };
  }

  // Step 3: Verify FK ownership — consent must belong to the correct employee.
  if (row.employee_profile_id !== profileId) {
    return {
      pass: false,
      status: "consent_type_mismatch", // profile mismatch → ownership mismatch
      paragraph: PARAGRAPH,
      consent_document_id: consentDocumentId,
      signed_at: null,
      expires_at: null,
      validator_version: VALIDATOR_VERSION,
    };
  }

  // Step 4: Sanity check — consent_type must be a deduction type, not training.
  // Valid: loan_agreement, uniform_policy, union_dues, court_order, other_voluntary.
  // 'training' would be a misconfigured DocuSeal callback.
  const DEDUCTION_TYPES = [
    "loan_agreement",
    "uniform_policy",
    "union_dues",
    "court_order",
    "other_voluntary",
  ] as const;
  if (!DEDUCTION_TYPES.includes(row.consent_type)) {
    return {
      pass: false,
      status: "consent_type_mismatch",
      paragraph: PARAGRAPH,
      consent_document_id: consentDocumentId,
      signed_at: null,
      expires_at: null,
      validator_version: VALIDATOR_VERSION,
    };
  }

  // Step 5: Status check. Only 'active' consents are valid for new deductions.
  // 'expired' | 'revoked' | 'superseded' all block.
  if (row.status !== "active") {
    return {
      pass: false,
      status: "consent_expired", // covers revoked + superseded semantically
      paragraph: PARAGRAPH,
      consent_document_id: consentDocumentId,
      signed_at: (row.signed_at as string) ?? null,
      expires_at: (row.expires_at as string | null) ?? null,
      validator_version: VALIDATOR_VERSION,
    };
  }

  // Step 6: Expiry check — expires_at IS NULL means no expiry (e.g. one-time deductions).
  // If expires_at is set, it must be in the future.
  if (row.expires_at !== null) {
    const expiresAt = new Date(row.expires_at as string);
    if (expiresAt <= new Date()) {
      return {
        pass: false,
        status: "consent_expired",
        paragraph: PARAGRAPH,
        consent_document_id: consentDocumentId,
        signed_at: (row.signed_at as string) ?? null,
        expires_at: (row.expires_at as string) ?? null,
        validator_version: VALIDATOR_VERSION,
      };
    }
  }

  // Step 7: All checks passed.
  return {
    pass: true,
    status: "passes",
    paragraph: PARAGRAPH,
    consent_document_id: consentDocumentId,
    signed_at: (row.signed_at as string) ?? null,
    expires_at: (row.expires_at as string | null) ?? null,
    validator_version: VALIDATOR_VERSION,
  };
}
