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

export function TeamStepAdapter({ state, updateState }: WizardStepProps<SetupState>) {
  const handleTeamChange = useCallback(
    (members: TeamMember[]) => {
      updateState({ teamMembers: members });
    },
    [updateState],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-12">
      <TeamSetupStep
        extractedEmployees={state.extractedData.employees}
        teamMembers={state.teamMembers}
        onTeamChange={handleTeamChange}
      />
    </div>
  );
}
