// packages/ai/src/capabilities/memory/index.ts
//
// Phase A3: materialises the `memory` intent (previously a classifier stub,
// see router/tool-selector.ts lines 41-55). Wires the agent's save_memory
// tool into the registry.
//
// Per ADR-0078, memory writes are chat-only (PII defence in depth). Per
// ADR-0099, save_memory calls gate_action before mutating.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { saveMemoryTool } from "./tools.js";

// SmartoutTool is invariant on TSchema; cast through unknown to erase the
// specific schema type for the registry, same pattern as other capabilities.
const writeTools = [saveMemoryTool] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const memoryCapability: CapabilityDefinition = {
  name: "memory",
  description:
    "Persist durable memories about the employee (preferences, facts, summaries). Write-only surface: retrieval happens automatically via the context collector. Chat-only per ADR-0078.",
  // Chat-only — memories may contain sensitive hints; voice is forbidden per ADR-0078.
  allowedChannels: ["chat"],
  // No read-only tools: the context collector surfaces memories in the
  // system prompt automatically, so the agent never needs to query them.
  readOnlyTools: [],
  // save_memory is a gated mutation → authority must be at least `suggest`
  // for the tool to be exposed. Default authority (read_only) hides it,
  // which matches campaign intent: workspaces opt in.
  suggestTools: writeTools,
  tools: writeTools,
};
