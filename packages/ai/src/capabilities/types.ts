// packages/ai/src/capabilities/types.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SmartoutTool } from "../types.js";

export type CapabilityName =
  | "knowledge"
  | "schedule"
  | "training"
  | "operations"
  | "operations_intelligence" // ADR-0088: manager/system-scoped intelligence
  | "profile"
  | "communication"
  | "memory"
  | "payroll"
  | "ui"
  | "guardian"
  | "contract"
  | "contract_intake"
  | "shift_swap"
  | "shift_lifecycle"
  | "governance"
  | "billing_query" // ADR-0118 — read-only billing surface, chat-only
  | "helpdesk_query" // ADR-0162 — helpdesk ticket lifecycle, chat-only PII
  | "journey"; // ADR-0173 — journey authoring + runtime (4 tools: run_dev, publish_mission, publish_guide, run_guided)

// AuthorityLevel is a Node-side advisory for tool-selector + router.
// The unified_authority_gate RPC (gate_action) treats all non-disabled
// levels as "allow=true"; it only enforces min_role downgrade and
// requires_four_eyes. Level semantics ("suggest" vs "autonomous" vs
// "confirm") are enforced by packages/ai/src/capabilities/tool-selector.ts,
// not by the DB. See 20260506120000_gate_action_accept_entity_id.sql:45-161.
export type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";

export type SessionChannel =
  | "chat"
  | "voice"
  | "sms"
  | "email"
  | "autonomous"
  | "telegram"
  // ADR-0099: originating_channel for DB-trigger / cron / engine-dispatch paths.
  // Used by gate_action to permit internal/system-only capabilities
  // (e.g. shift_lifecycle.interpret, shift_lifecycle.settle).
  | "system";

export type AgentToolContext = {
  workspaceId: string;
  profileId: string;
  userId?: string;
  sessionId: string;
  supabaseAdmin: SupabaseClient;
  /** Employee-scoped Supabase client (RLS-enforced via user JWT).
   *  Used for self-service PII writes (submit_own_pii) where auth.uid() must resolve. */
  supabaseUser?: SupabaseClient;
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
  | "communication"
  | "general";

export type PostureAdaptFlags = {
  role: boolean;
  situation: boolean;
  authority: boolean;
};

export type ProfileRole = "employee" | "manager" | "admin" | "owner";
