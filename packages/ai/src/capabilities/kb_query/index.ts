// packages/ai/src/capabilities/kb_query/index.ts
// ADR-0221 — KB capability registration as merge gate.
// Binds the existing-but-unregistered searchWorkspaceDocs tool so
// agent-router can dispatch it for intent='knowledge'.
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { searchKb } from "./tools.js";

const allTools = [searchKb] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
const readOnlyTools = allTools;
const suggestTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [];

export const kbQueryCapability: CapabilityDefinition = {
  name: "kb_query",
  description: "Semantic search over workspace handbook, policies, and procedures.",
  allowedChannels: ["chat"], // ADR-0078 — text-only retrieval; voice falls back to chat.
  toolAuthPattern: "direct_admin",
  emitPrefix: "kb",
  defaultAuthority: "read_only",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
