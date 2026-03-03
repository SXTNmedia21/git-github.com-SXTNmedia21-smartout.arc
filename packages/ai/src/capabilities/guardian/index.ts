// packages/ai/src/capabilities/guardian/index.ts
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { getSignals, acknowledgeSignal, getWorkspaceHealth } from "./tools.js";

const allTools = [getSignals, acknowledgeSignal, getWorkspaceHealth] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const readOnlyTools = [getSignals, getWorkspaceHealth] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const suggestTools = [acknowledgeSignal] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const guardianCapability: CapabilityDefinition = {
  name: "guardian",
  description:
    "Workspace health monitoring: readiness alerts, maturity signals, and agent behavior tracking",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
