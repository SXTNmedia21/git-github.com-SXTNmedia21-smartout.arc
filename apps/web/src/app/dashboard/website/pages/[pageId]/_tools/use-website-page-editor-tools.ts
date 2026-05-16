"use client";

/**
 * use-website-page-editor-tools.ts — Botsson tools for /dashboard/website/pages/[pageId].
 *
 * Three read-only tools:
 *
 *   getPageState       — page title, visibility, section count, last edited
 *   getSectionsList    — sections with type, title hint, sort_order (no full content)
 *   getSaveActionState — hasUnsavedChanges, canPublish, canPreview, hint
 *
 * No mutations are exposed — section CRUD and publish are user-confirmed form actions.
 * ADR-0244 RISK-TIER: deleteSection / updateSectionContent must not be called via Botsson tools.
 *
 * Pattern follows use-year-wheel-tools.ts:
 *   - `useWebsitePageEditorTools(input): ClientToolKit` exported
 *   - `dataRef = useRef(input)` refreshed every render via useEffect
 *   - definitions + implementations memoised on `[]`
 *
 * PII safety: section content (which may include spokesperson text) is NOT exposed.
 * Tool returns section type + is_visible + sort_order only.
 *
 * ADR-0238: /dashboard/website/pages/[pageId] has no embedded domain chat surface.
 * ADR-0151: workspace_id never passed as a prop — resolved server-side via RLS.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

// ── Input type ────────────────────────────────────────────────────────────

export type WebsitePageEditorToolInput = {
  /** Page ID currently being edited. */
  pageId: string;
  /** Page title. */
  pageTitle: string;
  /** Whether the page is visible to website visitors. */
  isVisible: boolean;
  /** List of sections on this page (no full content — type + order + visibility only). */
  sections: Array<{
    website_section_id: string;
    section_type: string;
    is_visible: boolean;
    sort_order: number;
  }>;
  /** Whether there are unsaved local changes (autosave pending). */
  hasUnsavedChanges: boolean;
  /** Whether the parent website is live. */
  websiteIsLive: boolean;
  /** ISO timestamp of last known save, or null if never saved. */
  lastSavedAt: string | null;
};

// ── Hook ──────────────────────────────────────────────────────────────────

export function useWebsitePageEditorTools(input: WebsitePageEditorToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getPageState",
          description:
            "Get the current state of the page being edited — title, visibility, section count, unsaved changes status, and last saved timestamp. Call first when answering open-ended questions about the page editor.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getSectionsList",
          description:
            "List all sections on the current page — section type, visibility, and sort order. Use when the user asks 'hvilke seksjoner er det?', 'hva inneholder siden?', 'er hero-seksjonen synlig?'. Does NOT return section content.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getSaveActionState",
          description:
            "Get the current save and publish action availability — hasUnsavedChanges, canPublish, canPreview, and a hint. Use when the user asks 'er endringene lagret?', 'kan jeg publisere siden?', 'hva gjenstår?'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getPageState: (_params: Record<string, unknown>): Promise<string> => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            page_id: d.pageId,
            title: d.pageTitle,
            is_visible: d.isVisible,
            section_count: d.sections.length,
            visible_section_count: d.sections.filter((s) => s.is_visible).length,
            has_unsaved_changes: d.hasUnsavedChanges,
            last_saved_at: d.lastSavedAt,
          }),
        );
      },

      getSectionsList: (_params: Record<string, unknown>): Promise<string> => {
        const d = dataRef.current;
        const sections = [...d.sections]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => ({
            id: s.website_section_id,
            type: s.section_type,
            is_visible: s.is_visible,
            sort_order: s.sort_order,
          }));
        return Promise.resolve(
          JSON.stringify({
            count: sections.length,
            sections,
          }),
        );
      },

      getSaveActionState: (_params: Record<string, unknown>): Promise<string> => {
        const d = dataRef.current;
        const canPreview = d.sections.length > 0;
        const canPublish = d.sections.length > 0 && !d.hasUnsavedChanges;

        let hint: string;
        if (d.hasUnsavedChanges) {
          hint = "Endringer er ikke lagret ennå — autolагring pågår.";
        } else if (!canPreview) {
          hint = "Ingen seksjoner ennå — legg til minst én seksjon for å forhåndsvise.";
        } else if (!d.websiteIsLive) {
          hint = "Siden er lagret. Publiser nettsiden fra oversikten for å gå live.";
        } else {
          hint = "Siden er lagret og nettsiden er live.";
        }

        return Promise.resolve(
          JSON.stringify({
            has_unsaved_changes: d.hasUnsavedChanges,
            can_publish: canPublish,
            can_preview: canPreview,
            website_is_live: d.websiteIsLive,
            hint,
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
