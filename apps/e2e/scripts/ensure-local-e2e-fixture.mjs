// ============================================
// ensure-local-e2e-fixture.mjs
// Ensures local Playwright has a dedicated
// admin user and workspace fixture without
// overwriting the developer's real local data.
//
// Why: broader local E2E should run against a
// stable test fixture, not assume the whole
// local database matches seed.sql.
// ============================================

import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const e2eEmail = process.env.E2E_EMAIL ?? "admin@smartout.local";
const e2ePassword = process.env.E2E_PASSWORD ?? "password123";
const e2eEmployeeEmail = process.env.E2E_EMPLOYEE_EMAIL ?? "employee@smartout.local";
const e2eEmployeePassword = process.env.E2E_EMPLOYEE_PASSWORD ?? "password123";

const fixtureIds = {
  companyId: "a0000000-0000-0000-0000-000000000000",
  workspaceId: "b0000000-0000-0000-0000-000000000000",
  locationId: "c0000000-0000-0000-0000-000000000000",
  departmentId: "d0000000-0000-0000-0000-000000000000",
  profileId: "f0000000-0000-0000-0000-000000000000",
  companyMemberId: "aa000000-0000-0000-0000-000000000001",
  employeeProfileId: "f0000000-0000-0000-0000-000000000001",
  employeeCompanyMemberId: "aa000000-0000-0000-0000-000000000002",
  seasonId: "ab000000-0000-0000-0000-000000000001",
  shiftId: "ac000000-0000-0000-0000-000000000001",
  policyIds: [
    "ad000000-0000-0000-0000-000000000001",
    "ad000000-0000-0000-0000-000000000002",
    "ad000000-0000-0000-0000-000000000003",
  ],
};

/**
 * Returns a service-role Supabase client for local fixture provisioning.
 * Why: the script must create auth users and non-RLS test records safely.
 *
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
function createAdminClient() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing fixture env vars: ${missing.join(", ")}`);
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Finds or creates a dedicated auth user and ensures the password is correct.
 * Why: local Playwright needs stable password-auth fixtures regardless of existing local data.
 *
 * @param {ReturnType<typeof createAdminClient>} supabase
 * @param {{ email: string, password: string, firstName: string, lastName: string }} options
 * @returns {Promise<{ userId: string, email: string }>}
 */
async function ensureAuthUser(supabase, options) {
  const { email, password, firstName, lastName } = options;
  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers();

  if (listError) {
    throw new Error(`Could not list auth users: ${listError.message}`);
  }

  const existingUser = users.find((user) => user.email === email);

  if (existingUser) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (updateError) {
      throw new Error(`Could not refresh E2E auth user: ${updateError.message}`);
    }

    return { userId: existingUser.id, email };
  }

  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (createError || !createdUser.user?.id) {
    throw new Error(`Could not create E2E auth user: ${createError?.message ?? "missing user"}`);
  }

  return { userId: createdUser.user.id, email };
}

/**
 * Ensures the dedicated E2E auth users and passwords exist.
 * Why: the broader local suite needs both an owner and a second active employee profile.
 *
 * @param {ReturnType<typeof createAdminClient>} supabase
 * @returns {Promise<{ adminUser: { userId: string, email: string }, employeeUser: { userId: string, email: string } }>}
 */
async function ensureFixtureAuthUsers(supabase) {
  const adminUser = await ensureAuthUser(supabase, {
    email: e2eEmail,
    password: e2ePassword,
    firstName: "Local",
    lastName: "Admin",
  });
  const employeeUser = await ensureAuthUser(supabase, {
    email: e2eEmployeeEmail,
    password: e2eEmployeePassword,
    firstName: "Fixture",
    lastName: "Employee",
  });

  return { adminUser, employeeUser };
}

/**
 * Ensures the user_identity row exists with the required auth and platform flags.
 * Why: dashboard and platform-admin flows rely on user_identity as the auth bridge.
 *
 * @param {ReturnType<typeof createAdminClient>} supabase
 * @param {{ userId: string, email: string, firstName: string, lastName: string, isGodmode?: boolean }} identity
 * @returns {Promise<void>}
 */
async function ensureUserIdentity(supabase, identity) {
  const { error } = await supabase.from("user_identity").upsert(
    {
      user_id: identity.userId,
      email: identity.email,
      first_name: identity.firstName,
      last_name: identity.lastName,
      auth_provider: "supabase",
      preferred_language: "no",
      timezone: "Europe/Oslo",
      is_active: true,
      is_godmode: identity.isGodmode ?? false,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Could not ensure user_identity fixture: ${error.message}`);
  }
}

/**
 * Ensures the shared company/workspace/location/department fixture rows exist.
 * Why: the auth tests need a stable workspace context after login.
 *
 * @param {ReturnType<typeof createAdminClient>} supabase
 * @returns {Promise<void>}
 */
async function ensureWorkspaceFixture(supabase) {
  const companyPayload = {
    company_id: fixtureIds.companyId,
    name: "Smartout E2E Company",
    legal_name: "Smartout E2E Company AS",
    org_number: "999888777",
    country: "NO",
    industry: "other",
    default_language: "no",
    default_currency: "NOK",
    is_active: true,
  };

  const workspacePayload = {
    workspace_id: fixtureIds.workspaceId,
    company_id: fixtureIds.companyId,
    name: "HQ Workspace",
    slug: "hq-workspace",
    description: "Stable E2E workspace fixture",
    timezone: "Europe/Oslo",
    currency: "NOK",
    language: "no",
    country: "NO",
    is_active: true,
    onboarding_completed: true,
  };

  const locationPayload = {
    location_id: fixtureIds.locationId,
    workspace_id: fixtureIds.workspaceId,
    name: "Oslo Downtown Hub",
    slug: "oslo-downtown",
    location_type: "main",
    is_active: true,
  };

  const departmentPayload = {
    department_id: fixtureIds.departmentId,
    workspace_id: fixtureIds.workspaceId,
    name: "Operations",
    slug: "operations",
    sort_order: 0,
    is_active: true,
  };

  const { error: companyError } = await supabase
    .from("company")
    .upsert(companyPayload, { onConflict: "company_id" });
  if (companyError) {
    throw new Error(`Could not ensure company fixture: ${companyError.message}`);
  }

  const { error: workspaceError } = await supabase
    .from("workspace")
    .upsert(workspacePayload, { onConflict: "workspace_id" });
  if (workspaceError) {
    throw new Error(`Could not ensure workspace fixture: ${workspaceError.message}`);
  }

  const { error: locationError } = await supabase
    .from("location")
    .upsert(locationPayload, { onConflict: "location_id" });
  if (locationError) {
    throw new Error(`Could not ensure location fixture: ${locationError.message}`);
  }

  const { error: departmentError } = await supabase
    .from("department")
    .upsert(departmentPayload, { onConflict: "department_id" });
  if (departmentError) {
    throw new Error(`Could not ensure department fixture: ${departmentError.message}`);
  }
}

/**
 * Ensures the E2E user is linked to the shared company and workspace.
 * Why: dashboard navigation expects both company membership and an active owner profile.
 *
 * @param {ReturnType<typeof createAdminClient>} supabase
 * @param {{ userId: string }} authUser
 * @returns {Promise<void>}
 */
async function ensureMembershipAndProfile(supabase, authUser) {
  const { data: existingCompanyMember, error: memberLookupError } = await supabase
    .from("company_member")
    .select("company_member_id")
    .eq("user_id", authUser.userId)
    .eq("company_id", fixtureIds.companyId)
    .limit(1)
    .maybeSingle();

  if (memberLookupError) {
    throw new Error(`Could not inspect company membership fixture: ${memberLookupError.message}`);
  }

  if (existingCompanyMember?.company_member_id) {
    const { error: memberUpdateError } = await supabase
      .from("company_member")
      .update({ role: "owner", is_active: true })
      .eq("company_member_id", existingCompanyMember.company_member_id);

    if (memberUpdateError) {
      throw new Error(`Could not refresh company membership fixture: ${memberUpdateError.message}`);
    }
  } else {
    const { error: memberInsertError } = await supabase.from("company_member").insert({
      company_member_id: fixtureIds.companyMemberId,
      user_id: authUser.userId,
      company_id: fixtureIds.companyId,
      role: "owner",
      is_active: true,
    });

    if (memberInsertError) {
      throw new Error(`Could not create company membership fixture: ${memberInsertError.message}`);
    }
  }

  const { error: profileError } = await supabase.from("profile").upsert(
    {
      profile_id: fixtureIds.profileId,
      profile_code: "ADM001",
      user_id: authUser.userId,
      workspace_id: fixtureIds.workspaceId,
      company_id: fixtureIds.companyId,
      role: "owner",
      status: "active",
      is_active: true,
      department_id: fixtureIds.departmentId,
      location_id: fixtureIds.locationId,
      display_name: "Local Admin",
      job_title: "E2E Admin",
    },
    { onConflict: "profile_id" },
  );

  if (profileError) {
    throw new Error(`Could not ensure owner profile fixture: ${profileError.message}`);
  }
}

/**
 * Ensures the second active employee profile exists in the E2E workspace.
 * Why: the setup gate requires more than one active profile before it stops routing to setup mode.
 *
 * @param {ReturnType<typeof createAdminClient>} supabase
 * @param {{ userId: string }} employeeUser
 * @returns {Promise<void>}
 */
async function ensureEmployeeFixture(supabase, employeeUser) {
  const { data: existingCompanyMember, error: memberLookupError } = await supabase
    .from("company_member")
    .select("company_member_id")
    .eq("user_id", employeeUser.userId)
    .eq("company_id", fixtureIds.companyId)
    .limit(1)
    .maybeSingle();

  if (memberLookupError) {
    throw new Error(`Could not inspect employee membership fixture: ${memberLookupError.message}`);
  }

  if (existingCompanyMember?.company_member_id) {
    const { error: memberUpdateError } = await supabase
      .from("company_member")
      .update({ role: "member", is_active: true })
      .eq("company_member_id", existingCompanyMember.company_member_id);

    if (memberUpdateError) {
      throw new Error(`Could not refresh employee membership fixture: ${memberUpdateError.message}`);
    }
  } else {
    const { error: memberInsertError } = await supabase.from("company_member").insert({
      company_member_id: fixtureIds.employeeCompanyMemberId,
      user_id: employeeUser.userId,
      company_id: fixtureIds.companyId,
      role: "member",
      is_active: true,
    });

    if (memberInsertError) {
      throw new Error(`Could not create employee membership fixture: ${memberInsertError.message}`);
    }
  }

  const { error: profileError } = await supabase.from("profile").upsert(
    {
      profile_id: fixtureIds.employeeProfileId,
      profile_code: "EMP001",
      user_id: employeeUser.userId,
      workspace_id: fixtureIds.workspaceId,
      company_id: fixtureIds.companyId,
      role: "employee",
      status: "active",
      is_active: true,
      department_id: fixtureIds.departmentId,
      location_id: fixtureIds.locationId,
      display_name: "Fixture Employee",
      job_title: "Server",
    },
    { onConflict: "profile_id" },
  );

  if (profileError) {
    throw new Error(`Could not ensure employee profile fixture: ${profileError.message}`);
  }
}

/**
 * Ensures the fixture workspace is complete enough to suppress setup mode.
 * Why: the dashboard shell routes incomplete workspaces into setup mode in every fresh browser context.
 *
 * @param {ReturnType<typeof createAdminClient>} supabase
 * @returns {Promise<void>}
 */
async function ensureSetupCompletionFixture(supabase) {
  const { error: seasonError } = await supabase.from("season").upsert(
    {
      season_id: fixtureIds.seasonId,
      workspace_id: fixtureIds.workspaceId,
      name: "E2E Active Season",
      slug: "e2e-active-season",
      season_type: "default",
      status: "active",
      is_default: true,
      created_by: fixtureIds.profileId,
    },
    { onConflict: "season_id" },
  );

  if (seasonError) {
    throw new Error(`Could not ensure fixture season: ${seasonError.message}`);
  }

  const policyRows = [
    {
      policy_id: fixtureIds.policyIds[0],
      workspace_id: fixtureIds.workspaceId,
      policy_type: "operational",
      policy_scope: "workspace",
      name: "Opening checks",
      statement: "The team completes opening checks before service starts.",
      enforcement_status: "aspirational",
      is_active: true,
      created_by: fixtureIds.profileId,
    },
    {
      policy_id: fixtureIds.policyIds[1],
      workspace_id: fixtureIds.workspaceId,
      policy_type: "safety",
      policy_scope: "workspace",
      name: "Safety walk",
      statement: "Managers verify the floor is safe before each shift.",
      enforcement_status: "aspirational",
      is_active: true,
      created_by: fixtureIds.profileId,
    },
    {
      policy_id: fixtureIds.policyIds[2],
      workspace_id: fixtureIds.workspaceId,
      policy_type: "hr",
      policy_scope: "workspace",
      name: "Shift handoff",
      statement: "Every shift ends with a short team handoff.",
      enforcement_status: "aspirational",
      is_active: true,
      created_by: fixtureIds.profileId,
    },
  ];

  const { error: policyError } = await supabase.from("policy").upsert(policyRows, {
    onConflict: "policy_id",
  });

  if (policyError) {
    throw new Error(`Could not ensure fixture policies: ${policyError.message}`);
  }

  const { error: shiftError } = await supabase.from("schedule_shift").upsert(
    {
      schedule_shift_id: fixtureIds.shiftId,
      workspace_id: fixtureIds.workspaceId,
      employee_id: fixtureIds.employeeProfileId,
      shift_date: "2026-03-23",
      role: "server",
      start_time: "09:00",
      end_time: "17:00",
      work_hours: 7.5,
      breaks: 30,
      day_category: "morning",
      status: "published",
      is_published: true,
      indicator: "blue",
    },
    { onConflict: "schedule_shift_id" },
  );

  if (shiftError) {
    throw new Error(`Could not ensure fixture shift: ${shiftError.message}`);
  }
}

/**
 * Ensures local Playwright has a stable user/workspace fixture.
 * Why: local developers can have arbitrary real data, so tests must create their own baseline.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const supabase = createAdminClient();
  const authUser = await ensureE2EAuthUser(supabase);

  await ensureUserIdentity(supabase, authUser);
  await ensureWorkspaceFixture(supabase);
  await ensureMembershipAndProfile(supabase, authUser);
}

await main();
