// packages/ai/src/capabilities/training/index.ts
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { getMyTrainingStatus, getNextProtocol, getTeamReadiness } from "./tools.js";

// Employee-safe tools (available at read_only authority)
const employeeTools = [getMyTrainingStatus, getNextProtocol] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// Manager/admin tools (available at suggest authority or higher)
const managerTools = [getTeamReadiness] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// All tools combined (available at confirm/autonomous authority)
const allTools = [...employeeTools, ...managerTools] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const trainingCapability: CapabilityDefinition = {
  name: "training",
  description:
    "Employee training and competence: protocol assignments, readiness scores, knowledge test status, and next steps",
  tools: allTools,
  readOnlyTools: employeeTools,
  suggestTools: managerTools,
};
