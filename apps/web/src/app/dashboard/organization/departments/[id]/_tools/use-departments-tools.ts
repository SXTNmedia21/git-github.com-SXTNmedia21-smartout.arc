"use client";

/**
 * use-departments-tools.ts — Botsson tools for /dashboard/organization/departments/[id].
 *
 * Five tools — four read, one nav:
 *   getDepartmentSummary       — name, status, positions, teams, members, policies, manager
 *   listPositions              — all positions in this department with status + minimum_role
 *   listTeams                  — teams linked to this department
 *   getDepartmentOperatingHours — per-day offset schedule for this department
 *   openDepartmentEdit         — fires CustomEvent to open the EditDepartmentDialog
 *
 * Scope key: "organization-departments"
 *
 * dataRef pattern keeps definitions stable (useMemo [], []) while reading live
 * state on every invocation — same pattern as use-organization-tools.ts.
 *
 * ADR-0151: workspace_id and department_id are resolved from page-level state
 * (auth-derived via DashboardContext + useParams). Never body-supplied.
 *
 * ADR-0238: page has no embedded domain chat surface.
 * BotssonShell operates in normal interactive mode. No <DomainChatOwnership> needed.
 *
 * No write tools here — department edits, position creation, and archive are
 * user-driven interactions in the UI dialogs, not Botsson-initiated mutations.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type DepartmentPosition = {
  positionId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  minimumRole: string | null;
  color: string | null;
};

export type DepartmentTeam = {
  teamId: string;
  name: string;
  description: string | null;
  color: string | null;
};

export type DepartmentPolicy = {
  policyId: string;
  name: string;
  policyType: string;
  enforcementStatus: string;
  isActive: boolean;
};

export type DepartmentHourEntry = {
  dayOfWeek: number;
  dayName: string;
  openOffset: number;
  closeOffset: number;
  isClosed: boolean;
};

export type DepartmentsToolInput = {
  /** Whether the primary department data is still loading. */
  loading: boolean;
  /** Department ID from route params. */
  departmentId: string;
  /** Department name, or null while loading. */
  departmentName: string | null;
  /** Whether the department is currently active. */
  isActive: boolean;
  /** Manager display name, or null if unassigned. */
  managerName: string | null;
  /** Active positions in this department. */
  positions: DepartmentPosition[];
  /** Teams linked to this department. */
  teams: DepartmentTeam[];
  /** Number of active members assigned to this department. */
  memberCount: number;
  /** Policies scoped to this department. */
  policies: DepartmentPolicy[];
  /** Per-day operating hour offsets, if loaded. Empty array if not yet loaded. */
  operatingHours: DepartmentHourEntry[];
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useDepartmentsTools(input: DepartmentsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getDepartmentSummary",
          description:
            "Get a summary of the current department — name, active/inactive status, position count, team count, member count, policy count, and manager name. Use when the user asks 'hva er status på denne avdelingen?', 'hvem leder avdelingen?', 'hvor mange ansatte er her?', or wants a quick overview of the department.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listPositions",
          description:
            "List all positions defined in this department with their active status, minimum role requirement, and description. Use when the user asks 'hvilke stillinger finnes her?', 'vis stillinger i avdelingen', 'er [stilling] aktiv?', or needs to review staffing structure.",
          dynamicParameters: [
            {
              name: "active_only",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "boolean",
                description:
                  "If true (default), only return active positions. Set false to include deactivated positions.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listDepartmentTeams",
          description:
            "List all teams linked to this department. Use when the user asks 'hvilke team tilhører avdelingen?', 'vis team i [avdeling]', or needs to understand team structure within this department.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getDepartmentOperatingHours",
          description:
            "Get the per-day operating hour offsets for this department relative to workspace base hours. Use when the user asks 'når åpner avdelingen?', 'hva er åpningstidene her?', 'er det avvik fra arbeidsstedets timer?', or needs to review when this department operates.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openDepartmentEdit",
          description:
            "Open the edit dialog for this department so the user can change name, description, color, icon, manager, or active status. Use when the user says 'rediger avdelingen', 'endre navn', 'oppdater avdelingsinfo', or asks to modify department settings.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getDepartmentSummary: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            departmentId: d.departmentId,
            name: d.departmentName,
            isActive: d.isActive,
            managerName: d.managerName,
            positionCount: d.positions.length,
            activePositionCount: d.positions.filter((p) => p.isActive).length,
            teamCount: d.teams.length,
            memberCount: d.memberCount,
            policyCount: d.policies.length,
          }),
        );
      },

      listPositions: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const activeOnly = params.active_only !== false; // default true
        const list = activeOnly ? d.positions.filter((p) => p.isActive) : [...d.positions];
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: list.length,
            activeOnly,
            positions: list.map((p) => ({
              positionId: p.positionId,
              name: p.name,
              description: p.description,
              isActive: p.isActive,
              minimumRole: p.minimumRole,
              color: p.color,
            })),
          }),
        );
      },

      listDepartmentTeams: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: d.teams.length,
            teams: d.teams.map((t) => ({
              teamId: t.teamId,
              name: t.name,
              description: t.description,
              color: t.color,
            })),
          }),
        );
      },

      getDepartmentOperatingHours: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (d.operatingHours.length === 0) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              note: "Ingen avdelingstilpasninger er lagret ennå. Avdelingen arver arbeidsstedets åpningstider.",
              hours: [],
            }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: d.operatingHours.length,
            hours: d.operatingHours.map((h) => ({
              dayOfWeek: h.dayOfWeek,
              dayName: h.dayName,
              openOffsetMinutes: h.openOffset,
              closeOffsetMinutes: h.closeOffset,
              isClosed: h.isClosed,
            })),
          }),
        );
      },

      openDepartmentEdit: () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("botsson:open-department-edit"));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            action: "open-department-edit",
            message: "Åpner redigeringsdialog for avdelingen.",
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
