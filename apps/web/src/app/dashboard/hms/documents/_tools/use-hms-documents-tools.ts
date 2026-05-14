"use client";

/**
 * use-hms-documents-tools.ts — Botsson tools for /dashboard/hms/documents.
 *
 * Two tools: 1 read, 1 control.
 *   getCurrentDocument        — returns currently selected document or null
 *   clearDocumentSelection    — close the viewer (clear selection)
 *
 * Why minimal:
 *   The document tree (policy → protocol → procedure) is fetched internally
 *   by DocumentBrowser. The page itself only owns the selection state, so
 *   tools mirror that surface — selection-only. Listing happens via the
 *   tree UI; Botsson does not re-fetch the tree.
 *
 * ADR-0151: workspace_id resolved server-side in DocumentBrowser's hooks.
 * ADR-0238: page does not own a domain chat surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { DocumentSelection } from "../../_components/DocumentBrowser";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type HmsDocumentsToolInput = {
  selection: DocumentSelection | null;
  clearSelection: () => void;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useHmsDocumentsTools(input: HmsDocumentsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getCurrentDocument",
          description:
            "Get the document currently open in the viewer — its type (handbook | policy | protocol | procedure), id, and name. Returns null when nothing is selected. Use when the user asks 'hva ser jeg på?', 'hvilket dokument er åpent?', or 'hvor er jeg i håndboken?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "clearDocumentSelection",
          description:
            "Clear the document viewer — close the currently selected document so the user is back to the browser without anything open. Use when the user says 'lukk dokumentet', 'tilbake til oversikten', or 'fjern valget'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getCurrentDocument: () => {
        const d = dataRef.current;
        if (!d.selection) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              selected: false,
              hint: "Ingen dokument er åpnet. Bruk dokumenttreet til venstre.",
            }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            selected: true,
            document: {
              type: d.selection.type,
              id: d.selection.id,
              name: d.selection.name,
            },
          }),
        );
      },

      clearDocumentSelection: () => {
        const d = dataRef.current;
        if (!d.selection) {
          return Promise.resolve(JSON.stringify({ ok: true, alreadyCleared: true }));
        }
        d.clearSelection();
        return Promise.resolve(JSON.stringify({ ok: true, cleared: true }));
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
