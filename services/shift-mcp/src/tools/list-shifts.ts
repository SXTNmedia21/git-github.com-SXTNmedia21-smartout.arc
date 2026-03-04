// ============================================
// list-shifts.ts
// MCP tool: list_shifts
// Queries schedule_shift with date range and optional filters.
// Returns shifts ordered by date and start time.
// Connected to: src/server.ts (tool registration)
// Connected to: src/types/shift.ts (input schema)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import type { ListShiftsInput, ToolResult } from "../types/shift.js";

/**
 * Lists shifts for a workspace within a date range.
 * Validates workspace scope and supports optional filters
 * for employee, status, and team.
 *
 * @param input - Validated list filters (workspace_id, date_from, date_to, etc.)
 * @param workspaceId - Workspace UUID from auth context
 * @returns MCP content block with array of shifts
 */
export async function handleListShifts(
  input: ListShiftsInput,
  workspaceId: string,
): Promise<ToolResult> {
  // Enforce workspace scope
  if (input.workspace_id !== workspaceId) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Workspace mismatch: you can only list shifts in your authenticated workspace.",
          }),
        },
      ],
      isError: true,
    };
  }

  let query = supabaseAdmin
    .from("schedule_shift")
    .select("*")
    .eq("workspace_id", input.workspace_id)
    .gte("shift_date", input.date_from)
    .lte("shift_date", input.date_to)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });

  // Apply optional filters
  if (input.employee_id) {
    query = query.eq("employee_id", input.employee_id);
  }
  if (input.status) {
    query = query.eq("status", input.status);
  }
  if (input.team_id) {
    query = query.eq("team_id", input.team_id);
  }

  const { data, error } = await query;

  if (error) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify({ shifts: data, count: data.length }) }],
  };
}
