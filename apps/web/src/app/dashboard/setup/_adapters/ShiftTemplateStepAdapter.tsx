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
import { SetupStepHeader } from "../_components/SetupStepHeader";

export function ShiftTemplateStepAdapter({ state, t }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SetupStepHeader
        stepId="shift-template"
        stepIndex={6}
        totalSteps={9}
        t={t}
        botssonTip={industryPackage.botsson?.["shift-template"]}
      />
      <ShiftTemplateSetupStep
        suggestedTemplates={industryPackage.shiftTemplates}
        extractedShiftPatterns={state.extractedData.shiftPatterns}
        openingHours={state.scrapedData.openingHours}
      />
    </div>
  );
}
