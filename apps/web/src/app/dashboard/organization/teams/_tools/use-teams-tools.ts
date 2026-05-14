"use client";

/**
 * use-teams-tools.ts — Botsson tools for the /dashboard/organization/teams surface.
 *
 * Four tools — 2 read, 2 write-propose:
 *
 *   listTeams          — all teams with member count, type, leader flag, and department link
 *   getTeamDetail      — single team summary by id or name, including leader info
 *   proposeCreateTeam  — open the Create Team dialog in the UI (no direct DB write)
 *   proposeAssignLeader— navigate to the team's detail page so leader can be assigned
 *
 * No direct DB writes — "propose" tools dispatch CustomEvents that the UI reacts to.
 * This keeps mutations user-confirmed per ADR-0151.
 *
 * Pattern: dataRef refreshed every render, definitions stable via useMemo([], []).
 * workspace_id is auth-derived from DashboardContext — never body-supplied (ADR-0151).
 *
 * ADR-0238: page does not own a domain chat surface.
 * Orb runs in interactive mode — no <DomainChatOwnership> needed.
 *
 * Cascade vocabulary:
 *   D2 (Resource) — team is a membership overlay on D1 departments.
 *   team.leader_profile_id is NOT a role — it is a team attribute only.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type TeamSummary = {
  teamId: string;
  name: string;
  slug: string;
  teamType: string;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  /** true when leader_profile_id is set — NOT a role */
  hasLeader: boolean;
  leaderName: string | null;
  memberCount: number;
  policyCount: number;
  description: string | null;
  color: string | null;
};

export type TeamsToolInput = {
  /** Whether the teams query is still loading. */
  loading: boolean;
  /** All teams for this workspace. */
  teams: TeamSummary[];
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useTeamsTools(input: TeamsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "listTeams",
          description:
            "List all teams in this workspace with member count, type, leader status, and department link. Use when the user asks 'hvilke team finnes?', 'vis alle team', 'hvordan er teamene organisert?', or wants a cross-workspace team overview.",
          dynamicParameters: [
            {
              name: "active_only",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "boolean",
                description:
                  "If true (default), only return active teams. Set false to include deactivated teams.",
              },
            },
            {
              name: "department_id",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description:
                  "Optional department_id to filter teams by department. Omit to list all teams.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getTeamDetail",
          description:
            "Get details for a single team by name or id — member count, type, leader name, department, and description. Use when the user asks about a specific team by name, 'hvem leder [team]?', 'hvor mange er i [team]?', or wants details about a specific team.",
          dynamicParameters: [
            {
              name: "teamName",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description:
                  "Name (or partial name) of the team to look up. Case-insensitive substring match.",
              },
            },
            {
              name: "teamId",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description: "UUID of the team. Use when exact id is known. Preferred over name.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeCreateTeam",
          description:
            "Open the Create Team dialog in the UI so the user can fill in name, type, and department. Use when the user says 'opprett nytt team', 'legg til team', 'nytt team for [avdeling]', or asks to create a team. Does NOT create a team directly — opens the form for user confirmation.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeAssignLeader",
          description:
            "Navigate to a specific team's detail page so the user can assign or change the leader. Use when the user says 'sett leder for [team]', 'hvem skal lede [team]?', 'endre leder på [team]', or asks to assign a team leader. Note: leader is a team attribute, not a role.",
          dynamicParameters: [
            {
              name: "teamName",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description:
                  "Name (or partial name) of the team to navigate to. Case-insensitive substring match.",
              },
            },
            {
              name: "teamId",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description: "UUID of the team. Preferred over name when known.",
              },
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      listTeams: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const activeOnly = params.active_only !== false; // default true
        const deptId =
          typeof params.department_id === "string" && params.department_id.trim() !== ""
            ? params.department_id
            : null;

        let list = activeOnly ? d.teams.filter((t) => t.isActive) : [...d.teams];
        if (deptId) {
          list = list.filter((t) => t.departmentId === deptId);
        }

        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: list.length,
            activeOnly,
            filteredByDepartment: deptId,
            teams: list.map((t) => ({
              teamId: t.teamId,
              name: t.name,
              slug: t.slug,
              teamType: t.teamType,
              isActive: t.isActive,
              departmentName: t.departmentName,
              hasLeader: t.hasLeader,
              leaderName: t.leaderName,
              memberCount: t.memberCount,
              policyCount: t.policyCount,
              description: t.description,
            })),
          }),
        );
      },

      getTeamDetail: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }

        const teamId = typeof params.teamId === "string" ? params.teamId.trim() : "";
        const teamName =
          typeof params.teamName === "string" ? params.teamName.toLowerCase().trim() : "";

        if (!teamId && !teamName) {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason:
                "Oppgi enten teamId eller teamName. Bruk listTeams for å se tilgjengelige team.",
            }),
          );
        }

        const team = teamId
          ? d.teams.find((t) => t.teamId === teamId)
          : d.teams.find((t) => t.name.toLowerCase().includes(teamName));

        if (!team) {
          const query = teamId || params.teamName;
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: `Fant ingen team som matcher "${query}". Bruk listTeams for å se tilgjengelige team.`,
            }),
          );
        }

        return Promise.resolve(
          JSON.stringify({
            ok: true,
            team: {
              teamId: team.teamId,
              name: team.name,
              slug: team.slug,
              teamType: team.teamType,
              isActive: team.isActive,
              departmentName: team.departmentName,
              hasLeader: team.hasLeader,
              leaderName: team.leaderName,
              memberCount: team.memberCount,
              policyCount: team.policyCount,
              description: team.description,
              color: team.color,
              detailUrl: `/dashboard/organization/teams/${team.teamId}`,
            },
          }),
        );
      },

      proposeCreateTeam: () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("botsson:open-create-team-dialog"));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            action: "open-create-team-dialog",
            message: "Åpner dialogen for å opprette nytt team. Fyll inn navn, type og avdeling.",
          }),
        );
      },

      proposeAssignLeader: (params: Record<string, unknown>) => {
        const d = dataRef.current;

        const teamId = typeof params.teamId === "string" ? params.teamId.trim() : "";
        const teamName =
          typeof params.teamName === "string" ? params.teamName.toLowerCase().trim() : "";

        if (!teamId && !teamName) {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: "Oppgi enten teamId eller teamName for å navigere til teamets detaljside.",
            }),
          );
        }

        const team = teamId
          ? d.teams.find((t) => t.teamId === teamId)
          : d.teams.find((t) => t.name.toLowerCase().includes(teamName));

        if (!team) {
          const query = teamId || params.teamName;
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: `Fant ingen team som matcher "${query}". Bruk listTeams for å se tilgjengelige team.`,
            }),
          );
        }

        const url = `/dashboard/organization/teams/${team.teamId}`;
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("botsson:navigate", { detail: { url, tab: "members" } }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            action: "navigate-to-team-members",
            teamId: team.teamId,
            teamName: team.name,
            url,
            message: `Navigerer til "${team.name}" — åpner Medlemmer-fanen for å tildele leder.`,
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
