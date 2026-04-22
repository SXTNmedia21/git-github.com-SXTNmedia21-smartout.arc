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
  explainContractClause,
  getComplianceDriftForContract,
  createEmployeeContract,
  sendEmployeeContract,
  forkTemplate,
  publishWorkspaceTemplate,
  deprecateWorkspaceTemplate,
} from "./tools.js";

const readOnlyTools = [
  listEmployeeTemplates,
  listEmployeeContracts,
  checkContractStatus,
  explainContractClause,
  getComplianceDriftForContract,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// Suggest-level: Botsson proposes, admin confirms before execution.
// - create/send are irreversible mutations on `contract`
// - fork/publish/deprecate are lifecycle mutations on `contract_template`
//   (Council 2026-04-22 Gate G4)
//
// ADR-0133 (mobile boundary): these authoring tools are chat-only (see
// `allowedChannels` below) and therefore MUST NOT appear on mobile voice
// or agent surfaces. If/when a mobile-specific capability config is added,
// fork/publish/deprecate stay web-only. The `ctx.channel !== 'chat'` guard
// inside each tool is the defence-in-depth layer (ADR-0078 Layer 3).
const suggestTools = [
  createEmployeeContract,
  sendEmployeeContract,
  forkTemplate,
  publishWorkspaceTemplate,
  deprecateWorkspaceTemplate,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const allTools = [...readOnlyTools, ...suggestTools] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const contractCapability: CapabilityDefinition = {
  name: "contract",
  description: "Manage employee contracts — create, send for signing, and track status",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  allowedChannels: ["chat"],
};
