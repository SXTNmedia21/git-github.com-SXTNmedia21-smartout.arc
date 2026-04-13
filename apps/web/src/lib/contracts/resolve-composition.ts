/**
 * resolve-composition.ts — Pure cascade derivation for employment contracts.
 *
 * Reads from D2 (profile), K1a (framework_rule, tariff_rate_table),
 * K1b (workspace_framework_binding) to produce a ContractDraftProposal.
 * This is a SERVER-ONLY function — never import from client components.
 *
 * ADR-0076: composition as cascade derivation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComplianceLevel = "ok" | "warning" | "blocker";

export type ComplianceValidation = {
  rule_id: string;
  rule_type: string;
  level: ComplianceLevel;
  message: string;
  field?: string;
  expected_value?: string;
  actual_value?: string;
};

export type MandatoryClause = {
  rule_id: string;
  title: string;
  text: string;
  enforcement_level: string;
  locked: boolean;
};

export type ContractDraftProposal = {
  employment_terms: {
    position_title: string;
    hourly_rate: number | null;
    monthly_salary: number | null;
    employment_percentage: number;
    employment_category: string;
    start_date: string;
  };
  framework_snapshot: {
    framework_id: string;
    framework_name: string;
    snapshot_date: string;
    rules: Array<{
      rule_id: string;
      rule_type: string;
      description: string;
      enforcement_level: string;
    }>;
  };
  mandatory_clauses: MandatoryClause[];
  validations: {
    ok: ComplianceValidation[];
    warning: ComplianceValidation[];
    blocker: ComplianceValidation[];
  };
  placeholder_status: {
    filled: string[];
    missing: string[];
  };
};

export type EmploymentCategory = "fast" | "deltid" | "tilkalling";

export type CompositionInput = {
  employment_category: EmploymentCategory;
  employment_percentage: number;
  position_title: string;
  employee_group_id?: string;
};

// ---------------------------------------------------------------------------
// Helper: compute placeholder status from profile fields
// ---------------------------------------------------------------------------

function computePlaceholderStatus(profile: {
  personal_number: string | null;
  bank_account: string | null;
  address_line_1: string | null;
  postal_code: string | null;
}): { filled: string[]; missing: string[] } {
  const filled: string[] = [];
  const missing: string[] = [];

  if (profile.personal_number) {
    filled.push("personal_number");
  } else {
    missing.push("personal_number");
  }

  if (profile.bank_account) {
    filled.push("bank_account");
  } else {
    missing.push("bank_account");
  }

  // Address is considered filled only when both line1 and postal_code exist
  if (profile.address_line_1 && profile.postal_code) {
    filled.push("address");
  } else {
    missing.push("address");
  }

  return { filled, missing };
}

// ---------------------------------------------------------------------------
// Main derivation function
// ---------------------------------------------------------------------------

export async function resolveComposition(
  supabase: SupabaseClient,
  workspaceId: string,
  profileId: string,
  input: CompositionInput,
): Promise<ContractDraftProposal> {
  // ---- Step 1: Load profile from D2 ----
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select(
      "profile_id, display_name, role, personal_number, bank_account, address_line_1, postal_code, city",
    )
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .single();

  if (profileError || !profile) {
    throw new Error(`Failed to load profile ${profileId}: ${profileError?.message ?? "not found"}`);
  }

  // ---- Step 2: Load workspace_framework_binding from K1b + join regulatory_framework ----
  const { data: binding, error: bindingError } = await supabase
    .from("workspace_framework_binding")
    .select("framework_id, regulatory_framework(name, version)")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .single();

  if (bindingError || !binding) {
    throw new Error(
      `No active framework binding for workspace ${workspaceId}: ${bindingError?.message ?? "not found"}`,
    );
  }

  const frameworkId = binding.framework_id;

  // regulatory_framework comes back as a nested object from the join
  const frameworkInfo = binding.regulatory_framework as unknown as {
    name: string;
    version: string;
  } | null;

  const frameworkName = frameworkInfo?.name ?? "Unknown Framework";

  // ---- Step 3: Load framework_rule from K1a ----
  const { data: rules, error: rulesError } = await supabase
    .from("framework_rule")
    .select("rule_id, rule_type, description, severity, code, category, evaluation_config")
    .eq("framework_id", frameworkId);

  if (rulesError) {
    throw new Error(`Failed to load framework rules: ${rulesError.message}`);
  }

  const activeRules = rules ?? [];

  // ---- Step 4: Load tariff_rate_table for suggested rate ----
  // Query employee_payroll_profile to determine if employee has fagbrev.
  // Use rate_type "minstelonn_faglart" if has_fagbrev, else "minstelonn_ufaglart".
  // Lookup against platform-level rates (workspace_id = null).
  const { data: payrollProfile } = await supabase
    .from("employee_payroll_profile")
    .select("has_fagbrev")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .single();

  const rateType = payrollProfile?.has_fagbrev ? "minstelonn_faglart" : "minstelonn_ufaglart";

  const { data: tariffRows } = await supabase
    .from("tariff_rate_table")
    .select("amount, rate_type, unit")
    .is("workspace_id", null)
    .eq("rate_type", rateType)
    .order("effective_from", { ascending: false })
    .limit(1);

  const suggestedRate =
    tariffRows && tariffRows.length > 0 ? (tariffRows[0]?.amount ?? null) : null;

  // ---- Step 5: Build mandatory clauses from rules with severity = "mandatory" ----
  // In the schema, enforcement level maps to the severity field on framework_rule.
  // Rules with rule_type "gate" or severity "critical" are treated as mandatory.
  const mandatoryClauses: MandatoryClause[] = activeRules
    .filter((r) => r.severity === "critical" || r.rule_type === "gate")
    .map((r) => ({
      rule_id: r.rule_id,
      title: r.code,
      text: r.description,
      enforcement_level: r.severity,
      locked: true,
    }));

  // ---- Step 6: Run compliance validations ----
  const validations: {
    ok: ComplianceValidation[];
    warning: ComplianceValidation[];
    blocker: ComplianceValidation[];
  } = { ok: [], warning: [], blocker: [] };

  // Tariff compliance check
  if (suggestedRate !== null) {
    validations.ok.push({
      rule_id: "tariff-check",
      rule_type: "commercial",
      level: "ok",
      message: `Tariff rate found: ${suggestedRate}`,
    });
  } else {
    validations.warning.push({
      rule_id: "tariff-check",
      rule_type: "commercial",
      level: "warning",
      message: "No tariff rate found for this framework — rate must be set manually",
    });
  }

  // Add all mandatory rules as ok validations (they exist in the framework)
  for (const rule of activeRules) {
    validations.ok.push({
      rule_id: rule.rule_id,
      rule_type: rule.rule_type,
      level: "ok",
      message: `Rule present: ${rule.description}`,
    });
  }

  // ---- Step 7: Compute placeholder status ----
  const placeholderStatus = computePlaceholderStatus({
    personal_number: profile.personal_number,
    bank_account: profile.bank_account,
    address_line_1: profile.address_line_1,
    postal_code: profile.postal_code,
  });

  // If critical PII is missing, add blocker validations
  if (placeholderStatus.missing.length > 0) {
    validations.blocker.push({
      rule_id: "pii-completeness",
      rule_type: "gate",
      level: "blocker",
      message: `Missing employee data: ${placeholderStatus.missing.join(", ")}`,
      field: placeholderStatus.missing.join(", "),
    });
  }

  // ---- Assemble the proposal ----
  return {
    employment_terms: {
      position_title: input.position_title,
      hourly_rate: suggestedRate,
      monthly_salary: null,
      employment_percentage: input.employment_percentage,
      employment_category: input.employment_category,
      start_date: new Date().toISOString().split("T")[0] ?? "",
    },
    framework_snapshot: {
      framework_id: frameworkId,
      framework_name: frameworkName,
      snapshot_date: new Date().toISOString(),
      rules: activeRules.map((r) => ({
        rule_id: r.rule_id,
        rule_type: r.rule_type,
        description: r.description,
        enforcement_level: r.severity,
      })),
    },
    mandatory_clauses: mandatoryClauses,
    validations,
    placeholder_status: placeholderStatus,
  };
}
