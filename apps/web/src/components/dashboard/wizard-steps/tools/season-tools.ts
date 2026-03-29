"use client";

import { useMemo } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import { useSyncRef } from "@/lib/wizard-tools/shared";

/**
 * Tools Emma can use on the Season setup step.
 *
 * Reads/writes via refs — never captures state in closure.
 * No nav tools — this step has custom props, not WizardStepProps.
 */
export function useSeasonTools(
  name: string,
  startDate: string,
  endDate: string,
  setName: (v: string) => void,
  setStartDate: (v: string) => void,
  setEndDate: (v: string) => void,
  handleSave: () => Promise<void>,
): ClientToolKit {
  const nameRef = useSyncRef(name);
  const startRef = useSyncRef(startDate);
  const endRef = useSyncRef(endDate);
  const setNameRef = useSyncRef(setName);
  const setStartRef = useSyncRef(setStartDate);
  const setEndRef = useSyncRef(setEndDate);
  const saveRef = useSyncRef(handleSave);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "set_season_name",
          description: "Set the season name. Example: 'Sommersesong 2026'",
          dynamicParameters: [
            {
              name: "name",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Season name" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "set_season_dates",
          description:
            "Set the season start and end dates. Format: YYYY-MM-DD. End must be after start.",
          dynamicParameters: [
            {
              name: "startDate",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Start date (YYYY-MM-DD)" },
              required: true,
            },
            {
              name: "endDate",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "End date (YYYY-MM-DD)" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "save_season",
          description: "Save the current season to the database.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_season_status",
          description: "Get the current season setup: name, dates, duration.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      set_season_name: (params) => {
        const p = params as Record<string, string>;
        const val = p.name?.trim();
        if (!val) return "Error: name is required.";
        setNameRef.current(val);
        return `Season name set to "${val}".`;
      },
      set_season_dates: (params) => {
        const p = params as Record<string, string>;
        const s = p.startDate;
        const e = p.endDate;
        if (!s || !e) return "Error: both startDate and endDate are required.";
        if (s >= e) return "Error: endDate must be after startDate.";
        setStartRef.current(s);
        setEndRef.current(e);
        const days = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000);
        return `Season dates set: ${s} to ${e} (${days} days).`;
      },
      save_season: async () => {
        try {
          await saveRef.current();
          return "Season saved successfully.";
        } catch {
          return "Error saving season. Ask the user to check the form.";
        }
      },
      get_season_status: () => {
        const n = nameRef.current;
        const s = startRef.current;
        const e = endRef.current;
        if (!n && !s && !e) return "No season configured yet.";
        const days =
          s && e ? Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) : 0;
        return `Season: "${n || "(unnamed)"}". Period: ${s || "not set"} to ${e || "not set"} (${days} days).`;
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
