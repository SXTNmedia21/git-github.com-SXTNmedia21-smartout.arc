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

// Both create and send are suggest-level: Botsson proposes, admin confirms before execution.
// Sending is irreversible, so requiring confirmation is especially important here.
const suggestTools = [createEmployeeContract, sendEmployeeContract] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const allTools = [...readOnlyTools, ...suggestTools] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const contractCapability: CapabilityDefinition = {
  name: "contract",
  description: "Manage employee contracts — create, send for signing, and track status",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
