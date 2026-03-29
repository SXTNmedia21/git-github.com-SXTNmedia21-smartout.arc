"use client";

import { useRef, useEffect } from "react";
import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import {
  EmploymentSetupStep,
  type EmploymentSetupHandle,
} from "@/components/dashboard/wizard-steps/EmploymentSetupStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import { SetupStepHeader } from "../_components/SetupStepHeader";
import { registerEmploymentSave, unregisterEmploymentSave } from "./employment-save-bridge";

export function EmploymentStepAdapter({ state, t }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();
  const stepRef = useRef<EmploymentSetupHandle>(null);

  useEffect(() => {
    registerEmploymentSave(() => stepRef.current?.save() ?? Promise.resolve());
    return () => unregisterEmploymentSave();
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SetupStepHeader
        stepId="employment"
        stepIndex={4}
        totalSteps={9}
        t={t}
        botssonTip={industryPackage.botsson?.employment}
      />
      <EmploymentSetupStep
        ref={stepRef}
        industryDefaults={industryPackage.employmentDefaults}
        extractedTerms={state.extractedData.employmentTerms}
      />
    </div>
  );
}
