/**
 * packages/ai/src/capabilities/day-line/tools.ts
 *
 * Four tools for the `day-line` capability (ADR-0367).
 *
 *   1. create              — insert a day_line row for a dept_session + location pairing.
 *   2. add_item            — delegating dispatcher (task | routine branch, V1 only).
 *   3. instantiate_template — alias of add_item routine branch (single-template convenience).
 *   4. update_hours        — patch planned_open / planned_close; emits one or both change events.
 *
 * Cross-cutting laws (all four tools):
 *   ADR-0078   Chat-only (all mutations contain free-text or PII-adjacent data).
 *   ADR-0099   gate_action RPC before every DB write. Fail-closed on error.
 *   ADR-0134   emit() with nonEmpty workspace_id + actor_id on every mutation.
 *   ADR-0151   workspace_id + profileId are ALWAYS from ctx — never from input params.
 *   ADR-0173   Cross-namespace writes are FORBIDDEN; delegation to owning capability tools is used.
 *   ADR-0240   Journey delegation precedent generalised: day-line.add_item delegates to task/timeline-template.
 *   ADR-0356   Pattern B audit symmetry: actor_capability + delegated_via emitted on delegation.
 *   L-0177     Fail-fast: if server-resolved IDs are empty, throw before any side-effect.
 *   L-0176     Docstring claims must match body. Body written first; docstrings reflect reality.
 */

import { z } from "zod";
import { emit, nonEmpty } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gateDayLineAction } from "./gate.js";
import { createSession } from "../task/tools.js";
import { applyTemplate } from "../timeline-template/tools.js";

const CAPABILITY = "day-line" as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

/** Shared chat-only guard. Returns error string or null when channel is OK. */
function rejectIfNotChat(c: SessionChannel | undefined): string | null {
  if (normaliseChannel(c) !== "chat") {
    return "Av sikkerhetshensyn må dag-linje-operasjoner skje i chat, ikke via stemme.";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Zod primitives
// ─────────────────────────────────────────────────────────────────────────────

const UUIDSchema = z.string().uuid().describe("UUID v4 identifier");

/** HH:MM or HH:MM:SS time string. Used for planned_open / planned_close. */
const TimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Must be HH:MM or HH:MM:SS")
  .describe("Time in HH:MM or HH:MM:SS format.");

// ─────────────────────────────────────────────────────────────────────────────
// Tool 1 — day-line.create
// Gate: day-line.create, manager+, chat-only
// ─────────────────────────────────────────────────────────────────────────────

const createSchema = z
  .object({
    department_session_id: UUIDSchema.describe("The department_session this day_line belongs to."),
    location_id: UUIDSchema.describe("The location area covered by this day_line."),
    planned_open: TimeSchema.optional().describe(
      "Override planned opening time. Falls back to department_session.planned_open or '00:00'.",
    ),
    planned_close: TimeSchema.optional().describe(
      "Override planned closing time. Falls back to department_session.planned_close or '23:59'.",
    ),
    source_template_id: UUIDSchema.optional().describe(
      "Optional timeline_template to link as source.",
    ),
    notes: z.string().max(2000).optional().describe("Free-text notes for this day_line."),
  })
  .strict();

export const create = defineTool({
  name: "create",
  description:
    "Opprett en dag-linje (day_line) for en bestemt lokasjon og arbeidsøkt. " +
    "Kobler together en department_session og en location som har et gyldig department_location-forhold. " +
    "planned_open og planned_close er valgfrie overstyringer — faller tilbake på session-verdier. " +
    "Kun tilgjengelig i chat (ADR-0078).",
  capability: CAPABILITY,
  schema: createSchema,
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078) — all day-line mutations are chat-only.
    const channelErr = rejectIfNotChat(ctx.channel);
    if (channelErr) return channelErr;

    // L-0177 fail-fast: server-derived IDs must be non-empty.
    const workspaceId = nonEmpty(ctx.workspaceId, "workspace_id");
    const actorId = nonEmpty(ctx.profileId, "actor_id");

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Step 1: Resolve department_session — server-side, no body-supplied workspace.
    const { data: session, error: sessionErr } = await supabase
      .from("department_session")
      .select(
        "department_session_id, department_id, session_date, planned_open, planned_close, workspace_id",
      )
      .eq("department_session_id", params.department_session_id)
      .maybeSingle();

    if (sessionErr || !session) {
      return JSON.stringify({ ok: false, error: "department_session_not_found" });
    }

    // Workspace scope enforcement (ADR-0099 + Law 1).
    if (session.workspace_id !== workspaceId) {
      return JSON.stringify({ ok: false, error: "session_belongs_to_different_workspace" });
    }

    // Step 2: Verify department_location pairing exists (ADR-0367 §B3).
    const { data: pairing, error: pairingErr } = await supabase
      .from("department_location")
      .select("department_id")
      .eq("department_id", session.department_id)
      .eq("location_id", params.location_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (pairingErr || !pairing) {
      return JSON.stringify({
        ok: false,
        error: "department_location_pairing_not_found",
      });
    }

    // Step 3: Resolve hours with fallback chain (ADR-0367 §B4).
    const plannedOpen = params.planned_open ?? session.planned_open ?? "00:00";
    const plannedClose = params.planned_close ?? session.planned_close ?? "23:59";

    // Step 4: Gate check (ADR-0099). Must pass before any DB write.
    const gate = await gateDayLineAction(supabase, workspaceId, actorId, {
      actionType: "day-line.create",
      channel: normaliseChannel(ctx.channel),
      entityId: undefined, // pre-insert
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        error: `ikke_tillatt: ${gate.reason ?? "gate_denied"}`,
      });
    }

    // Step 5: Insert day_line row.
    const { data: inserted, error: insertErr } = await supabase
      .from("day_line")
      .insert({
        workspace_id: workspaceId,
        department_session_id: params.department_session_id,
        department_id: session.department_id,
        location_id: params.location_id,
        business_date: session.session_date,
        planned_open: plannedOpen,
        planned_close: plannedClose,
        source_template_id: params.source_template_id ?? null,
        notes: params.notes ?? null,
        created_by: actorId,
        is_backfilled: false,
      })
      .select("day_line_id")
      .single();

    if (insertErr || !inserted) {
      return JSON.stringify({
        ok: false,
        error: insertErr?.message ?? "insert_failed",
      });
    }

    // Step 6: Emit (ADR-0134). Non-empty IDs enforced by nonEmpty() above.
    await emit({
      event: "day_line.created",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "day_line", entity_id: inserted.day_line_id },
        data: {
          day_line_id: inserted.day_line_id,
          department_session_id: params.department_session_id,
          location_id: params.location_id,
          department_id: session.department_id,
          workspace_id: workspaceId,
          planned_open: plannedOpen,
          planned_close: plannedClose,
        },
      },
    });

    return JSON.stringify({ ok: true, day_line_id: inserted.day_line_id });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 2 — day-line.add_item  (delegating dispatcher, ADR-0240 + ADR-0356)
// V1: task | routine only. Booking/note/reminder DEFERRED.
// Gate: day-line.add_item, manager+, chat-only
// ─────────────────────────────────────────────────────────────────────────────

const addItemSchema = z.discriminatedUnion("item_type", [
  z.object({
    day_line_id: UUIDSchema.describe("The day_line to add the item to."),
    item_type: z.literal("task"),
    title: z.string().min(1).max(200).describe("Task title — short, action-oriented."),
    description: z.string().max(2000).optional().describe("Optional task description."),
    scheduled_at: z
      .string()
      .datetime()
      .optional()
      .describe("Optional ISO-8601 datetime for when the task should be performed."),
    assigned_to: UUIDSchema.optional().describe(
      "Optional profile_id to assign the task to. Must be in the same workspace.",
    ),
  }),
  z.object({
    day_line_id: UUIDSchema.describe("The day_line to attach the routine template to."),
    item_type: z.literal("routine"),
    template_id: UUIDSchema.describe("The timeline_template UUID to instantiate."),
  }),
]);

export const addItem = defineTool({
  name: "add_item",
  description:
    "Legg til et element på en dag-linje. " +
    "V1 støtter to typer: 'task' (delegerer til task.create_session) og 'routine' (delegerer til timeline_template.apply_template). " +
    "Booking/note/reminder er utsatt til V2. " +
    "Kun tilgjengelig i chat (ADR-0078). " +
    "ADR-0240 + ADR-0356: kryssdomain-skrivinger er forbudt — dette verktøyet delegerer kun.",
  capability: CAPABILITY,
  schema: addItemSchema,
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078).
    const channelErr = rejectIfNotChat(ctx.channel);
    if (channelErr) return channelErr;

    // L-0177 fail-fast.
    const workspaceId = nonEmpty(ctx.workspaceId, "workspace_id");
    const actorId = nonEmpty(ctx.profileId, "actor_id");

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Resolve day_line to get workspace + dept_session — server-side scope enforcement.
    const { data: dayLine, error: lineErr } = await supabase
      .from("day_line")
      .select("day_line_id, workspace_id, department_session_id, location_id, business_date")
      .eq("day_line_id", params.day_line_id)
      .maybeSingle();

    if (lineErr || !dayLine) {
      return JSON.stringify({ ok: false, error: "day_line_not_found" });
    }

    if (dayLine.workspace_id !== workspaceId) {
      return JSON.stringify({ ok: false, error: "day_line_belongs_to_different_workspace" });
    }

    // Gate check (ADR-0099) — uses day-line capability, add_item action.
    const gate = await gateDayLineAction(supabase, workspaceId, actorId, {
      actionType: "day-line.add_item",
      channel: normaliseChannel(ctx.channel),
      entityId: params.day_line_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        error: `ikke_tillatt: ${gate.reason ?? "gate_denied"}`,
      });
    }

    if (params.item_type === "task") {
      // ADR-0240 + ADR-0356 Pattern B: delegate to task.create_session tool.
      // Direct insert into session_task from here would violate ADR-0173 (frozen-4 cap boundary).
      const delegateResult = await createSession.execute(
        {
          session_id: dayLine.department_session_id,
          title: params.title,
          description: params.description,
          scheduled_at: params.scheduled_at,
          assignee_profile_id: params.assigned_to,
          reason: "Delegert fra dag-linje",
          actor_capability: "task",
          delegated_via: "day-line",
          day_line_id: params.day_line_id,
        },
        ctx,
      );

      // Parse delegate result to extract the created task id.
      let delegateRow: { id?: string; ok?: boolean; error?: string } = {};
      try {
        delegateRow = JSON.parse(delegateResult) as { id?: string; ok?: boolean; error?: string };
      } catch {
        return JSON.stringify({ ok: false, error: "delegate_parse_failed" });
      }

      if (!delegateRow.id) {
        return JSON.stringify({
          ok: false,
          error: `task_delegate_failed: ${delegateRow.error ?? "unknown"}`,
        });
      }

      // Emit day_line_item.added with ADR-0356 audit trail fields.
      await emit({
        event: "day_line_item.added",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          entity: { entity_type: "day_line", entity_id: params.day_line_id },
          data: {
            day_line_id: params.day_line_id,
            item_type: "task",
            delegated_to_id: delegateRow.id,
            actor_capability: "task",
            delegated_via: "day-line",
          },
        },
      });

      return JSON.stringify({ ok: true, task_id: delegateRow.id });
    }

    // item_type === "routine"
    // ADR-0240 + ADR-0356 Pattern B: delegate to timeline_template.apply_template tool.
    // business_date becomes target_date for the template application.
    const routineResult = await applyTemplate.execute(
      {
        template_id: params.template_id,
        target_date: dayLine.business_date,
        freeform_mapping: {},
      },
      ctx,
    );

    let routineRow: {
      ok?: boolean;
      materialized?: Record<string, number>;
      errors?: unknown[];
      error?: string;
    } = {};
    try {
      routineRow = JSON.parse(routineResult) as typeof routineRow;
    } catch {
      return JSON.stringify({ ok: false, error: "routine_delegate_parse_failed" });
    }

    if (routineRow.ok === false) {
      return JSON.stringify({
        ok: false,
        error: `routine_delegate_failed: ${routineRow.error ?? "unknown"}`,
      });
    }

    // Compute total items applied (sum of materialized_count_by_kind values).
    const itemsApplied = routineRow.materialized
      ? Object.values(routineRow.materialized).reduce((sum, n) => sum + n, 0)
      : 0;

    // Emit routine.attached with ADR-0356 audit trail fields.
    await emit({
      event: "routine.attached",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "day_line", entity_id: params.day_line_id },
        data: {
          day_line_id: params.day_line_id,
          template_id: params.template_id,
          items_applied: itemsApplied,
          actor_capability: "timeline-template",
          delegated_via: "day-line",
        },
      },
    });

    return JSON.stringify({ ok: true, items_applied: itemsApplied });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 3 — day-line.instantiate_template  (convenience alias for routine branch)
// Equivalent to add_item { item_type: "routine", template_id, day_line_id }.
// Gate: day-line.instantiate_template, manager+, chat-only
// ─────────────────────────────────────────────────────────────────────────────

const instantiateTemplateSchema = z
  .object({
    day_line_id: UUIDSchema.describe("The day_line to apply the template to."),
    template_id: UUIDSchema.describe("The timeline_template UUID to instantiate."),
  })
  .strict();

export const instantiateTemplate = defineTool({
  name: "instantiate_template",
  description:
    "Appliser en tidslinje-mal (timeline_template) direkte på en dag-linje. " +
    "Konveniensversjon av add_item {item_type:'routine'}. " +
    "Delegerer til timeline_template.apply_template (ADR-0240 + ADR-0356). " +
    "Kun tilgjengelig i chat (ADR-0078).",
  capability: CAPABILITY,
  schema: instantiateTemplateSchema,
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078).
    const channelErr = rejectIfNotChat(ctx.channel);
    if (channelErr) return channelErr;

    // L-0177 fail-fast.
    const workspaceId = nonEmpty(ctx.workspaceId, "workspace_id");
    const actorId = nonEmpty(ctx.profileId, "actor_id");

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Resolve day_line — workspace scope enforcement (ADR-0151 + Law 1).
    const { data: dayLine, error: lineErr } = await supabase
      .from("day_line")
      .select("day_line_id, workspace_id, business_date")
      .eq("day_line_id", params.day_line_id)
      .maybeSingle();

    if (lineErr || !dayLine) {
      return JSON.stringify({ ok: false, error: "day_line_not_found" });
    }

    if (dayLine.workspace_id !== workspaceId) {
      return JSON.stringify({ ok: false, error: "day_line_belongs_to_different_workspace" });
    }

    // Gate check (ADR-0099).
    const gate = await gateDayLineAction(supabase, workspaceId, actorId, {
      actionType: "day-line.instantiate_template",
      channel: normaliseChannel(ctx.channel),
      entityId: params.day_line_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        error: `ikke_tillatt: ${gate.reason ?? "gate_denied"}`,
      });
    }

    // Delegate to timeline_template.apply_template (ADR-0173 + ADR-0240).
    const routineResult = await applyTemplate.execute(
      {
        template_id: params.template_id,
        target_date: dayLine.business_date,
        freeform_mapping: {},
      },
      ctx,
    );

    let routineRow: {
      ok?: boolean;
      materialized?: Record<string, number>;
      errors?: unknown[];
      error?: string;
    } = {};
    try {
      routineRow = JSON.parse(routineResult) as typeof routineRow;
    } catch {
      return JSON.stringify({ ok: false, error: "routine_delegate_parse_failed" });
    }

    if (routineRow.ok === false) {
      return JSON.stringify({
        ok: false,
        error: `routine_delegate_failed: ${routineRow.error ?? "unknown"}`,
      });
    }

    const itemsApplied = routineRow.materialized
      ? Object.values(routineRow.materialized).reduce((sum, n) => sum + n, 0)
      : 0;

    // Emit routine.attached (ADR-0134 + ADR-0356).
    await emit({
      event: "routine.attached",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "day_line", entity_id: params.day_line_id },
        data: {
          day_line_id: params.day_line_id,
          template_id: params.template_id,
          items_applied: itemsApplied,
          actor_capability: "timeline-template",
          delegated_via: "day-line",
        },
      },
    });

    return JSON.stringify({ ok: true, items_applied: itemsApplied });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 4 — day-line.update_hours
// Patch planned_open and/or planned_close on an existing day_line.
// Emits day_line.opening_changed and/or day_line.closing_changed as needed.
// Gate: day-line.update_hours, manager+, chat-only
// ─────────────────────────────────────────────────────────────────────────────

const updateHoursSchema = z
  .object({
    day_line_id: UUIDSchema.describe("The day_line to update hours on."),
    planned_open: TimeSchema.optional().describe("New planned opening time (HH:MM)."),
    planned_close: TimeSchema.optional().describe("New planned closing time (HH:MM)."),
  })
  .strict()
  .refine((d) => d.planned_open !== undefined || d.planned_close !== undefined, {
    message: "At least one of planned_open / planned_close is required.",
  });

export const updateHours = defineTool({
  name: "update_hours",
  description:
    "Oppdater planlagte åpningstider (planned_open / planned_close) for en dag-linje. " +
    "Minst én av verdiene må angis. " +
    "No-op dersom begge verdier er uendret. " +
    "Emitter dag-linje-åpningsendring / -lukkingsendring per endret felt. " +
    "Kun tilgjengelig i chat (ADR-0078).",
  capability: CAPABILITY,
  schema: updateHoursSchema,
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078).
    const channelErr = rejectIfNotChat(ctx.channel);
    if (channelErr) return channelErr;

    // L-0177 fail-fast.
    const workspaceId = nonEmpty(ctx.workspaceId, "workspace_id");
    const actorId = nonEmpty(ctx.profileId, "actor_id");

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Step 1: SELECT existing day_line.
    const { data: existing, error: fetchErr } = await supabase
      .from("day_line")
      .select("day_line_id, workspace_id, planned_open, planned_close")
      .eq("day_line_id", params.day_line_id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return JSON.stringify({ ok: false, error: "day_line_not_found" });
    }

    // Workspace scope enforcement (ADR-0151 + Law 1).
    if (existing.workspace_id !== workspaceId) {
      return JSON.stringify({ ok: false, error: "day_line_belongs_to_different_workspace" });
    }

    // Step 2: Build patch object — only changed fields.
    const patch: { planned_open?: string; planned_close?: string } = {};
    if (params.planned_open !== undefined && params.planned_open !== existing.planned_open) {
      patch.planned_open = params.planned_open;
    }
    if (params.planned_close !== undefined && params.planned_close !== existing.planned_close) {
      patch.planned_close = params.planned_close;
    }

    // Step 3: No-op early exit when nothing changed.
    if (Object.keys(patch).length === 0) {
      return JSON.stringify({ ok: true, no_op: true });
    }

    // Step 4: Gate check (ADR-0099).
    const gate = await gateDayLineAction(supabase, workspaceId, actorId, {
      actionType: "day-line.update_hours",
      channel: normaliseChannel(ctx.channel),
      entityId: params.day_line_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        error: `ikke_tillatt: ${gate.reason ?? "gate_denied"}`,
      });
    }

    // Step 5: UPDATE day_line.
    const { error: updateErr } = await supabase
      .from("day_line")
      .update(patch)
      .eq("day_line_id", params.day_line_id)
      .eq("workspace_id", workspaceId);

    if (updateErr) {
      return JSON.stringify({ ok: false, error: updateErr.message });
    }

    // Step 6: Emit one or both change events (ADR-0134).
    if (patch.planned_open !== undefined) {
      await emit({
        event: "day_line.opening_changed",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          entity: { entity_type: "day_line", entity_id: params.day_line_id },
          data: {
            day_line_id: params.day_line_id,
            old: existing.planned_open,
            new: patch.planned_open,
          },
        },
      });
    }

    if (patch.planned_close !== undefined) {
      await emit({
        event: "day_line.closing_changed",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          entity: { entity_type: "day_line", entity_id: params.day_line_id },
          data: {
            day_line_id: params.day_line_id,
            old: existing.planned_close,
            new: patch.planned_close,
          },
        },
      });
    }

    return JSON.stringify({ ok: true, patched: patch });
  },
});
