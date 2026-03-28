"use client";

/**
 * Adapter: bridges WizardStepProps<SetupState> to the existing GovernanceSetupStep.
 *
 * Passes the industry package and extracted policies for template pre-selection.
 */

import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import { GovernanceSetupStep } from "@/components/dashboard/wizard-steps/GovernanceSetupStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import { SetupStepHeader } from "../_components/SetupStepHeader";

export function GovernanceStepAdapter({ state, t }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SetupStepHeader
        stepId="governance"
        stepIndex={2}
        totalSteps={9}
        t={t}
        botssonTip={industryPackage.botsson?.governance}
      />
      <GovernanceSetupStep
        industryPackage={industryPackage}
        extractedPolicies={state.extractedData.policies}
      />
    </div>
  );
}
