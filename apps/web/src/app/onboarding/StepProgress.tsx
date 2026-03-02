"use client";

import type { WizardStep } from "./types";

const VISIBLE_STEPS: { step: WizardStep; label: string }[] = [
  { step: "init", label: "Website" },
  { step: "auth", label: "Account" },
  { step: "org_verification", label: "Company" },
  { step: "branding", label: "Branding" },
  { step: "season_identity", label: "Season" },
  { step: "departments", label: "Departments" },
  { step: "teams", label: "Teams" },
  { step: "locations", label: "Locations" },
  { step: "procedures", label: "Procedures" },
  { step: "battlefield_review", label: "Review" },
  { step: "invite", label: "Invite" },
];

const HIDDEN_STEPS: WizardStep[] = ["crawling", "finalizing", "done"];

interface StepProgressProps {
  currentStep: WizardStep;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  if (HIDDEN_STEPS.includes(currentStep)) return null;

  const effectiveStep = currentStep === "season_education" ? "season_identity" : currentStep;

  const currentIndex = VISIBLE_STEPS.findIndex((s) => s.step === effectiveStep);
  const progress = currentIndex >= 0 ? ((currentIndex + 1) / VISIBLE_STEPS.length) * 100 : 0;

  return (
    <div className="mx-auto mb-6 w-full max-w-5xl px-4 sm:mb-8 sm:px-6">
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {currentIndex >= 0 && (
        <div className="mt-2 flex justify-between text-xs text-zinc-600">
          <span>
            Step {currentIndex + 1} of {VISIBLE_STEPS.length}
          </span>
          <span className="text-zinc-500">{VISIBLE_STEPS[currentIndex]?.label}</span>
        </div>
      )}
    </div>
  );
}
