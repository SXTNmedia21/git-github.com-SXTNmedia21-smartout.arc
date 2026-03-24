// packages/ui/src/wizard/WizardShell.tsx
"use client";

import { useEffect, useCallback } from "react";
import type { WizardDefinition, WizardStepDef, WizardStepProps, WizardThemeTokens } from "./types";
import { useWizardState } from "./useWizardState";
import { useWizardWalkAi } from "./useWizardWalkAi";
import { WizardSidebar } from "./WizardSidebar";
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
  renderStep?: (
    stepContent: React.ReactNode,
    direction: "forward" | "back",
    stepKey: string,
  ) => React.ReactNode;
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
  renderStep,
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
    back: rawBack,
    goTo: rawGoTo,
    wizardState,
    totalSteps,
  } = useWizardState(definition);

  const walkai = useWizardWalkAi(definition.id, currentStep?.id ?? "");
  const theme: WizardThemeTokens = { name: definition.theme };

  // Cast steps for sub-components that use the base Record<string, unknown> generic
  const stepsForNav = definition.steps as unknown as WizardStepDef<Record<string, unknown>>[];

  const handleNext = useCallback(async () => {
    const prevStep = currentStep;
    const durationMs = Date.now() - wizardState.stepEnteredAt;
    const result = await rawNext();

    if (result.success) {
      if (prevStep) {
        onStepComplete?.(prevStep.id, currentStepIndex, durationMs);
      }
      if (isLast) {
        onComplete?.();
      }
    } else if ("errors" in result) {
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

  const handleBack = useCallback(() => {
    const fromStep = currentStep?.id ?? "";
    rawBack();
    const prevIndex = currentStepIndex - 1;
    const toStep = definition.steps[prevIndex]?.id ?? "";
    onStepBack?.(fromStep, toStep);
  }, [rawBack, currentStep, currentStepIndex, definition.steps, onStepBack]);

  const handleSkip = useCallback(() => {
    if (currentStep) {
      onStepSkip?.(currentStep.id, currentStepIndex);
    }
    rawNext();
  }, [currentStep, currentStepIndex, rawNext, onStepSkip]);

  const handleGoTo = useCallback(
    (stepId: string) => {
      rawGoTo(stepId);
    },
    [rawGoTo],
  );

  useEffect(() => {
    if (currentStep) {
      onStepChange?.(currentStep.id, currentStepIndex);
    }
  }, [currentStep, currentStepIndex, onStepChange]);

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
    t,
    theme,
    walkai,
  };

  const stepContent = <StepComponent {...stepProps} />;
  const renderedStep = renderStep
    ? renderStep(stepContent, "forward", currentStep.id)
    : stepContent;

  return (
    <div
      className="flex h-dvh flex-col"
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
      <div className="flex min-h-0 flex-1">
        <WizardSidebar
          steps={stepsForNav}
          currentStepIndex={currentStepIndex}
          completedSteps={completedSteps}
          t={t}
          onStepClick={handleGoTo}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <WizardTopBar
            steps={stepsForNav}
            currentStepIndex={currentStepIndex}
            completedSteps={completedSteps}
            t={t}
          />

          <main
            className="flex-1 overflow-y-auto"
            style={{ backgroundColor: "var(--wizard-bg)" }}
            data-walkai-id={`${definition.id}-${currentStep.id}-step`}
            data-walkai-type="wizard-step"
          >
            {renderedStep}
          </main>

          <WizardNavBar
            isFirst={isFirst}
            isLast={isLast}
            isSkippable={currentStep.skippable ?? false}
            t={t}
            onBack={handleBack}
            onNext={handleNext}
            onSkip={currentStep.skippable ? handleSkip : undefined}
          />
        </div>
      </div>
    </div>
  );
}
