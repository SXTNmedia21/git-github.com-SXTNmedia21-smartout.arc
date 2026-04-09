// packages/ai/src/capabilities/types.ts
import type { SupabaseClient } from "@supabase/supabase-js";
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
  | "ui"
  | "guardian"
  | "contract"
  | "contract_intake";

export type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";

export type SessionChannel = "chat" | "voice" | "sms" | "email" | "autonomous" | "telegram";

export type AgentToolContext = {
  workspaceId: string;
  profileId: string;
  userId?: string;
  sessionId: string;
  supabaseAdmin: SupabaseClient;
  /** ADR-0078: current session channel for defence-in-depth PII restriction */
  channel?: SessionChannel;
  /** Active engine_process ID if this session is running a process */
  processId?: string;
  /** Active engine_state ID for step tracking */
  engineStateId?: string;
  /** Admin acting on behalf of employee (dashboard flows only, never agent) */
  actingOnBehalfOf?: string;
};

export type CapabilityDefinition = {
  name: CapabilityName;
  description: string;
  tools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  suggestTools?: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  /** ADR-0078: if set, capability is only available when session.channel is in this list */
  allowedChannels?: SessionChannel[];
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
