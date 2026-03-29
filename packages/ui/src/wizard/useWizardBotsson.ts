// packages/ui/src/wizard/useWizardBotsson.ts
"use client";

import { useMemo } from "react";
import type { BotssonHelper, BotssonDataAttributes } from "./types";

export function useWizardBotsson(wizardId: string, stepId: string): BotssonHelper {
  return useMemo(
    () => ({
      id: (element: string) => `${wizardId}-${stepId}-${element}`,

      tag: (
        element: string,
        intent: string,
        context?: Record<string, unknown>,
      ): BotssonDataAttributes => {
        const attrs: BotssonDataAttributes = {
          "data-botsson-id": `${wizardId}-${stepId}-${element}`,
          "data-botsson-intent": intent,
          "data-botsson-type": inferType(element),
        };
        if (context) {
          attrs["data-botsson-context"] = JSON.stringify(context);
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
