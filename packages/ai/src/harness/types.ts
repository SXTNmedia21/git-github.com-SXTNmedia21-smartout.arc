/**
 * HarnessAdapter — unified LLM-consumer adapter contract.
 *
 * Phase 1 (this file): interface signatures only. No implementation.
 * Phase 2 (sibling files): registry sources + factory.
 * Phase 3 (separate sortie): chat consumer wires `stage-engine/agent/chat` to `getToolsForChannel`.
 * Phase 4 (separate sortie): voice consumer fills `LiveKitVoiceSession.registerTool` stub
 *   (`packages/agent-sdk/src/providers/livekit.ts:38-40`).
 *
 * See ADR-0327 for full rationale. See HANDOFF-2026-05-14 for the dead-pipe trace
 * that motivated this contract.
 */

/**
 * NOTE on tool types — these are RE-DECLARED locally because @smartout/agent-sdk
 * has a circular dependency cycle with @smartout/ai (agent-sdk imports from
 * @smartout/ai/missions). TypeScript's structural typing makes these
 * assignment-compatible with `@smartout/agent-sdk/types.ts:57-91`.
 *
 * If agent-sdk's types diverge, this file must follow. Phase 3 consumer wiring
 * will assert compatibility at the boundary (`packages/ai/src/harness/__tests__/types.test.ts`).
 */
export type ClientToolParameter = {
  name: string;
  location: string;
  description: string;
  required?: boolean;
  schema:
    | { type: "string"; enum?: string[] }
    | { type: "number" }
    | { type: "boolean" }
    | { type: "object"; properties?: Record<string, unknown> }
    | { type: "array"; items?: unknown };
};

export type ClientToolDefinition = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: ClientToolParameter[];
    client: Record<string, never>;
  };
};

export type ClientToolImplementation = (
  params: Record<string, unknown>,
) => string | Promise<string>;

/* ━━━ Channel + user context ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * LLM consumer surface. Each value maps to a distinct deployment of an
 * AI agent that asks the harness for its tool surface.
 *
 * Channel restrictions per ADR-0078:
 * - chat: PII tools allowed
 * - voice: PII tools forbidden (strict; voice transcripts traverse third-party Realtime LLM)
 * - slack/email/api: deferred to Phase 6 — placeholder values for type extension
 */
export type Channel = "chat" | "voice" | "slack" | "email" | "api";

/**
 * User context resolved server-side. Per ADR-0151, `workspace_id` MUST be
 * derived from authenticated session — never read from request body.
 *
 * Role is the user's effective role in this workspace (owner|admin|manager|employee).
 */
export type UserContext = {
  profile_id: string;
  workspace_id: string;
  role: "owner" | "admin" | "manager" | "employee";
};

/* ━━━ Tool bundle ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * The output of `getToolsForChannel`. Consumer passes `definitions` +
 * `implementations` to its LLM SDK (vercel-ai for chat, LiveKit for voice).
 *
 * `systemPromptSlices` are pre-rendered prompt fragments the consumer
 * concatenates into its system prompt (e.g. "## Sidekart" route catalog,
 * authority hints, capability bibliography).
 *
 * `authority` is the audit record of what the harness filtered + why.
 */
export type ToolBundle = {
  definitions: ClientToolDefinition[];
  implementations: Record<string, ClientToolImplementation>;
  systemPromptSlices: string[];
  authority: AuthorityConfig;
};

/* ━━━ Authority config ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Server-side authority record. Snapshot of the harness's filtering decisions
 * for a single `getToolsForChannel` call. Returned to consumer for audit.
 *
 * - `workspace_id`: server-derived; ADR-0151. Consumer MUST NOT trust any
 *   body-supplied workspace_id once authority is set.
 * - `channel`: the channel this bundle was filtered for.
 * - `role`: the user's effective role at filter time.
 * - `blockedTools`: tool names that WERE in the unfiltered set but were
 *   stripped by an authority rule. Each entry includes the rule name for
 *   audit (e.g. `{ name: "revealPersonnummer", rule: "ADR-0078-voice-no-pii" }`).
 * - `gateActionMisses`: capability tools the user lacks `gate_action` for.
 *   Useful for "you don't have permission" UX.
 */
export type AuthorityConfig = {
  workspace_id: string;
  channel: Channel;
  role: UserContext["role"];
  blockedTools: BlockedToolEntry[];
  gateActionMisses: string[];
};

export type BlockedToolEntry = {
  name: string;
  rule: AuthorityRuleName;
};

/**
 * Named authority rules. Adding a new rule = add a value here + implement
 * in `authority.ts`. Closed enum for grep-ability.
 */
export type AuthorityRuleName =
  | "ADR-0078-voice-no-pii"
  | "ADR-0244-passive-no-financial-mutation"
  | "ADR-0151-workspace-id-derived-server-side"
  | "ADR-0133-mobile-verbs-only"
  | "role-insufficient"
  | "gate-action-denied";

/* ━━━ Site map ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Route catalog returned by `getSiteMap`. Mirrors the shape of
 * `apps/web/.botsson/site-map.json` after access filtering.
 *
 * Common intents are pre-baked navigation hints (e.g. "hvor finner jeg
 * HMS-loggen?" → /dashboard/hms). Consumer surfaces them to the LLM
 * as a separate prompt slice.
 */
export type SiteMap = {
  routes: SiteMapRoute[];
  commonIntents: CommonIntent[];
};

export type SiteMapRoute = {
  path: string;
  purpose: string;
  module: string;
  tier?: number;
  toolCount: number;
  scope: string | null;
};

export type CommonIntent = {
  phrase: string;
  routePath: string;
};

/* ━━━ Adapter interface ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type Unsubscribe = () => void;

export interface HarnessAdapter {
  /**
   * Fetch the tool bundle for a given consumer + page + user.
   *
   * - `channel`: which consumer is asking (chat, voice, future)
   * - `pageRoute`: the user's current dashboard route (e.g. `/dashboard/hms`)
   *   or `null` if no page context (e.g. voice answering before navigation).
   *   When `null`, only capability tools are returned (no page-scope tools).
   * - `userContext`: server-resolved identity. `workspace_id` MUST come from
   *   authenticated session per ADR-0151.
   *
   * Returns a {@link ToolBundle} ready for the consumer's LLM SDK.
   */
  getToolsForChannel(
    channel: Channel,
    pageRoute: string | null,
    userContext: UserContext,
  ): Promise<ToolBundle>;

  /**
   * Fetch the route catalog filtered by user access.
   *
   * Separate from `getToolsForChannel` because (a) consumers may want the
   * site map as a prompt slice independent of tool fetching, (b) it's
   * idempotent + cacheable per (workspace_id, role).
   */
  getSiteMap(userContext: UserContext): Promise<SiteMap>;

  /**
   * Subscribe to route changes for long-lived sessions (voice).
   *
   * When the user navigates in the browser, the adapter notifies the
   * consumer so it can re-fetch tools for the new page. Phase 4 wires
   * this for voice via LiveKit data channel; chat doesn't need it
   * (each request resolves route fresh).
   *
   * Returns an `Unsubscribe` function the consumer calls on session end.
   */
  subscribeToRouteChange(callback: (newRoute: string) => void): Unsubscribe;
}

/* ━━━ Source interfaces (Phase 2 contract) ━━━━━━━━━━━━━━━━━━━━ */

/**
 * Capabilities source — reads from `packages/ai/src/capabilities/` registry.
 * Returns server-side capability tools eligible for a given channel + user.
 *
 * Authority filtering is NOT applied here — that's the authority layer's job.
 * This source returns the unfiltered eligible set.
 */
export interface CapabilitiesSource {
  getToolsFor(
    channel: Channel,
    userContext: UserContext,
  ): Promise<{
    definitions: ClientToolDefinition[];
    implementations: Record<string, ClientToolImplementation>;
  }>;
}

/**
 * Site-map source — reads `apps/web/.botsson/site-map.json`.
 * Returns the filtered route catalog for a given user.
 */
export interface SiteMapSource {
  getSiteMap(userContext: UserContext): Promise<SiteMap>;
}

/**
 * Authority enforcer — applies ADR-0078/0151/0244/0133 to a bundle.
 *
 * Mutates the bundle by:
 * - Stripping blocked tools from `definitions` and `implementations`
 * - Populating `bundle.authority.blockedTools` with the strip records
 * - Overwriting any body-derived `workspace_id` with server-derived value
 *
 * Returns the filtered bundle (not in place — returns new object).
 */
export interface AuthorityEnforcer {
  apply(bundle: ToolBundle, userContext: UserContext, channel: Channel): ToolBundle;
}

/* ━━━ Client-tool roundtrip protocol (Phase 3.5b) ━━━━━━━━━━━━━━ */

/**
 * Emitted by stage-engine when the LLM picks a CLIENT-shipped tool
 * (one whose name exists in `bundle.definitions` but whose `implementations`
 * entry is the placeholder stub — i.e. it must execute in the browser).
 *
 * Stage-engine pauses the LLM run after this tool-call, returns the request
 * to BFF/browser with `client_tool_calls` populated, awaits a follow-up
 * request containing `client_tool_results` for the same `tool_call_id`s,
 * then resumes the LLM run with those results filled in as tool messages.
 *
 * - `tool_call_id`: opaque identifier from the LLM SDK; preserved through
 *   the roundtrip so stage-engine can match the result back to the call.
 * - `name`: the `modelToolName` from `ClientToolDefinition.temporaryTool`.
 *   Must match exactly so the browser can look up the implementation in
 *   `BotssonProvider.botssonTools.implementations[name]`.
 * - `arguments`: JSON-serialisable args the LLM produced. Browser passes
 *   this verbatim to `implementation(args)`.
 */
export type ClientToolCall = {
  tool_call_id: string;
  name: string;
  arguments: Record<string, unknown>;
};

/**
 * Sent by browser back to stage-engine to complete the roundtrip.
 *
 * - `tool_call_id`: MUST match a previously-issued `ClientToolCall.tool_call_id`.
 * - `result`: string returned by `implementation(args)` (or stringified error
 *   when implementation throws). LLM receives this as the tool message and
 *   continues the conversation.
 *
 * NOTE on `is_error`: optional flag for telemetry / future auto-recovery.
 * MVP doesn't branch on it; LLM treats error text as a normal tool result.
 */
export type ClientToolCallResult = {
  tool_call_id: string;
  result: string;
  is_error?: boolean;
};
