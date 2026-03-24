"use client";

/**
 * AnimatedWizardShell — web-specific wrapper around @smartout/ui WizardShell.
 *
 * Adds two web-only concerns:
 *  1. framer-motion AnimatePresence transitions between steps
 *  2. Telemetry via useWizardTelemetry (emits SmartoutEvent on every lifecycle hook)
 *
 * The underlying WizardShell stays platform-agnostic in @smartout/ui.
 */

import { useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WizardShell, type WizardDefinition } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { useWizardTelemetry } from "./useWizardTelemetry";

/** Spring-based enter/exit matching "Ren og Varm" motion spec */
const springIn = {
  initial: { opacity: 0, x: 24 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 35, damping: 22, mass: 2 },
  },
  exit: { opacity: 0, x: -24, transition: { duration: 0.25 } },
};

interface AnimatedWizardShellProps<TState extends Record<string, unknown>> {
  definition: WizardDefinition<TState>;
  workspaceId?: string | null;
  actorId?: string;
}

export function AnimatedWizardShell<TState extends Record<string, unknown>>({
  definition,
  workspaceId = null,
  actorId = "anonymous",
}: AnimatedWizardShellProps<TState>) {
  const { t: tShell } = useTranslation("wizard");
  const { t: tWizard } = useTranslation(definition.metadata.i18nNamespace);
  const telemetry = useWizardTelemetry(definition, workspaceId, actorId);

  // Merged translator: try wizard-specific namespace first, fall back to shell namespace
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const wizardResult = tWizard(key, params);
      // If tWizard returns the key itself (not found), try shell namespace
      if (wizardResult === key) return tShell(key, params);
      return wizardResult;
    },
    [tWizard, tShell],
  );
  const directionRef = useRef<"forward" | "back">("forward");

  useEffect(() => {
    telemetry.emitWizardStarted();
  }, [telemetry.emitWizardStarted]);

  const renderStep = useCallback(
    (stepContent: React.ReactNode, direction: "forward" | "back", stepKey: string) => {
      directionRef.current = direction;
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key={stepKey}
            initial={springIn.initial}
            animate={springIn.animate}
            exit={springIn.exit}
            className="h-full"
          >
            {stepContent}
          </motion.div>
        </AnimatePresence>
      );
    },
    [],
  );

  return (
    <WizardShell
      definition={definition}
      t={t}
      onStepChange={telemetry.onStepChange}
      onStepComplete={telemetry.onStepComplete}
      onStepSkip={telemetry.onStepSkip}
      onStepBack={telemetry.onStepBack}
      onComplete={telemetry.onComplete}
      onValidationFail={telemetry.onValidationFail}
      renderStep={renderStep}
    />
  );
}
