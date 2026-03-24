"use client";

/**
 * Adapter: bridges WizardStepProps<SetupState> to the existing WelcomeStep.
 *
 * The WelcomeStep needs scraped data and industry detection — both come
 * from the shared wizard state and the useIndustryPackage hook.
 */

import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import { WelcomeStep } from "@/components/dashboard/wizard-steps/WelcomeStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";

export function WelcomeStepAdapter({ state, updateState }: WizardStepProps<SetupState>) {
  const { detectedType, setIndustryType } = useIndustryPackage();

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <WelcomeStep
        scrapedData={state.scrapedData}
        detectedIndustry={detectedType}
        onIndustryChange={(type) => {
          setIndustryType(type);
          updateState({ detectedIndustry: type });
        }}
      />
    </div>
  );
}
