// apps/web/src/app/walkAi/_hooks/useWizardWalkAiContext.ts
"use client";

/**
 * Bridge between WizardShell (packages/ui) and WalkAi context system.
 *
 * WizardShell fires onContextChange with navigation payload.
 * This hook translates that into a format WalkAi can inject
 * into Emma's context window via sendContext().
 *
 * Lives in apps/web (not packages/ui) to keep the shared
 * package agent-agnostic.
 *
 * IMPORTANT: This hook must be used INSIDE WalkAiProvider's React tree
 * so it can access the agent session for mid-session context injection.
 * The sendContext param should come from WalkAiProvider's useAgent() hook.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { WizardContextPayload } from "@smartout/ui";

/** The current wizard context, or null if no wizard is active. */
export type WizardContext = WizardContextPayload | null;

/**
 * Returns a callback to pass as WizardShell's onContextChange prop,
 * plus the latest wizard context for consumption by WalkAiProvider.
 */
export function useWizardWalkAiContext(sendContext?: (text: string) => void) {
  const [wizardContext, setWizardContext] = useState<WizardContext>(null);
  const sendContextRef = useRef(sendContext);
  useEffect(() => {
    sendContextRef.current = sendContext;
  }, [sendContext]);

  const handleContextChange = useCallback((ctx: WizardContextPayload) => {
    setWizardContext(ctx);
    // Deliver context to Emma's live Ultravox session
    sendContextRef.current?.(
      `[Wizard navigation] Step ${ctx.stepIndex + 1}/${ctx.totalSteps}: ${ctx.stepId}. ` +
        `Completed: ${ctx.completedSteps.join(", ") || "none"}.`,
    );
  }, []);

  /** Call when wizard unmounts to clear context */
  const clearContext = useCallback(() => {
    setWizardContext(null);
  }, []);

  return { wizardContext, handleContextChange, clearContext } as const;
}
