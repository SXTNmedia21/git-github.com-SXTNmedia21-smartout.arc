/**
 * harness/index.ts — Public API for the HarnessAdapter module.
 *
 * Import from "@smartout/ai/harness" (once subpath exports are wired in Phase 3).
 * Until then, import directly from this file.
 *
 * Exports:
 *  - All types from types.ts (re-exported as type-only for tree-shaking)
 *  - createHarnessAdapter + HarnessAdapterImpl from factory.ts
 *  - createAuthorityEnforcer from authority.ts
 *  - createCapabilitiesSource from sources/capabilities-source.ts
 *  - createSiteMapSource from sources/site-map-source.ts
 */

export type * from "./types.js";

export { createHarnessAdapter, HarnessAdapterImpl } from "./factory.js";
export type { HarnessAdapterDeps } from "./factory.js";

export { createAuthorityEnforcer } from "./authority.js";

export { createCapabilitiesSource } from "./sources/capabilities-source.js";
export type { CapabilityMinRoleConfig } from "./sources/capabilities-source.js";

export { createSiteMapSource, SiteMapJsonSchema } from "./sources/site-map-source.js";
export type { RawSiteMapJson } from "./sources/site-map-source.js";
