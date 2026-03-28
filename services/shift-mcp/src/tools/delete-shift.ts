// ============================================
// delete-shift.ts
// MCP tool: delete_shift
// Deletes a shift from the schedule_shift table.
// Only allows deletion when status is 'created' or 'unpublished'
// to prevent removing active/published shifts.
// Connected to: src/server.ts (tool registration)
// Connected to: src/types/shift.ts (input schema)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import type { DeleteShiftInput, ToolResult } from "../types/shift.js";

/** Statuses that allow deletion — published/active/completed shifts cannot be deleted */
const DELETABLE_STATUSES = new Set(["created", "unpublished"]);

/**
 * Deletes a shift by ID. Validates workspace scope and checks
 * that the shift is in a deletable status (created or unpublished).
 *
 * @param input - Validated input with shift_id
 * @param workspaceId - Workspace UUID from auth context
 * @returns MCP content block confirming deletion
 */
export async function handleDeleteShift(
  input: DeleteShiftInput,
  workspaceId: string,
): Promise<ToolResult> {
  // Fetch the shift first to validate scope and status
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("schedule_shift")
    .select("schedule_shift_id, workspace_id, status")
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

  if (!DELETABLE_STATUSES.has(existing.status)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: `Cannot delete shift with status '${existing.status}'. Only 'created' or 'unpublished' shifts can be deleted.`,
          }),
        },
      ],
      isError: true,
    };
  }

  const { error } = await supabaseAdmin
    .from("schedule_shift")
    .delete()
    .eq("schedule_shift_id", input.shift_id);

  if (error) {
    if (typeof error.message === "string" && error.message.includes("SHIFT_LOCKED_MUTATION")) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error:
                "Shift is locked because it has started or the shift date has passed. Locked shifts cannot be deleted.",
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

  return {
    content: [{ type: "text", text: JSON.stringify({ deleted: true, shift_id: input.shift_id }) }],
  };
}
