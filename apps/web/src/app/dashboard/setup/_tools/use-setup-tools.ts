"use client";

/**
 * use-setup-tools.ts — Botsson tools for the /dashboard/setup surface.
 *
 * Six tools — 3 read, 1 write-propose, 2 nav:
 *
 *   getSetupProgress     — overall completion: which modules are done, how many steps remain
 *   listSetupSteps       — all 9 wizard steps with status, skippable flag, and module mapping
 *   getCurrentStep       — current active step id, index, label, and completion state
 *   proposeAdvanceStep   — fires botsson:setup:advance window event (page handles the actual advance)
 *   openStep             — hard-navigates /dashboard/setup?step=<stepId> to jump to a named step
 *   restartSetup         — clears session dismiss flag and reloads from step 0
 *
 * ADR-0238: /dashboard/setup does NOT own an embedded chat surface.
 * useWizardBotssonContext sends navigation context INTO Botsson's existing session
 * — it is a context-injection hook, not a second chat surface.
 * owns_chat_surface = false. No <DomainChatOwnership> declaration needed.
 *
 * ADR-0151: workspace_id resolved server-side by season-actions; tools never forge it.
 * Read tools read from the wizard state ref only.
 *
 * Navigation pattern:
 *   - openStep: hard navigates via window.location.href so wizard remounts at ?step=<id>
 *     (loadState computes _initialStepIndex from URL param in page.tsx useSearchParams).
 *   - proposeAdvanceStep: dispatches CustomEvent("botsson:setup:advance") — page.tsx
 *     registers a listener that forwards to AnimatedWizardShell's internal next().
 *     This avoids needing to thread callbacks through AnimatedWizardShell props.
 *   - restartSetup: clears sessionStorage dismiss flag + hard navigates to /dashboard/setup.
 *
 * dataRef pattern (same as use-notifications-tools.ts / use-year-wheel-tools.ts):
 *   - definitions and implementations memoised independently
 *   - dataRef refreshed every render via useEffect
 *   - implementations always read from dataRef.current
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Step IDs in declaration order — matches wizard-definition.ts steps array. */
const STEP_IDS = [
  "welcome",
  "document-drop",
  "governance",
  "payroll",
  "employment",
  "team",
  "shift-template",
  "season",
  "handbook",
] as const;

type StepId = (typeof STEP_IDS)[number];

/** Module grouping for each step — mirrors STEP_TO_MODULE in wizard-definition.ts. */
const STEP_MODULE: Record<StepId, string> = {
  welcome: "onboarding",
  "document-drop": "governance",
  governance: "governance",
  payroll: "governance",
  employment: "governance",
  team: "people",
  "shift-template": "schedule",
  season: "season",
  handbook: "governance",
};

/** Skippable flags — mirrors wizard-definition.ts step.skippable. */
const STEP_SKIPPABLE: Record<StepId, boolean> = {
  welcome: true,
  "document-drop": true,
  governance: false,
  payroll: false,
  employment: false,
  team: true,
  "shift-template": true,
  season: false,
  handbook: true,
};

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type SetupToolInput = {
  /** Index of the currently active wizard step (0-based). Updated via onContextChange. */
  currentStepIndex: number;
  /** Set of step ids the user has completed in this session. Updated via onContextChange. */
  completedSteps: ReadonlySet<string>;
  /** Whether the wizard is loading (before loadState resolves). */
  isLoading: boolean;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useSetupTools(input: SetupToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getSetupProgress",
          description:
            "Get overall workspace setup progress: how many steps are done, which modules are complete, and how many remain. Use when the user asks 'hva gjenstår?', 'er setup ferdig?', or 'hvor langt er jeg kommet?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listSetupSteps",
          description:
            "List all 9 setup wizard steps with their id, module, skippable flag, and whether completed this session. Use when the user asks to see the full setup checklist or wants to know which steps remain.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getCurrentStep",
          description:
            "Get the currently active setup step: id, index, module, and skippable flag. Use when the user asks 'hvor er jeg nå?', 'hvilket steg er jeg på?', or before calling proposeAdvanceStep.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeAdvanceStep",
          description:
            "Advance the wizard to the next step. Only use when the user explicitly says they want to move on, skip, or continue to the next step. Does NOT apply when the user has content to fill in first.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openStep",
          description:
            "Jump directly to a named setup step. Use when the user wants to go to a specific step (e.g. 'gå til lønn' → payroll, 'åpne team-steget' → team). Valid ids: welcome, document-drop, governance, payroll, employment, team, shift-template, season, handbook.",
          dynamicParameters: [
            {
              name: "stepId",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                enum: [...STEP_IDS],
                description: "The step id to navigate to.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "restartSetup",
          description:
            "Restart the setup wizard from the first step. Use ONLY when the user explicitly asks to start over or reset setup. This reloads the page.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getSetupProgress: () => {
        const d = dataRef.current;
        const completedCount = d.completedSteps.size;
        const totalSteps = STEP_IDS.length;
        const remaining = totalSteps - completedCount;

        const moduleStatus: Record<string, { steps: string[]; allComplete: boolean }> = {};
        for (const stepId of STEP_IDS) {
          const mod = STEP_MODULE[stepId];
          if (!moduleStatus[mod]) {
            moduleStatus[mod] = { steps: [], allComplete: true };
          }
          const isComplete = d.completedSteps.has(stepId);
          moduleStatus[mod]!.steps.push(stepId);
          if (!isComplete) {
            moduleStatus[mod]!.allComplete = false;
          }
        }

        return JSON.stringify({
          totalSteps,
          completedCount,
          remaining,
          percentComplete: Math.round((completedCount / totalSteps) * 100),
          modules: moduleStatus,
          currentStepIndex: d.currentStepIndex,
          currentStepId: STEP_IDS[d.currentStepIndex] ?? null,
          isLoading: d.isLoading,
        });
      },

      listSetupSteps: () => {
        const d = dataRef.current;
        const steps = STEP_IDS.map((id, idx) => ({
          index: idx,
          id,
          module: STEP_MODULE[id],
          skippable: STEP_SKIPPABLE[id],
          completed: d.completedSteps.has(id),
          current: idx === d.currentStepIndex,
        }));
        return JSON.stringify({ steps, totalSteps: steps.length });
      },

      getCurrentStep: () => {
        const d = dataRef.current;
        const stepId = STEP_IDS[d.currentStepIndex] ?? null;
        if (!stepId) {
          return JSON.stringify({ ok: false, reason: "No active step" });
        }
        return JSON.stringify({
          index: d.currentStepIndex,
          id: stepId,
          module: STEP_MODULE[stepId],
          skippable: STEP_SKIPPABLE[stepId],
          completed: d.completedSteps.has(stepId),
          isLoading: d.isLoading,
          totalSteps: STEP_IDS.length,
        });
      },

      proposeAdvanceStep: () => {
        const d = dataRef.current;
        if (d.isLoading) {
          return JSON.stringify({ ok: false, reason: "Wizard is loading — wait a moment." });
        }
        const isLastStep = d.currentStepIndex >= STEP_IDS.length - 1;
        if (isLastStep) {
          return JSON.stringify({ ok: false, reason: "Already on the last step." });
        }
        // Dispatch window event — page.tsx registers a listener to forward to wizard's next()
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("botsson:setup:advance"));
        }
        const nextId = STEP_IDS[d.currentStepIndex + 1] ?? null;
        return JSON.stringify({ ok: true, advancing: true, nextStepId: nextId });
      },

      openStep: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const stepId = params.stepId as string | undefined;
        if (!stepId || !(STEP_IDS as ReadonlyArray<string>).includes(stepId)) {
          return JSON.stringify({
            ok: false,
            reason: `Invalid stepId '${String(stepId)}'. Must be one of: ${STEP_IDS.join(", ")}`,
          });
        }
        const targetIndex = STEP_IDS.indexOf(stepId as StepId);
        if (targetIndex === d.currentStepIndex) {
          return JSON.stringify({ ok: true, alreadyOnStep: true, stepId });
        }
        // Hard navigate — wizard remounts at the requested step via ?step= URL param
        if (typeof window !== "undefined") {
          window.location.href = `/dashboard/setup?step=${stepId}`;
        }
        return JSON.stringify({ ok: true, navigating: true, stepId, index: targetIndex });
      },

      restartSetup: () => {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("setup_dismissed");
          window.location.href = "/dashboard/setup";
        }
        return JSON.stringify({ ok: true, restarting: true });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
