"use client";

/**
 * Adapter: bridges WizardStepProps<SetupState> to the existing SeasonSetupStep.
 *
 * Passes industry season templates.
 */

import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import { SeasonSetupStep } from "@/components/dashboard/wizard-steps/SeasonSetupStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import { SetupStepHeader } from "../_components/SetupStepHeader";

export function SeasonStepAdapter({ t }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SetupStepHeader
        stepId="season"
        stepIndex={7}
        totalSteps={9}
        t={t}
        botssonTip={industryPackage.botsson?.season}
      />
      <SeasonSetupStep suggestedSeasons={industryPackage.seasonTemplates} />
    </div>
  );
}
