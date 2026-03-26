// packages/ai/src/capabilities/schedule/index.ts

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { getMyShifts, getShiftColleagues, getTodaySchedule, getShiftDetail } from "./tools.js";

// SmartoutTool is invariant on TSchema (schema property + z.infer in execute),
// so defineTool's inferred ZodObject doesn't widen to ZodType automatically.
// Cast through unknown to erase the specific schema type for the registry.
const tools = [
  getMyShifts,
  getShiftColleagues,
  getTodaySchedule,
  getShiftDetail,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const scheduleCapability: CapabilityDefinition = {
  name: "schedule",
  description:
    "Employee shift schedule: upcoming shifts, colleagues, department schedules, and shift details",
  tools,
  readOnlyTools: tools,
  // All schedule tools are read-only in v1.0 — no write operations
};
