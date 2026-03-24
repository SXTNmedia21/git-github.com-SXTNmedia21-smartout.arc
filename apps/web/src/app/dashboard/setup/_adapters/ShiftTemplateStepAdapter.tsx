"use client";

/**
 * Adapter: bridges WizardStepProps<SetupState> to the existing ShiftTemplateSetupStep.
 *
 * Passes industry shift templates, extracted shift patterns, and opening hours.
 */

import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import { ShiftTemplateSetupStep } from "@/components/dashboard/wizard-steps/ShiftTemplateSetupStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";

export function ShiftTemplateStepAdapter({ state }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <ShiftTemplateSetupStep
        suggestedTemplates={industryPackage.shiftTemplates}
        extractedShiftPatterns={state.extractedData.shiftPatterns}
        openingHours={state.scrapedData.openingHours}
      />
    </div>
  );
}
