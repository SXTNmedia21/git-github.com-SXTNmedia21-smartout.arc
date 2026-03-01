// ============================================
// server.ts
// McpServer configuration with 5 shift management tools.
// Uses the MCP SDK registerTool API with Zod input schemas.
// Auth context is passed via closure — each request creates
// a new McpServer with the authenticated workspaceId bound.
// Connected to: src/index.ts (server.connect with transport)
// Connected to: src/tools/ (individual tool handlers)
// ============================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createShiftInput,
  updateShiftInput,
  listShiftsInput,
  getShiftInput,
  deleteShiftInput,
} from "./types/shift.js";
import { handleCreateShift } from "./tools/create-shift.js";
import { handleUpdateShift } from "./tools/update-shift.js";
import { handleListShifts } from "./tools/list-shifts.js";
import { handleGetShift } from "./tools/get-shift.js";
import { handleDeleteShift } from "./tools/delete-shift.js";

/**
 * Creates and configures the McpServer with all shift tools.
 * Called once per request in stateless mode — the workspaceId
 * from auth middleware is captured in tool handler closures.
 *
 * @param workspaceId - Authenticated workspace UUID from auth middleware
 * @returns Configured McpServer instance
 */
export function createMcpServer(workspaceId: string): McpServer {
  const server = new McpServer({
    name: "shift-mcp",
    version: "0.1.0",
  });

  // ── create_shift ─────────────────────────────────────────
  server.registerTool(
    "create_shift",
    {
      description:
        "Creates a new shift in the schedule. Requires workspace_id, shift_date, role, start_time, end_time, and day_category. Work hours are automatically calculated.",
      inputSchema: createShiftInput,
    },
    async (input) => handleCreateShift(input, workspaceId),
  );

  // ── update_shift ─────────────────────────────────────────
  server.registerTool(
    "update_shift",
    {
      description:
        "Updates an existing shift. Provide shift_id and any fields to change. Work hours are recalculated if time or break fields change.",
      inputSchema: updateShiftInput,
    },
    async (input) => handleUpdateShift(input, workspaceId),
  );

  // ── list_shifts ──────────────────────────────────────────
  server.registerTool(
    "list_shifts",
    {
      description:
        "Lists shifts for a workspace within a date range. Supports optional filters by employee_id, status, and team_id. Returns shifts sorted by date and start time.",
      inputSchema: listShiftsInput,
    },
    async (input) => handleListShifts(input, workspaceId),
  );

  // ── get_shift ────────────────────────────────────────────
  server.registerTool(
    "get_shift",
    {
      description:
        "Retrieves a single shift by its ID. Validates that the shift belongs to the authenticated workspace.",
      inputSchema: getShiftInput,
    },
    async (input) => handleGetShift(input, workspaceId),
  );

  // ── delete_shift ─────────────────────────────────────────
  server.registerTool(
    "delete_shift",
    {
      description:
        "Deletes a shift by ID. Only shifts with status 'created' or 'unpublished' can be deleted. Published, active, or completed shifts must be unpublished first.",
      inputSchema: deleteShiftInput,
    },
    async (input) => handleDeleteShift(input, workspaceId),
  );

  return server;
}
