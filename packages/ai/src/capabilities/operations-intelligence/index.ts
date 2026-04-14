// packages/ai/src/capabilities/operations-intelligence/index.ts
// ADR-0088: Operations Intelligence — manager/system-scoped capability.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { triageEvent } from "./tools.js";
import { queryMonitorAlerts, getSessionIntelligence } from "./monitor-tools.js";

const allTools = [
  triageEvent,
  queryMonitorAlerts,
  getSessionIntelligence,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [queryMonitorAlerts, getSessionIntelligence] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const suggestTools = [
  triageEvent,
  queryMonitorAlerts,
  getSessionIntelligence,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const operationsIntelligenceCapability: CapabilityDefinition = {
  name: "operations_intelligence",
  description:
    "Operational intelligence: event triage, anomaly monitoring, session analysis. Manager and system scope.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
