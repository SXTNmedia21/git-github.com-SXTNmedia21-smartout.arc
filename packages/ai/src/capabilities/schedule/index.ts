// packages/ai/src/capabilities/schedule/index.ts

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  getMyShifts,
  getShiftColleagues,
  getTodaySchedule,
  getShiftDetail,
  getWorkspaceSchedule,
  getDateScheduleForMe,
} from "./tools.js";
import { getShiftLifecycle } from "./tools/get-shift-lifecycle.js";

// SmartoutTool is invariant on TSchema (schema property + z.infer in execute),
// so defineTool's inferred ZodObject doesn't widen to ZodType automatically.
// Cast through unknown to erase the specific schema type for the registry.
const tools = [
  getMyShifts,
  getShiftColleagues,
  getTodaySchedule,
  getShiftDetail,
  getShiftLifecycle,
  // Admin/manager workspace-level date query — chat-only (PII: display_name).
  getWorkspaceSchedule,
  // Employee own-date query — voice-safe.
  getDateScheduleForMe,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const scheduleCapability: CapabilityDefinition = {
  name: "schedule",
  description:
    "Shift schedule queries for employees (personal shifts, colleagues, lifecycle) and admins/managers (workspace-wide date views). All tools are read-only.",
  tools,
  readOnlyTools: tools,
  // All schedule tools are read-only — voice-safe per ADR-0078.
  // get_workspace_schedule enforces its own voice guard (PII: display_name).
  allowedChannels: ["chat", "voice", "system"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "schedule",
  defaultAuthority: "read_only",
};
