// packages/ui/src/wizard/WizardShell.tsx
"use client";

/**
 * WizardShell — Nordic Split layout
 *
 * Follows the visual language from login/signup:
 * - Warm background content area (left)
 * - Dark brand panel with contextual messages (right on desktop, hidden on mobile)
 * - Mobile: top progress bar, bottom navigation
 * - Step indicators in brand panel (minimal dots)
 *
 * The entire content area (step + nav) scrolls together so the Neste button
 * is always reachable even on short viewports or long forms.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { WizardDefinition, WizardStepDef, WizardStepProps, WizardThemeTokens, WizardContextPayload } from "./types";
import { useWizardState } from "./useWizardState";
import { useWizardWalkAi } from "./useWizardWalkAi";
import { WizardTopBar } from "./WizardTopBar";
import { WizardNavBar } from "./WizardNavBar";

interface WizardShellProps<TState extends Record<string, unknown>> {
  definition: WizardDefinition<TState>;
  t: (key: string, params?: Record<string, string | number>) => string;
  onStepChange?: (stepId: string, stepIndex: number, fromStep?: string) => void;
  onStepComplete?: (stepId: string, stepIndex: number, durationMs: number) => void;
  onStepSkip?: (stepId: string, stepIndex: number) => void;
  onStepBack?: (stepId: string, toStep: string) => void;
  onComplete?: () => void;
  onValidationFail?: (stepId: string, errors: string[]) => void;
  onContextChange?: (context: WizardContextPayload) => void;
  renderStep?: (
    stepContent: React.ReactNode,
    direction: "forward" | "back",
    stepKey: string,
  ) => React.ReactNode;
  renderBrandPanel?: (props: {
    currentStepId: string;
    currentStepIndex: number;
    totalSteps: number;
    message?: { heading: string; sub: string };
    logoSrc?: string;
  }) => React.ReactNode;
}

export function WizardShell<TState extends Record<string, unknown>>({
  definition,
  t,
  onStepChange,
  onStepComplete,
  onStepSkip,
  onStepBack,
  onComplete,
  onValidationFail,
  onContextChange,
  renderStep,
  renderBrandPanel,
}: WizardShellProps<TState>) {
  const {
    data,
    updateState,
    currentStep,
    currentStepIndex,
    completedSteps,
    isFirst,
    isLast,
    next: rawNext,
    skip: rawSkip,
    back: rawBack,
    goTo: rawGoTo,
    wizardState,
    totalSteps,
    loading,
  } = useWizardState(definition);

  const walkai = useWizardWalkAi(definition.id, currentStep?.id ?? "");
  const theme: WizardThemeTokens = { name: definition.theme };
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [attempted, setAttempted] = useState(false);

  const stepsForNav = definition.steps as unknown as WizardStepDef<Record<string, unknown>>[];

  const handleNext = useCallback(async () => {
    setValidationErrors([]);
    const prevStep = currentStep;
    const durationMs = Date.now() - wizardState.stepEnteredAt;
    const result = await rawNext();

    if (result.success) {
      setAttempted(false);
      if (prevStep) {
        onStepComplete?.(prevStep.id, currentStepIndex, durationMs);
      }
      if (isLast) {
        onComplete?.();
      }
    } else if ("errors" in result) {
      setAttempted(true);
      setValidationErrors(result.errors);
      onValidationFail?.(currentStep?.id ?? "", result.errors);
    }
  }, [
    rawNext,
    currentStep,
    currentStepIndex,
    isLast,
    wizardState.stepEnteredAt,
    onStepComplete,
    onComplete,
    onValidationFail,
  ]);

  const handleBack = useCallback(async () => {
    setValidationErrors([]);
    const fromStep = currentStep?.id ?? "";
    await rawBack();
    const prevIndex = currentStepIndex - 1;
    const toStep = definition.steps[prevIndex]?.id ?? "";
    onStepBack?.(fromStep, toStep);
  }, [rawBack, currentStep, currentStepIndex, definition.steps, onStepBack]);

  const handleSkip = useCallback(() => {
    setValidationErrors([]);
    if (currentStep) {
      onStepSkip?.(currentStep.id, currentStepIndex);
    }
    rawSkip();
  }, [currentStep, currentStepIndex, rawSkip, onStepSkip]);

  const handleGoTo = useCallback(
    (stepId: string) => {
      setValidationErrors([]);
      rawGoTo(stepId);
    },
    [rawGoTo],
  );

  // Stable serialized key so the effect doesn't re-run on every Set reference change
  const completedKey = useMemo(() => Array.from(completedSteps).sort().join(","), [completedSteps]);

  // Clear errors on step change and emit context to external consumers
  useEffect(() => {
    setValidationErrors([]);
    setAttempted(false);
    if (currentStep) {
      onStepChange?.(currentStep.id, currentStepIndex);
      onContextChange?.({
        wizardId: definition.id,
        stepId: currentStep.id,
        stepIndex: currentStepIndex,
        totalSteps,
        completedSteps: Array.from(completedSteps),
        theme: definition.theme,
      });
    }
  }, [currentStep, currentStepIndex, onStepChange, onContextChange, definition.id, totalSteps, completedKey, definition.theme]);

  /* Show a centered spinner while loadState is resolving */
  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="border-foreground/20 border-t-foreground h-8 w-8 animate-spin rounded-full border-2" />
      </div>
    );
  }

  if (!currentStep) return null;

  const StepComponent = currentStep.component;
  const stepProps: WizardStepProps<TState> = {
    state: data,
    updateState,
    next: handleNext,
    back: handleBack,
    goTo: handleGoTo,
    isFirst,
    isLast,
    attempted,
    t,
    theme,
    walkai,
  };

  const stepContent = <StepComponent {...stepProps} />;
  const renderedStep = renderStep
    ? renderStep(stepContent, "forward", currentStep.id)
    : stepContent;

  const hasBrandPanel = !!definition.brandPanel && !!renderBrandPanel;
  const brandMessage = definition.brandPanel?.messages[currentStep.id];
  const panelPosition = definition.brandPanel?.position ?? "right";

  return (
    <div
      className="relative flex min-h-[100dvh]"
      data-wizard-theme={definition.theme}
      data-walkai-id={`${definition.id}-shell`}
      data-walkai-type="wizard"
      data-walkai-context={JSON.stringify({
        wizardId: definition.id,
        currentStep: currentStep.id,
        currentStepIndex,
        totalSteps,
        theme: definition.theme,
      })}
    >
      {/* Noise overlay — matches login/signup */}
      <div className="bg-noise pointer-events-none fixed inset-0 z-30 opacity-[0.025] mix-blend-overlay" />

      {/* Brand panel — LEFT position (before content) */}
      {hasBrandPanel &&
        panelPosition === "left" &&
        renderBrandPanel({
          currentStepId: currentStep.id,
          currentStepIndex,
          totalSteps,
          message: brandMessage,
          logoSrc: definition.brandPanel?.logoSrc,
        })}

      {/* WIZARD CONTENT — warm background, fixed footer nav */}
      <div
        className="relative flex w-full flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: "var(--wizard-bg)" }}
      >
        {/* Progress bar */}
        <WizardTopBar
          steps={stepsForNav}
          currentStepIndex={currentStepIndex}
          completedSteps={completedSteps}
          t={t}
        />

        {/* Step content — scrollable */}
        <main
          className="flex-1 overflow-y-auto px-4 pt-4 pb-4 lg:px-8 xl:px-12"
          data-walkai-id={`${definition.id}-${currentStep.id}-step`}
          data-walkai-type="wizard-step"
        >
          <div className="flex min-h-full w-full items-start justify-center">
            <div className="w-full">{renderedStep}</div>
          </div>
        </main>

        {/* Navigation bar — fixed at bottom, outside scroll */}
        {!currentStep.hideNavBar && (
          <div
            className="w-full shrink-0 border-t border-[var(--brd,oklch(0.91_0.006_55))] pt-3"
            style={{ backgroundColor: "var(--wizard-bg)" }}
          >
            <WizardNavBar
              isFirst={isFirst}
              isLast={isLast}
              isSkippable={currentStep.skippable ?? false}
              validationErrors={validationErrors}
              t={t}
              onBack={handleBack}
              onNext={handleNext}
              onSkip={currentStep.skippable ? handleSkip : undefined}
            />
          </div>
        )}
      </div>

      {/* Brand panel — RIGHT position (after content, default) */}
      {hasBrandPanel &&
        panelPosition === "right" &&
        renderBrandPanel({
          currentStepId: currentStep.id,
          currentStepIndex,
          totalSteps,
          message: brandMessage,
          logoSrc: definition.brandPanel?.logoSrc,
        })}
    </div>
  );
}
