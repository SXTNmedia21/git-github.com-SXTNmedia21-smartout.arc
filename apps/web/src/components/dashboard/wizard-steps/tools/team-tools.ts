"use client";

import { useMemo } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import { useSyncRef } from "@/lib/wizard-tools/shared";
import type { TeamMember } from "../wizard-state";

/**
 * Tools Emma can use on the Team setup step.
 *
 * Reads member state via refs — never captures state in closure.
 * No nav tools — this step has custom props, not WizardStepProps.
 */
export function useTeamTools(teamMembers: TeamMember[]): ClientToolKit {
  const membersRef = useSyncRef(teamMembers);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "get_team_status",
          description:
            "Get current team setup: how many members are added, their roles, and any pending invites.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      get_team_status: () => {
        const members = membersRef.current;
        if (members.length === 0) return "No team members added yet.";

        const byRole = members.reduce<Record<string, number>>((acc, m) => {
          acc[m.role] = (acc[m.role] ?? 0) + 1;
          return acc;
        }, {});

        const roleSummary = Object.entries(byRole)
          .map(([role, count]) => `${count} ${role}`)
          .join(", ");

        const withEmail = members.filter((m) => m.email.trim()).length;
        const missingEmail = members.length - withEmail;

        return (
          `Team: ${members.length} member(s) — ${roleSummary}. ` +
          `${withEmail} with email (ready to invite). ` +
          `${missingEmail > 0 ? `${missingEmail} missing email.` : "All have emails."}`
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
