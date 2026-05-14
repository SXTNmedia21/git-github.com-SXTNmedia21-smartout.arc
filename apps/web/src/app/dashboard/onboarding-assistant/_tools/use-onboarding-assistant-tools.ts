"use client";

/**
 * use-onboarding-assistant-tools.ts — Botsson tools for the
 * /dashboard/onboarding-assistant surface.
 *
 * Four tools: 3 read, 1 nav.
 *   getOnboardingProgress  — overall completion status (steps done / total)
 *   listOnboardingSteps    — full list of steps with status per step
 *   getCurrentStep         — the step the workspace is currently on
 *   openStep               — navigate user to the setup wizard at a specific step
 *
 * No write tools — mutations (completing/resetting steps) live in the
 * setup wizard flow, not this assistant surface. Assistant surface is
 * read + guide only.
 *
 * dataRef pattern (same as use-notifications-tools.ts) keeps definitions
 * stable while reading live data on every invocation.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type OnboardingStep = {
  /** Stable slug identifier for the step (e.g. "workspace-profile"). */
  id: string;
  /** Display title of the step. */
  title: string;
  /** Whether this step is complete. */
  completed: boolean;
  /** Whether this step is currently active / in progress. */
  active: boolean;
  /** Optional short description of what this step covers. */
  description?: string | null;
};

export type OnboardingAssistantToolInput = {
  /** All onboarding steps for the workspace. */
  steps: OnboardingStep[];
  /** Number of completed steps. */
  completedCount: number;
  /** Total number of steps. */
  totalCount: number;
  /** Client-side navigation handler — e.g. router.push */
  navigate: (path: string) => void;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useOnboardingAssistantTools(input: OnboardingAssistantToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getOnboardingProgress",
          description:
            "Get the workspace's overall onboarding completion status — how many steps are done vs total. Use when user asks 'er vi ferdige med onboarding?', 'hvor langt har vi kommet?' or 'hva mangler for å sette opp arbeidsplassen?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listOnboardingSteps",
          description:
            "List all onboarding steps with their completion status. Use when user wants a full overview of what is done and what remains, e.g. 'vis alle stegene' or 'hva gjenstår i oppsettet?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getCurrentStep",
          description:
            "Get the onboarding step the workspace is currently working on. Use when user asks 'hvilket steg er vi på nå?' or 'hva er neste i onboarding?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openStep",
          description:
            "Navigate the user to the setup wizard at a specific onboarding step. Use when user says 'åpne steg X', 'ta meg til [stegnavn]' or 'jeg vil fullføre [steg]'.",
          dynamicParameters: [
            {
              name: "stepId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "The id of the onboarding step to open in the setup wizard.",
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
      getOnboardingProgress: () => {
        const d = dataRef.current;
        const pct = d.totalCount > 0 ? Math.round((d.completedCount / d.totalCount) * 100) : 0;
        return JSON.stringify({
          completedCount: d.completedCount,
          totalCount: d.totalCount,
          percentComplete: pct,
          isComplete: d.completedCount === d.totalCount && d.totalCount > 0,
        });
      },

      listOnboardingSteps: () => {
        const d = dataRef.current;
        return JSON.stringify({
          steps: d.steps.map((s) => ({
            id: s.id,
            title: s.title,
            description: s.description ?? null,
            completed: s.completed,
            active: s.active,
          })),
          completedCount: d.completedCount,
          totalCount: d.totalCount,
        });
      },

      getCurrentStep: () => {
        const d = dataRef.current;
        const current = d.steps.find((s) => s.active);
        if (!current) {
          const firstIncomplete = d.steps.find((s) => !s.completed);
          if (!firstIncomplete) {
            return JSON.stringify({
              currentStep: null,
              message: "Alle onboarding-steg er fullført.",
            });
          }
          return JSON.stringify({ currentStep: firstIncomplete });
        }
        return JSON.stringify({ currentStep: current });
      },

      openStep: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const stepId = params.stepId as string | undefined;
        if (!stepId) {
          return JSON.stringify({ ok: false, reason: "stepId is required" });
        }
        const step = d.steps.find((s) => s.id === stepId);
        if (!step) {
          return JSON.stringify({
            ok: false,
            reason: `Step '${stepId}' not found. Available: ${d.steps.map((s) => s.id).join(", ")}`,
          });
        }
        d.navigate(`/dashboard/setup?step=${stepId}`);
        return JSON.stringify({ ok: true, stepId, stepTitle: step.title });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
