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
  if (fields.zone !== undefined) updateData.zone = fields.zone ?? null;
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

  const { data, error } = await supabaseAdmin
    .from("schedule_shift")
    .update(updateData)
    .eq("schedule_shift_id", shift_id)
    .select()
    .single();

  if (error) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}
