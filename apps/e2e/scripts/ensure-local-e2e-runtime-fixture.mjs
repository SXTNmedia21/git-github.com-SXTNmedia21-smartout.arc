// ============================================
// ensure-local-e2e-runtime-fixture.mjs
// Provisions a stable local Playwright fixture
// without replacing existing developer data.
//
// Why: the local DB can contain real workspace
// data, so E2E must ensure its own dedicated
// owner user, employee user, and workspace
// completeness markers at runtime.
// ============================================

import process from "node:process";
import { execSync } from "node:child_process";
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
  adminProfileId: "f0000000-0000-0000-0000-000000000000",
  employeeProfileId: "f0000000-0000-0000-0000-000000000001",
  adminCompanyMemberId: "aa000000-0000-0000-0000-000000000001",
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
 * Builds the service-role Supabase client used for fixture provisioning.
 * Why: the script needs auth admin access and bypasses RLS intentionally for test data only.
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
 * Finds or creates a dedicated auth user and refreshes its password.
 * Why: browser login tests need stable password auth, not whichever local user already exists.
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
      throw new Error(`Could not refresh auth user ${email}: ${updateError.message}`);
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
    throw new Error(`Could not create auth user ${email}: ${createError?.message ?? "missing user"}`);
  }

  return { userId: createdUser.user.id, email };
}

/**
 * Ensures the fixture auth users exist for owner and employee flows.
 * Why: setup completion requires at least two active profiles in the workspace.
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
 * Ensures the user_identity row exists with the desired platform flags.
 * Why: dashboard auth and godmode access both bridge through user_identity.
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
    throw new Error(`Could not ensure user_identity for ${identity.email}: ${error.message}`);
  }
}

/**
 * Ensures the shared company/workspace/location/department fixture exists.
 * Why: dashboard tests need a stable workspace context that does not depend on local developer data.
 *
 * @param {ReturnType<typeof createAdminClient>} supabase
 * @returns {Promise<void>}
 */
async function ensureWorkspaceFixture(supabase) {
  const { error: companyError } = await supabase.from("company").upsert(
    {
      company_id: fixtureIds.companyId,
      name: "Smartout E2E Company",
      legal_name: "Smartout E2E Company AS",
      org_number: "999888777",
      country: "NO",
      industry: "other",
      default_language: "no",
      default_currency: "NOK",
      is_active: true,
    },
    { onConflict: "company_id" },
  );

  if (companyError) {
    throw new Error(`Could not ensure company fixture: ${companyError.message}`);
  }

  const { error: workspaceError } = await supabase.from("workspace").upsert(
    {
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
      // Dashboard setup gate: `isSetupMode` = !setup_guide_completed &&
      // !setupDismissed. When false, DashboardShell hard-navigates to
      // /dashboard/setup on mount — which breaks every dashboard-scoped E2E.
      // Mark the fixture workspace as fully provisioned.
      onboarding_completed: true,
      setup_guide_completed: true,
      contract_status: "active",
    },
    { onConflict: "workspace_id" },
  );

  if (workspaceError) {
    throw new Error(`Could not ensure workspace fixture: ${workspaceError.message}`);
  }

  const { error: locationError } = await supabase.from("location").upsert(
    {
      location_id: fixtureIds.locationId,
      workspace_id: fixtureIds.workspaceId,
      name: "Oslo Downtown Hub",
      slug: "oslo-downtown",
      location_type: "main",
      is_active: true,
    },
    { onConflict: "location_id" },
  );

  if (locationError) {
    throw new Error(`Could not ensure location fixture: ${locationError.message}`);
  }

  const { error: departmentError } = await supabase.from("department").upsert(
    {
      department_id: fixtureIds.departmentId,
      workspace_id: fixtureIds.workspaceId,
      name: "Operations",
      slug: "operations",
      sort_order: 0,
      is_active: true,
    },
    { onConflict: "department_id" },
  );

  if (departmentError) {
    throw new Error(`Could not ensure department fixture: ${departmentError.message}`);
  }
}

/**
 * Ensures a company_member row exists for the given user.
 * Why: workspace access checks rely on company membership being present and active.
 *
 * @param {ReturnType<typeof createAdminClient>} supabase
 * @param {{ userId: string, companyMemberId: string, role: "owner" | "member" }} member
 * @returns {Promise<void>}
 */
async function ensureCompanyMember(supabase, member) {
  const { data: existingCompanyMember, error: memberLookupError } = await supabase
    .from("company_member")
    .select("company_member_id")
    .eq("user_id", member.userId)
    .eq("company_id", fixtureIds.companyId)
    .limit(1)
    .maybeSingle();

  if (memberLookupError) {
    throw new Error(`Could not inspect company membership fixture: ${memberLookupError.message}`);
  }

  if (existingCompanyMember?.company_member_id) {
    const { error: memberUpdateError } = await supabase
      .from("company_member")
      .update({ role: member.role, is_active: true })
      .eq("company_member_id", existingCompanyMember.company_member_id);

    if (memberUpdateError) {
      throw new Error(`Could not refresh company membership fixture: ${memberUpdateError.message}`);
    }

    return;
  }

  const { error: memberInsertError } = await supabase.from("company_member").insert({
    company_member_id: member.companyMemberId,
    user_id: member.userId,
    company_id: fixtureIds.companyId,
    role: member.role,
    is_active: true,
  });

  if (memberInsertError) {
    throw new Error(`Could not create company membership fixture: ${memberInsertError.message}`);
  }
}

/**
 * Ensures the admin and employee profiles exist in the fixture workspace.
 * Why: the setup gate requires more than one active profile, and dashboard tests need an owner profile.
 *
 * @param {ReturnType<typeof createAdminClient>} supabase
 * @param {{ adminUser: { userId: string }, employeeUser: { userId: string } }} users
 * @returns {Promise<void>}
 */
async function ensureProfiles(supabase, users) {
  await ensureCompanyMember(supabase, {
    userId: users.adminUser.userId,
    companyMemberId: fixtureIds.adminCompanyMemberId,
    role: "owner",
  });
  await ensureCompanyMember(supabase, {
    userId: users.employeeUser.userId,
    companyMemberId: fixtureIds.employeeCompanyMemberId,
    role: "member",
  });

  const profiles = [
    {
      profile_id: fixtureIds.adminProfileId,
      profile_code: "ADM001",
      user_id: users.adminUser.userId,
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
    {
      profile_id: fixtureIds.employeeProfileId,
      profile_code: "EMP001",
      user_id: users.employeeUser.userId,
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
  ];

  for (const profile of profiles) {
    const { error: profileError } = await supabase
      .from("profile")
      .upsert(profile, { onConflict: "profile_id" });

    if (profileError) {
      throw new Error(`Could not ensure fixture profile: ${profileError.message}`);
    }
  }
}

/**
 * Ensures the fixture workspace looks complete to the dashboard setup query.
 * Why: this prevents every fresh browser context from being routed into setup mode.
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
      created_by: fixtureIds.adminProfileId,
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
      created_by: fixtureIds.adminProfileId,
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
      created_by: fixtureIds.adminProfileId,
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
      created_by: fixtureIds.adminProfileId,
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
 * Resolves the local Supabase anon key, preferring env then `supabase status`.
 * Why: the verifier MUST use the anon key (not service role) to prove a real client login works,
 * and the wrapper script only exports SERVICE_ROLE_KEY — so we read ANON_KEY from CLI status if missing.
 *
 * @returns {string}
 */
function resolveAnonKey() {
  const fromEnv = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const raw = execSync("npx supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = JSON.parse(raw);
    if (typeof parsed.ANON_KEY === "string" && parsed.ANON_KEY.length > 0) {
      return parsed.ANON_KEY;
    }
    throw new Error("supabase status JSON did not include ANON_KEY");
  } catch (cliError) {
    throw new Error(
      `Could not resolve Supabase anon key for fixture verifier: ${cliError instanceof Error ? cliError.message : String(cliError)}. ` +
        "Set SUPABASE_ANON_KEY or ensure `npx supabase status` works.",
    );
  }
}

/**
 * Verifies that both fixture users can actually sign in with password auth.
 * Why: upserts can succeed silently while leaving auth in a broken state (wrong password hash,
 * missing email_confirm, etc). Without a readback, callers trust exit 0 and discover the
 * fixture was empty only after 10/14 tests fail at login. L-0107.
 *
 * @returns {Promise<void>}
 */
async function verifyFixtureLogins() {
  const anonKey = resolveAnonKey();
  const supabase = createClient(process.env.SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const credentials = [
    { email: e2eEmail, password: e2ePassword },
    { email: e2eEmployeeEmail, password: e2eEmployeePassword },
  ];

  for (const { email, password } of credentials) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(
        `[fixture] verifier login FAILED for ${email}: ${error.message}. ` +
          "Fixture provisioning succeeded at the upsert layer but the auth user cannot sign in. " +
          "Do NOT paper over — root-cause the auth setup before re-running.",
      );
    }
    // Sign out to release the session so the next iteration starts clean.
    await supabase.auth.signOut();
  }

  console.log(`[fixture] verified login: ${e2eEmail}, ${e2eEmployeeEmail}`);
}

/**
 * Ensures local Playwright has a stable runtime fixture.
 * Why: the broader suite should run against its own known-good baseline, not inferred local data.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const supabase = createAdminClient();
  const users = await ensureFixtureAuthUsers(supabase);

  await ensureUserIdentity(supabase, {
    ...users.adminUser,
    firstName: "Local",
    lastName: "Admin",
    isGodmode: true,
  });
  await ensureUserIdentity(supabase, {
    ...users.employeeUser,
    firstName: "Fixture",
    lastName: "Employee",
  });
  await ensureWorkspaceFixture(supabase);
  await ensureProfiles(supabase, users);
  await ensureSetupCompletionFixture(supabase);

  // L-0107: self-verifying fixture. Provisioning is not "done" until both users
  // can prove they can sign in. Failure here surfaces silent fixture-drops
  // before 14 downstream tests cascade-fail at login.
  await verifyFixtureLogins();
}

await main();
