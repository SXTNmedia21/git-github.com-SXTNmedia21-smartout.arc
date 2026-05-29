// ============================================
// create-shift.ts
// MCP tool: create_shift
// Inserts a new shift into the schedule_shift table.
// Automatically computes work_hours from start/end times and breaks.
// Connected to: src/server.ts (tool registration)
// Connected to: src/types/shift.ts (input schema)
//
// ADR-0430 (Shift × Zone × Location M:N): schedule_shift.department_id is NOT NULL
// (M1) and the scalar `zone` column was dropped (M4). This tool now:
//   1. resolves department_id explicitly (mirror of add-shift-action.ts — the
//      schedule_shift_derive_department_id trigger only fires on UPDATE OF position_id,
//      NEVER on INSERT, so create MUST resolve a department before inserting).
//   2. writes zone assignments to the shift_zone junction (keyed by
//      shift_session_id + day_line_id, materialized by the ensure_shift_session trigger).
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import type { CreateShiftInput, ToolResult } from "../types/shift.js";
import { computeWorkHours } from "../lib/work-hours.js";

function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

/**
 * Creates a new shift in the schedule_shift table.
 * Validates that the workspace_id matches the authenticated context.
 * Resolves department_id (M1 NOT NULL) and writes zone_ids to shift_zone (M4 M:N).
 * Computes work_hours from start_time, end_time, and breaks.
 *
 * @param input - Validated create shift fields
 * @param workspaceId - Workspace UUID from auth context
 * @returns MCP content block with the created shift
 */
export async function handleCreateShift(
  input: CreateShiftInput,
  workspaceId: string,
): Promise<ToolResult> {
  // Enforce workspace scope — only allow creating shifts in the authenticated workspace
  if (input.workspace_id !== workspaceId) {
    return errorResult(
      "Workspace mismatch: you can only create shifts in your authenticated workspace.",
    );
  }

  // ── Resolve department_id (ADR-0430 M1) ───────────────────────────────────
  // Preference order mirrors add-shift-action.ts:
  //   1. department_session_id → department_session.department_id (strongest)
  //   2. department_id direct input
  // Cross-workspace verification runs on whichever path is used.
  // NO silent fallback (L-0177): if neither resolves, fail fast.
  let departmentId: string | null = null;
  if (input.department_session_id) {
    const { data: ds } = await supabaseAdmin
      .from("department_session")
      .select("department_session_id, workspace_id, department_id")
      .eq("department_session_id", input.department_session_id)
      .maybeSingle();
    if (!ds || ds.workspace_id !== workspaceId) {
      return errorResult("department_session_not_found: not found or in another workspace.");
    }
    departmentId = ds.department_id ?? null;
  } else if (input.department_id) {
    const { data: dept } = await supabaseAdmin
      .from("department")
      .select("department_id, workspace_id")
      .eq("department_id", input.department_id)
      .maybeSingle();
    if (!dept || dept.workspace_id !== workspaceId) {
      return errorResult("department_not_found: not found or in another workspace.");
    }
    departmentId = dept.department_id;
  }

  if (!departmentId) {
    return errorResult(
      "department_unresolved: supply department_session_id or department_id (schedule_shift.department_id is NOT NULL).",
    );
  }

  // ── Rule 7 forgery defense (ADR-0430) ──────────────────────────────────────
  // Validate every zone_id belongs to this workspace AND this department's area
  // before inserting. Fail-fast on first invalid zone (L-0177: NO silent fallback).
  const resolvedZoneLocationPairs: Array<{ zone_id: string; location_id: string }> = [];
  for (const zone_id of input.zone_ids) {
    const { data: zoneRow } = await supabaseAdmin
      .from("zone")
      .select("zone_id, location_id")
      .eq("zone_id", zone_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!zoneRow) {
      return errorResult(`zone_forgery_workspace: zone ${zone_id} not found in workspace.`);
    }

    const { data: deptLocRow } = await supabaseAdmin
      .from("department_location")
      .select("location_id")
      .eq("department_id", departmentId)
      .eq("location_id", zoneRow.location_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!deptLocRow) {
      return errorResult(
        `zone_forgery_dept_area: zone ${zone_id} location not in department area.`,
      );
    }

    resolvedZoneLocationPairs.push({ zone_id, location_id: zoneRow.location_id });
  }

  const workHours = computeWorkHours(input.start_time, input.end_time, input.breaks);

  // ── INSERT schedule_shift ──────────────────────────────────────────────────
  // ADR-0430 M4: no `zone`, no `location_id` columns. department_id is required.
  const { data, error } = await supabaseAdmin
    .from("schedule_shift")
    .insert({
      workspace_id: input.workspace_id,
      department_id: departmentId,
      shift_date: input.shift_date,
      role: input.role,
      start_time: input.start_time,
      end_time: input.end_time,
      day_category: input.day_category,
      employee_id: input.employee_id ?? null,
      position_id: input.position_id ?? null,
      team_id: input.team_id ?? null,
      breaks: input.breaks,
      indicator: input.indicator,
      notes: input.notes ?? null,
      status: input.status,
      is_published: input.is_published,
      work_hours: workHours,
    })
    .select("schedule_shift_id")
    .single();

  if (error || !data) {
    return errorResult(error?.message ?? "schedule_shift insert failed.");
  }

  const newShiftId = data.schedule_shift_id;

  // ── INSERT shift_zone rows (ADR-0430 Rule 4) ──────────────────────────────
  // shift_zone is keyed by (shift_session_id, day_line_id) — both materialized
  // by the ensure_shift_session trigger that fires AFTER INSERT on schedule_shift.
  // Skip entirely when no zones requested (empty shift is valid).
  if (resolvedZoneLocationPairs.length > 0) {
    const { data: ssRow } = await supabaseAdmin
      .from("shift_session")
      .select("shift_session_id")
      .eq("schedule_shift_id", newShiftId)
      .maybeSingle();

    if (!ssRow) {
      // Trigger preconditions not met (no session for this date/dept/location).
      // Compensating DELETE so we don't leave a shift that can't carry its zones (MF-B).
      await supabaseAdmin
        .from("schedule_shift")
        .delete()
        .eq("schedule_shift_id", newShiftId)
        .eq("workspace_id", workspaceId);
      return errorResult("shift_zone_insert_failed: no shift_session created by trigger.");
    }

    const { data: sdlRows } = await supabaseAdmin
      .from("shift_session_day_line")
      .select("day_line_id")
      .eq("shift_session_id", ssRow.shift_session_id);

    const dayLineId = sdlRows?.[0]?.day_line_id ?? null;
    if (!dayLineId) {
      await supabaseAdmin
        .from("schedule_shift")
        .delete()
        .eq("schedule_shift_id", newShiftId)
        .eq("workspace_id", workspaceId);
      return errorResult("shift_zone_insert_failed: no day_line found for shift_session.");
    }

    for (const { zone_id, location_id } of resolvedZoneLocationPairs) {
      const { error: szError } = await supabaseAdmin.from("shift_zone").insert({
        shift_session_id: ssRow.shift_session_id,
        day_line_id: dayLineId,
        zone_id,
        location_id,
      });
      if (szError) {
        await supabaseAdmin
          .from("schedule_shift")
          .delete()
          .eq("schedule_shift_id", newShiftId)
          .eq("workspace_id", workspaceId);
        return errorResult(`shift_zone_insert_failed: ${szError.message}`);
      }
    }
  }

  // Re-select the full shift row to return to the caller, echoing assigned zone_ids.
  const { data: fullRow } = await supabaseAdmin
    .from("schedule_shift")
    .select("*")
    .eq("schedule_shift_id", newShiftId)
    .single();

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          ...(fullRow ?? { schedule_shift_id: newShiftId }),
          zone_ids: resolvedZoneLocationPairs.map((p) => p.zone_id),
        }),
      },
    ],
  };
}
