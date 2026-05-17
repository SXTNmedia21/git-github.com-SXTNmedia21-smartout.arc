/**
 * factory.ts — HarnessAdapter factory.
 *
 * Composes CapabilitiesSource + SiteMapSource + AuthorityEnforcer into a
 * single HarnessAdapter instance. This is the assembly point for Phase 2.
 *
 * Phase 3 (chat consumer) and Phase 4 (voice consumer) import from harness/index.ts
 * and call createHarnessAdapter(deps) with their own source/authority instances.
 *
 * See ADR-0327 for the full rationale behind the three-layer pipeline.
 */

import { createAuthorityEnforcer } from "./authority.js";
import type {
  AuthorityEnforcer,
  CapabilitiesSource,
  Channel,
  HarnessAdapter,
  SiteMap,
  SiteMapSource,
  ToolBundle,
  Unsubscribe,
  UserContext,
} from "./types.js";

/* ━━━ HarnessAdapterImpl ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export class HarnessAdapterImpl implements HarnessAdapter {
  readonly #capabilities: CapabilitiesSource;
  readonly #siteMap: SiteMapSource;
  readonly #authority: AuthorityEnforcer;

  constructor(
    capabilities: CapabilitiesSource,
    siteMap: SiteMapSource,
    authority: AuthorityEnforcer,
  ) {
    this.#capabilities = capabilities;
    this.#siteMap = siteMap;
    this.#authority = authority;
  }

  async getToolsForChannel(
    channel: Channel,
    _pageRoute: string | null,
    userContext: UserContext,
  ): Promise<ToolBundle> {
    // Step 1: fetch the unfiltered eligible tool set from the capabilities source.
    const { definitions, implementations } = await this.#capabilities.getToolsFor(
      channel,
      userContext,
    );

    // Step 2: assemble the initial bundle — authority fields primed with
    // server-derived values so the authority layer can detect any drift.
    const bundle: ToolBundle = {
      definitions,
      implementations,
      systemPromptSlices: [],
      authority: {
        workspace_id: userContext.workspace_id,
        channel,
        role: userContext.role,
        blockedTools: [],
        gateActionMisses: [],
      },
    };

    // Step 3: apply authority rules (ADR-0078/0151/0244).
    // Returns a new filtered bundle — never mutates in place.
    return this.#authority.apply(bundle, userContext, channel);
  }

  async getSiteMap(userContext: UserContext): Promise<SiteMap> {
    // Delegate directly — SiteMapSource handles role filtering.
    return this.#siteMap.getSiteMap(userContext);
  }

  subscribeToRouteChange(_callback: (newRoute: string) => void): Unsubscribe {
    // MVP no-op subscription. Long-lived voice sessions will wire this
    // via LiveKit data channel in Phase 4.
    //
    // TODO (Phase 4): implement live route subscription.
    // File: packages/agent-sdk/src/providers/livekit.ts (see LiveKitVoiceSession.registerTool stub).
    // When the user navigates in the browser, the BFF publishes a route-change
    // event over the LiveKit data channel; the voice consumer calls this
    // callback to trigger a fresh getToolsForChannel() call.
    return () => {
      // no-op: no subscription was registered, nothing to clean up.
    };
  }
}

/* ━━━ Factory ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type HarnessAdapterDeps = {
  capabilities: CapabilitiesSource;
  siteMap: SiteMapSource;
  /** Optional — defaults to `createAuthorityEnforcer()` if omitted. */
  authority?: AuthorityEnforcer;
};

/**
 * Compose the three harness sources into a {@link HarnessAdapter}.
 *
 * @param deps.capabilities - Source for capability tools (from capability registry).
 * @param deps.siteMap - Source for the dashboard route catalog.
 * @param deps.authority - Optional authority enforcer. Defaults to the production
 *   enforcer (ADR-0078/0151/0244). Inject a custom enforcer in tests or
 *   non-standard deployments.
 *
 * Usage (production):
 * ```ts
 * const adapter = createHarnessAdapter({
 *   capabilities: createCapabilitiesSource(),
 *   siteMap: createSiteMapSource(rawJson),
 * });
 * ```
 *
 * Usage (test with stub sources):
 * ```ts
 * const adapter = createHarnessAdapter({
 *   capabilities: stubCapabilities,
 *   siteMap: stubSiteMap,
 * });
 * ```
 */
export function createHarnessAdapter(deps: HarnessAdapterDeps): HarnessAdapter {
  const authority = deps.authority ?? createAuthorityEnforcer();
  return new HarnessAdapterImpl(deps.capabilities, deps.siteMap, authority);
}
