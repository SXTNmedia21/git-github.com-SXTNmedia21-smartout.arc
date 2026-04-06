// packages/ai/src/capabilities/contract/index.ts
//
// Registers the contract capability: read-only tools for employees/managers,
// suggest-level tools for creating contracts, and the irreversible send action.
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  listEmployeeTemplates,
  listEmployeeContracts,
  checkContractStatus,
  createEmployeeContract,
  sendEmployeeContract,
} from "./tools.js";

const readOnlyTools = [
  listEmployeeTemplates,
  listEmployeeContracts,
  checkContractStatus,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// createEmployeeContract is suggest-level: Botsson proposes, admin confirms
const suggestTools = [createEmployeeContract] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// sendEmployeeContract is autonomous/irreversible — included in allTools but treated
// with highest caution by the authority layer (only reached after role guard passes)
const allTools = [
  ...readOnlyTools,
  ...suggestTools,
  sendEmployeeContract as unknown as SmartoutTool<AgentToolContext>,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const contractCapability: CapabilityDefinition = {
  name: "contract",
  description: "Manage employee contracts — create, send for signing, and track status",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
