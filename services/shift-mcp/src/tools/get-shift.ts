// ============================================
// get-shift.ts
// MCP tool: get_shift
// Retrieves a single shift by ID with workspace scope validation.
// Connected to: src/server.ts (tool registration)
// Connected to: src/types/shift.ts (input schema)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import type { GetShiftInput, ToolResult } from "../types/shift.js";

/**
 * Gets a single shift by ID. Validates that the shift
 * belongs to the authenticated workspace.
 *
 * @param input - Validated input with shift_id
 * @param workspaceId - Workspace UUID from auth context
 * @returns MCP content block with the shift data
 */
export async function handleGetShift(
  input: GetShiftInput,
  workspaceId: string,
): Promise<ToolResult> {
  const { data, error } = await supabaseAdmin
    .from("schedule_shift")
    .select("*")
    .eq("schedule_shift_id", input.shift_id)
    .single();

  if (error || !data) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "Shift not found." }) }],
      isError: true,
    };
  }

  if (data.workspace_id !== workspaceId) {
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

  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}
