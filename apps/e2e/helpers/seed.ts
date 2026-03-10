import { createClient } from "@supabase/supabase-js";

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
