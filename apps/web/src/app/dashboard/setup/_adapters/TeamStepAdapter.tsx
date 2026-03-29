"use client";

/**
 * Adapter: bridges WizardStepProps<SetupState> to the existing TeamSetupStep.
 *
 * Passes extracted employees and manages the teamMembers array in wizard state.
 */

import { useCallback } from "react";
import type { WizardStepProps } from "@smartout/ui";
import type { SetupState } from "../types";
import type { TeamMember } from "@/components/dashboard/wizard-steps/wizard-state";
import { TeamSetupStep } from "@/components/dashboard/wizard-steps/TeamSetupStep";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import { SetupStepHeader } from "../_components/SetupStepHeader";

export function TeamStepAdapter({ state, updateState, t }: WizardStepProps<SetupState>) {
  const { package: industryPackage } = useIndustryPackage();

  const handleTeamChange = useCallback(
    (members: TeamMember[]) => {
      updateState({ teamMembers: members });
    },
    [updateState],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <SetupStepHeader
        stepId="team"
        stepIndex={5}
        totalSteps={9}
        t={t}
        botssonTip={industryPackage.botsson?.team}
      />
      <TeamSetupStep
        extractedEmployees={state.extractedData.employees}
        teamMembers={state.teamMembers}
        onTeamChange={handleTeamChange}
      />
    </div>
  );
}
