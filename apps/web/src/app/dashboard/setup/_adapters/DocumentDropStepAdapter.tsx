"use client";

/**
 * Adapter: bridges WizardStepProps<SetupState> to the existing DocumentDropStep.
 *
 * Passes the extraction callback through to updateState so extracted data
 * is available for subsequent steps (governance pre-fill, team pre-fill, etc.).
 */

import { useCallback } from "react";
import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import type { DocumentExtractionResult } from "@/components/dashboard/wizard-steps/wizard-state";
import { DocumentDropStep } from "@/components/dashboard/wizard-steps/DocumentDropStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import { SetupStepHeader } from "../_components/SetupStepHeader";

export function DocumentDropStepAdapter({ updateState, t }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  const handleExtractionComplete = useCallback(
    (result: DocumentExtractionResult) => {
      updateState({ extractedData: result });
    },
    [updateState],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SetupStepHeader
        stepId="document-drop"
        stepIndex={1}
        totalSteps={9}
        t={t}
        botssonTip={industryPackage.botsson?.["document-drop"]}
      />
      <DocumentDropStep onExtractionComplete={handleExtractionComplete} />
    </div>
  );
}
