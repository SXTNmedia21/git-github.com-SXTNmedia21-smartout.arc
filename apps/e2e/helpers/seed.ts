import { createClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for E2E seed helpers");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Types for insert overrides — derived from actual database schema
// ---------------------------------------------------------------------------

type WorkspaceOverrides = {
  workspace_id?: string;
  name?: string;
  slug?: string;
  country?: "NO" | "SE" | "DK" | "FI" | "GB";
  currency?: "NOK" | "SEK" | "DKK" | "EUR" | "GBP" | "USD";
  language?: "no" | "sv" | "en" | "da" | "fi";
  timezone?: string;
  is_active?: boolean;
  company_id?: string | null;
};

type ProfileOverrides = {
  profile_id?: string;
  display_name?: string;
  profile_code?: string;
  user_id?: string;
  role?: "employee" | "manager" | "admin" | "owner";
  status?: "trainee" | "active" | "inactive" | "offboarding";
  is_active?: boolean;
  department_id?: string | null;
  location_id?: string | null;
  job_title?: string | null;
};

type DepartmentOverrides = {
  department_id?: string;
  name?: string;
  slug?: string;
  is_active?: boolean;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sort_order?: number | null;
  manager_profile_id?: string | null;
};

type ShiftOverrides = {
  employee_id?: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  status?: "created" | "assigned" | "published" | "active" | "completed" | "unpublished";
  is_published?: boolean;
  day_category?: "morning" | "afternoon" | "evening" | "night" | "split" | "full_day";
  role?: string;
  notes?: string | null;
};

type ProtocolOverrides = {
  protocol_id?: string;
  name?: string;
  description?: string | null;
  policy_id: string;
  owner_profile_id: string;
  created_by: string;
  status?: "draft" | "active" | "deprecated";
  version?: string;
};

type ProtocolAssignmentOverrides = {
  assignment_id?: string;
  protocol_id: string;
  profile_id: string;
  status?: "pending" | "completed" | "expired";
};

type DepartmentSessionOverrides = {
  department_session_id?: string;
  department_id: string;
  session_date: string;
  status?: "upcoming" | "active" | "pending_signoff" | "closed" | "missed";
  season_id?: string | null;
};

type PolicyOverrides = {
  policy_id?: string;
  name?: string;
  statement?: string;
  description?: string | null;
  created_by: string;
  policy_scope?: "workspace" | "department" | "team" | "location";
  policy_type?: "operational" | "haccp" | "hr" | "safety" | "access" | "payroll" | "custom";
  enforcement_status?: "aspirational" | "enforced";
  is_active?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

export async function seedWorkspace(overrides?: WorkspaceOverrides) {
  const suffix = uniqueSuffix();
  const { data, error } = await supabase
    .from("workspace")
    .insert({
      name: `Test Workspace ${suffix}`,
      slug: `test-ws-${suffix}`,
      country: "NO",
      currency: "NOK",
      language: "no",
      timezone: "Europe/Oslo",
      is_active: true,
      ...overrides,
    })
    .select()
    .single();

  if (error) throw new Error(`seedWorkspace failed: ${error.message}`);
  return data;
}

export async function seedProfile(
  workspaceId: string,
  overrides?: Omit<ProfileOverrides, "workspace_id">,
) {
  const suffix = uniqueSuffix();
  const { data, error } = await supabase
    .from("profile")
    .insert({
      workspace_id: workspaceId,
      display_name: `Test User ${suffix}`,
      profile_code: `TST-${suffix}`,
      user_id: overrides?.user_id ?? crypto.randomUUID(),
      role: "employee",
      status: "active",
      is_active: true,
      ...overrides,
    })
    .select()
    .single();

  if (error) throw new Error(`seedProfile failed: ${error.message}`);
  return data;
}

export async function seedDepartment(
  workspaceId: string,
  overrides?: Omit<DepartmentOverrides, "workspace_id">,
) {
  const suffix = uniqueSuffix();
  const { data, error } = await supabase
    .from("department")
    .insert({
      workspace_id: workspaceId,
      name: `Test Department ${suffix}`,
      slug: `test-dept-${suffix}`,
      is_active: true,
      ...overrides,
    })
    .select()
    .single();

  if (error) throw new Error(`seedDepartment failed: ${error.message}`);
  return data;
}

export async function seedShift(workspaceId: string, overrides: ShiftOverrides) {
  const { data, error } = await supabase
    .from("schedule_shift")
    .insert({
      workspace_id: workspaceId,
      shift_date: overrides.shift_date,
      start_time: overrides.start_time,
      end_time: overrides.end_time,
      employee_id: overrides.employee_id ?? null,
      day_category: overrides.day_category ?? "morning",
      role: overrides.role ?? "server",
      status: overrides.status ?? "created",
      is_published: overrides.is_published ?? false,
      notes: overrides.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`seedShift failed: ${error.message}`);
  return data;
}

export async function seedProtocol(workspaceId: string, overrides: ProtocolOverrides) {
  const suffix = uniqueSuffix();
  const { data, error } = await supabase
    .from("protocol")
    .insert({
      workspace_id: workspaceId,
      name: overrides.name ?? `Test Protocol ${suffix}`,
      description: overrides.description ?? null,
      policy_id: overrides.policy_id,
      owner_profile_id: overrides.owner_profile_id,
      created_by: overrides.created_by,
      status: overrides.status ?? "active",
      version: overrides.version ?? "1.0",
    })
    .select()
    .single();

  if (error) throw new Error(`seedProtocol failed: ${error.message}`);
  return data;
}

export async function seedProtocolAssignment(overrides: ProtocolAssignmentOverrides) {
  const { data, error } = await supabase
    .from("protocol_assignment")
    .insert({
      protocol_id: overrides.protocol_id,
      profile_id: overrides.profile_id,
      status: overrides.status ?? "pending",
    })
    .select()
    .single();

  if (error) throw new Error(`seedProtocolAssignment failed: ${error.message}`);
  return data;
}

export async function seedDepartmentSession(
  workspaceId: string,
  overrides: DepartmentSessionOverrides,
) {
  const { data, error } = await supabase
    .from("department_session")
    .insert({
      workspace_id: workspaceId,
      department_id: overrides.department_id,
      session_date: overrides.session_date,
      status: overrides.status ?? "upcoming",
      season_id: overrides.season_id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`seedDepartmentSession failed: ${error.message}`);
  return data;
}

export async function seedPolicy(workspaceId: string, overrides: PolicyOverrides) {
  const suffix = uniqueSuffix();
  const { data, error } = await supabase
    .from("policy")
    .insert({
      workspace_id: workspaceId,
      name: overrides.name ?? `Test Policy ${suffix}`,
      statement: overrides.statement ?? `Test policy statement ${suffix}`,
      description: overrides.description ?? null,
      created_by: overrides.created_by,
      policy_scope: overrides.policy_scope ?? "workspace",
      policy_type: overrides.policy_type ?? "operational",
      enforcement_status: overrides.enforcement_status ?? "enforced",
      is_active: overrides.is_active ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(`seedPolicy failed: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Contract-template seed helpers — Phase E2E (contract-hub-redesign)
// ---------------------------------------------------------------------------
//
// Feature suite cover:
//   - hub-redesign.spec             — tab navigation + telemetry
//   - workspace-template-fork.spec  — fork lineage columns
//   - cascade-drift-observability  — drifted fork vs system source
//   - bulk-send.spec                — published + not deprecated gate
//   - composition-drawer.spec       — reverse-flow, preselected profile
//
// The `contract_template` table has `workspace_id IS NULL` for K1a system
// templates and a concrete workspace_id for K1b workspace forks. Lineage
// columns `source_template_id`, `source_template_version`, `forked_at` and
// lifecycle columns `published_at`, `deprecated_at` were added Phase 3.

type PublishedTemplateOverrides = {
  workspace_id: string;
  name?: string;
  source_template_id?: string | null;
  source_template_version?: string | null;
  version?: number;
  is_published?: boolean; // default true
};

type DriftedTemplatePair = {
  workspace_id: string;
  source_version: number; // what the workspace fork points at
  current_version: number; // what the K1a system template is now
};

type DeprecatedTemplateOverrides = {
  workspace_id: string;
  name?: string;
  deprecated_at?: string; // defaults to now()
};

type EmployeeBatchOverrides = {
  workspace_id: string;
  count: number;
  role?: "employee" | "manager" | "admin" | "owner";
};

/**
 * Insert a workspace-owned (is_system=false) contract template. Published by
 * default so bulk-send tests pass the published-gate. Pass lineage columns to
 * simulate a fork from a K1a system template.
 *
 * Returns the inserted template row.
 */
export async function seedPublishedTemplate(overrides: PublishedTemplateOverrides) {
  const suffix = uniqueSuffix();
  const published = overrides.is_published ?? true;
  const { data, error } = await supabase
    .from("contract_template")
    .insert({
      workspace_id: overrides.workspace_id,
      name: overrides.name ?? `Test Workspace Template ${suffix}`,
      contract_type: "employee",
      language: "no",
      locale: "nb-NO",
      content_html: "<p>Test workspace template body</p>",
      is_system: false,
      is_active: true,
      version: overrides.version ?? 1,
      source_template_id: overrides.source_template_id ?? null,
      source_template_version: overrides.source_template_version ?? null,
      forked_at: overrides.source_template_id ? new Date().toISOString() : null,
      published_at: published ? new Date().toISOString() : null,
      deprecated_at: null,
      created_by: "e0000000-0000-0000-0000-000000000000",
    })
    .select()
    .single();

  if (error) throw new Error(`seedPublishedTemplate failed: ${error.message}`);
  return data;
}

/**
 * Seed a drifted pair: a K1a system template at `current_version` and a
 * workspace fork pointing at `source_version`. When `source_version <
 * current_version`, `MalerTab` shows the amber drift chip.
 *
 * Returns both rows so the test can assert against template_id.
 */
export async function seedDriftedTemplate(overrides: DriftedTemplatePair) {
  const suffix = uniqueSuffix();

  // K1a system template (workspace_id IS NULL, is_system=true) at the newer
  // version. This is the "truth" the workspace fork is behind.
  const { data: source, error: sourceError } = await supabase
    .from("contract_template")
    .insert({
      workspace_id: null,
      name: `Test K1a System Template ${suffix}`,
      contract_type: "employee",
      language: "no",
      locale: "nb-NO",
      content_html: "<p>Updated K1a body — reflects regulatory change.</p>",
      is_system: true,
      is_active: true,
      version: overrides.current_version,
    })
    .select()
    .single();

  if (sourceError || !source) {
    throw new Error(`seedDriftedTemplate (source) failed: ${sourceError?.message ?? "no row"}`);
  }

  // Workspace fork — references the K1a template id, but pinned at an older
  // version. `source_template_version` is stored as text per Gate G5.
  const fork = await seedPublishedTemplate({
    workspace_id: overrides.workspace_id,
    name: `Test Drifted Fork ${suffix}`,
    source_template_id: source.template_id,
    source_template_version: String(overrides.source_version),
    version: overrides.source_version,
  });

  return { source, fork };
}

/**
 * Insert a workspace template with `deprecated_at` set. Used to verify the
 * bulk-send UI hides / blocks the action and the server returns 400.
 */
export async function seedDeprecatedTemplate(overrides: DeprecatedTemplateOverrides) {
  const suffix = uniqueSuffix();
  const deprecatedAt = overrides.deprecated_at ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("contract_template")
    .insert({
      workspace_id: overrides.workspace_id,
      name: overrides.name ?? `Test Deprecated Template ${suffix}`,
      contract_type: "employee",
      language: "no",
      locale: "nb-NO",
      content_html: "<p>Old template</p>",
      is_system: false,
      is_active: true,
      version: 1,
      published_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      deprecated_at: deprecatedAt,
      created_by: "e0000000-0000-0000-0000-000000000000",
    })
    .select()
    .single();

  if (error) throw new Error(`seedDeprecatedTemplate failed: ${error.message}`);
  return data;
}

/**
 * Insert N test profiles in the workspace. Used by bulk-send + virtualization
 * tests. Each profile is backed by a fresh auth.users row created through
 * the Supabase admin API (`profile.user_id` has a NOT-NULL FK to auth.users
 * via `fk_profile_user`, so a raw insert without an auth user fails).
 *
 * These users can technically authenticate, but tests never log in as them —
 * the bulk-send endpoint only reads `profile` rows and writes `employment_contract`.
 */
export async function seedEmployeeBatch(overrides: EmployeeBatchOverrides) {
  const { workspace_id, count, role = "employee" } = overrides;
  const profiles: Array<{ profile_id: string; display_name: string }> = [];

  for (let i = 0; i < count; i += 1) {
    const suffix = uniqueSuffix();

    // Create the auth user first so profile.user_id satisfies the FK.
    const { data: userResp, error: userError } = await supabase.auth.admin.createUser({
      email: `batch-${i + 1}-${suffix}@smartout.local`,
      password: "password123",
      email_confirm: true,
      user_metadata: { first_name: `Batch${i + 1}`, last_name: "Tester" },
    });

    if (userError || !userResp?.user) {
      throw new Error(
        `seedEmployeeBatch (auth.users) failed at ${i}: ${userError?.message ?? "no user"}`,
      );
    }

    const { data, error } = await supabase
      .from("profile")
      .insert({
        workspace_id,
        display_name: `Batch Profile ${i + 1} ${suffix}`,
        profile_code: `BATCH-${i + 1}-${suffix}`,
        user_id: userResp.user.id,
        role,
        status: "active",
        is_active: true,
      })
      .select("profile_id, display_name")
      .single();

    if (error || !data) {
      throw new Error(`seedEmployeeBatch failed at ${i}: ${error?.message ?? "no row"}`);
    }
    profiles.push(data);
  }

  return profiles;
}

/**
 * Delete test contract_template rows for a workspace (plus any orphan K1a
 * system rows whose name starts with "Test "). Keeps the test DB clean
 * between runs.
 */
export async function cleanupContractTemplates(workspaceId: string) {
  await supabase.from("contract_template").delete().eq("workspace_id", workspaceId);
  await supabase.from("contract_template").delete().is("workspace_id", null).like("name", "Test %");
}

// ---------------------------------------------------------------------------
// Contract-employee E2E seed helpers — Cycle 8 Track B
// ---------------------------------------------------------------------------
//
// Three helpers for the 5 contract-employee journey specs:
//   - seedEmploymentContract  — draft/pending/ready/sent/active/superseded contract
//   - seedPayrollProfile      — employee_payroll_profile row (Tripletex-aligned)
//   - seedObligation          — contract_obligation (blocker or advisory)
//
// Patterns follow seedWorkspace + seedEmployeeBatch: service-role client,
// Insert types from database.types.ts, uniqueSuffix for deterministic cleanup.

/**
 * Insert an employment_contract row for a profile. All §14-6 fields have
 * sensible Norwegian defaults so callers only need to pass the required IDs
 * and any fields the specific test actually exercises.
 *
 * Returns `{ contract_id }` so subsequent helpers (seedPayrollProfile,
 * seedObligation) and test bodies can chain on the same contract.
 */
export async function seedEmploymentContract(opts: {
  workspaceId: string;
  /** The employee profile this contract belongs to */
  profileId: string;
  status?: Database["public"]["Enums"]["contract_status"];
  employmentForm?: Database["public"]["Enums"]["employment_form_enum"];
  positionTitle?: string;
  /** ISO date string — defaults to today */
  startDate?: Date;
  /** Agreed weekly hours — affects tariff derivation */
  agreedWeeklyHours?: number;
}): Promise<{ contract_id: string }> {
  type ContractInsert = Database["public"]["Tables"]["employment_contract"]["Insert"];
  const today = new Date().toISOString().split("T")[0]!;

  const insert: ContractInsert = {
    workspace_id: opts.workspaceId,
    profile_id: opts.profileId,
    status: opts.status ?? "draft",
    employment_form: opts.employmentForm ?? "permanent",
    employment_category: "fast",
    position_title: opts.positionTitle ?? "Servitør",
    start_date: opts.startDate ? opts.startDate.toISOString().split("T")[0]! : today,
    agreed_weekly_hours: opts.agreedWeeklyHours ?? 37.5,
    // §14-6 defaults (Norwegian labour law minimums)
    employment_percentage: 100,
    notice_period_months: 1,
    trial_period_months: 6,
    break_minutes_per_day: 30,
    overtime_agreement_type: "legal_default",
    source: "e2e-seed",
  };

  const { data, error } = await supabase
    .from("employment_contract")
    .insert(insert)
    .select("contract_id")
    .single();

  if (error || !data) {
    throw new Error(`seedEmploymentContract failed: ${error?.message ?? "no row"}`);
  }
  return { contract_id: data.contract_id };
}

/**
 * Insert an employee_payroll_profile row for a profile. Defaults are minimal
 * but valid — callers override only what their test exercises (e.g. sync
 * status, tripletex ID).
 */
export async function seedPayrollProfile(opts: {
  workspaceId: string;
  profileId: string;
  tripletexEmployeeId?: number;
  payrollSyncStatus?: Database["public"]["Enums"]["sync_status_enum"];
}): Promise<void> {
  type PayrollInsert = Database["public"]["Tables"]["employee_payroll_profile"]["Insert"];
  const today = new Date().toISOString().split("T")[0]!;

  const insert: PayrollInsert = {
    workspace_id: opts.workspaceId,
    profile_id: opts.profileId,
    salary_type: "hourly",
    seniority_start_date: today,
    agreed_weekly_hours: 37.5,
    tariff_category: "general",
    valid_from: today,
    payroll_sync_status: opts.payrollSyncStatus ?? "not_synced",
    payroll_tripletex_employee_id: opts.tripletexEmployeeId ?? null,
  };

  const { error } = await supabase.from("employee_payroll_profile").insert(insert);

  if (error) {
    throw new Error(`seedPayrollProfile failed: ${error.message}`);
  }
}

/**
 * Insert a contract_obligation row tied to an existing employment_contract.
 * Useful for Journey 4 (blocker enforcement on clock-in) and Journey 5
 * (amendment re-sign obligations).
 *
 * Returns `{ obligation_id }` so test bodies can reference the row.
 */
export async function seedObligation(opts: {
  workspaceId: string;
  contractId: string;
  obligationType?: Database["public"]["Enums"]["obligation_type"];
  status?: Database["public"]["Enums"]["obligation_status"];
  dueAt?: Date;
  isBlocker?: boolean;
}): Promise<{ obligation_id: string }> {
  type ObligationInsert = Database["public"]["Tables"]["contract_obligation"]["Insert"];

  const insert: ObligationInsert = {
    workspace_id: opts.workspaceId,
    contract_id: opts.contractId,
    obligation_type: opts.obligationType ?? "training_required",
    status: opts.status ?? "pending",
    due_at: opts.dueAt ? opts.dueAt.toISOString() : null,
    is_blocker: opts.isBlocker ?? false,
    reference_text: "E2E seed obligation",
  };

  const { data, error } = await supabase
    .from("contract_obligation")
    .insert(insert)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`seedObligation failed: ${error?.message ?? "no row"}`);
  }
  return { obligation_id: data.id };
}

/**
 * Delete test employment_contract rows + profiles created by seedEmployeeBatch
 * (matched by profile_code prefix BATCH-), plus their auth.users rows.
 */
export async function cleanupEmployeeBatch(workspaceId: string) {
  const { data: batch } = await supabase
    .from("profile")
    .select("profile_id, user_id")
    .eq("workspace_id", workspaceId)
    .like("profile_code", "BATCH-%");

  const profileIds = batch?.map((row) => row.profile_id) ?? [];
  const userIds = batch?.map((row) => row.user_id).filter((x): x is string => !!x) ?? [];

  if (profileIds.length > 0) {
    await supabase.from("employment_contract").delete().in("profile_id", profileIds);
    await supabase.from("profile").delete().in("profile_id", profileIds);
  }

  for (const userId of userIds) {
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch {
      // best-effort — leftover auth rows are harmless for E2E
    }
  }
}
