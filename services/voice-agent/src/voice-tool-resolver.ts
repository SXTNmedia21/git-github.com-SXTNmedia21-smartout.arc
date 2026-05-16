// ============================================
// voice-tool-resolver.ts
// Phase 4 of ADR-0327 — composes HarnessAdapter for the voice consumer.
//
// Resolves the tool surface for one voice session by:
//   1. Constructing a HarnessAdapter from CapabilitiesSource +
//      SiteMapSource + AuthorityEnforcer (cached per workspace_id).
//   2. Calling getToolsForChannel("voice", pageRoute, userContext).
//      This enforces the ADR-0078 voice-no-PII rule automatically
//      via the authority layer (no PII tools returned for channel="voice").
//
// Feature-flag gated: when HARNESS_ADAPTER_VOICE !== "true", callers
// SHOULD continue using buildAllBotssonTools() only (backward-compat).
//
// PRAGMATIC SCOPE (Phase 4 MVP):
//   The active voice tool set is still buildAllBotssonTools() for MVP.
//   This resolver is called for AUDIT LOGGING only — it logs what the
//   authority layer would allow/block so we can observe the harness
//   authority decisions in production before switching over.
//   When capability-tagging sortie ships, resolveVoiceTools REPLACES
//   buildAllBotssonTools as the active tool source.
//
// DOCKER PATH NOTE:
//   The site-map.json is located at apps/web/.botsson/site-map.json in
//   the monorepo. The voice-agent Docker container does NOT copy apps/web/,
//   so the path will always be missing in production. This is gracefully
//   handled: a missing site-map is logged as a warning and an empty routes
//   object is used instead. Capability tools are still returned correctly —
//   only page-scope tool filtering is absent. This is acceptable for voice
//   (which uses channel="voice" and has no page-scope tools today).
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
import type { RawSiteMapJson } from "@smartout/ai/harness";
import type { HarnessAdapter, ToolBundle, UserContext } from "@smartout/ai/harness/types";

// ━━━ Re-exports for callers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export type { UserContext, ToolBundle };

// ━━━ Site-map cache (module-scope, read once) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parsed site-map JSON. Loaded lazily on first call; reused for the
 * process lifetime. Reset by `resetVoiceToolResolverCache()` for tests.
 *
 * WHY module-scope: Same rationale as chat-tool-resolver — reading + parsing
 * on every voice turn would add cold-start latency. Voice sessions are long-lived
 * compared to per-request chat flows, making this even more appropriate.
 *
 * DOCKER NOTE: In the voice-agent container, apps/web/ is not present, so
 * this will always miss and fall back to the empty routes structure.
 * This is deliberate — voice has no page-scope tools in Phase 4.
 */
let _siteMapJson: RawSiteMapJson | null = null;

function loadSiteMapJson(): RawSiteMapJson {
  if (_siteMapJson !== null) return _siteMapJson;

  // Resolve relative to this compiled file's location, walking up to repo root.
  // ESM-safe: use import.meta.url → __dirname equivalent.
  // Compiled path: services/voice-agent/dist/voice-tool-resolver.js
  // Site-map path: apps/web/.botsson/site-map.json
  // Distance: dist/ → voice-agent/ → services/ → repo root/ → apps/web/.botsson/
  //           = 3 levels up, then apps/web/.botsson
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const siteMapPath = resolve(__dirname, "../../../apps/web/.botsson/site-map.json");

  try {
    const raw = readFileSync(siteMapPath, "utf8");
    _siteMapJson = JSON.parse(raw) as RawSiteMapJson;
  } catch (err) {
    // Missing or unreadable file is expected in Docker (apps/web/ not copied).
    // Degrade gracefully: capability tools still work; page-scope filtering absent.
    console.warn(
      `[voice-tool-resolver] site-map.json not found at "${siteMapPath}". ` +
        `Returning empty site-map (expected in Docker container). ` +
        `Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    _siteMapJson = {
      version: 1,
      generated_at: new Date().toISOString(),
      routes: [],
    };
  }

  return _siteMapJson;
}

// ━━━ Adapter cache (per workspace_id) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Per-workspace HarnessAdapter instance map.
 *
 * WHY cached per workspace_id: Building the adapter is expensive relative
 * to voice turn latency. The adapter is stateless beyond its three source
 * references — actual per-turn filtering (role, pageRoute) happens inside
 * getToolsForChannel(). A single adapter per workspace is safe for the
 * process lifetime.
 *
 * Voice sessions are long-lived — one session can span many turns across
 * minutes. Caching at workspace level correctly shares the adapter across
 * all turns in the same session (and across sessions in the same process).
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

// ━━━ Public API ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Feature-flag check. Reads `HARNESS_ADAPTER_VOICE` env var.
 * Returns true only when explicitly `"true"`. Conservative-by-default.
 *
 * agent.ts calls this at session boot to decide whether to invoke
 * resolveVoiceTools for audit logging. When false, only buildAllBotssonTools
 * is used (no harness calls, no audit log).
 */
export function harnessAdapterVoiceEnabled(): boolean {
  return process.env.HARNESS_ADAPTER_VOICE === "true";
}

/**
 * Resolve the voice tool bundle for a given session context.
 *
 * Composes adapter (with per-workspace caching) and returns the
 * authority-filtered tool bundle for channel="voice".
 *
 * The authority layer automatically strips PII tools per ADR-0078
 * (voice-no-PII rule). blockedTools in the returned bundle's authority
 * field contains the audit record of what was stripped and why.
 *
 * Phase 4 MVP: caller logs the bundle for audit but keeps
 * buildAllBotssonTools() as the active tool set.
 * Future: resolveVoiceTools result replaces buildAllBotssonTools entirely.
 *
 * pageRoute: passes null for MVP — no page-scope tools on voice today.
 *   When voice gains page-awareness (D6 session tools, etc.), pass the
 *   current route from the context_route message.
 */
export async function resolveVoiceTools(input: {
  pageRoute: string | null;
  userContext: UserContext;
}): Promise<ToolBundle> {
  const { pageRoute, userContext } = input;
  const adapter = getOrCreateAdapter(userContext.workspace_id);
  return adapter.getToolsForChannel("voice", pageRoute, userContext);
}

/**
 * Reset the per-workspace adapter cache AND the site-map cache.
 *
 * Test utility only. Production code never calls this — both caches are
 * process-lifetime by design (avoids cold-start latency on each voice turn).
 *
 * Call before each test that exercises resolveVoiceTools with different
 * site-map content or capabilities.
 */
export function resetVoiceToolResolverCache(): void {
  _adapterCache.clear();
  _siteMapJson = null;
}
