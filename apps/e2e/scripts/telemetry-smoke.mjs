// ============================================
// telemetry-smoke.mjs
// Runs the local website telemetry smoke spec
// and verifies both activity_trail and
// journey_test_run afterwards.
// Why: local Playwright should prove the full
// telemetry path, not just UI rendering.
// ============================================

import { spawnSync } from "node:child_process";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const journeySlug = "admin-creates-website-from-template";
const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const e2eAdminEmail = process.env.E2E_EMAIL ?? "admin@smartout.local";

/**
 * Ensures the verifier has the env needed to inspect local Supabase state.
 * Why: the smoke command should fail clearly instead of producing false negatives.
 *
 * @returns void
 */
function assertRequiredEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Telemetry smoke is missing env vars: ${missing.join(", ")}`);
  }
}

/**
 * Runs the dedicated Playwright smoke spec with inherited local env.
 * Why: the reporter must execute in the same process tree as the tested journey.
 *
 * @returns void
 */
function runSmokeSpec() {
  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "tests/telemetry-smoke.spec.ts"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        SKIP_WEB_SERVER: process.env.SKIP_WEB_SERVER ?? "1",
      },
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Loads the journey row so the verifier can target the reporter output.
 * Why: journey_test_run rows are keyed by journey_id, not slug.
 *
 * @returns Journey identity and workspace reference
 */
async function fetchJourney(supabase) {
  const { data, error } = await supabase
    .from("journey")
    .select("journey_id, workspace_id")
    .eq("slug", journeySlug)
    .single();

  if (error || !data) {
    throw new Error(`Telemetry smoke could not load journey "${journeySlug}": ${error?.message}`);
  }

  return data;
}

/**
 * Ensures the logged-in e2e admin is an owner in the smoke workspace.
 * Why: local dashboard context can resolve different workspaces during e2e runs,
 * and website actions gate writes through is_admin_in_workspace(user, workspace).
 *
 * @returns Promise<void>
 */
async function ensureAdminAccessToAllWorkspaces(supabase) {
  const {
    data: { users },
    error: usersError,
  } = await supabase.auth.admin.listUsers();

  if (usersError) {
    throw new Error(`Telemetry smoke could not list auth users: ${usersError.message}`);
  }

  const adminUser = users.find((user) => user.email === e2eAdminEmail);
  if (!adminUser) {
    throw new Error(`Telemetry smoke could not find auth user ${e2eAdminEmail}`);
  }

  const { data: workspaces, error: workspaceError } = await supabase
    .from("workspace")
    .select("workspace_id");

  if (workspaceError || !workspaces) {
    throw new Error(`Telemetry smoke could not load workspaces: ${workspaceError?.message ?? "missing rows"}`);
  }

  for (const workspace of workspaces) {
    const workspaceId = workspace.workspace_id;
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("user_id", adminUser.id)
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();

    if (profileLookupError) {
      throw new Error(`Telemetry smoke could not inspect admin profile: ${profileLookupError.message}`);
    }

    if (existingProfile?.profile_id) {
      const { error: updateError } = await supabase
        .from("profile")
        .update({ role: "owner", status: "active", is_active: true })
        .eq("profile_id", existingProfile.profile_id);

      if (updateError) {
        throw new Error(`Telemetry smoke could not update admin profile: ${updateError.message}`);
      }

      continue;
    }

    const { error: insertError } = await supabase.from("profile").insert({
      workspace_id: workspaceId,
      display_name: "E2E Admin",
      profile_code: `E2E-${Date.now()}-${workspaceId.slice(0, 4)}`,
      user_id: adminUser.id,
      role: "owner",
      status: "active",
      is_active: true,
    });

    if (insertError) {
      throw new Error(`Telemetry smoke could not create admin profile: ${insertError.message}`);
    }
  }
}

/**
 * Ensures the smoke journey exists in local Supabase before the reporter runs.
 * Why: the reporter skips inserts when the journey slug is missing.
 *
 * @returns Promise<void>
 */
async function ensureJourneyExists(supabase, workspaceId) {
  const { data: existing } = await supabase
    .from("journey")
    .select("journey_id")
    .eq("slug", journeySlug)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { error: insertError } = await supabase.from("journey").insert({
    actor: "admin",
    code: "e2e-admin-creates-website-from-template",
    module: "meta",
    platform: "desktop",
    preconditions: [],
    priority: "P2",
    related_journeys: [],
    slug: journeySlug,
    status: "active",
    tags: ["e2e", "telemetry-smoke"],
    title: "Admin creates website from template",
    version: 1,
    workspace_id: workspaceId,
  });

  if (insertError) {
    throw new Error(`Telemetry smoke could not create journey "${journeySlug}": ${insertError.message}`);
  }
}

/**
 * Returns a stable workspace ID for smoke-only metadata like the journey row.
 * Why: the reporter needs a journey workspace even before the Playwright run starts.
 *
 * @returns The first available workspace ID
 */
async function getJourneyWorkspaceId(supabase) {
  const { data, error } = await supabase.from("workspace").select("workspace_id").limit(1).single();

  if (error || !data?.workspace_id) {
    throw new Error(
      `Telemetry smoke could not resolve the journey workspace: ${error?.message ?? "missing workspace"}`,
    );
  }

  return data.workspace_id;
}

/**
 * Verifies the journey reporter wrote a fresh journey_test_run row.
 * Why: this proves Playwright reporting persisted to the local database.
 *
 * @returns Promise resolving to the workspace ID associated with the run
 */
async function verifyJourneyRun(supabase, sinceIso, journeyId) {
  const { data, error } = await supabase
    .from("journey_test_run")
    .select("workspace_id, result, created_at")
    .eq("journey_id", journeyId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Telemetry smoke did not record journey_test_run: ${error?.message ?? "missing row"}`);
  }

  if (data.result !== "pass") {
    throw new Error(`Telemetry smoke journey_test_run result was "${data.result}"`);
  }

  return data.workspace_id;
}

/**
 * Verifies a real product telemetry event landed in activity_trail.
 * Why: the smoke must prove mutation telemetry, not only reporter metadata.
 * The mutation may run in a different workspace than the synthetic journey row,
 * so we verify the fresh event globally and only use workspace as a soft hint.
 *
 * @returns Promise<void>
 */
async function verifyActivityTrail(supabase, sinceIso, workspaceId) {
  const baseQuery = supabase
    .from("activity_trail")
    .select("event, created_at, workspace_id")
    .eq("event", "website setup completed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1);

  const scopedResult = workspaceId
    ? await baseQuery.eq("workspace_id", workspaceId).maybeSingle()
    : { data: null, error: null };

  if (scopedResult.data) {
    return;
  }

  const { data, error } = await supabase
    .from("activity_trail")
    .select("event, created_at, workspace_id")
    .eq("event", "website setup completed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Telemetry smoke did not record activity_trail event "website setup completed": ${error?.message ?? "missing row"}`,
    );
  }
}

async function main() {
  assertRequiredEnv();

  const sinceIso = new Date().toISOString();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const journeyWorkspaceId = await getJourneyWorkspaceId(supabase);
  await ensureAdminAccessToAllWorkspaces(supabase);
  await ensureJourneyExists(supabase, journeyWorkspaceId);
  const journey = await fetchJourney(supabase);
  runSmokeSpec();

  const workspaceId = await verifyJourneyRun(supabase, sinceIso, journey.journey_id);
  await verifyActivityTrail(supabase, sinceIso, workspaceId ?? journey.workspace_id);

  console.log("[telemetry-smoke] Verified journey_test_run and activity_trail");
}

main().catch((error) => {
  console.error(`[telemetry-smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
