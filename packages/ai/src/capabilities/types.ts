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
  | "payroll"
  | "guardian";

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

// -- Personality & Posture --

export type Personality = {
  formality: number;
  assertiveness: number;
  warmth: number;
  humor: number;
  verbosity: number;
};

export type ResolvedPosture = Personality;

export type Situation =
  | "onboarding"
  | "haccp"
  | "scheduling"
  | "training"
  | "operations"
  | "guardian"
  | "general";

export type PostureAdaptFlags = {
  role: boolean;
  situation: boolean;
  authority: boolean;
};

export type ProfileRole = "employee" | "manager" | "admin" | "owner";
