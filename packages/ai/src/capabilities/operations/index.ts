// packages/ai/src/capabilities/operations/index.ts

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { getMyTasks, getSessionInfo, getDepartmentStatus, createDeviation } from "./tools.js";

const allTools = [
  getMyTasks,
  getSessionInfo,
  getDepartmentStatus,
  createDeviation,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [getMyTasks, getSessionInfo, getDepartmentStatus] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const suggestTools = [createDeviation] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const operationsCapability: CapabilityDefinition = {
  name: "operations",
  description: "Daily operations: tasks, session status, department state, and deviation reporting",
  // ADR-0163 — task and deviation data references profile_id + session_id (actor-attributed).
  // Not structured PII but employee-identifying in context: chat-only.
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "operations",
  defaultAuthority: "read_only",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
