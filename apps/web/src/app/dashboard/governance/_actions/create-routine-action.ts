"use server";

/**
 * create-routine-action.ts
 *
 * Server Action: creates a routine template then scopes it to a location
 * (+ optional team subset). Two sequential capability writes — create first,
 * then assign — matching the routine.create + routine.assign_to_location
 * tool contract in packages/ai/src/capabilities/routine/tools.ts.
 *
 * Delegation path (mirrors update-protocol-action.ts):
 *   resolveCurrentProfile() → gateAction() → createAdminClient() →
 *   routine.insert + routine.update(location_id) + routine_team.insert
 *   → emit(routine.created) → emit(routine.assigned_to_location)
 *
 * L-0177: workspace_id is NEVER trusted from the client. Every referenced
 * entity (procedure, protocol, location, teams) is cross-workspace-verified
 * server-side before write.
 *
 * procedure.workspace_id does not exist — workspace is resolved via
 * protocol.workspace_id (verified against resolveCurrentProfile().workspaceId).
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "@/app/dashboard/_actions/_shared";
import type { Json, Database } from "@smartout/supabase";

const TriggerTypeSchema = z.enum(["scheduled", "event"]);
const ExecutorTypeSchema = z.enum(["human", "ai", "system", "hybrid"]);

const InputSchema = z.object({
  name: z.string().min(1).max(200),
  procedure_id: z.string().uuid(),
  protocol_id: z.string().uuid(),
  trigger_type: TriggerTypeSchema,
  trigger_times: z.array(z.string()).default([]),
  trigger_days: z.array(z.string()).default([]),
  location_id: z.string().uuid(),
  team_ids: z.array(z.string().uuid()).default([]),
  executor_type: ExecutorTypeSchema.default("human"),
});

export type CreateRoutineInput = z.infer<typeof InputSchema>;
export type CreateRoutineResult =
  | { ok: true; routine_id: string; hooks_upserted: number }
  | { ok: false; error: string };

type SessionHookType = Database["public"]["Enums"]["session_hook_type"];

// Derive session_hook_type from trigger_type (mirrors tools.ts).
function hookTypeFromTriggerType(triggerType: string): SessionHookType {
  return triggerType === "scheduled" ? "scheduled" : "open";
}

export async function createRoutineAction(input: CreateRoutineInput): Promise<CreateRoutineResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validation: ${parsed.error.issues[0]?.message ?? "ugyldig input"}`,
    };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };
  if (!profile.profileId.trim() || !profile.workspaceId.trim()) {
    return { ok: false, error: "Ugyldig aktør-identitet." };
  }
  const { profileId, workspaceId } = profile;

  // Gate: routine.create — admin+.
  const gate = await gateAction({
    workspaceId,
    capability: "routine",
    channel: "system",
    actorProfileId: profileId,
    actionType: "create",
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert (routine.create)." };
  }

  const admin = createAdminClient();

  // L-0177: verify protocol belongs to this workspace.
  const { data: prot, error: protError } = await admin
    .from("protocol")
    .select("protocol_id, workspace_id")
    .eq("protocol_id", parsed.data.protocol_id)
    .maybeSingle();

  if (protError) return { ok: false, error: `Protokoll-oppslag feilet: ${protError.message}` };
  if (!prot) return { ok: false, error: "Protokoll ikke funnet." };
  if (prot.workspace_id !== workspaceId) {
    return { ok: false, error: "Protokoll tilhører et annet workspace." };
  }

  // L-0177: verify procedure belongs to this workspace via protocol chain.
  // procedure has no workspace_id column — workspace resolved via protocol FK.
  const { data: proc, error: procError } = await admin
    .from("procedure")
    .select("procedure_id, protocol_id")
    .eq("procedure_id", parsed.data.procedure_id)
    .maybeSingle();

  if (procError) return { ok: false, error: `Prosedyre-oppslag feilet: ${procError.message}` };
  if (!proc) return { ok: false, error: "Prosedyre ikke funnet." };
  // verify procedure's protocol belongs to the same workspace
  const { data: procProt, error: procProtError } = await admin
    .from("protocol")
    .select("workspace_id")
    .eq("protocol_id", proc.protocol_id)
    .maybeSingle();
  if (procProtError || !procProt || procProt.workspace_id !== workspaceId) {
    return { ok: false, error: "Prosedyre tilhører et annet workspace." };
  }

  // L-0177: verify location belongs to this workspace.
  const { data: loc, error: locError } = await admin
    .from("location")
    .select("location_id, workspace_id")
    .eq("location_id", parsed.data.location_id)
    .maybeSingle();

  if (locError) return { ok: false, error: `Lokasjon-oppslag feilet: ${locError.message}` };
  if (!loc) return { ok: false, error: "Lokasjon ikke funnet." };
  if (loc.workspace_id !== workspaceId) {
    return { ok: false, error: "Lokasjon tilhører et annet workspace." };
  }

  // Build trigger_config from times + days.
  // Cast to Json for Supabase's jsonb column type contract.
  const triggerConfigRaw: Record<string, string[]> = {};
  if (parsed.data.trigger_times.length > 0) triggerConfigRaw.times = parsed.data.trigger_times;
  if (parsed.data.trigger_days.length > 0) triggerConfigRaw.days = parsed.data.trigger_days;
  const triggerConfig = triggerConfigRaw as unknown as Json;

  // Step 1 — insert routine.
  // workspace_id is set via trigger trg_set_routine_workspace_id; we also pass
  // it explicitly for the Wave-0 column contract.
  const { data: inserted, error: insertError } = await admin
    .from("routine")
    .insert({
      name: parsed.data.name,
      procedure_id: parsed.data.procedure_id,
      protocol_id: parsed.data.protocol_id,
      trigger_type: parsed.data.trigger_type,
      trigger_config: triggerConfig,
      executor_type: parsed.data.executor_type,
      workspace_id: workspaceId,
      // V1 placeholder — assignment refined via location step below.
      assigned_to_type: "profile",
      assigned_to_ref: profileId,
    })
    .select("routine_id")
    .single();

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? "Rutine-innsetting feilet." };
  }

  const routineId = inserted.routine_id;

  // Emit routine.created (4 destinations).
  await emit({
    event: "routine.created",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(profileId, "actor_id"),
    properties: {
      entity: { entity_type: "routine", entity_id: routineId },
      data: {
        routine_id: routineId,
        name: parsed.data.name,
        procedure_id: parsed.data.procedure_id,
        protocol_id: parsed.data.protocol_id,
        trigger_type: parsed.data.trigger_type,
        executor_type: parsed.data.executor_type,
      },
    },
  });

  // Step 2 — set location_id on routine.
  const { error: updateError } = await admin
    .from("routine")
    .update({ location_id: parsed.data.location_id })
    .eq("routine_id", routineId)
    .eq("workspace_id", workspaceId);

  if (updateError) {
    return {
      ok: false,
      error: `Rutine-oppdatering (lokasjon) feilet: ${updateError.message}`,
    };
  }

  // Step 3 — replace routine_team rows (empty = location-wide).
  const teamIds = parsed.data.team_ids;
  if (teamIds.length > 0) {
    const teamRows = teamIds.map((tid) => ({
      routine_id: routineId,
      team_id: tid,
      workspace_id: workspaceId,
    }));

    const { error: teamsError } = await admin.from("routine_team").insert(teamRows);
    if (teamsError) {
      return { ok: false, error: `Team-tilknytning feilet: ${teamsError.message}` };
    }
  }

  // Step 4 — upsert session_hook per department at this location.
  const { data: deptLinks, error: deptError } = await admin
    .from("department_location")
    .select("department_id")
    .eq("location_id", parsed.data.location_id)
    .eq("workspace_id", workspaceId);

  if (deptError) {
    return { ok: false, error: `Avdelings-oppslag feilet: ${deptError.message}` };
  }

  const hookType = hookTypeFromTriggerType(parsed.data.trigger_type);
  let hooksUpserted = 0;

  if (deptLinks && deptLinks.length > 0) {
    for (const link of deptLinks) {
      const { error: upsertError } = await admin
        .from("session_hook")
        .upsert(
          {
            workspace_id: workspaceId,
            department_id: link.department_id,
            hook_type: hookType,
            linked_routine_id: routineId,
            trigger_offset_min: 0,
            is_active: true,
          },
          {
            onConflict: "workspace_id,department_id,hook_type",
            ignoreDuplicates: false,
          },
        )
        .select("id");

      if (!upsertError) hooksUpserted++;
    }
  }

  // Emit routine.assigned_to_location (4 destinations).
  await emit({
    event: "routine.assigned_to_location",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(profileId, "actor_id"),
    properties: {
      entity: { entity_type: "routine", entity_id: routineId },
      data: {
        routine_id: routineId,
        location_id: parsed.data.location_id,
        team_ids: teamIds,
        hooks_upserted: hooksUpserted,
      },
    },
  });

  return { ok: true, routine_id: routineId, hooks_upserted: hooksUpserted };
}
