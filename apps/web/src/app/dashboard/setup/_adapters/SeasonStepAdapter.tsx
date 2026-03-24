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

export function SeasonStepAdapter(_props: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SeasonSetupStep suggestedSeasons={industryPackage.seasonTemplates} />
    </div>
  );
}
