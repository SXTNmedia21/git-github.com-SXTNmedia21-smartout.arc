"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-handbook-tools.ts — Botsson tools for /dashboard/handbook.
 *
 * Five tools — all read + one navigation:
 *
 *   getHandbookState        — current active chapter + total chapter counts + which have content
 *   listHandbookSections    — all 10 chapters with title, key, number, hasContent flag
 *   getHandbookEntry        — full rendered content of a chapter by key
 *   searchHandbook          — keyword search across chapter titles and keys
 *   openHandbookEntry       — navigate to a specific chapter in the sidebar
 *
 * Pattern follows use-calendar-tools.ts (memoise definitions once, refresh
 * dataRef every render). Handbook is read-only — no mutations, no proposals.
 * kb_query_voice_fallback is handled by /dashboard/help; this page is a
 * company-specific structured viewer, NOT a general knowledge-base chat.
 *
 * ADR-0238: owns_chat_surface = false — no DomainChatOwnership declaration needed.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import { CHAPTERS, type ChapterKey } from "@/app/dashboard/_components/document-mode/chapters";
import type { HandbookChapter } from "../_hooks/use-handbook-chapters";

export type HandbookToolInput = {
  /** Currently active chapter key. */
  activeChapterKey: ChapterKey;
  /** All fetched chapter data (from TanStack cache). */
  chapters: HandbookChapter[] | undefined;
  /** UI actions. */
  uiActions: {
    /** Navigate the sidebar to a chapter. */
    setActiveChapterKey: (key: ChapterKey) => void;
  };
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function isValidChapterKey(value: unknown): value is ChapterKey {
  return typeof value === "string" && CHAPTERS.some((c) => c.key === value);
}

function buildChapterMap(chapters: HandbookChapter[] | undefined): Map<string, HandbookChapter> {
  const map = new Map<string, HandbookChapter>();
  for (const ch of chapters ?? []) {
    map.set(ch.chapterKey, ch);
  }
  return map;
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useHandbookTools(input: HandbookToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getHandbookState",
          description:
            "Get the handbook's current state — active chapter key + title, total chapters, and how many have content written. Call first when employee or manager asks anything about the handbook.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listHandbookSections",
          description:
            "List all handbook chapters with number, key, title, and whether they have content. Use when user asks 'hva dekker håndboken?', 'hvilke kapitler finnes?', or wants an overview of topics.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getHandbookEntry",
          description:
            "Get the text content of a handbook chapter by its key. Use when user asks 'hva sier håndboken om sikkerhet?', 'finn kapittel om HMS', or wants to read a specific section. Returns plain-text summary when content exists.",
          dynamicParameters: [
            {
              name: "chapterKey",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description:
                  "Chapter key — one of: identity-mission, organization-model, daily-operations, safety-compliance, communication, onboarding-training, scheduling, quality-service, incident-response, kpi-review.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "searchHandbook",
          description:
            "Search for a keyword across handbook chapter titles and descriptions. Use when user mentions a topic but doesn't know which chapter it belongs to — e.g. 'finn noe om overtid', 'er det noe om kundeservice?'.",
          dynamicParameters: [
            {
              name: "query",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "string", description: "Search term (Norwegian or English)." },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openHandbookEntry",
          description:
            "Navigate the handbook sidebar to a specific chapter. Use when user says 'gå til sikkerhetskapittelet', 'åpne onboarding', or after searchHandbook returns a match. Does NOT read the content — combine with getHandbookEntry if content is needed.",
          dynamicParameters: [
            {
              name: "chapterKey",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description:
                  "Chapter key to open — one of: identity-mission, organization-model, daily-operations, safety-compliance, communication, onboarding-training, scheduling, quality-service, incident-response, kpi-review.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getHandbookState: () => {
        const d = dataRef.current;
        const chapterMap = buildChapterMap(d.chapters);
        const activeDef = CHAPTERS.find((c) => c.key === d.activeChapterKey);
        const chaptersWithContent = CHAPTERS.filter((c) => chapterMap.has(c.key)).length;
        return JSON.stringify({
          activeChapterKey: d.activeChapterKey,
          activeChapterTitle: activeDef?.title ?? d.activeChapterKey,
          totalChapters: CHAPTERS.length,
          chaptersWithContent,
          chaptersEmpty: CHAPTERS.length - chaptersWithContent,
        });
      },

      listHandbookSections: () => {
        const d = dataRef.current;
        const chapterMap = buildChapterMap(d.chapters);
        return JSON.stringify({
          count: CHAPTERS.length,
          chapters: CHAPTERS.map((c) => ({
            number: c.number,
            key: c.key,
            title: c.title,
            description: c.description,
            hasContent: chapterMap.has(c.key),
          })),
        });
      },

      getHandbookEntry: (params) => {
        const d = dataRef.current;
        const key = params.chapterKey;
        if (!isValidChapterKey(key)) {
          return JSON.stringify({
            error: `Ugyldig chapterKey: '${String(key)}'. Gyldige nøkler: ${CHAPTERS.map((c) => c.key).join(", ")}.`,
          });
        }
        const def = CHAPTERS.find((c) => c.key === key)!;
        const chapterMap = buildChapterMap(d.chapters);
        const data = chapterMap.get(key);
        if (!data) {
          return JSON.stringify({
            key,
            title: def.title,
            hasContent: false,
            message: "Dette kapittelet er ikke skrevet enda.",
          });
        }
        // Return metadata + a note that content is Tiptap JSON (not plain text).
        return JSON.stringify({
          key,
          title: data.title,
          hasContent: true,
          updatedAt: data.updatedAt,
          contentType: "tiptap-json",
          note: "Innholdet vises i håndboken. Bruk openHandbookEntry for å navigere brukeren dit.",
        });
      },

      searchHandbook: (params) => {
        const query = typeof params.query === "string" ? params.query.toLowerCase().trim() : "";
        if (!query) {
          return JSON.stringify({ error: "query kan ikke være tom." });
        }
        const matches = CHAPTERS.filter(
          (c) =>
            c.title.toLowerCase().includes(query) ||
            c.key.toLowerCase().includes(query) ||
            c.description.toLowerCase().includes(query),
        ).map((c) => ({
          number: c.number,
          key: c.key,
          title: c.title,
          description: c.description,
        }));
        return JSON.stringify({
          query,
          count: matches.length,
          results: matches,
          suggestion:
            matches.length > 0
              ? `Bruk openHandbookEntry med key='${matches[0]!.key}' for å navigere til det beste treffet.`
              : "Ingen treff. Prøv et annet søkeord.",
        });
      },

      openHandbookEntry: (params) => {
        const d = dataRef.current;
        const key = params.chapterKey;
        if (!isValidChapterKey(key)) {
          return JSON.stringify({
            error: `Ugyldig chapterKey: '${String(key)}'. Gyldige nøkler: ${CHAPTERS.map((c) => c.key).join(", ")}.`,
          });
        }
        d.uiActions.setActiveChapterKey(key);
        const def = CHAPTERS.find((c) => c.key === key)!;
        return JSON.stringify({
          ok: true,
          opened: key,
          title: def.title,
          message: `Navigerte til kapittel ${def.number}: ${def.title}.`,
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
