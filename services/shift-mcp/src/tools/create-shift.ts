// ============================================
// create-shift.ts
// MCP tool: create_shift
// Inserts a new shift into the schedule_shift table.
// Automatically computes work_hours from start/end times and breaks.
// Connected to: src/server.ts (tool registration)
// Connected to: src/types/shift.ts (input schema)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import type { CreateShiftInput, ToolResult } from "../types/shift.js";
import { computeWorkHours } from "../lib/work-hours.js";

/**
 * Creates a new shift in the schedule_shift table.
 * Validates that the workspace_id matches the authenticated context.
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
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error:
              "Workspace mismatch: you can only create shifts in your authenticated workspace.",
          }),
        },
      ],
      isError: true,
    };
  }

  const workHours = computeWorkHours(input.start_time, input.end_time, input.breaks);

  const { data, error } = await supabaseAdmin
    .from("schedule_shift")
    .insert({
      workspace_id: input.workspace_id,
      shift_date: input.shift_date,
      role: input.role,
      start_time: input.start_time,
      end_time: input.end_time,
      day_category: input.day_category,
      employee_id: input.employee_id ?? null,
      position_id: input.position_id ?? null,
      team_id: input.team_id ?? null,
      breaks: input.breaks,
      zone: input.zone ?? null,
      indicator: input.indicator,
      notes: input.notes ?? null,
      status: input.status,
      is_published: input.is_published,
      work_hours: workHours,
    })
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
