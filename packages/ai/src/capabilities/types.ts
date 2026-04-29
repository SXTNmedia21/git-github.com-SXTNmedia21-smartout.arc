// packages/ai/src/capabilities/types.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NonEmptyString } from "@smartout/telemetry/server";
import type { SmartoutTool } from "../types.js";

export type CapabilityName =
  | "knowledge"
  | "kb_query" // ADR-0221 — bound capability for intent='knowledge'
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
  /** @deprecated ADR-0195 — prefer per-tool dotted form (`journey.run_dev` etc.).
   *  Retained for IntentClassifier emission + legacy `authorityConfig["journey"]`
   *  fallback in tool-selector. Remove once every consumer reads dotted keys. */
  | "journey" // ADR-0173 — journey authoring + runtime (legacy short form)
  | "journey.run_dev" // ADR-0195 — per-tool authority key (was folded to "journey")
  | "journey.publish_mission" // ADR-0195 — per-tool authority key
  | "journey.publish_guide" // ADR-0195 — per-tool authority key
  | "journey.run_guided" // ADR-0195 — per-tool authority key (default autonomous)
  | "season" // ADR-0201 — umbrella capability (intent classifier + registry key)
  | "season.create" // ADR-0201 — per-tool authority key
  | "season.set_revenue" // ADR-0201 — per-tool authority key
  | "season.save_playbook" // ADR-0201 — per-tool authority key
  | "season.get_readiness" // ADR-0201 — per-tool authority key (read-only)
  | "season.learn_factors" // ADR-0201 — per-tool authority key (read-only)
  | "season.activate" // ADR-0200 — Server-Action-only capability (no tool registration; invoked via activate-season-action.ts)
  | "season.archive" // ADR-0200/0201 namespace extension — Server-Action-only (archive-season-action.ts)
  | "season.duplicate" // ADR-0200/0201 namespace extension — Server-Action-only (duplicate-season-action.ts)
  | "availability" // employee availability D2 capability (group short-form)
  | "availability.set_own" // per-tool authority key (voice-OK)
  | "availability.clear_own" // per-tool authority key (voice-OK)
  | "availability.query_others" // per-tool authority key (chat-only)
  | "tips" // umbrella capability (intent classifier + registry key)
  | "tips.set_pot" // per-tool authority key — record tip pool amount (suggest/manager)
  | "tips.adjust_share" // per-tool authority key — adjust single distribution (confirm/manager)
  | "tips.approve_distribution" // per-tool authority key — lock distributions (confirm/manager)
  | "tips.query_own_share"; // per-tool authority key — employee read own share (read_only)

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
  workspaceId: NonEmptyString;
  profileId: NonEmptyString;
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
  /** ADR-0078: capability is only available when session.channel is in this list.
   *  Required + non-empty (enforced socially by all 17 capabilities today; promoted
   *  to compile-time by ADR-0194). */
  allowedChannels: ReadonlyArray<SessionChannel>;
  /** ADR-0191: per-capability binary choice between BFF-proxied and direct-admin auth. */
  toolAuthPattern: "bff" | "direct_admin";
  /** ADR-0194: emit namespace owned by this capability (e.g. "contract", "schedule").
   *  `null` = this capability emits no domain events (only auto-emit via toVercelTools). */
  emitPrefix: string | null;
  /** Optional advisory fallback when engine_authority_config row is missing.
   *  Post-ADR-0192 bootstrap-trigger this becomes dead code. */
  defaultAuthority?: AuthorityLevel;
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
