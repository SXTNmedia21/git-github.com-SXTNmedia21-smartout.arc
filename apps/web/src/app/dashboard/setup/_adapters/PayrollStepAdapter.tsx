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

export function PayrollStepAdapter({ state }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <PayrollSetupStep
        industryTariffs={industryPackage.tariffs}
        defaultTariffKey={industryPackage.defaultTariffKey}
        extractedPayroll={state.extractedData.payroll}
      />
    </div>
  );
}
