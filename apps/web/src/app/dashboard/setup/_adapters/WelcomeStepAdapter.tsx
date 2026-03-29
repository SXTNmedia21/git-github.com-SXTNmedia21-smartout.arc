"use client";

import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import { WelcomeStep } from "@/components/dashboard/wizard-steps/WelcomeStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import { SetupStepHeader } from "../_components/SetupStepHeader";

export function WelcomeStepAdapter({ t }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SetupStepHeader
        stepId="welcome"
        stepIndex={0}
        totalSteps={9}
        t={t}
        botssonTip={industryPackage.botsson?.welcome}
      />
      <WelcomeStep />
    </div>
  );
}
