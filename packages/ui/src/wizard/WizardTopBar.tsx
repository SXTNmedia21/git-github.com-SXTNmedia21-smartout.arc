// packages/ui/src/wizard/WizardTopBar.tsx
"use client";

import type { WizardStepDef } from "./types";

interface WizardTopBarProps {
  steps: WizardStepDef<Record<string, unknown>>[];
  currentStepIndex: number;
  completedSteps: Set<string>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WizardTopBar({ steps, currentStepIndex, completedSteps, t }: WizardTopBarProps) {
  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div
      className="flex flex-col gap-2 p-4 lg:hidden"
      style={{ backgroundColor: "var(--wizard-sidebar)", color: "var(--wizard-text)" }}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{currentStep ? t(currentStep.labelKey) : ""}</span>
        <span style={{ color: "var(--wizard-text-muted)" }}>
          {t("progress.step", { current: currentStepIndex + 1, total: steps.length })}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--wizard-step-pending)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, backgroundColor: "var(--wizard-step-active)" }}
        />
      </div>
    </div>
  );
}
