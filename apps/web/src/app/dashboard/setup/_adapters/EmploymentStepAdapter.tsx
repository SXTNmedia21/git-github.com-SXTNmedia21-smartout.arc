"use client";

/**
 * Adapter: bridges WizardStepProps<SetupState> to the existing EmploymentSetupStep.
 *
 * Passes industry employment defaults and extracted terms for pre-fill.
 */

import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import { EmploymentSetupStep } from "@/components/dashboard/wizard-steps/EmploymentSetupStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";

export function EmploymentStepAdapter({ state }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <EmploymentSetupStep
        industryDefaults={industryPackage.employmentDefaults}
        extractedTerms={state.extractedData.employmentTerms}
      />
    </div>
  );
}
