"use client";

import { useMemo } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import { useSyncRef } from "@/lib/wizard-tools/shared";

type SavedChapter = {
  handbook_chapter_id: string;
  chapter_key: string;
  title: string;
};

/**
 * Tools Emma can use on the Handbook setup step.
 *
 * Reads chapter state via refs — never captures state in closure.
 * No nav tools — this step has custom props, not WizardStepProps.
 */
export function useHandbookTools(
  savedChapters: SavedChapter[],
  totalChapters: number,
): ClientToolKit {
  const savedRef = useSyncRef(savedChapters);
  const totalRef = useSyncRef(totalChapters);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "get_handbook_status",
          description:
            "Get the handbook completion status: how many chapters are saved vs total, and which chapters are done.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      get_handbook_status: () => {
        const saved = savedRef.current;
        const total = totalRef.current;
        const completedTitles = saved.map((ch) => ch.title);

        if (saved.length === 0) {
          return `Handbook: 0/${total} chapters written. Click "Skriv" on any chapter to start.`;
        }
        return (
          `Handbook: ${saved.length}/${total} chapters completed. ` +
          `Done: ${completedTitles.join(", ")}.`
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
