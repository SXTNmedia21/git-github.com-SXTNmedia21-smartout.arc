/**
 * journey-seed.ts — E2E fixtures for the Journey Engine tests.
 *
 * Why: `apps/e2e/tests/journey-engine.spec.ts` covers J1–J4 (admin authoring),
 * J7/J8 (Fjernkontroll realtime), and J11 (run_guided dual-gate). Each needs
 * specific DB state that `seed.sql` does not cover:
 *
 *   - J1–J4  : at least one `journey` row to pick as parent in the new-version
 *              form, plus (optionally) a pre-seeded `journey_version` row in
 *              `draft` status for edit/transition/run page tests.
 *   - J7/J8  : an `engine_state` run tied to the admin workspace so the
 *              Fjernkontroll has a `runId` to subscribe to. Tests then inject
 *              `engine_event` rows to trigger state transitions.
 *   - J11    : `engine_authority_config.level = 'disabled'` for
 *              `journey.run_guided` in a test workspace so the BFF gate
 *              returns 403.
 *
 * Contract:
 *   - Service-role client only — RLS is bypassed for fixtures.
 *   - Every seed fn returns the minimal identity fields the test needs.
 *   - `cleanupJourneyFixtures()` deletes everything in reverse-FK order.
 *   - No 1Password — creds come from apps/e2e/.env.local (gitignored).
 *
 * Binding ADRs:
 *   - 0173 (capability model)  — the 4 journey capabilities are the only
 *     values `seedDisabledAuthority()` will accept by default.
 *   - 0176 (authority seed)    — `engine_authority_config.level = 'disabled'`
 *     is the supported kill-switch (see 20260516000400_journey_authority_seed.sql).
 *   - 0177 (UI contract)       — the Fjernkontroll subscribes to `engine_event`
 *     filtered by run_id; tests insert events via `supabase.from("engine_event")`.
 */

import { supabase } from "./seed";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Seeded HQ workspace id — the admin@smartout.local profile lives here. */
export const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
/** Seeded admin user id — already a godmode user (see seed.sql step 8). */
export const ADMIN_USER_ID = "e0000000-0000-0000-0000-000000000000";
/** Seeded admin profile id — see seed.sql. */
export const ADMIN_PROFILE_ID = "f0000000-0000-0000-0000-000000000000";

/** Canonical journey capability names (ADR-0173). */
export type JourneyCapability =
  | "journey.run_dev"
  | "journey.publish_mission"
  | "journey.publish_guide"
  | "journey.run_guided";

/** Canonical engine_authority_config.level values (CHECK constraint, ADR-0176). */
export type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SeededJourneyVersion = {
  journey_version_id: string;
  journey_id: string;
  slug: string;
  status: string;
};

type SeededActiveRun = {
  run_id: string;
  process_id: string;
  step_ids: string[];
  step_keys: string[];
};

export type JourneyFixtureIds = {
  workspace_ids?: string[];
  journey_ids?: string[];
  journey_version_ids?: string[];
  run_ids?: string[];
  engine_process_ids?: string[];
  authority_ids?: string[];
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Parent journey — J1–J4 need at least one row to pick from.
// ---------------------------------------------------------------------------

/**
 * Insert a minimal `journey` row in the given workspace. Returns the id.
 *
 * Why: `/platform-admin/journeys/versions/new` lists parent journeys via a
 * workspace-scoped read; if none exist, the form is unusable.
 *
 * @param workspaceId - Target workspace. Defaults to HQ.
 * @param slug        - Journey slug; unique per workspace.
 */
export async function seedParentJourney(opts?: {
  workspaceId?: string;
  slug?: string;
  title?: string;
}): Promise<{ journey_id: string; slug: string }> {
  const workspaceId = opts?.workspaceId ?? HQ_WORKSPACE_ID;
  const suffix = uniqueSuffix();
  const slug = opts?.slug ?? `e2e-parent-${suffix}`;
  const title = opts?.title ?? `E2E Parent Journey ${suffix}`;

  const { data, error } = await supabase
    .from("journey")
    .insert({
      workspace_id: workspaceId,
      slug,
      code: `E2E-${suffix}`,
      title,
      actor: "admin",
      module: "onboarding",
      platform: "desktop",
      priority: "P2",
      status: "idea",
      created_by: ADMIN_USER_ID,
    })
    .select("journey_id, slug")
    .single();

  if (error) throw new Error(`seedParentJourney failed: ${error.message}`);
  return data as { journey_id: string; slug: string };
}

// ---------------------------------------------------------------------------
// Journey versions — `draft` for J2/J3, `published` for J5/J11.
// ---------------------------------------------------------------------------

const MINIMAL_IR = {
  version: "1.0" as const,
  meta: {
    module: "onboarding",
    actor: "admin",
    platform: "desktop",
    priority: "P2",
  },
  steps: [
    {
      key: "step-intro",
      title: "Introduction",
      description: "E2E skeleton step",
      action: "view",
    },
    {
      key: "step-confirm",
      title: "Confirm",
      description: "E2E skeleton confirmation",
      action: "click",
    },
  ],
};

/**
 * Insert a `journey_version` in `draft` status. Returns ids + slug.
 *
 * Creates the parent journey on-demand if `journey_id` is not supplied,
 * so J1/J2/J3 tests don't have to chain seed calls.
 */
export async function seedDraftJourneyVersion(opts?: {
  workspaceId?: string;
  journeyId?: string;
  slug?: string;
  title?: string;
}): Promise<SeededJourneyVersion> {
  const workspaceId = opts?.workspaceId ?? HQ_WORKSPACE_ID;
  let journeyId = opts?.journeyId;
  let slug = opts?.slug;
  if (!journeyId) {
    const parent = await seedParentJourney({
      workspaceId,
      slug: slug ?? undefined,
      title: opts?.title,
    });
    journeyId = parent.journey_id;
    slug = parent.slug;
  } else if (!slug) {
    // Re-read the parent to pick up its slug (used by test-run URL in some flows).
    const { data } = await supabase
      .from("journey")
      .select("slug")
      .eq("journey_id", journeyId)
      .maybeSingle();
    slug = (data?.slug as string | undefined) ?? `e2e-unknown-${uniqueSuffix()}`;
  }

  const { data, error } = await supabase
    .from("journey_version")
    .insert({
      workspace_id: workspaceId,
      journey_id: journeyId,
      status: "draft",
      ir_json: MINIMAL_IR,
      created_by: ADMIN_USER_ID,
    })
    .select("journey_version_id, journey_id, status")
    .single();

  if (error) throw new Error(`seedDraftJourneyVersion failed: ${error.message}`);
  return {
    journey_version_id: (data as { journey_version_id: string }).journey_version_id,
    journey_id: journeyId,
    slug: slug as string,
    status: (data as { status: string }).status,
  };
}

/**
 * Insert a `journey_version` in `published` status. Used by J5 and J11.
 */
export async function seedPublishedJourneyVersion(opts?: {
  workspaceId?: string;
  journeyId?: string;
  slug?: string;
}): Promise<SeededJourneyVersion> {
  const seeded = await seedDraftJourneyVersion(opts);
  const { data, error } = await supabase
    .from("journey_version")
    .update({ status: "published" })
    .eq("journey_version_id", seeded.journey_version_id)
    .select("status")
    .single();

  if (error) throw new Error(`seedPublishedJourneyVersion update failed: ${error.message}`);
  return { ...seeded, status: (data as { status: string }).status };
}

// ---------------------------------------------------------------------------
// Active run — engine_state + engine_state_step rows for J7/J8.
// ---------------------------------------------------------------------------

const JOURNEY_RUN_PROCESS_ID = "e2e_journey_run";

/**
 * Ensure a global engine_process row exists so engine_state FK resolves.
 * engine_process.workspace_id is nullable — one row covers every workspace.
 *
 * Idempotent — safe to call once per test or once per suite.
 */
async function ensureEngineRunProcess(): Promise<string> {
  const { data: existing } = await supabase
    .from("engine_process")
    .select("id")
    .eq("id", JOURNEY_RUN_PROCESS_ID)
    .maybeSingle();
  if (existing) return JOURNEY_RUN_PROCESS_ID;

  const { error } = await supabase
    .from("engine_process")
    .insert({
      id: JOURNEY_RUN_PROCESS_ID,
      name: "E2E Journey Run",
      description: "Ephemeral process used by E2E journey-engine fixtures.",
      is_active: true,
      max_steps: 32,
      allowed_channels: ["chat", "system"],
    });
  if (error) throw new Error(`ensureEngineRunProcess failed: ${error.message}`);
  return JOURNEY_RUN_PROCESS_ID;
}

/**
 * Seed an active `engine_state` run with `step_count` pending steps.
 *
 * The returned `run_id` is the primary key the Fjernkontroll subscribes to
 * via `engine_event.entity_id=eq.<runId>`. Tests insert into `engine_event`
 * directly (via `supabase.from("engine_event").insert(...)`) to fire
 * `journey stuck` / `journey completed` transitions.
 *
 * Note: engine_state.status accepts `pending | active | waiting | complete |
 * failed | escalated`. We insert as `active` — mimics a running journey.
 */
export async function seedActiveRun(opts: {
  workspaceId?: string;
  journeyVersionId: string;
  actorProfileId?: string;
  stepCount?: number;
}): Promise<SeededActiveRun> {
  const workspaceId = opts.workspaceId ?? HQ_WORKSPACE_ID;
  const actorProfileId = opts.actorProfileId ?? ADMIN_PROFILE_ID;
  const stepCount = Math.max(1, opts.stepCount ?? 2);

  const processId = await ensureEngineRunProcess();

  const { data: state, error: stateErr } = await supabase
    .from("engine_state")
    .insert({
      process_id: processId,
      workspace_id: workspaceId,
      status: "active",
      current_step: 0,
      entity_type: "journey_run",
      entity_id: opts.journeyVersionId,
      assignee_id: actorProfileId,
      context: { journey_version_id: opts.journeyVersionId, surface: "e2e" },
    })
    .select("id")
    .single();

  if (stateErr || !state) throw new Error(`seedActiveRun(state) failed: ${stateErr?.message}`);
  const runId = (state as { id: string }).id;

  // Insert pending step rows so Fjernkontroll-style consumers can iterate.
  const stepKeys = Array.from({ length: stepCount }, (_, idx) => `step-${idx + 1}`);
  const stepRows = stepKeys.map((key, idx) => ({
    state_id: runId,
    step_order: idx,
    status: idx === 0 ? "active" : "pending",
    action_type: "view",
    action_payload: { step_key: key },
  }));

  const { data: steps, error: stepErr } = await supabase
    .from("engine_state_step")
    .insert(stepRows)
    .select("id");

  if (stepErr || !steps) throw new Error(`seedActiveRun(steps) failed: ${stepErr?.message}`);

  return {
    run_id: runId,
    process_id: processId,
    step_ids: (steps as Array<{ id: string }>).map((s) => s.id),
    step_keys: stepKeys,
  };
}

// ---------------------------------------------------------------------------
// Disabled authority — J11 dual-gate.
// ---------------------------------------------------------------------------

/**
 * Flip the `engine_authority_config.level` for `capability` in `workspace_id`
 * to `disabled`. Upserts so a missing row is created too (idempotent).
 *
 * The J11 test depends on the BFF `gateAction()` call returning 403 when
 * the level is `disabled`. Restore via `cleanupJourneyFixtures()` or
 * `restoreAuthority()`.
 */
export async function seedDisabledAuthority(opts: {
  workspaceId?: string;
  capability: JourneyCapability;
}): Promise<void> {
  const workspaceId = opts.workspaceId ?? HQ_WORKSPACE_ID;
  // Try update first (seed migration already inserted rows for the 4 caps).
  const { data: updated, error: updateErr } = await supabase
    .from("engine_authority_config")
    .update({ level: "disabled" })
    .eq("workspace_id", workspaceId)
    .eq("capability", opts.capability)
    .select("id");

  if (updateErr) throw new Error(`seedDisabledAuthority(update) failed: ${updateErr.message}`);
  if (updated && updated.length > 0) return;

  // Fallback — migration not present (older DB). Insert minimal row.
  const { error: insertErr } = await supabase.from("engine_authority_config").insert({
    workspace_id: workspaceId,
    capability: opts.capability,
    level: "disabled",
    min_role: opts.capability === "journey.run_guided" ? "employee" : "admin",
    requires_four_eyes: false,
    observer_escalation_hours: 72,
  });
  if (insertErr) throw new Error(`seedDisabledAuthority(insert) failed: ${insertErr.message}`);
}

/**
 * Restore a capability to its seed default level — counterpart to
 * `seedDisabledAuthority()`.
 */
export async function restoreAuthority(opts: {
  workspaceId?: string;
  capability: JourneyCapability;
  level?: AuthorityLevel;
}): Promise<void> {
  const workspaceId = opts.workspaceId ?? HQ_WORKSPACE_ID;
  const defaultLevel: AuthorityLevel =
    opts.level ?? (opts.capability === "journey.run_guided" ? "autonomous" : "suggest");
  const { error } = await supabase
    .from("engine_authority_config")
    .update({ level: defaultLevel })
    .eq("workspace_id", workspaceId)
    .eq("capability", opts.capability);
  if (error) throw new Error(`restoreAuthority failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Cleanup — delete in reverse FK order.
// ---------------------------------------------------------------------------

/**
 * Delete every row produced by the helpers above, in reverse-FK order.
 * Tolerant to missing tables / rows — errors are logged, not thrown, so
 * afterAll always completes.
 *
 * Workspaces are NOT deleted by default — the HQ workspace is seeded and
 * shared by many tests. Pass `workspace_ids` only when the test owns a
 * workspace it also created.
 */
export async function cleanupJourneyFixtures(ids: JourneyFixtureIds): Promise<void> {
  // 1. engine_event rows referencing the run ids
  if (ids.run_ids?.length) {
    const { error } = await supabase
      .from("engine_event")
      .delete()
      .in("idempotency_key", ids.run_ids.map((rid) => `e2e-${rid}`));
    if (error) console.warn(`cleanupJourneyFixtures(engine_event): ${error.message}`);
  }

  // 2. engine_state_step cascades on state delete — but explicit is clearer.
  if (ids.run_ids?.length) {
    const { error: stepErr } = await supabase
      .from("engine_state_step")
      .delete()
      .in("state_id", ids.run_ids);
    if (stepErr) console.warn(`cleanupJourneyFixtures(engine_state_step): ${stepErr.message}`);

    const { error: stateErr } = await supabase.from("engine_state").delete().in("id", ids.run_ids);
    if (stateErr) console.warn(`cleanupJourneyFixtures(engine_state): ${stateErr.message}`);
  }

  // 3. journey_version rows
  if (ids.journey_version_ids?.length) {
    const { error } = await supabase
      .from("journey_version")
      .delete()
      .in("journey_version_id", ids.journey_version_ids);
    if (error) console.warn(`cleanupJourneyFixtures(journey_version): ${error.message}`);
  }

  // 4. journey rows
  if (ids.journey_ids?.length) {
    const { error } = await supabase.from("journey").delete().in("journey_id", ids.journey_ids);
    if (error) console.warn(`cleanupJourneyFixtures(journey): ${error.message}`);
  }

  // 5. engine_process — only delete the one created by tests (never seeded id).
  if (ids.engine_process_ids?.length) {
    const killList = ids.engine_process_ids.filter(
      (id) => id === JOURNEY_RUN_PROCESS_ID || id.startsWith("e2e_"),
    );
    if (killList.length) {
      const { error } = await supabase.from("engine_process").delete().in("id", killList);
      if (error) console.warn(`cleanupJourneyFixtures(engine_process): ${error.message}`);
    }
  }

  // 6. Workspaces (only if test created them).
  if (ids.workspace_ids?.length) {
    const { error } = await supabase
      .from("workspace")
      .delete()
      .in("workspace_id", ids.workspace_ids);
    if (error) console.warn(`cleanupJourneyFixtures(workspace): ${error.message}`);
  }

  // 7. Authority restore — by id list not used; callers invoke restoreAuthority().
}
