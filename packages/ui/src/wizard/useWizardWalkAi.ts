// packages/ui/src/wizard/useWizardWalkAi.ts
"use client";

import { useMemo } from "react";
import type { WalkAiHelper, WalkAiDataAttributes } from "./types";

export function useWizardWalkAi(wizardId: string, stepId: string): WalkAiHelper {
  return useMemo(
    () => ({
      id: (element: string) => `${wizardId}-${stepId}-${element}`,

      tag: (
        element: string,
        intent: string,
        context?: Record<string, unknown>,
      ): WalkAiDataAttributes => {
        const attrs: WalkAiDataAttributes = {
          "data-walkai-id": `${wizardId}-${stepId}-${element}`,
          "data-walkai-intent": intent,
          "data-walkai-type": inferType(element),
        };
        if (context) {
          attrs["data-walkai-context"] = JSON.stringify(context);
        }
        return attrs;
      },
    }),
    [wizardId, stepId],
  );
}

function inferType(element: string): string {
  if (element.includes("input") || element.includes("field")) return "input";
  if (element.includes("button") || element.includes("btn")) return "button";
  if (element.includes("select") || element.includes("dropdown")) return "select";
  if (element.includes("checkbox") || element.includes("toggle")) return "checkbox";
  return "element";
}
