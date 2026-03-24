"use client";

/**
 * Adapter: bridges WizardStepProps<SetupState> to the existing HandbookSetupStep.
 *
 * Reconstructs a SetupWizardState-compatible object from SetupState
 * so the handbook generator can access scraped data and extraction results.
 */

import { useMemo } from "react";
import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import type { SetupWizardState } from "@/components/dashboard/wizard-steps/wizard-state";
import { EMPTY_EXTRACTION } from "@/components/dashboard/wizard-steps/wizard-state";
import { HandbookSetupStep } from "@/components/dashboard/wizard-steps/HandbookSetupStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";

export function HandbookStepAdapter({ state }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  /** Reconstruct the legacy wizard state shape for handbook generation */
  const wizardState = useMemo<SetupWizardState>(
    () => ({
      scrapedData: state.scrapedData,
      extractedData: state.extractedData ?? EMPTY_EXTRACTION,
      industryPackage,
      createdPolicyIds: state.createdPolicyIds,
      payrollSaved: state.payrollSaved,
      employmentSaved: state.employmentSaved,
      invitedCount: state.invitedCount,
      shiftTemplateCount: state.shiftTemplateCount,
      seasonCreated: state.seasonCreated,
      teamMembers: state.teamMembers,
    }),
    [state, industryPackage],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <HandbookSetupStep wizardState={wizardState} />
    </div>
  );
}
