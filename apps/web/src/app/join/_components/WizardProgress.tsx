"use client";

import { useSignupWizard } from "../_hooks/useSignupWizard";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Konto" },
  { label: "Identitet" },
  { label: "Om bedriften" },
  { label: "Drift" },
  { label: "Meny" },
  { label: "Opprett konto" },
];

export function WizardProgress() {
  const { state, goToStep } = useSignupWizard();
  const { currentStep } = state;

  return (
    <nav aria-label="Registreringssteg" className="mx-auto w-full max-w-2xl px-4 py-6">
      <ol className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <li key={stepNumber} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => isCompleted && goToStep(stepNumber)}
                  disabled={!isCompleted}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200",
                    isCompleted && "bg-success hover:bg-success/80 cursor-pointer text-white",
                    isCurrent &&
                      "bg-brand-orange ring-brand-orange/15 dark:ring-brand-orange/20 text-white ring-4",
                    isUpcoming &&
                      "border-muted-foreground/25 bg-muted text-muted-foreground cursor-default border-2",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
                </button>
                <span
                  className={cn(
                    "text-center text-xs font-medium",
                    isCurrent && "text-foreground",
                    isCompleted && "text-success",
                    isUpcoming && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 rounded-full transition-colors duration-300",
                    stepNumber < currentStep ? "bg-success" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
