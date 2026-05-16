// packages/ai/src/capabilities/types.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NonEmptyString } from "@smartout/telemetry/server";
import type { SmartoutTool } from "../types.js";
import type {
  UserContext,
  WorkspaceContext,
  RouteContext,
  WorkforceContext,
} from "../agents/context-types.js";

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
  | "engine_world" // engine_world reader (Phase 0) — shared world model for agent fleet
  | "page_takeover.help.panic_bar_human_button" // ADR-0228 — granular per-target page-takeover authority, default-deny (M3.2 v1)
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
  | "tips.query_own_share" // per-tool authority key — employee read own share (read_only)
  | "journey_authoring" // ADR-0239 — 6-phase wizard capability (chat-only, admin)
  | "mission" // Active engine_state missions + workspace roadmap (read-only, voice-safe)
  | "personal" // feat/botsson-personal-tools — note, task, reminder, history, setting
  /** ADR-0298 Sortie 3 — unified task surface across five sources (session_task, personal_task,
   *  schedule_day_task, emma_task). Six tools: list_mine (read), create_personal, create_session,
   *  create_day_ad_hoc, complete, cancel_personal. suggest authority; chat+voice at capability
   *  level; create_* and cancel_personal are chat-only in V1 (ADR-0298 R6, free-text PII risk). */
  | "task" // ADR-0298 — unified task capability (Sortie 3)
  /** ADR-0249 — legal capability fifth sibling to contract + payroll.
   *  Three tools: validate_aml_14_6 (chat), cite_law (chat+voice),
   *  classify_amendment (server-only). Lovsen-branding output only.
   *  Phase 0c scaffold; Lovdata MCP integration is Phase 0c+. */
  | "legal" // ADR-0256 / ADR-0249 — Norsk arbeidsrett compliance (Lovsen-branding)
  /** ADR-0270 — godmode-only scrapling research toolkit.
   *  6 tools: find_hospitality_businesses (suggestTool — costs money),
   *  enrich_company_intelligence, search_brreg, lookup_brreg, scrape_website (readOnly),
   *  generate_company_copy (suggestTool — LLM output). chat-only, direct_admin.
   *  Used on /platform-admin/* surfaces for prospect-research + onboarding-helper. */
  | "business_intelligence" // ADR-0270
  /** ADR-0275 Phase E — wizard workspace-setup surface. 9 tools (skeleton T1.1-T1.5;
   *  bodies in T1.6+): update_business, update_season, add_departments, add_locations,
   *  add_zones (all confirm), add_procedures (suggest), scrape_website + search_company +
   *  identify_company (read_only bridges to business_intelligence). chat+voice+system.
   *  Authority seeded in 20260524000001_onboarding_capability_authority_seed.sql. */
  | "onboarding" // ADR-0275
  /** ADR-0305 — POS integration admin surface. V1 Lightspeed K-Series.
   *  Three tools: connect_lightspeed (admin+, chat-only), disconnect (admin+, chat-only),
   *  list_accounts (admin+, both channels). mutateWithGate on write tools.
   *  Authority seeded in wfm_capability_authority_seed migration. */
  | "pos_account_management" // ADR-0305
  /** ADR-0306 — open-shift marketplace sidecar offer table. 5 tools:
   *  list_open_offers (read_only, chat), post_open (suggest, manager+, chat-only),
   *  claim (suggest, employee+, chat-only V1), approve_claim (suggest, manager+, chat-only V1),
   *  cancel_offer (suggest, poster/manager, both channels).
   *  Authority seeded in 20260611120100_wfm_capability_authority_seed.sql. */
  | "shift_marketplace" // ADR-0306
  /** ADR-0307 + ADR-0309 — Greedy constraint-solver scheduler (C3 sortie). 3 tools:
   *  propose_plan (manager+, chat-only, web Compose), accept_proposal + reject_proposal
   *  (manager+, chat-only, mobile Approve). Single-row bundle pattern per ADR-0309. */
  | "scheduler" // ADR-0307 (C3 sortie)
  /** ADR-0334 — Timeline Templates: Dagslinjen save+apply+archive. 4 tools:
   *  save_template + apply_template + archive_template (confirm, manager+, chat-only),
   *  list_templates (read_only, chat-only). emitPrefix='timeline_template'.
   *  Authority seeded at confirm by 20260616110100_seed_timeline_template_authority.sql. */
  /** ADR-0XXX — governance content authority backlog closure.
   *  Server-Action update of organizational handbook chapters.
   *  (confirm, manager) per T0 scope verification. */
  | "handbook_chapter" // backlog closure — see ADR-NEXT
  /** ADR-0XXX — governance content authority backlog closure.
   *  Server-Action update of policy records (HR/HACCP/safety/etc).
   *  (confirm, manager) per T0 scope verification. */
  | "policy" // backlog closure — see ADR-NEXT
  /** ADR-0XXX — governance content authority backlog closure.
   *  Server-Action update of protocol records (training/compliance).
   *  (confirm, manager) per T0 scope verification. */
  | "protocol" // backlog closure — see ADR-NEXT
  | "timeline_template"; // ADR-0334 (timeline-templates sortie)

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
  /** ADR-0239: wizard_session_id when mission="journey_authoring".
   *  Set by /api/emma/chat → stage-engine → toolContext. NEVER fall back to
   *  ctx.sessionId — those are different IDs (engine_sessions.id vs
   *  wizard_session.wizard_session_id). save_draft + publish_draft tools
   *  MUST require this field (return error if missing). */
  wizardSessionId?: string;
  /** Botsson context pipe: who is speaking (role, status, department, display name, language).
   *  Server-derived at session start via GET /api/botsson/voice/session-context. */
  userContext?: UserContext;
  /** Botsson context pipe: active workspace cascade state (season, framework, planning cycle).
   *  Server-derived at session start via GET /api/botsson/voice/session-context. */
  workspaceContext?: WorkspaceContext;
  /** Botsson context pipe: current page + focused entity from the browser.
   *  Published on every route change via LiveKit data channel (voice) or
   *  forwarded directly on the chat body (BFF). */
  routeContext?: RouteContext;
  /** Botsson context pipe: D2+D6 workforce snapshot delivered at session start.
   *  Same on chat and voice (2026-05-13 directive). Capabilities can read names,
   *  roles, departments, phones, absences directly without tool-calls. */
  workforceContext?: WorkforceContext;
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

// Re-export for consumers that only import from "@smartout/ai/capabilities/types"
export type {
  UserContext,
  WorkspaceContext,
  RouteContext,
  WorkforceContext,
  WorkforceEmployee,
  WorkforceShift,
  WorkforceAbsence,
  WorkforceSession,
} from "../agents/context-types.js";
