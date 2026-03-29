"use client";

/**
 * Adapter: bridges WizardStepProps<SetupState> to the existing PayrollSetupStep.
 *
 * Passes industry tariffs and extracted payroll data for pre-fill.
 */

import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import { PayrollSetupStep } from "@/components/dashboard/wizard-steps/PayrollSetupStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import { SetupStepHeader } from "../_components/SetupStepHeader";

export function PayrollStepAdapter({ state, t }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SetupStepHeader
        stepId="payroll"
        stepIndex={3}
        totalSteps={9}
        t={t}
        botssonTip={industryPackage.botsson?.payroll}
      />
      <PayrollSetupStep
        industryTariffs={industryPackage.tariffs}
        defaultTariffKey={industryPackage.defaultTariffKey}
        extractedPayroll={state.extractedData.payroll}
      />
    </div>
  );
}
