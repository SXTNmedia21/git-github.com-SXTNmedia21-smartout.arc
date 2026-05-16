"use client";

/**
 * use-website-tools.ts — Botsson tools for /dashboard/website.
 *
 * Three read-only tools:
 *
 *   getWebsiteState        — is website configured, visibility, slug, last updated
 *   getPagesList           — pages with title, visibility, slug, sort_order
 *   getPublishActionState  — canPublish, canRollback, canUnpublish, hint
 *
 * All tools are READ-ONLY. publishWebsite / unpublishWebsite / rollbackWebsite are
 * ADR-0244 RISK-TIER server actions — Botsson must not mutate them via tools.
 *
 * Pattern follows use-year-wheel-tools.ts:
 *   - `useWebsiteTools(input): ClientToolKit` exported
 *   - `dataRef = useRef(input)` refreshed every render via useEffect (closure safety)
 *   - definitions + implementations memoised independently on `[]`
 *   - implementations typed (params: Record<string, unknown>) => Promise<string>
 *
 * ADR-0238: /dashboard/website has no embedded domain chat surface.
 * ADR-0151: workspace_id never passed as a prop — resolved server-side via RLS.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { WebsiteRow } from "../_actions/website-actions";
import type { PageRow } from "../_actions/page-actions";

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

// ── Input type ────────────────────────────────────────────────────────────

export type WebsiteToolInput = {
  /** The workspace website, or null if not yet created. */
  website: WebsiteRow | null;
  /** All pages for the website, ordered by sort_order. */
  pages: PageRow[];
  /** Whether initial data is still loading. */
  isLoading: boolean;
};

// ── Hook ──────────────────────────────────────────────────────────────────

export function useWebsiteTools(input: WebsiteToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getWebsiteState",
          description:
            "Get the workspace website's current state — whether a website has been set up, its name, visibility (live/draft), domain slug, template key, and when it was last updated. Call first when answering open-ended questions about the workspace website.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getPagesList",
          description:
            "List all website pages with title, URL slug, visibility status, and sort order. Use when the user asks 'hvilke sider finnes?', 'er forsiden synlig?', 'vis alle sider', or wants a page overview.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getPublishActionState",
          description:
            "Get the current publish action availability — canPublish, canUnpublish, canRollback, and a short hint explaining the current state. Use when the user asks 'kan jeg publisere?', 'er nettsiden live?', 'hva er publiseringsstatusen?'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getWebsiteState: (_params: Record<string, unknown>): Promise<string> => {
        const d = dataRef.current;
        if (d.isLoading) {
          return Promise.resolve(JSON.stringify({ loading: true }));
        }
        if (!d.website) {
          return Promise.resolve(
            JSON.stringify({
              has_website: false,
              hint: "Ingen nettside opprettet ennå. Gå til /dashboard/website/setup for å opprette.",
            }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            has_website: true,
            name: d.website.name,
            visibility: d.website.visibility,
            is_live: d.website.visibility === "live",
            site_slug: d.website.site_slug,
            domain: d.website.site_slug ? `${d.website.site_slug}.smartout.info` : null,
            template_key: d.website.template_key,
            page_count: d.pages.length,
            updated_at: d.website.updated_at,
          }),
        );
      },

      getPagesList: (_params: Record<string, unknown>): Promise<string> => {
        const d = dataRef.current;
        if (!d.website) {
          return Promise.resolve(JSON.stringify({ error: "Ingen nettside opprettet ennå." }));
        }
        const pages = d.pages.map((p) => ({
          id: p.website_page_id,
          title: p.title,
          slug: p.slug,
          page_type: p.page_type,
          is_visible: p.is_visible,
          sort_order: p.sort_order,
        }));
        return Promise.resolve(
          JSON.stringify({
            count: pages.length,
            pages,
          }),
        );
      },

      getPublishActionState: (_params: Record<string, unknown>): Promise<string> => {
        const d = dataRef.current;
        if (!d.website) {
          return Promise.resolve(
            JSON.stringify({
              canPublish: false,
              canUnpublish: false,
              canRollback: false,
              hint: "Ingen nettside konfigurert — opprett nettside først.",
            }),
          );
        }
        const isLive = d.website.visibility === "live";
        const hasPages = d.pages.length > 0;
        return Promise.resolve(
          JSON.stringify({
            canPublish: hasPages,
            canUnpublish: isLive,
            canRollback: isLive,
            is_live: isLive,
            hint: isLive
              ? "Nettsiden er live. Du kan avpublisere eller rulle tilbake."
              : hasPages
                ? "Nettside klar for publisering. Trykk 'Publiser endringer' for å gå live."
                : "Ingen sider opprettet ennå — legg til minst én side før publisering.",
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
