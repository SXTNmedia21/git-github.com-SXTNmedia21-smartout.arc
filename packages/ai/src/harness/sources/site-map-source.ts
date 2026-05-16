/**
 * site-map-source.ts — SiteMapSource implementation.
 *
 * Reads apps/web/.botsson/site-map.json (caller-supplied or injected as
 * parsed JSON) and returns a role-filtered SiteMap for a given UserContext.
 *
 * Design decision: file-reading is delegated to the caller (factory pattern)
 * so the source is unit-testable without filesystem access. The exported
 * `createSiteMapSource` factory accepts the parsed JSON directly.
 * Production callers read the file once at startup and pass the result in.
 *
 * Why: cwd varies between test runners, CLI scripts, and Next.js server
 * actions — accepting parsed JSON removes all path-resolution ambiguity.
 */

import { z } from "zod";
import type { SiteMap, SiteMapRoute, CommonIntent, SiteMapSource, UserContext } from "../types.js";

/* ━━━ Zod schema ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const ToolEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

const RawRouteSchema = z.object({
  path: z.string().startsWith("/"),
  purpose: z.string().min(1).max(200),
  module: z.string().min(1),
  tier: z.number().int().min(0).max(3).optional(),
  access: z.array(z.string()),
  polished_at: z.string().optional(),
  owns_chat_surface: z.boolean().optional(),
  domain_chat_endpoint: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
  tools: z.array(ToolEntrySchema).default([]),
  common_intents: z.array(z.string()).optional(),
});

export const SiteMapJsonSchema = z.object({
  version: z.literal(1),
  generated_at: z.string(),
  notes: z.string().optional(),
  routes: z.array(RawRouteSchema),
});

/** Inferred type of the raw (unparsed) site-map JSON. */
export type RawSiteMapJson = z.infer<typeof SiteMapJsonSchema>;

/* ━━━ Implementation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

class SiteMapSourceImpl implements SiteMapSource {
  readonly #raw: RawSiteMapJson;

  constructor(raw: RawSiteMapJson) {
    this.#raw = raw;
  }

  async getSiteMap(userContext: UserContext): Promise<SiteMap> {
    const { role } = userContext;

    const filteredRoutes: SiteMapRoute[] = [];
    const commonIntents: CommonIntent[] = [];

    for (const route of this.#raw.routes) {
      // Include route only if user's role appears in the access array.
      if (!route.access.includes(role)) continue;

      filteredRoutes.push({
        path: route.path,
        purpose: route.purpose,
        module: route.module,
        tier: route.tier,
        toolCount: route.tools.length,
        scope: route.scope ?? null,
      });

      // Derive CommonIntents from the route's common_intents field (if present).
      if (route.common_intents && route.common_intents.length > 0) {
        for (const phrase of route.common_intents) {
          if (phrase.trim().length > 0) {
            commonIntents.push({ phrase, routePath: route.path });
          }
        }
      }
    }

    return { routes: filteredRoutes, commonIntents };
  }
}

/* ━━━ Factory ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Create a SiteMapSource from a parsed (and Zod-validated) site-map JSON object.
 *
 * Throws `ZodError` if the JSON does not match the expected schema.
 *
 * Usage (production — read the file once at startup):
 * ```ts
 * import { readFileSync } from "node:fs";
 * import { join } from "node:path";
 * import { createSiteMapSource } from "@smartout/ai/harness/sources/site-map-source";
 *
 * const raw = JSON.parse(
 *   readFileSync(join(process.cwd(), "apps/web/.botsson/site-map.json"), "utf8")
 * );
 * const source = createSiteMapSource(raw);
 * ```
 */
export function createSiteMapSource(rawJson: unknown): SiteMapSource {
  const parsed = SiteMapJsonSchema.parse(rawJson);
  return new SiteMapSourceImpl(parsed);
}
