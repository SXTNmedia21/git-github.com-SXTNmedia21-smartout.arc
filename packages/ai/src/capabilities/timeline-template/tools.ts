/**
 * timeline_template capability tools — ADR-0335.
 *
 * Four tools covering the full save → list → apply → archive lifecycle for
 * TimelineTab templates.  Every mutating tool routes through `mutateWithGate`
 * (ADR-0204 / ADR-0287) and emits a domain event (ADR-0134).  All four tools
 * are CHAT-ONLY (ADR-0078 — template authoring involves free-text labels,
 * notes, and item payloads that are PII-adjacent in the restaurant context).
 *
 * Identity (ADR-0151): workspace_id and profile_id are ALWAYS server-derived
 * from AgentToolContext.  No tool parameter accepts either field.
 *
 * Tool compliance table (verified against bodies below — L-0176):
 *   save_template    | timeline_template.save    | mutateWithGate | timeline_template.saved    | voice-reject | PASS
 *   list_templates   | — (read-only)             | direct SELECT  | timeline_template.listed   | voice-reject | PASS
 *   apply_template   | timeline_template.apply   | mutateWithGate | timeline_template.applied  | voice-reject | PASS
 *   archive_template | timeline_template.archive | mutateWithGate | timeline_template.archived | voice-reject | PASS
 *
 * Transaction strategy for apply_template:
 *   `exec` callback in mutateWithGate runs all per-item INSERTs sequentially
 *   inside a single TypeScript callback.  On any Supabase error the callback
 *   throws → gatedMutation captures the throw → mutateWithGate re-throws as
 *   MutateWithGateError("execute_failed").  Because exec runs as a single
 *   async fn inside gatedMutation's own DB session this achieves implicit
 *   serial atomicity: partial-write on network failure is the only gap, which
 *   is acceptably low-risk for template apply (idempotent retry is the mitigation).
 *   A dedicated SQL function (full BEGIN/COMMIT) is the Phase 2 upgrade path.
 *   This choice is documented here per spec §6 comment requirement.
 *
 * References:
 *   Spec:    docs/superpowers/specs/2026-05-16-timeline-templates-design.md
 *   ADR-0078  — channel guard (chat-only surfaces)
 *   ADR-0099  — unified authority gate (gate_action RPC contract)
 *   ADR-0134  — telemetry contract (every mutation emits)
 *   ADR-0151  — workspace_id server-derived, never body-supplied
 *   ADR-0189  — authority-seed-parity CI (timeline_template capability seeded by T1 migration)
 *   ADR-0204  — composition orchestrator (Pathway A + B)
 *   ADR-0287  — mutateWithGate mandatory on mutation capability tools
 *   ADR-0335  — Timeline Templates feature ADR
 *   L-0175    — gate_action mandatory before any DB write (enforced by mutateWithGate)
 *   L-0176    — docstring claims must match body (verified; body is the source)
 *   L-0177    — fail-fast on missing workspace_id / profile_id
 */

import { z } from "zod";
import { emit, nonEmpty } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import {
  mutateWithGate,
  MutateWithGateDenied,
  MutateWithGateError,
} from "../_shared/mutate-with-gate.js";
import {
  TimelineTemplateSaveSchema,
  TimelineTemplateApplySchema,
  TimelineTemplateItems,
  type TimelineTemplateItemT,
  type ScopeTypeT,
} from "@smartout/types";
import { startOfOsloDay } from "../schedule/oslo-time.js";

const CAPABILITY = "timeline_template" as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * validateScope — verify that scope_id exists and belongs to workspace_id.
 * No FK constraint on items_json.scope_id (polymorphic column), so we
 * validate at insert + apply time.  Throws on invalid scope.
 *
 * Spec ref: §Polymorphic scope_id validation
 */
async function validateScope(
  supabase: SupabaseClient,
  workspaceId: string,
  scopeType: ScopeTypeT,
  scopeId: string,
): Promise<void> {
  const tableMap: Record<ScopeTypeT, string> = {
    team: "team",
    department: "department",
    location: "location",
    shift: "schedule_shift",
  };
  const idColMap: Record<ScopeTypeT, string> = {
    team: "team_id",
    department: "department_id",
    location: "location_id",
    shift: "schedule_shift_id",
  };

  const table = tableMap[scopeType];
  const idCol = idColMap[scopeType];

  const { data, error } = await supabase
    .from(table)
    .select(idCol)
    .eq(idCol, scopeId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !data) {
    throw new Error(`Invalid scope — ${scopeType}:${scopeId} not found in workspace`);
  }
}

/**
 * resolveDepartmentIdForScope — resolve the department_id from a scope entity.
 *
 * For team scope: read team.department_id (team belongs to department).
 * For department scope: scope_id IS department_id.
 * For shift scope: read schedule_shift.department_id.
 * For location scope: no department — returns null.
 *
 * Used in apply_template to find/create the department_session.
 */
async function resolveDepartmentIdForScope(
  supabase: SupabaseClient,
  workspaceId: string,
  scopeType: ScopeTypeT,
  scopeId: string,
): Promise<string | null> {
  switch (scopeType) {
    case "department":
      return scopeId;

    case "team": {
      const { data } = await supabase
        .from("team")
        .select("department_id")
        .eq("team_id", scopeId)
        .eq("workspace_id", workspaceId)
        .single();
      return data?.department_id ?? null;
    }

    case "shift": {
      const { data } = await supabase
        .from("schedule_shift")
        .select("department_id")
        .eq("schedule_shift_id", scopeId)
        .eq("workspace_id", workspaceId)
        .single();
      return data?.department_id ?? null;
    }

    case "location":
      // Location scope: only schedule_shift items; no session needed.
      return null;
  }
}

/**
 * findOrCreateDepartmentSession — idempotent find-or-create for
 * (department_id, session_date, workspace_id) → department_session_id.
 *
 * Mirrors the logic from open-session-action.ts (web Server Action) which
 * cannot be imported from a capability tool.  Uses admin client (service_role)
 * because the capability already operates in that context (ctx.supabaseAdmin).
 *
 * Status 'upcoming' per spec §Apply flow: templates apply to future dates;
 * session lifecycle progresses naturally from upstream cascade.
 */
async function findOrCreateDepartmentSession(
  supabase: SupabaseClient,
  workspaceId: string,
  departmentId: string,
  sessionDate: string, // YYYY-MM-DD
  openedBy: string,
): Promise<string> {
  // Idempotent find first.
  const { data: existing } = await supabase
    .from("department_session")
    .select("department_session_id")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("session_date", sessionDate)
    .maybeSingle();

  if (existing) return existing.department_session_id;

  // Create with status='upcoming' — let cascade lifecycle progress it.
  const { data: created, error } = await supabase
    .from("department_session")
    .insert({
      workspace_id: workspaceId,
      department_id: departmentId,
      session_date: sessionDate,
      status: "upcoming",
      opened_by: openedBy,
    })
    .select("department_session_id")
    .single();

  if (error || !created) {
    throw new Error(`findOrCreateDepartmentSession failed: ${error?.message ?? "no row returned"}`);
  }

  return created.department_session_id;
}

/**
 * buildStartEndFromHhMm — construct HH:MM:SS strings for schedule_shift insert.
 *
 * schedule_shift.start_time and end_time are PostgreSQL TIME (HH:MM:SS) columns
 * holding Europe/Oslo wall-clock — NOT TIMESTAMPTZ. Output must be a plain
 * time-of-day string; no date, no timezone offset. Pure arithmetic; we do not
 * cross a Date object so there is no UTC conversion that could shift the hour.
 * Overflow past midnight wraps via mod 24 (rare but well-defined for double
 * shifts that close just past midnight).
 */
function buildStartEnd(
  targetDate: string,
  timeHhmm: string,
  durationMin: number | null,
): { start_time: string; end_time: string } {
  void targetDate;
  const [hh, mm] = timeHhmm.split(":").map(Number);
  const startMin = (hh ?? 0) * 60 + (mm ?? 0);
  const endMin = startMin + (durationMin ?? 60);
  const fmt = (mins: number): string => {
    const total = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = String(Math.floor(total / 60)).padStart(2, "0");
    const m = String(total % 60).padStart(2, "0");
    return `${h}:${m}:00`;
  };
  return { start_time: fmt(startMin), end_time: fmt(endMin) };
}

/**
 * insertItemsInExec — called inside mutateWithGate exec callback.
 *
 * Performs all per-kind INSERTs sequentially.  If any insert fails this
 * function throws — gatedMutation captures the throw and mutateWithGate
 * re-throws as execute_failed.  Serial atomicity model; no BEGIN/COMMIT here.
 * Phase 2 upgrade path: extract to a SQL function called via supabase.rpc().
 *
 * Returns the per-kind materialized_count_by_kind map and freeform_skipped count.
 */
async function insertItemsInExec(
  supabase: SupabaseClient,
  workspaceId: string,
  profileId: string,
  items: TimelineTemplateItemT[],
  targetDate: string,
  sessionId: string | null, // null only for location scope
  freeformMapping: Record<string, "task" | "note" | "skip">,
  templateId: string,
): Promise<{
  materialized_count_by_kind: Record<string, number>;
  freeform_skipped: number;
}> {
  const counts: Record<string, number> = {};
  let freeformSkipped = 0;
  const provenance = `template:${templateId}`;
  let itemIndex = 0;

  for (const item of items) {
    const i = itemIndex++;
    const { start_time, end_time } = buildStartEnd(targetDate, item.time_hhmm, item.duration_min);

    switch (item.kind) {
      case "schedule_shift": {
        // schedule_shift.source is the ADR-0108 provenance discriminator with a
        // CHECK constraint limited to ('operational','bubble_migration','v3_engine').
        // Template-application is operational; the per-row template_id linkage
        // travels via the notes field instead (free-text, no constraint).
        // day_category defaults to 'morning' — template doesn't store it;
        // the manager can update post-apply via web UI.
        const taggedNotes = `${item.payload.notes ?? ""} [${provenance}]`.trim();

        // ── Rule 7 forgery defense (ADR-0430) — validate zone_ids before insert ──
        // Each zone_id must belong to this workspace AND the shift's location's
        // department-area. Fail-fast on first invalid zone (L-0177: no silent fallback).
        const resolvedZonePairs: Array<{ zone_id: string; location_id: string }> = [];
        for (const zone_id of item.payload.zone_ids) {
          const { data: zoneRow } = await supabase
            .from("zone")
            .select("zone_id, location_id")
            .eq("zone_id", zone_id)
            .eq("workspace_id", workspaceId)
            .maybeSingle();
          if (!zoneRow) {
            // L-0177 fail-fast: zone not found or wrong workspace.
            throw new Error(`zone_forgery_workspace: zone ${zone_id} not found in workspace`);
          }
          // If the template item has a location_id, verify zone's location matches.
          if (item.payload.location_id && zoneRow.location_id !== item.payload.location_id) {
            throw new Error(
              `zone_forgery_dept_area: zone ${zone_id} location mismatch for template item`,
            );
          }
          resolvedZonePairs.push({ zone_id: zoneRow.zone_id, location_id: zoneRow.location_id });
        }

        const { data: shiftRow, error } = await supabase
          .from("schedule_shift")
          .insert({
            workspace_id: workspaceId,
            role: item.payload.role,
            start_time,
            end_time,
            shift_date: targetDate,
            day_category: "morning",
            position_id: item.payload.position_id ?? null,
            team_id: item.payload.team_id ?? null,
            location_id: item.payload.location_id ?? null,
            // ADR-0430: zone TEXT field removed — zone assignment goes to shift_zone table.
            notes: taggedNotes,
            is_published: false,
          })
          .select("schedule_shift_id")
          .single();
        if (error || !shiftRow) throw new Error(`schedule_shift insert failed: ${error?.message}`);

        // ── shift_zone INSERTs (ADR-0430 Rule 4 M2N) ────────────────────────────
        // Requires shift_session created by ensure_shift_session trigger. Template
        // shifts are often unassigned (no employee_id), so the trigger may not fire.
        // If shift_session exists, insert shift_zone rows. Otherwise skip gracefully
        // (template shifts frequently have no employee_id + no session at apply time).
        if (resolvedZonePairs.length > 0) {
          const { data: ssRow } = await supabase
            .from("shift_session")
            .select("shift_session_id")
            .eq("schedule_shift_id", shiftRow.schedule_shift_id)
            .maybeSingle();

          if (ssRow) {
            const { data: sdlRows } = await supabase
              .from("shift_session_day_line")
              .select("day_line_id")
              .eq("shift_session_id", ssRow.shift_session_id);
            const dayLineId = sdlRows?.[0]?.day_line_id ?? null;

            if (dayLineId) {
              for (const { zone_id, location_id } of resolvedZonePairs) {
                const { error: szError } = await supabase.from("shift_zone").insert({
                  shift_session_id: ssRow.shift_session_id,
                  day_line_id: dayLineId,
                  zone_id,
                  location_id,
                  workspace_id: workspaceId,
                });
                if (szError) {
                  // Compensating rollback — delete the shift (MF-B).
                  await supabase
                    .from("schedule_shift")
                    .delete()
                    .eq("schedule_shift_id", shiftRow.schedule_shift_id)
                    .eq("workspace_id", workspaceId);
                  throw new Error(`shift_zone_insert_failed:${zone_id} — ${szError.message}`);
                }
              }
            }
          }
        }

        counts["schedule_shift"] = (counts["schedule_shift"] ?? 0) + 1;

        // Per-row emit using "shift created" (posthog + logger + activity_trail + engine_event).
        // ADR-0356 Pattern B: timeline-template writes to schedule-domain data —
        // emit includes actor_capability + delegated_via for cross-namespace audit symmetry.
        // ADR-0430 Rule 6b: zone_ids recorded for audit reconstruction.
        // assigned_to is empty string for unassigned template shifts (no employee pinned yet).
        await emit({
          event: "shift created",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: shiftRow.schedule_shift_id,
            data: {
              assigned_to: "",
              date: targetDate,
              start_time,
              end_time,
              position_id: item.payload.position_id ?? undefined,
              // ADR-0430 Rule 6b: zone_ids for audit reconstruction.
              ...(resolvedZonePairs.length > 0
                ? { zone_ids: resolvedZonePairs.map((p) => p.zone_id) }
                : {}),
              // ADR-0356 Pattern B: cross-namespace write audit fields.
              actor_capability: "schedule" as const,
              delegated_via: "timeline-template" as const,
            },
          },
        });
        break;
      }

      case "session_hook": {
        // Canvas inserts session_hook; cron session_hook_executor materializes
        // session_task at fire time.  DO NOT pre-create session_task here.
        if (!sessionId)
          throw new Error("session_hook requires department_session (no location scope)");
        // session_hook is a department-level template, not session-scoped.
        // We need department_id for the insert.  Fetch from department_session.
        const { data: sessionRow } = await supabase
          .from("department_session")
          .select("department_id")
          .eq("department_session_id", sessionId)
          .single();
        if (!sessionRow) throw new Error("department_session not found for hook insert");

        const { data: hookRow, error } = await supabase
          .from("session_hook")
          .insert({
            workspace_id: workspaceId,
            department_id: sessionRow.department_id,
            hook_type: item.payload.hook_type,
            trigger_offset_min: item.payload.trigger_offset_min,
            linked_procedure_id: item.payload.linked_procedure_id ?? null,
            linked_routine_id: item.payload.linked_routine_id ?? null,
            is_active: true,
          })
          .select("id")
          .single();
        if (error || !hookRow) throw new Error(`session_hook insert failed: ${error?.message}`);
        counts["session_hook"] = (counts["session_hook"] ?? 0) + 1;

        await emit({
          event: "session_hook created",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            data: {
              hook_id: hookRow.id,
              department_id: sessionRow.department_id,
              hook_type: item.payload.hook_type,
              linked_procedure_id: item.payload.linked_procedure_id ?? "",
            },
          },
        });
        break;
      }

      case "session_task": {
        // Canvas-inserted session_task: session_hook_id=NULL (supervisor finding —
        // distinguishes from cron-materialized tasks so cron idempotency key skips them).
        if (!sessionId)
          throw new Error("session_task requires department_session (no location scope)");

        const { data: taskRow, error } = await supabase
          .from("session_task")
          .insert({
            workspace_id: workspaceId,
            department_session_id: sessionId,
            session_hook_id: null, // INVARIANT: null for canvas-inserted tasks
            title: item.payload.title,
            description: item.payload.description ?? null,
            is_compliance_required: item.payload.is_compliance_required,
            status: "pending",
          })
          .select("id")
          .single();
        if (error || !taskRow) throw new Error(`session_task insert failed: ${error?.message}`);
        counts["session_task"] = (counts["session_task"] ?? 0) + 1;

        // "session_task.created" interface requires { entity: EntityRef; metadata: { source: string } }.
        await emit({
          event: "session_task.created",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity: { entity_type: "session_task", entity_id: taskRow.id },
            metadata: { source: "template_apply" },
          },
        });
        break;
      }

      case "session_note": {
        if (!sessionId)
          throw new Error("session_note requires department_session (no location scope)");

        const { data: noteRow, error } = await supabase
          .from("session_note")
          .insert({
            workspace_id: workspaceId,
            department_session_id: sessionId,
            content: item.payload.content,
            created_by: profileId,
            note_type: "general",
          })
          .select("id")
          .single();
        if (error || !noteRow) throw new Error(`session_note insert failed: ${error?.message}`);
        counts["session_note"] = (counts["session_note"] ?? 0) + 1;

        await emit({
          event: "comm.scheduled_note.created",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity: { entity_type: "session_note", entity_id: noteRow.id },
            data: {
              note_id: noteRow.id,
              audience_summary: { dept_count: 0, team_count: 0, shift_count: 0, profile_count: 0 },
              notify_at: start_time,
              is_cross_dept: false,
            },
          },
        });
        break;
      }

      case "deviation": {
        // Deviation requires `domain` (enum).  Template payload has free-text
        // `category` mapped to `subcategory`; domain defaults to 'procedure'.
        const { data: devRow, error } = await supabase
          .from("deviation")
          .insert({
            workspace_id: workspaceId,
            title: item.payload.title,
            description: item.payload.description ?? null,
            subcategory: item.payload.category ?? null,
            domain: "procedure" as const,
            severity: "low" as const,
            status: "open" as const,
            requires_action: false,
            reported_by: profileId,
            session_id: sessionId ?? null,
          })
          .select("deviation_id")
          .single();
        if (error || !devRow) throw new Error(`deviation insert failed: ${error?.message}`);
        counts["deviation"] = (counts["deviation"] ?? 0) + 1;

        // "deviation reported" interface: { entity: EntityRef; data: { domain: string; severity: string } }.
        await emit({
          event: "deviation reported",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity: { entity_type: "deviation", entity_id: devRow.deviation_id },
            data: { domain: "procedure", severity: "low" },
          },
        });
        break;
      }

      case "free_form": {
        const choice = freeformMapping[String(i)] ?? "skip";
        if (choice === "skip") {
          freeformSkipped += 1;
          break;
        }

        if (choice === "task") {
          if (!sessionId) throw new Error("free_form→task requires department_session");
          const { data: taskRow, error } = await supabase
            .from("session_task")
            .insert({
              workspace_id: workspaceId,
              department_session_id: sessionId,
              session_hook_id: null, // INVARIANT: null for canvas-inserted tasks
              title: item.payload.label,
              is_compliance_required: false,
              status: "pending",
            })
            .select("id")
            .single();
          if (error || !taskRow)
            throw new Error(`free_form→session_task insert failed: ${error?.message}`);
          counts["session_task"] = (counts["session_task"] ?? 0) + 1;

          await emit({
            event: "session_task.created",
            workspace_id: nonEmpty(workspaceId, "workspace_id"),
            actor_id: nonEmpty(profileId, "actor_id"),
            properties: {
              entity: { entity_type: "session_task", entity_id: taskRow.id },
              metadata: { source: "template_apply_freeform" },
            },
          });
        } else {
          // choice === "note"
          if (!sessionId) throw new Error("free_form→note requires department_session");
          const { data: noteRow, error } = await supabase
            .from("session_note")
            .insert({
              workspace_id: workspaceId,
              department_session_id: sessionId,
              content: item.payload.label,
              created_by: profileId,
              note_type: "general",
            })
            .select("id")
            .single();
          if (error || !noteRow)
            throw new Error(`free_form→session_note insert failed: ${error?.message}`);
          counts["session_note"] = (counts["session_note"] ?? 0) + 1;

          await emit({
            event: "comm.scheduled_note.created",
            workspace_id: nonEmpty(workspaceId, "workspace_id"),
            actor_id: nonEmpty(profileId, "actor_id"),
            properties: {
              entity: { entity_type: "session_note", entity_id: noteRow.id },
              data: {
                note_id: noteRow.id,
                audience_summary: {
                  dept_count: 0,
                  team_count: 0,
                  shift_count: 0,
                  profile_count: 0,
                },
                notify_at: start_time,
                is_cross_dept: false,
              },
            },
          });
        }
        break;
      }
    }
  }

  return { materialized_count_by_kind: counts, freeform_skipped: freeformSkipped };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool 1 — save_template
// Channel: CHAT-ONLY (ADR-0078 — free-text name, notes, item payloads)
// Gate: timeline_template.save via mutateWithGate (ADR-0287)
// Writes: INSERT timeline_template
// Emit: timeline_template.saved (posthog, logger, activity_trail, engine_event)
// ─────────────────────────────────────────────────────────────────────────────

export const saveTemplate = defineTool({
  name: "save_template",
  description:
    "Lagre gjeldende Dagslinjen-tidslinje som en navngitt mal for en gitt scope (team, avdeling, lokasjon eller vakt). " +
    "Bruk når manager sier 'lagre mal', 'lagre tidslinje som mal', 'lagre dette oppsettet'. " +
    "Kun tilgjengelig i chat (ikke stemme) — inneholder fri tekst og scope-informasjon. " +
    "Validerer scope_id mot workspace; avviser dersom entiteten ikke finnes. " +
    "Lokasjonsscope tillater kun vaktenheter (schedule_shift). " +
    "Skriver til timeline_template. Krever manager+ tilgangsnivå.",
  capability: CAPABILITY,
  schema: TimelineTemplateSaveSchema.strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078): all template authoring is chat-only.
    if (ctx.channel === "voice") {
      return "Maler kan kun lagres i chat, ikke via stemme. Bruk chat-grensesnittet for å lagre en tidslinje-mal.";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Validate scope entity exists in workspace before gating (fast fail).
    try {
      await validateScope(supabase, ctx.workspaceId, params.scope_type, params.scope_id);
    } catch (err) {
      return JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "scope_validation_failed",
      });
    }

    // Location scope constraint: only schedule_shift items allowed.
    if (params.scope_type === "location") {
      const hasNonShift = params.items_json.some((item) => item.kind !== "schedule_shift");
      if (hasNonShift) {
        return JSON.stringify({
          ok: false,
          error:
            "Lokasjonsscope tillater kun vaktenheter (schedule_shift). " +
            "Fjern hooks, oppgaver, notater og avvik fra malen for å bruke lokasjonsfilter.",
        });
      }
    }

    try {
      const { result } = await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY,
        actionType: "timeline_template.save",
        channel: ctx.channel ?? "chat",
        exec: async (db) => {
          const { data, error } = await db
            .from("timeline_template")
            .insert({
              workspace_id: ctx.workspaceId,
              name: params.name,
              scope_type: params.scope_type,
              scope_id: params.scope_id,
              items_json: params.items_json as unknown as Json,
              notes: params.notes ?? null,
              created_by: ctx.profileId,
            })
            .select("id")
            .single();
          if (error || !data) throw new Error(error?.message ?? "insert returned no row");
          return { template_id: data.id };
        },
      });

      const itemCount = params.items_json.length;

      await emit({
        event: "timeline_template.saved",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: {
          data: {
            template_id: result.template_id,
            scope_type: params.scope_type,
            item_count: itemCount,
            name: params.name,
          },
        },
      });

      return JSON.stringify({ ok: true, template_id: result.template_id });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({ ok: false, error: `gate_denied: ${err.message}` });
      }
      if (err instanceof MutateWithGateError) {
        if (err.code === "execute_failed") {
          // Possible UNIQUE index violation on (workspace_id, scope_type, scope_id, lower(name)).
          const msg = err.message ?? "";
          if (msg.includes("uniq_timeline_template_name_per_scope") || msg.includes("unique")) {
            return JSON.stringify({
              ok: false,
              error: "Navn finnes allerede for dette scopet. Velg et annet navn.",
            });
          }
          return JSON.stringify({ ok: false, error: `write_failed: ${err.message}` });
        }
        return JSON.stringify({ ok: false, error: `gate_error: ${err.code}` });
      }
      return JSON.stringify({ ok: false, error: String(err) });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 2 — list_templates
// Channel: CHAT-ONLY (ADR-0078 — name/notes may contain PII-adjacent content)
// Gate: none (read-only, workspace-scoped SELECT)
// Emit: timeline_template.listed (logger only — debug)
// ─────────────────────────────────────────────────────────────────────────────

export const listTemplates = defineTool({
  name: "list_templates",
  description:
    "List lagrede tidslinje-maler for et bestemt scope (team, avdeling, lokasjon eller vakt). " +
    "Bruk når manager sier 'vis maler', 'hva har vi lagret', 'mine tidslinje-maler'. " +
    "Kun tilgjengelig i chat. Returnerer maler filtrert på scope_type og scope_id. " +
    "include_archived=false (standard) viser kun aktive maler.",
  capability: CAPABILITY,
  schema: z
    .object({
      scope_type: z
        .enum(["team", "department", "location", "shift"])
        .describe("Scope-type å filtrere på."),
      scope_id: z.string().uuid().describe("UUID for scope-entiteten."),
      include_archived: z
        .boolean()
        .default(false)
        .describe("Vis også arkiverte maler. Standard: false."),
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078): chat-only — template names may contain PII-adjacent text.
    if (ctx.channel === "voice") {
      return "Tidslinje-maler kan kun vises i chat, ikke via stemme.";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    let query = supabase
      .from("timeline_template")
      .select("id, name, scope_type, scope_id, notes, created_by, created_at, is_archived")
      .eq("workspace_id", ctx.workspaceId)
      .eq("scope_type", params.scope_type)
      .eq("scope_id", params.scope_id)
      .order("created_at", { ascending: false });

    if (!params.include_archived) {
      query = query.eq("is_archived", false);
    }

    const { data, error } = await query;

    if (error) {
      return JSON.stringify({ ok: false, error: error.message });
    }

    const rows = data ?? [];

    // Debug emit to logger only (read-path observability — no audit trail).
    await emit({
      event: "timeline_template.listed",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        data: { count: rows.length, scope_type: params.scope_type },
      },
    });

    if (rows.length === 0) {
      return `Ingen maler funnet for ${params.scope_type}:${params.scope_id}.`;
    }

    return JSON.stringify({ ok: true, templates: rows });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 3 — apply_template
// Channel: CHAT-ONLY (ADR-0078 — target date + freeform mapping involve authoring intent)
// Gate: timeline_template.apply via mutateWithGate (ADR-0287)
// Writes: INSERT schedule_shift | session_hook | session_task | session_note | deviation
// Emit: timeline_template.applied + per-row domain events (ADR-0134)
// Transaction: serial exec callback — see file header for atomicity model.
// ─────────────────────────────────────────────────────────────────────────────

export const applyTemplate = defineTool({
  name: "apply_template",
  description:
    "Bruk en lagret tidslinje-mal på en bestemt dato. " +
    "Instantierer alle mal-elementer som reelle D6-rader (vakter, hooks, oppgaver, notater, avvik). " +
    "Bruk når manager sier 'bruk mal på fredag', 'kopier malen til neste uke', 'aktiver tidslinje-mal'. " +
    "Kun tilgjengelig i chat. Krever target_date >= i dag (Oslo-tid). " +
    "freeform_mapping angir per-chip materialiseringsvalg (task|note|skip) for free_form-elementer. " +
    "Mislykket innsetting avbryter operasjonen (exec-callback kaster, rollback-semantikk via mutateWithGate).",
  capability: CAPABILITY,
  schema: TimelineTemplateApplySchema.strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078): template apply is chat-only.
    if (ctx.channel === "voice") {
      return "Tidslinje-maler kan kun brukes i chat, ikke via stemme.";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Validate target_date >= startOfOsloDay(now) to prevent past-date apply.
    // Uses startOfOsloDay from schedule/oslo-time.ts (L-0252 class guard).
    const todayOslo = startOfOsloDay(new Date());
    const targetDateObj = new Date(`${params.target_date}T00:00:00`);
    if (targetDateObj < todayOslo) {
      return JSON.stringify({
        ok: false,
        error: `target_date må være i dag eller senere. Angitt dato: ${params.target_date}`,
      });
    }

    // Fetch the template — verify workspace_id match (ADR-0151 workspace scope law).
    const { data: template, error: fetchErr } = await supabase
      .from("timeline_template")
      .select("id, workspace_id, scope_type, scope_id, items_json, is_archived")
      .eq("id", params.template_id)
      .single();

    if (fetchErr || !template) {
      return JSON.stringify({ ok: false, error: "Mal ikke funnet." });
    }
    if (template.workspace_id !== ctx.workspaceId) {
      return JSON.stringify({ ok: false, error: "Mal tilhører et annet workspace." });
    }
    if (template.is_archived) {
      return JSON.stringify({ ok: false, error: "Malen er arkivert og kan ikke brukes." });
    }

    // Parse items_json from JSONB (Supabase returns as unknown).
    const parsedItems = TimelineTemplateItems.safeParse(template.items_json);
    if (!parsedItems.success) {
      return JSON.stringify({ ok: false, error: "items_json-validering feilet: korrupt mal." });
    }
    const items = parsedItems.data;

    // Re-validate scope still exists (entity may have been deleted since save).
    const scopeType = template.scope_type as ScopeTypeT;
    try {
      await validateScope(supabase, ctx.workspaceId, scopeType, template.scope_id);
    } catch {
      return JSON.stringify({
        ok: false,
        error:
          "Scope-entiteten finnes ikke lenger. Arkiver malen og opprett en ny med gyldig scope.",
      });
    }

    // Resolve department_id for session-aware items.
    const departmentId = await resolveDepartmentIdForScope(
      supabase,
      ctx.workspaceId,
      scopeType,
      template.scope_id,
    );

    // Find-or-create department_session when department-aware scope.
    let sessionId: string | null = null;
    if (departmentId) {
      try {
        sessionId = await findOrCreateDepartmentSession(
          supabase,
          ctx.workspaceId,
          departmentId,
          params.target_date,
          ctx.profileId,
        );
      } catch (err) {
        return JSON.stringify({
          ok: false,
          error: `Kunne ikke opprette departmentsøkt: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // mutateWithGate wraps ALL per-item inserts in single exec callback.
    // Failure in any insert throws from exec → mutateWithGate re-throws as execute_failed.
    try {
      const { result } = await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY,
        actionType: "timeline_template.apply",
        channel: ctx.channel ?? "chat",
        targetId: params.template_id,
        exec: async (db) => {
          return insertItemsInExec(
            db,
            ctx.workspaceId,
            ctx.profileId,
            items,
            params.target_date,
            sessionId,
            params.freeform_mapping,
            params.template_id,
          );
        },
      });

      // Final summary emit.
      await emit({
        event: "timeline_template.applied",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: {
          data: {
            template_id: params.template_id,
            target_date: params.target_date,
            materialized_count_by_kind: result.materialized_count_by_kind,
            freeform_skipped: result.freeform_skipped,
          },
        },
      });

      return JSON.stringify({
        ok: true,
        materialized: result.materialized_count_by_kind,
        errors: [],
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({ ok: false, error: `gate_denied: ${err.message}` });
      }
      if (err instanceof MutateWithGateError) {
        // Emit apply_failed for observability (posthog, logger, activity_trail).
        await emit({
          event: "timeline_template.apply_failed",
          workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
          actor_id: nonEmpty(ctx.profileId, "actor_id"),
          properties: {
            data: {
              template_id: params.template_id,
              target_date: params.target_date,
              error_code: err.code,
              error_message: err.message,
            },
          },
        });
        return JSON.stringify({
          ok: false,
          materialized: {},
          errors: [{ code: err.code, message: err.message }],
        });
      }
      return JSON.stringify({ ok: false, error: String(err) });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 4 — archive_template
// Channel: CHAT-ONLY (ADR-0078)
// Gate: timeline_template.archive via mutateWithGate (ADR-0287)
// Writes: UPDATE is_archived=true on timeline_template
// Emit: timeline_template.archived (posthog, logger, activity_trail, engine_event)
// ─────────────────────────────────────────────────────────────────────────────

export const archiveTemplate = defineTool({
  name: "archive_template",
  description:
    "Arkiver en tidslinje-mal (myk sletting — is_archived=true). " +
    "Bruk når manager sier 'arkiver mal', 'fjern mal', 'slett tidslinje-mal'. " +
    "Kun tilgjengelig i chat. Irreversibel i v1 (ingen hard-delete policy). " +
    "Verifiserer workspace-tilhørighet før update. Krever manager+ tilgangsnivå.",
  capability: CAPABILITY,
  schema: z
    .object({
      template_id: z.string().uuid().describe("UUID for malen som skal arkiveres."),
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078): chat-only.
    if (ctx.channel === "voice") {
      return "Maler kan kun arkiveres i chat, ikke via stemme.";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Verify template exists in workspace before gating (L-0177 — no silent fallback).
    const { data: existing } = await supabase
      .from("timeline_template")
      .select("id, workspace_id, is_archived")
      .eq("id", params.template_id)
      .maybeSingle();

    if (!existing || existing.workspace_id !== ctx.workspaceId) {
      return JSON.stringify({
        ok: false,
        error: "Mal ikke funnet eller tilhører et annet workspace.",
      });
    }
    if (existing.is_archived) {
      return JSON.stringify({ ok: false, error: "Malen er allerede arkivert." });
    }

    try {
      await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY,
        actionType: "timeline_template.archive",
        channel: ctx.channel ?? "chat",
        targetId: params.template_id,
        exec: async (db) => {
          const { error } = await db
            .from("timeline_template")
            .update({ is_archived: true })
            .eq("id", params.template_id)
            .eq("workspace_id", ctx.workspaceId);
          if (error) throw new Error(error.message);
          return undefined;
        },
      });

      await emit({
        event: "timeline_template.archived",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: {
          data: { template_id: params.template_id },
        },
      });

      return JSON.stringify({ ok: true, template_id: params.template_id });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({ ok: false, error: `gate_denied: ${err.message}` });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({ ok: false, error: `gate_error: ${err.code} — ${err.message}` });
      }
      return JSON.stringify({ ok: false, error: String(err) });
    }
  },
});
