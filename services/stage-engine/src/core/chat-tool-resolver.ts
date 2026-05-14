// ============================================
// chat-tool-resolver.ts
// Phase 3 of ADR-0327 — composes HarnessAdapter for the chat consumer.
//
// Resolves the tool surface for one /agent/chat request by:
//   1. Constructing a HarnessAdapter from CapabilitiesSource +
//      SiteMapSource + AuthorityEnforcer (cached per workspace_id).
//   2. Calling getToolsForChannel("chat", pageRoute, userContext).
//   3. Merging server-side capability tools with client-shipped
//      page-scope tools (from request body's `client_tools` field).
//      Merge policy: client-tool-wins on name collision; collisions
//      recorded in authority audit.
//
// Feature-flag gated: when HARNESS_ADAPTER_CHAT !== "true", caller
// SHOULD fall back to existing toVercelTools chain (ADR-0327
// Migration Path).
//
// THIS FILE IS A STUB pre-written by lead orchestrator.
// Implementation body is filled by the D1 resolver agent (Phase 3 sortie).
// Contract is locked; do not change signature without updating C1 (stage-engine
// chat route) caller and D1 implementer agent prompt.
// ============================================

import type {
  Channel,
  ClientToolDefinition,
  ClientToolImplementation,
  ToolBundle,
  UserContext,
} from "@smartout/ai/harness/types";

/**
 * Input to resolveChatTools.
 *
 * `clientTools` is the optional array shipped by the BFF from the
 * browser's BotssonProvider.botssonTools aggregate. When `null` or
 * empty, only capability tools are returned.
 */
export type ChatToolResolverInput = {
  pageRoute: string | null;
  userContext: UserContext;
  clientTools: ClientToolDefinition[] | null;
};

/**
 * Output of resolveChatTools. Returned to the stage-engine chat route,
 * which then calls `toVercelTools` (or equivalent) on `bundle.definitions`
 * and `bundle.implementations`.
 *
 * `viaHarnessAdapter` is true when the adapter pipeline ran (feature flag
 * ON). When false, caller is in fallback mode — bundle is empty and caller
 * should use existing toVercelTools chain.
 *
 * `clientToolCollisions` lists tool names where a client-shipped tool
 * overrode a capability tool of the same name. Client-tool-wins policy.
 */
export type ChatToolResolverOutput = {
  bundle: ToolBundle;
  viaHarnessAdapter: boolean;
  clientToolCollisions: string[];
};

/**
 * Public entry point. Composes adapter (with per-workspace caching) and
 * returns merged + authority-filtered tool bundle for the given request.
 *
 * Stage-engine chat route should call this once per request. When the
 * returned `viaHarnessAdapter` is false, fall back to existing
 * `toVercelTools` chain.
 *
 * NOTE — STUB: body filled by D1 resolver agent. Throws
 * `ResolverNotImplementedError` until then.
 */
export async function resolveChatTools(
  _input: ChatToolResolverInput,
): Promise<ChatToolResolverOutput> {
  throw new ResolverNotImplementedError(
    "resolveChatTools is a stub pre-written by lead orchestrator. " +
      "D1 agent fills the body. If you see this in production, the Phase 3 " +
      "sortie shipped incomplete.",
  );
}

/**
 * Reset the per-workspace adapter cache. Useful for tests; production
 * doesn't call this (cache is process-lifetime).
 *
 * NOTE — STUB: D1 agent implements with cache map.
 */
export function resetChatToolResolverCache(): void {
  // STUB — D1 fills.
}

/**
 * Sentinel error so callers can distinguish "feature flag off" from
 * "resolver crashed". Phase 3 D1 agent removes the throw site from
 * resolveChatTools; this class survives for test-doubles.
 */
export class ResolverNotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResolverNotImplementedError";
  }
}

/**
 * Feature-flag check. Reads `HARNESS_ADAPTER_CHAT` env var.
 * Returns true only when explicitly `"true"`. Any other value (unset,
 * `"false"`, `"0"`, etc.) returns false. Conservative-by-default.
 *
 * Stage-engine chat route calls this BEFORE calling resolveChatTools.
 * If false, skip resolver entirely and use toVercelTools fallback.
 */
export function harnessAdapterChatEnabled(): boolean {
  return process.env.HARNESS_ADAPTER_CHAT === "true";
}

// Suppress unused-import errors during stub phase. D1 removes this.
export type _StubReferences = {
  Channel: Channel;
  ClientToolImplementation: ClientToolImplementation;
};
