"use server";

// ============================================
// enrich-mission.ts — M4 author-enrich Server Actions
//
// Two actions:
//   enrichStageAction  — updates a single engine_stages row. Gate first.
//   activateMissionAction — flips engine_missions.is_active=true.
//                           Pre-condition: every linked stage non-empty.
//
// Invariants enforced:
//   - ADR-0196 Invariant 13: callGateAction BEFORE every supabase mutation.
//   - ADR-0196 Invariant 11: no phantom; both actions produce a real DB write.
//   - ADR-0175: emit via registry events only (reuses journey_version saved;
//               no NEW journey.* event keys added — Phase 2.5 grep stays clean).
//   - ADR-0176: capability literal "journey.publish_mission" is seeded;
//               both actions operate on the publish_mission authority surface.
//   - ADR-0134: actor_id + workspace_id non-null guard via nonEmpty().
// ============================================

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { gateAction } from "@/app/dashboard/_actions/_shared";
import { resolveAdminProfile, assertPlatformAdmin } from "./_shared";

// ─── Input schemas ───────────────────────────────────────────────────────────

const EnrichStageSchema = z.object({
  stage_id: z.string().uuid("stage_id must be a UUID"),
  mission_id: z.string().min(1, "mission_id required"),
  goal: z.string().min(1, "goal cannot be empty"),
  instructions: z.string().min(1, "instructions cannot be empty"),
  success_criteria: z.string().min(1, "success_criteria cannot be empty"),
  creative_freedom: z.number().min(0).max(1).default(0.3),
});

const ActivateMissionSchema = z.object({
  mission_id: z.string().min(1, "mission_id required"),
  /** journey_version_id used for page revalidation path. */
  journey_version_id: z.string().uuid("journey_version_id must be a UUID"),
});

// ─── Return types ─────────────────────────────────────────────────────────────

export type EnrichStageResult = { ok: true; updated_at: string } | { ok: false; error: string };

export type ActivateMissionResult = { ok: true } | { ok: false; error: string; missing?: string[] };

// ─── enrichStageAction ────────────────────────────────────────────────────────

/**
 * Update one `engine_stages` row with author-supplied coaching content.
 *
 * Gate: `journey.publish_mission` authority (same surface as the publish step).
 * The C4 gate is the inner authorisation layer; `assertPlatformAdmin` is the
 * outer godmode boundary.
 *
 * Invariant 13 (ADR-0196): callGateAction → THEN supabase .update(). No exceptions.
 */
export async function enrichStageAction(
  input: z.infer<typeof EnrichStageSchema>,
): Promise<EnrichStageResult> {
  const parsed = EnrichStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const profile = await resolveAdminProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };
  if (!(await assertPlatformAdmin(profile.userId))) {
    return { ok: false, error: "Platform-admin required." };
  }

  const admin = createAdminClient();

  // Verify the stage exists and belongs to this workspace via the mission FK.
  const { data: stage, error: fetchErr } = await admin
    .from("engine_stages")
    .select("stage_id, mission_id")
    .eq("stage_id", parsed.data.stage_id)
    .eq("mission_id", parsed.data.mission_id)
    .single();
  if (fetchErr || !stage) {
    return { ok: false, error: `Stage not found: ${fetchErr?.message ?? "no row"}` };
  }

  // Verify the mission belongs to this workspace (workspace_id guard — tenant isolation).
  const { data: mission, error: missionErr } = await admin
    .from("engine_missions")
    .select("id, workspace_id, is_active")
    .eq("id", parsed.data.mission_id)
    .single();
  if (missionErr || !mission) {
    return { ok: false, error: `Mission not found: ${missionErr?.message ?? "no row"}` };
  }
  if (mission.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Cross-workspace edit forbidden." };
  }
  if (mission.is_active) {
    return { ok: false, error: "Mission is already active — stages are locked post-activation." };
  }

  // ── Invariant 13: gate BEFORE mutation ──────────────────────────────────────
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "journey.publish_mission",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "enrich_stage",
    entityId: parsed.data.stage_id,
  });
  if (!gate.allow) {
    return { ok: false, error: `capability_disabled: ${gate.reason ?? "forbidden"}` };
  }
  if (gate.downgrade_to === "suggest") {
    return {
      ok: false,
      error:
        "capability_disabled: enrich_stage downgraded to suggest; no confirm path in admin UI.",
    };
  }

  // ── Mutation — runs AFTER gate passes ─────────────────────────────────────
  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("engine_stages")
    .update({
      goal: parsed.data.goal,
      instructions: parsed.data.instructions,
      success_criteria: parsed.data.success_criteria,
      creative_freedom: parsed.data.creative_freedom,
    })
    .eq("stage_id", parsed.data.stage_id);

  if (updateErr) {
    return { ok: false, error: `Update failed: ${updateErr.message}` };
  }

  // ── Telemetry — reuse journey_version saved (no new journey.* keys) ────────
  // We emit "journey_version saved" on the version-level artefact; stage edits
  // are authoring events (not runtime) — same destination set (posthog + logger
  // + activity_trail). engine_event excluded for authoring (see ADR-0175 comment).
  // This intentionally does NOT add a new event key. Phase 2.5 grep: clean.
  await emit({
    event: "journey_version saved",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      journey_version_id: parsed.data.mission_id,
      actor_id: profile.profileId,
      workspace_id: profile.workspaceId,
      // Surface "what changed" so the audit trail is meaningful.
      fields_changed: [
        "stage.goal",
        "stage.instructions",
        "stage.success_criteria",
        "stage.creative_freedom",
      ] as ReadonlyArray<string>,
      entity: {
        entity_type: "journey_version",
        entity_id: parsed.data.stage_id,
        entity_label: `stage:${parsed.data.stage_id.slice(0, 8)}`,
      },
    },
  });

  revalidatePath("/platform-admin/journeys/versions");
  return { ok: true, updated_at: now };
}

// ─── activateMissionAction ────────────────────────────────────────────────────

/**
 * Flip `engine_missions.is_active = true` for a published mission.
 *
 * Pre-condition: every linked `engine_stages` row has non-null + non-empty
 * goal, instructions, and success_criteria. If any stage is incomplete, the
 * action returns `{ok:false, error:"stages_incomplete", missing:[stage_ids]}`.
 *
 * Gate: same `journey.publish_mission` authority surface.
 * Invariant 13 (ADR-0196): callGateAction → THEN supabase .update(). No exceptions.
 */
export async function activateMissionAction(
  input: z.infer<typeof ActivateMissionSchema>,
): Promise<ActivateMissionResult> {
  const parsed = ActivateMissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const profile = await resolveAdminProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };
  if (!(await assertPlatformAdmin(profile.userId))) {
    return { ok: false, error: "Platform-admin required." };
  }

  const admin = createAdminClient();

  // Fetch mission with workspace guard.
  const { data: mission, error: missionErr } = await admin
    .from("engine_missions")
    .select("id, workspace_id, is_active, name")
    .eq("id", parsed.data.mission_id)
    .single();
  if (missionErr || !mission) {
    return { ok: false, error: `Mission not found: ${missionErr?.message ?? "no row"}` };
  }
  if (mission.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Cross-workspace activation forbidden." };
  }
  if (mission.is_active) {
    return { ok: false, error: "Mission is already active." };
  }

  // ── Pre-condition: all stages complete ────────────────────────────────────
  const { data: stages, error: stageErr } = await admin
    .from("engine_stages")
    .select("stage_id, goal, instructions, success_criteria")
    .eq("mission_id", parsed.data.mission_id);

  if (stageErr) {
    return { ok: false, error: `Failed to fetch stages: ${stageErr.message}` };
  }
  if (!stages || stages.length === 0) {
    return { ok: false, error: "Mission has no stages — cannot activate." };
  }

  const incomplete = stages
    .filter((s) => !s.goal?.trim() || !s.instructions?.trim() || !s.success_criteria?.trim())
    .map((s) => s.stage_id);

  if (incomplete.length > 0) {
    return { ok: false, error: "stages_incomplete", missing: incomplete };
  }

  // ── Invariant 13: gate BEFORE mutation ──────────────────────────────────────
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "journey.publish_mission",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "activate_mission",
    entityId: parsed.data.mission_id,
  });
  if (!gate.allow) {
    return { ok: false, error: `capability_disabled: ${gate.reason ?? "forbidden"}` };
  }
  if (gate.downgrade_to === "suggest") {
    return {
      ok: false,
      error:
        "capability_disabled: activate_mission downgraded to suggest; no confirm path in admin UI.",
    };
  }

  // ── Mutation — runs AFTER gate passes ─────────────────────────────────────
  const { error: updateErr } = await admin
    .from("engine_missions")
    .update({ is_active: true })
    .eq("id", parsed.data.mission_id);

  if (updateErr) {
    return { ok: false, error: `Activation failed: ${updateErr.message}` };
  }

  // ── Telemetry ───────────────────────────────────────────────────────────────
  // Reuse "journey_version saved" — activation is an authoring event, not a
  // runtime run-event. Phase 2.5 grep: no new journey.* key. Clean.
  await emit({
    event: "journey_version saved",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      journey_version_id: parsed.data.journey_version_id,
      actor_id: profile.profileId,
      workspace_id: profile.workspaceId,
      fields_changed: ["mission.is_active"] as ReadonlyArray<string>,
      entity: {
        entity_type: "journey_version",
        entity_id: parsed.data.mission_id,
        entity_label: `mission:${String(mission.name).slice(0, 32)}`,
      },
    },
  });

  revalidatePath(`/platform-admin/journeys/versions/${parsed.data.journey_version_id}`);
  revalidatePath("/platform-admin/journeys/versions");
  return { ok: true };
}
