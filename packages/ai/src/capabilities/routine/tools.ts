/**
 * Routine capability tools — ADR-0367 BT2 + procedure-engine Phase 1.
 *
 * Tools (Phase 1 additions — procedure-engine-phase1, 2026-05-22):
 *   createRoutineTool       (Task 3) — insert routine bound to procedure + protocol.
 *   assignRoutineToLocation (Task 4) — scope routine to a location + optional team subset.
 *   addStepTool             (Task 5b) — append a step to a routine's procedure.
 *
 * Existing tool:
 *   attachToLine — materialises a routine template into a day_line's task set.
 *
 * Delegation contract (ADR-0240):
 *   attachToLine MUST NOT write directly to session_task.
 *   All task creation is delegated to task.create_session.execute() — the owning
 *   capability for session_task writes. ADR-0173 frozen-4 namespace boundaries apply.
 *   The ADR-0240 test in __tests__/tools.test.ts enforces this at CI time.
 *
 * Authority: confirm, manager+ (attach_to_line, assign_to_location, add_step).
 *            admin (create — routine creation is an admin authoring act).
 *
 * Channel: chat-only. Voice rejected at tool body (ADR-0078).
 *
 * Column adaptations (pre-flight verified 2026-05-22):
 *   - routine table uses assigned_to_type (ENUM: team|role|profile) + assigned_to_ref (uuid)
 *     for V1 assignment; Wave-0 adds location_id + workspace_id + executor_type.
 *   - procedure_step columns: step_id, procedure_id, title, description, step_order,
 *     is_required, estimated_minutes. NO training_content / media_urls / is_compliance_required.
 *   - session_hook UNIQUE(workspace_id, department_id, hook_type); linked_routine_id present.
 *   - location→department: M:N via department_location junction (department_id, location_id).
 *   - session_hook_type ENUM: pre_open | open | scheduled | pre_close | close.
 *     trigger_type ENUM: scheduled | event. Mapping: scheduled→scheduled, event→open.
 */

import { z } from "zod";
import { emit, nonEmpty } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gateRoutineAction } from "./gate.js";
import { createSession } from "../task/tools.js";

// ─── Shared Zod primitives ─────────────────────────────────────────────────
const UUIDSchema = z.string().uuid();
const TriggerTypeSchema = z.enum(["scheduled", "event"]);
const ExecutorTypeSchema = z.enum(["human", "ai", "system", "hybrid"]);

const CAPABILITY = "routine" as const;

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

// ─────────────────────────────────────────────────────────────────────────────
// Tool — routine.attach_to_line
// Channel: CHAT-ONLY (ADR-0078 — free-text item title PII risk)
// Gate: routine.attach_to_line, confirm, manager+
// Delegates: task.create_session.execute() per item (ADR-0240)
// ─────────────────────────────────────────────────────────────────────────────

export const attachToLine = defineTool({
  name: "attach_to_line",
  description:
    "Materialiserer en rutine-mal til et day_line's oppgavesett. " +
    "Bruk når en leder sier 'koble rutinen til dagslinjen', 'legg til åpningsrutinen', " +
    "'sett opp standardoppgaver for denne linjen'. " +
    "Krever manager+ tilgangsnivå. Kun tilgjengelig i chat (ikke stemme) — V1 kanal-policy. " +
    "Oppretter session-oppgaver via task.create_session (ADR-0240 — ingen direkte DB-skriving). " +
    "Returnerer antall opprettede oppgaver og UUID-listen.",
  capability: CAPABILITY,
  schema: z
    .object({
      day_line_id: z.string().uuid().describe("UUID for day_line oppgavene festes til."),
      items: z
        .array(
          z.object({
            title: z.string().min(1).max(200).describe("Tittel på oppgaven (maks 200 tegn)."),
            description: z
              .string()
              .max(2000)
              .optional()
              .describe("Valgfri beskrivelse av oppgaven (maks 2000 tegn)."),
            scheduled_at: z
              .string()
              .datetime()
              .optional()
              .describe("Valgfri ISO-8601 tid for når oppgaven skal utføres."),
          }),
        )
        .min(1)
        .max(50)
        .describe("Liste over oppgaver som skal opprettes (1–50 elementer)."),
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078): chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan rutine-tilknytning bare utføres i chat, ikke via stemme (V1-policy).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Step 1 — resolve day_line workspace + department_session.
    // Fail-fast per L-0177: no silent fallback to JWT-default workspace.
    const { data: line, error: lineError } = await supabase
      .from("day_line")
      .select("day_line_id, workspace_id, department_session_id")
      .eq("day_line_id", params.day_line_id)
      .maybeSingle();

    if (lineError) {
      return JSON.stringify({ ok: false, error: `day_line lookup failed: ${lineError.message}` });
    }
    if (!line) {
      return JSON.stringify({ ok: false, error: "day_line_not_found" });
    }
    if (line.workspace_id !== ctx.workspaceId) {
      return JSON.stringify({ ok: false, error: "day_line_wrong_workspace" });
    }

    // Step 2 — C4 authority gate (ADR-0099 / ADR-0287).
    const gate = await gateRoutineAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.attach_to_line`,
      channel,
      entityId: params.day_line_id,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // Step 3 — delegate each item to task.create_session (ADR-0240).
    // IMPORTANT: no direct session_task.insert allowed here — see ADR-0240 + __tests__/tools.test.ts.
    const sessionTaskIds: string[] = [];
    const errors: string[] = [];

    for (const item of params.items) {
      const result = await createSession.execute(
        {
          // session_id is required by task.create_session but is overridden via day_line_id.
          // Pass the resolved session id from the day_line row.
          session_id: line.department_session_id,
          day_line_id: params.day_line_id,
          title: item.title,
          ...(item.description ? { description: item.description } : {}),
          ...(item.scheduled_at
            ? { reason: `scheduled_at:${item.scheduled_at}` }
            : { reason: "routine.attach_to_line" }),
          // ADR-0356 Pattern B audit symmetry.
          actor_capability: "task",
          delegated_via: "routine",
        },
        ctx,
      );

      // task.create_session returns JSON: { id } on success | { ok: false, error } on fail.
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(result) as Record<string, unknown>;
      } catch {
        errors.push(`item_parse_error: ${result}`);
        continue;
      }

      if (parsed.id) {
        sessionTaskIds.push(parsed.id as string);
      } else {
        errors.push((parsed.error as string) ?? "unknown_error");
      }
    }

    const itemsApplied = sessionTaskIds.length;

    // Step 4 — emit routine.attached once (ADR-0134 cardinality: one emit per logical event).
    if (itemsApplied > 0) {
      await emit({
        event: "routine.attached",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "day_line",
            entity_id: params.day_line_id,
          },
          data: {
            day_line_id: params.day_line_id,
            items_applied: itemsApplied,
            actor_capability: "task",
            delegated_via: "routine",
          },
        },
      });
    }

    if (errors.length > 0) {
      return JSON.stringify({
        ok: itemsApplied > 0,
        items_applied: itemsApplied,
        session_task_ids: sessionTaskIds,
        errors,
      });
    }

    return JSON.stringify({
      ok: true,
      items_applied: itemsApplied,
      session_task_ids: sessionTaskIds,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool — routine.create (Task 3)
// Creates a routine template bound to a procedure + protocol.
// Authority: admin+, chat-only V1.
// Gate: routine.create
// Emit: routine.created (4 destinations)
// ─────────────────────────────────────────────────────────────────────────────

export const createRoutineTool = defineTool({
  name: "create",
  description:
    "Opprett en rutine-mal koblet til en prosedyre og et protokoll. " +
    "Bruk når en admin sier 'lag rutine', 'opprett ny rutine', 'legg til rutine for stenging'. " +
    "Krever admin tilgangsnivå. Kun i chat (V1-policy). " +
    "trigger_type='scheduled' for tidsbaserte rutiner (åpning/stenging), " +
    "'event' for hendelsesbaserte rutiner. " +
    "executor_type='human' (standard), 'ai', 'system' eller 'hybrid'.",
  capability: CAPABILITY,
  schema: z
    .object({
      name: z.string().min(1).max(200).describe("Navn på rutinen (maks 200 tegn)."),
      procedure_id: UUIDSchema.describe("UUID for prosedyren rutinen implementerer."),
      protocol_id: UUIDSchema.describe("UUID for protokollen rutinen tilhører."),
      trigger_type: TriggerTypeSchema.describe(
        "'scheduled' = tidsbasert (cron/offset), 'event' = hendelsesbasert.",
      ),
      trigger_config: z
        .record(z.unknown())
        .describe(
          "Konfigurasjon for utløseren — f.eks. { times: ['07:00'], days: ['mon','tue'] }.",
        ),
      executor_type: ExecutorTypeSchema.optional()
        .default("human")
        .describe("Hvem utfører rutinen: human (standard), ai, system, hybrid."),
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078): chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Rutine-oppretting kan bare gjøres i chat, ikke via stemme (V1-policy).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // C4 authority gate — admin+.
    const gate = await gateRoutineAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.create`,
      channel,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // Verify procedure belongs to ctx.workspaceId — fail-fast (L-0177).
    const { data: proc, error: procError } = await supabase
      .from("procedure")
      .select("procedure_id, workspace_id")
      .eq("procedure_id", params.procedure_id)
      .maybeSingle();

    if (procError) {
      return JSON.stringify({ ok: false, error: `procedure lookup failed: ${procError.message}` });
    }
    if (!proc) {
      return JSON.stringify({ ok: false, error: "procedure_not_found" });
    }
    if (proc.workspace_id !== ctx.workspaceId) {
      return JSON.stringify({ ok: false, error: "procedure_wrong_workspace" });
    }

    // Verify protocol belongs to ctx.workspaceId — fail-fast (L-0177).
    const { data: prot, error: protError } = await supabase
      .from("protocol")
      .select("protocol_id, workspace_id")
      .eq("protocol_id", params.protocol_id)
      .maybeSingle();

    if (protError) {
      return JSON.stringify({ ok: false, error: `protocol lookup failed: ${protError.message}` });
    }
    if (!prot) {
      return JSON.stringify({ ok: false, error: "protocol_not_found" });
    }
    if (prot.workspace_id !== ctx.workspaceId) {
      return JSON.stringify({ ok: false, error: "protocol_wrong_workspace" });
    }

    const executorType = params.executor_type ?? "human";

    // Insert routine.
    // assigned_to_type / assigned_to_ref are V1 required columns — use actor profile as placeholder.
    // workspace_id is set via trigger (trg_set_routine_workspace_id) from protocol, but we
    // also pass it explicitly for clarity + Wave-0 column contract.
    const { data: inserted, error: insertError } = await supabase
      .from("routine")
      .insert({
        name: params.name,
        procedure_id: params.procedure_id,
        protocol_id: params.protocol_id,
        trigger_type: params.trigger_type,
        trigger_config: params.trigger_config,
        executor_type: executorType,
        workspace_id: ctx.workspaceId,
        // V1 placeholder — assignment is refined via assign_to_location.
        assigned_to_type: "profile",
        assigned_to_ref: ctx.profileId,
      })
      .select("routine_id")
      .single();

    if (insertError || !inserted) {
      return JSON.stringify({ ok: false, error: insertError?.message ?? "insert_failed" });
    }

    // Emit routine.created.
    await emit({
      event: "routine.created",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "routine",
          entity_id: inserted.routine_id,
        },
        data: {
          routine_id: inserted.routine_id,
          name: params.name,
          procedure_id: params.procedure_id,
          protocol_id: params.protocol_id,
          trigger_type: params.trigger_type,
          executor_type: executorType,
        },
      },
    });

    return `Rutine "${params.name}" er opprettet (routine_id: ${inserted.routine_id}).`;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool — routine.assign_to_location (Task 4 + Task 5 hook wiring)
// Scopes a routine to a location + optional team subset, then upserts
// a session_hook for every department at that location.
//
// Location→department relationship: M:N via department_location junction.
// session_hook UNIQUE(workspace_id, department_id, hook_type) — upsert on conflict.
// linked_routine_id is set on each upserted hook.
//
// Authority: confirm, manager+, chat-only V1.
// Gate: routine.assign_to_location
// Emit: routine.assigned_to_location (4 destinations)
// ─────────────────────────────────────────────────────────────────────────────

// Derive session_hook_type from trigger_type.
// scheduled → 'scheduled'; event → 'open' (sensible default for event-driven routines).
function hookTypeFromTriggerType(triggerType: string): string {
  return triggerType === "scheduled" ? "scheduled" : "open";
}

export const assignRoutineToLocation = defineTool({
  name: "assign_to_location",
  description:
    "Knytt en rutine til en lokasjon og valgfrie team. " +
    "Bruk når en leder sier 'koble rutinen til kjøkkenet', 'sett rutinen på lokasjon X', " +
    "'tilordne åpningsrutinen til baren og team A'. " +
    "Oppretter session_hook for hvert avdeling ved lokasjonen. " +
    "team_ids=[] (tomt) = alle team ved lokasjonen. " +
    "Krever manager+ tilgangsnivå. Kun i chat (V1-policy).",
  capability: CAPABILITY,
  schema: z
    .object({
      routine_id: UUIDSchema.describe("UUID for rutinen som skal knyttes til lokasjonen."),
      location_id: UUIDSchema.describe("UUID for lokasjonen rutinen skal knyttes til."),
      team_ids: z
        .array(UUIDSchema)
        .optional()
        .default([])
        .describe(
          "Valgfrie team-UUIDs (tomt = alle team/hele lokasjonen). " +
            "Hvert team må tilhøre samme workspace.",
        ),
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078): chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Rutine-tilordning kan bare gjøres i chat, ikke via stemme (V1-policy).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Step 1 — verify routine belongs to ctx.workspaceId (L-0177 fail-fast).
    const { data: routine, error: routineError } = await supabase
      .from("routine")
      .select("routine_id, workspace_id, trigger_type")
      .eq("routine_id", params.routine_id)
      .maybeSingle();

    if (routineError) {
      return JSON.stringify({ ok: false, error: `routine lookup failed: ${routineError.message}` });
    }
    if (!routine) {
      return JSON.stringify({ ok: false, error: "routine_not_found" });
    }
    if (routine.workspace_id !== ctx.workspaceId) {
      // L-0177: cross-workspace routine — explicit rejection, NO silent fallback.
      return JSON.stringify({ ok: false, error: "routine_wrong_workspace" });
    }

    // Step 2 — C4 authority gate.
    const gate = await gateRoutineAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.assign_to_location`,
      channel,
      entityId: params.routine_id,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // Step 3 — UPDATE routine SET location_id.
    const { error: updateError } = await supabase
      .from("routine")
      .update({ location_id: params.location_id })
      .eq("routine_id", params.routine_id)
      .eq("workspace_id", ctx.workspaceId);

    if (updateError) {
      return JSON.stringify({
        ok: false,
        error: `routine update failed: ${updateError.message}`,
      });
    }

    // Step 4 — Replace routine_team rows.
    // Delete existing rows for this routine, then insert new ones if team_ids supplied.
    const teamIds = params.team_ids ?? [];

    const { error: deleteTeamsError } = await supabase
      .from("routine_team")
      .delete()
      .eq("routine_id", params.routine_id)
      .eq("workspace_id", ctx.workspaceId);

    if (deleteTeamsError) {
      return JSON.stringify({
        ok: false,
        error: `routine_team delete failed: ${deleteTeamsError.message}`,
      });
    }

    if (teamIds.length > 0) {
      const teamRows = teamIds.map((tid) => ({
        routine_id: params.routine_id,
        team_id: tid,
        workspace_id: ctx.workspaceId,
      }));

      const { error: insertTeamsError } = await supabase.from("routine_team").insert(teamRows);

      if (insertTeamsError) {
        return JSON.stringify({
          ok: false,
          error: `routine_team insert failed: ${insertTeamsError.message}`,
        });
      }
    }

    // Step 5 — Resolve departments at this location via department_location junction (Task 5).
    // session_hook UNIQUE(workspace_id, department_id, hook_type) — upsert per department.
    const { data: deptLinks, error: deptError } = await supabase
      .from("department_location")
      .select("department_id")
      .eq("location_id", params.location_id)
      .eq("workspace_id", ctx.workspaceId);

    if (deptError) {
      return JSON.stringify({
        ok: false,
        error: `department_location lookup failed: ${deptError.message}`,
      });
    }

    const hookType = hookTypeFromTriggerType(routine.trigger_type as string);
    let hooksUpserted = 0;

    if (deptLinks && deptLinks.length > 0) {
      for (const link of deptLinks) {
        const { error: upsertError } = await supabase
          .from("session_hook")
          .upsert(
            {
              workspace_id: ctx.workspaceId,
              department_id: link.department_id,
              hook_type: hookType,
              linked_routine_id: params.routine_id,
              trigger_offset_min: 0,
              is_active: true,
            },
            {
              onConflict: "workspace_id,department_id,hook_type",
              // Update linked_routine_id when hook already exists for this dept/type.
              ignoreDuplicates: false,
            },
          )
          .select("id");

        if (upsertError) {
          // Non-fatal: log and continue — partial hook wiring is better than zero wiring.
          // The error is surfaced in the return value for operator visibility.
          continue;
        }
        hooksUpserted++;
      }
    }

    // Emit routine.assigned_to_location.
    await emit({
      event: "routine.assigned_to_location",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "routine",
          entity_id: params.routine_id,
        },
        data: {
          routine_id: params.routine_id,
          location_id: params.location_id,
          team_ids: teamIds,
          hooks_upserted: hooksUpserted,
        },
      },
    });

    const teamSummary =
      teamIds.length > 0 ? `${teamIds.length} team` : "alle team (lokasjonsstyrt)";
    return (
      `Rutine ${params.routine_id} er knyttet til lokasjon ${params.location_id} ` +
      `(${teamSummary}). ${hooksUpserted} session_hook(s) oppsatt.`
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool — routine.add_step (Task 5b)
// Appends a step to the procedure owned by a routine.
// Resolves routine→procedure_id, verifies workspace, inserts at max(step_order)+1.
//
// procedure_step columns (pre-flight verified 2026-05-22):
//   step_id, procedure_id, title, description, step_order, is_required, estimated_minutes.
//   No training_content / media_urls / is_compliance_required in current schema.
//
// Authority: confirm, manager+, chat-only V1.
// Gate: routine.add_step
// Emit: procedure_step.added (3 destinations)
// ─────────────────────────────────────────────────────────────────────────────

export const addStepTool = defineTool({
  name: "add_step",
  description:
    "Legg til et steg i prosedyren tilknyttet en rutine. " +
    "Bruk når en leder sier 'legg til steg i rutinen', 'ny oppgave i rutinen', " +
    "'legg til 'vask gulv' som steg'. " +
    "Løser rutine → prosedyre automatisk. " +
    "Krever manager+ tilgangsnivå. Kun i chat (V1-policy).",
  capability: CAPABILITY,
  schema: z
    .object({
      routine_id: UUIDSchema.describe("UUID for rutinen stegene tilhører."),
      title: z.string().min(1).max(200).describe("Tittel på steget (maks 200 tegn)."),
      description: z.string().min(1).max(2000).describe("Beskrivelse av steget (maks 2000 tegn)."),
      is_required: z.boolean().optional().default(true).describe("Om steget er obligatorisk."),
      estimated_minutes: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Valgfri estimert tid i minutter."),
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078): chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Å legge til prosedyre-steg kan bare gjøres i chat, ikke via stemme (V1-policy).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Step 1 — resolve routine → procedure_id, verify workspace (L-0177 fail-fast).
    const { data: routine, error: routineError } = await supabase
      .from("routine")
      .select("routine_id, workspace_id, procedure_id")
      .eq("routine_id", params.routine_id)
      .maybeSingle();

    if (routineError) {
      return JSON.stringify({ ok: false, error: `routine lookup failed: ${routineError.message}` });
    }
    if (!routine) {
      return JSON.stringify({ ok: false, error: "routine_not_found" });
    }
    if (routine.workspace_id !== ctx.workspaceId) {
      // L-0177: cross-workspace — explicit rejection, NO silent fallback.
      return JSON.stringify({ ok: false, error: "routine_wrong_workspace" });
    }

    // Step 2 — C4 authority gate.
    const gate = await gateRoutineAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.add_step`,
      channel,
      entityId: params.routine_id,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // Step 3 — resolve max(step_order) for this procedure.
    const { data: maxRow, error: maxError } = await supabase
      .from("procedure_step")
      .select("step_order")
      .eq("procedure_id", routine.procedure_id)
      .order("step_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      return JSON.stringify({ ok: false, error: `step_order lookup failed: ${maxError.message}` });
    }

    const nextOrder = maxRow ? (maxRow.step_order as number) + 1 : 1;

    // Step 4 — insert procedure_step.
    // Columns: procedure_id, title, description, step_order, is_required, estimated_minutes.
    const { data: inserted, error: insertError } = await supabase
      .from("procedure_step")
      .insert({
        procedure_id: routine.procedure_id,
        title: params.title,
        description: params.description,
        step_order: nextOrder,
        is_required: params.is_required ?? true,
        ...(params.estimated_minutes !== undefined
          ? { estimated_minutes: params.estimated_minutes }
          : {}),
      })
      .select("step_id")
      .single();

    if (insertError || !inserted) {
      return JSON.stringify({ ok: false, error: insertError?.message ?? "insert_failed" });
    }

    // Step 5 — emit procedure_step.added.
    await emit({
      event: "procedure_step.added",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "procedure",
          entity_id: routine.procedure_id as string,
        },
        data: {
          step_id: inserted.step_id,
          procedure_id: routine.procedure_id as string,
          title: params.title,
          step_order: nextOrder,
          is_required: params.is_required ?? true,
          source_routine_id: params.routine_id,
        },
      },
    });

    return (
      `Steg "${params.title}" er lagt til prosedyre ${routine.procedure_id as string} ` +
      `(steg ${nextOrder}, step_id: ${inserted.step_id}).`
    );
  },
});
