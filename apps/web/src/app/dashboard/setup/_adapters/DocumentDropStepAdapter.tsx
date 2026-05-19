"use client";

/**
 * Adapter: bridges WizardStepProps<SetupState> to the existing DocumentDropStep.
 *
 * Passes the extraction callback through to updateState so extracted data
 * is available for subsequent steps (governance pre-fill, team pre-fill, etc.).
 *
 * Pontus 2026-05-19: swap visual position of the botsson tip (was above step
 * content) with the doc-count button (was below dropzone). Tip renders here
 * at the bottom of the adapter; SetupStepHeader is called WITHOUT botssonTip
 * so it skips its own inline tip card.
 */

import { useCallback } from "react";
import { Info } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import type { DocumentExtractionResult } from "@/components/dashboard/wizard-steps/wizard-state";
import { DocumentDropStep } from "@/components/dashboard/wizard-steps/DocumentDropStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import { SetupStepHeader } from "../_components/SetupStepHeader";

export function DocumentDropStepAdapter({ updateState, t }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();
  const botssonTip = industryPackage.botsson?.["document-drop"];

  const handleExtractionComplete = useCallback(
    (result: DocumentExtractionResult) => {
      updateState({ extractedData: result });
    },
    [updateState],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SetupStepHeader stepId="document-drop" stepIndex={1} totalSteps={9} t={t} />
      <DocumentDropStep onExtractionComplete={handleExtractionComplete} />
      {botssonTip && (
        <div className="bg-muted/50 border-border mt-6 flex items-start gap-3 rounded-xl border px-4 py-3">
          <Info className="text-brand-orange mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-muted-foreground text-sm leading-relaxed">{botssonTip}</p>
        </div>
      )}
    </div>
  );
}
