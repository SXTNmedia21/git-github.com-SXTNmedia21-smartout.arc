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
//   4. Re-applying authority on the merged bundle — ensures client-shipped
//      tools cannot bypass ADR-0078 PII stripping (Risk R4).
//
// Feature-flag gated: when HARNESS_ADAPTER_CHAT !== "true", caller
// SHOULD fall back to existing toVercelTools chain (ADR-0327
// Migration Path).
// ============================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  createHarnessAdapter,
  createCapabilitiesSource,
  createSiteMapSource,
  createAuthorityEnforcer,
} from "@smartout/ai/harness";
import type {
  Channel,
  ClientToolDefinition,
  ClientToolImplementation,
  HarnessAdapter,
  ToolBundle,
  UserContext,
} from "@smartout/ai/harness/types";
import type { RawSiteMapJson } from "@smartout/ai/harness";

// ━━━ Re-export types used by callers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Re-exported to allow callers to import these types from this module
// rather than reaching into @smartout/ai directly.
export type { Channel, ClientToolDefinition, ClientToolImplementation, UserContext };

// ━━━ Public types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ━━━ Site-map cache (module-scope, read once) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parsed site-map JSON. Loaded lazily on first call; reused for the
 * process lifetime. Reset by `resetChatToolResolverCache()` for tests.
 *
 * WHY module-scope: The file rarely changes between requests; reading
 * + parsing JSON on every request is wasteful. Production deployments
 * restart the process on code changes, so stale-map is not a concern.
 */
let _siteMapJson: RawSiteMapJson | null = null;

function loadSiteMapJson(): RawSiteMapJson {
  if (_siteMapJson !== null) return _siteMapJson;

  // Resolve relative to this compiled file's location, walking up to repo root.
  // ESM-safe: use import.meta.url → __dirname equivalent.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const siteMapPath = resolve(__dirname, "../../../../apps/web/.botsson/site-map.json");

  try {
    const raw = readFileSync(siteMapPath, "utf8");
    _siteMapJson = JSON.parse(raw) as RawSiteMapJson;
  } catch (err) {
    // Missing or unreadable file is a non-fatal degradation:
    // adapter returns capability tools only; site-map context is absent.
    console.warn(
      `[chat-tool-resolver] site-map.json not found or unreadable at "${siteMapPath}". ` +
        `Returning empty site-map. Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    // Minimal valid structure: no routes.
    _siteMapJson = {
      version: 1,
      generated_at: new Date().toISOString(),
      routes: [],
    };
  }

  return _siteMapJson;
}

// ━━━ Adapter cache (per workspace_id) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Per-workspace HarnessAdapter instance map.
 *
 * WHY cached per workspace_id (Risk R3 mitigation):
 *   Building the adapter involves reading the capabilities registry and
 *   parsing the site-map JSON. Both are expensive relative to LLM latency
 *   targets when done cold on every request. The adapter itself is stateless
 *   beyond its three source references — the actual per-request filtering
 *   (role, pageRoute) happens inside getToolsForChannel(). A single adapter
 *   per workspace is therefore safe for the process lifetime.
 *
 *   Process restarts re-populate the cache; no stale-entry concern.
 */
const _adapterCache = new Map<string, HarnessAdapter>();

function getOrCreateAdapter(workspaceId: string): HarnessAdapter {
  const cached = _adapterCache.get(workspaceId);
  if (cached !== undefined) return cached;

  const siteMapJson = loadSiteMapJson();

  const adapter = createHarnessAdapter({
    capabilities: createCapabilitiesSource(),
    siteMap: createSiteMapSource(siteMapJson),
    authority: createAuthorityEnforcer(),
  });

  _adapterCache.set(workspaceId, adapter);
  return adapter;
}

// ━━━ Public API ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Public entry point. Composes adapter (with per-workspace caching) and
 * returns merged + authority-filtered tool bundle for the given request.
 *
 * Stage-engine chat route calls this once per request. When the
 * returned `viaHarnessAdapter` is false, fall back to existing
 * `toVercelTools` chain.
 *
 * CLIENT TOOL MERGE POLICY (Risk R4 mitigation):
 *   Client-shipped tools (from BotssonProvider.botssonTools) are merged
 *   into the capability bundle AFTER the adapter runs. When a client tool
 *   shares a `modelToolName` with a capability tool, the client tool WINS
 *   (its definition replaces the capability definition in the bundle).
 *
 *   WHY client-tool-wins: The browser page knows its own context best —
 *   a page-scope tool for the same name should take precedence over the
 *   generic capability tool.
 *
 *   AUTHORITY RE-APPLICATION: After merge, the authority enforcer is
 *   re-applied. This ensures client-shipped tools cannot bypass ADR-0078
 *   PII restrictions by shipping a tool with a PII-tier name.
 *
 *   CLIENT TOOL IMPLEMENTATIONS: Client tools are only definitions — they
 *   execute in the browser, not server-side. The harness records a stub
 *   implementation that documents this boundary. stage-engine-side LLM
 *   receives the DEFINITIONS (so it can describe the action to the user)
 *   but calling them from stage-engine directly is a no-op placeholder.
 *
 *   TODO (Phase 3.5): Route client tool call results back through the BFF
 *   for browser-side execution (LiveKit data-channel pattern for voice).
 */
export async function resolveChatTools(
  input: ChatToolResolverInput,
): Promise<ChatToolResolverOutput> {
  const { pageRoute, userContext, clientTools } = input;
  const { workspace_id } = userContext;

  // 1. Get (or create) the per-workspace adapter.
  const adapter = getOrCreateAdapter(workspace_id);

  // 2. Fetch the base bundle from the harness adapter.
  //    This includes capability tools + authority filtering pass 1.
  const baseBundle = await adapter.getToolsForChannel("chat", pageRoute, userContext);

  // 3. Merge client-shipped tools.
  //    Client-tool-wins on modelToolName collision; collisions recorded.
  const clientToolCollisions: string[] = [];

  // Build a mutable copy of definitions + implementations for merging.
  const mergedDefinitions: ClientToolDefinition[] = [...baseBundle.definitions];
  const mergedImplementations: Record<string, ClientToolImplementation> = {
    ...baseBundle.implementations,
  };

  if (clientTools !== null && clientTools.length > 0) {
    // Build a name → index map for O(1) collision detection.
    const capabilityIndexByName = new Map<string, number>();
    for (let i = 0; i < mergedDefinitions.length; i++) {
      const def = mergedDefinitions[i];
      if (def !== undefined) {
        capabilityIndexByName.set(def.temporaryTool.modelToolName, i);
      }
    }

    for (const clientTool of clientTools) {
      const toolName = clientTool.temporaryTool.modelToolName;
      const existingIndex = capabilityIndexByName.get(toolName);

      if (existingIndex !== undefined) {
        // Collision: client tool replaces capability tool.
        mergedDefinitions[existingIndex] = clientTool;
        clientToolCollisions.push(toolName);
      } else {
        // No collision: append client tool.
        mergedDefinitions.push(clientTool);
        capabilityIndexByName.set(toolName, mergedDefinitions.length - 1);
      }

      // Client tools execute in the browser, not on the server.
      // The stub implementation documents this boundary; Phase 3.5 wires
      // the actual call-back-through-BFF path.
      mergedImplementations[toolName] = async (
        _params: Record<string, unknown>,
      ): Promise<string> => {
        return "client-side tool — not directly invokable from stage-engine";
      };
    }
  }

  // 4. Assemble the merged bundle (preserves authority metadata from pass 1).
  const mergedBundle: ToolBundle = {
    definitions: mergedDefinitions,
    implementations: mergedImplementations,
    systemPromptSlices: baseBundle.systemPromptSlices,
    authority: baseBundle.authority,
  };

  // 5. Re-apply authority on the merged bundle (Risk R4 mitigation).
  //    This second pass ensures no client-shipped tool with a PII-tier name
  //    slips through to the LLM. Authority enforcer is stateless; calling
  //    it twice is safe — the second pass only acts on the merged additions.
  const authority = createAuthorityEnforcer();
  const finalBundle = authority.apply(mergedBundle, userContext, "chat");

  return {
    bundle: finalBundle,
    viaHarnessAdapter: true,
    clientToolCollisions,
  };
}

/**
 * Reset the per-workspace adapter cache AND the site-map cache.
 *
 * Test utility only. Production code never calls this — both caches are
 * process-lifetime by design (avoids cold-start latency on each request).
 *
 * Call before each test that exercises `resolveChatTools` with different
 * site-map content or capabilities.
 */
export function resetChatToolResolverCache(): void {
  _adapterCache.clear();
  _siteMapJson = null;
}

/**
 * Sentinel error so callers can distinguish "feature flag off" from
 * "resolver crashed". The `throw` site in `resolveChatTools` has been
 * removed; this class survives for test-doubles and future error handling.
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
