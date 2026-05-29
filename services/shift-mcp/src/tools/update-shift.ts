// ============================================
// update-shift.ts
// MCP tool: update_shift
// Updates an existing shift in the schedule_shift table.
// Recomputes work_hours if start/end times or breaks change.
// Connected to: src/server.ts (tool registration)
// Connected to: src/types/shift.ts (input schema)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import type { UpdateShiftInput, ToolResult } from "../types/shift.js";
import { computeWorkHours } from "../lib/work-hours.js";

/**
 * Updates an existing shift. Validates workspace scope by
 * checking the shift belongs to the authenticated workspace.
 * If start_time, end_time, or breaks change, recomputes work_hours.
 *
 * @param input - Validated partial update fields + shift_id
 * @param workspaceId - Workspace UUID from auth context
 * @returns MCP content block with the updated shift
 */
export async function handleUpdateShift(
  input: UpdateShiftInput,
  workspaceId: string,
): Promise<ToolResult> {
  // First fetch the existing shift to validate workspace scope
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("schedule_shift")
    .select("*")
    .eq("schedule_shift_id", input.shift_id)
    .single();

  if (fetchError || !existing) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "Shift not found." }) }],
      isError: true,
    };
  }

  if (existing.workspace_id !== workspaceId) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Workspace mismatch: shift does not belong to your workspace.",
          }),
        },
      ],
      isError: true,
    };
  }

  // Build the update payload, only including provided fields
  const { shift_id, ...fields } = input;
  const updateData: Record<string, unknown> = {};

  if (fields.shift_date !== undefined) updateData.shift_date = fields.shift_date;
  if (fields.role !== undefined) updateData.role = fields.role;
  if (fields.start_time !== undefined) updateData.start_time = fields.start_time;
  if (fields.end_time !== undefined) updateData.end_time = fields.end_time;
  if (fields.day_category !== undefined) updateData.day_category = fields.day_category;
  if (fields.employee_id !== undefined) updateData.employee_id = fields.employee_id ?? null;
  if (fields.position_id !== undefined) updateData.position_id = fields.position_id ?? null;
  if (fields.team_id !== undefined) updateData.team_id = fields.team_id ?? null;
  if (fields.breaks !== undefined) updateData.breaks = fields.breaks;
  // ADR-0430 M4: scalar `zone` dropped. Zone reconcile happens after the update
  // via the shift_zone junction (handled below). Do NOT write `zone` here.
  if (fields.indicator !== undefined) updateData.indicator = fields.indicator;
  if (fields.notes !== undefined) updateData.notes = fields.notes ?? null;
  if (fields.status !== undefined) updateData.status = fields.status;
  if (fields.is_published !== undefined) updateData.is_published = fields.is_published;

  // Recompute work_hours if any time-related field changed
  const startTime = (fields.start_time ?? existing.start_time) as string;
  const endTime = (fields.end_time ?? existing.end_time) as string;
  const breaks = (fields.breaks ?? existing.breaks) as number;

  if (
    fields.start_time !== undefined ||
    fields.end_time !== undefined ||
    fields.breaks !== undefined
  ) {
    updateData.work_hours = computeWorkHours(startTime, endTime, breaks);
  }

  // Only issue the schedule_shift UPDATE when there are scalar fields to change.
  // When the caller supplied ONLY zone_ids, updateData is empty — `.update({})`
  // returns no row and `.single()` throws "cannot coerce". In that case we keep
  // the already-fetched `existing` row and go straight to the zone reconcile.
  let data: typeof existing = existing;
  if (Object.keys(updateData).length > 0) {
    const updateResult = await supabaseAdmin
      .from("schedule_shift")
      .update(updateData)
      .eq("schedule_shift_id", shift_id)
      .select()
      .single();

    if (updateResult.error) {
      const error = updateResult.error;
      if (typeof error.message === "string" && error.message.includes("SHIFT_LOCKED_MUTATION")) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error:
                  "Shift is locked because it has started or the shift date has passed. Planning fields cannot be changed.",
              }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
        isError: true,
      };
    }
    data = updateResult.data;
  }

  // ── Reconcile zone assignments (ADR-0430 Rule 4) ──────────────────────────
  // undefined = leave zones unchanged; [] = clear all; [ids] = replace set.
  // shift_zone has no UPDATE policy (M2 RLS): zone changes are binary
  // delete + re-insert, keyed by (shift_session_id, day_line_id).
  if (fields.zone_ids !== undefined) {
    // department for forgery checks comes from the (NOT NULL) existing row.
    const departmentId = (existing as { department_id: string }).department_id;

    // Validate every new zone_id (Rule 7 forgery defense — L-0177 fail-fast).
    const resolvedZoneLocationPairs: Array<{ zone_id: string; location_id: string }> = [];
    for (const zone_id of fields.zone_ids) {
      const { data: zoneRow } = await supabaseAdmin
        .from("zone")
        .select("zone_id, location_id")
        .eq("zone_id", zone_id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!zoneRow) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `zone_forgery_workspace: zone ${zone_id} not found in workspace.`,
              }),
            },
          ],
          isError: true,
        };
      }
      const { data: deptLocRow } = await supabaseAdmin
        .from("department_location")
        .select("location_id")
        .eq("department_id", departmentId)
        .eq("location_id", zoneRow.location_id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!deptLocRow) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `zone_forgery_dept_area: zone ${zone_id} location not in department area.`,
              }),
            },
          ],
          isError: true,
        };
      }
      resolvedZoneLocationPairs.push({ zone_id, location_id: zoneRow.location_id });
    }

    // Resolve the trigger-materialized session + day_line for this shift.
    const { data: ssRow } = await supabaseAdmin
      .from("shift_session")
      .select("shift_session_id")
      .eq("schedule_shift_id", shift_id)
      .maybeSingle();
    const { data: sdlRows } = ssRow
      ? await supabaseAdmin
          .from("shift_session_day_line")
          .select("day_line_id")
          .eq("shift_session_id", ssRow.shift_session_id)
      : { data: null };
    const dayLineId = sdlRows?.[0]?.day_line_id ?? null;

    if (!ssRow || !dayLineId) {
      // Cannot carry zones without a session/day_line. If the caller actually
      // wanted to set zones (non-empty), surface the failure (no silent drop).
      // Clearing ([]) when there's no session is a harmless no-op.
      if (resolvedZoneLocationPairs.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error:
                  "shift_zone_reconcile_failed: no shift_session/day_line for this shift; cannot assign zones.",
              }),
            },
          ],
          isError: true,
        };
      }
    } else {
      // Binary reconcile: delete the existing set, then insert the new set.
      const { error: delErr } = await supabaseAdmin
        .from("shift_zone")
        .delete()
        .eq("shift_session_id", ssRow.shift_session_id)
        .eq("day_line_id", dayLineId);
      if (delErr) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `shift_zone_reconcile_failed: ${delErr.message}` }),
            },
          ],
          isError: true,
        };
      }
      for (const { zone_id, location_id } of resolvedZoneLocationPairs) {
        const { error: szErr } = await supabaseAdmin.from("shift_zone").insert({
          shift_session_id: ssRow.shift_session_id,
          day_line_id: dayLineId,
          zone_id,
          location_id,
        });
        if (szErr) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `shift_zone_reconcile_failed: ${szErr.message}` }),
              },
            ],
            isError: true,
          };
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ...data,
            zone_ids: resolvedZoneLocationPairs.map((p) => p.zone_id),
          }),
        },
      ],
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}
