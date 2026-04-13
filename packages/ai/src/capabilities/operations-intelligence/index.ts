// packages/ai/src/capabilities/operations-intelligence/index.ts
// ADR-0088: Operations Intelligence — manager/system-scoped capability.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { triageEvent } from "./tools.js";

const allTools = [triageEvent] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [triageEvent] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const operationsIntelligenceCapability: CapabilityDefinition = {
  name: "operations_intelligence",
  description:
    "Operational intelligence: event triage, anomaly monitoring, session analysis. Manager and system scope.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
