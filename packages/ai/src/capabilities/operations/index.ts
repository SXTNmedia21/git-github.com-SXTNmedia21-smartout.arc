// packages/ai/src/capabilities/operations/index.ts

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  getMyTasks,
  getSessionInfo,
  getDepartmentStatus,
  createDeviation,
  completeTask,
} from "./tools.js";

const allTools = [
  getMyTasks,
  getSessionInfo,
  getDepartmentStatus,
  createDeviation,
  completeTask,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [getMyTasks, getSessionInfo, getDepartmentStatus] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const suggestTools = [createDeviation, completeTask] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const operationsCapability: CapabilityDefinition = {
  name: "operations",
  description:
    "Daily operations: tasks, session status, department state, deviations, and task completion",
  // ADR-0163 — task and deviation data references profile_id + session_id (actor-attributed).
  // Not structured PII but employee-identifying in context: chat-only.
  allowedChannels: ["chat"],
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
