// packages/ai/src/capabilities/types.ts
import type { SmartoutTool } from "../types.js";

export type CapabilityName =
  | "knowledge"
  | "schedule"
  | "training"
  | "operations"
  | "profile"
  | "communication"
  | "memory"
  | "payroll";

export type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";

export type AgentToolContext = {
  workspaceId: string;
  profileId: string;
  userId?: string;
  sessionId: string;
  supabaseAdmin: unknown;
};

export type CapabilityDefinition = {
  name: CapabilityName;
  description: string;
  tools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  suggestTools?: ReadonlyArray<SmartoutTool<AgentToolContext>>;
};
