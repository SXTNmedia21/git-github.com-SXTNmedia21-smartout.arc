// packages/ai/src/capabilities/operations-intelligence/index.ts
// ADR-0088: Operations Intelligence — manager/system-scoped capability.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { triageEvent } from "./tools.js";
import { queryMonitorAlerts, getSessionIntelligence } from "./monitor-tools.js";
import { predictCoverage, predictCompliance } from "./predict-tools.js";
import { queryPatterns } from "./learn-tools.js";

const allTools = [
  triageEvent,
  queryMonitorAlerts,
  getSessionIntelligence,
  predictCoverage,
  predictCompliance,
  queryPatterns,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [
  queryMonitorAlerts,
  getSessionIntelligence,
  predictCoverage,
  predictCompliance,
  queryPatterns,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [
  triageEvent,
  queryMonitorAlerts,
  getSessionIntelligence,
  predictCoverage,
  predictCompliance,
  queryPatterns,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const operationsIntelligenceCapability: CapabilityDefinition = {
  name: "operations_intelligence",
  description:
    "Operational intelligence: event triage, anomaly monitoring, session analysis, coverage prediction, compliance prediction, and learned pattern queries. Manager and system scope.",
  // ADR-0163 — aggregate/KPI output surfaces employee identities in drill-down.
  // Manager-scoped but chat-only to prevent voice leakage of per-employee signals.
  allowedChannels: ["chat"],
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
