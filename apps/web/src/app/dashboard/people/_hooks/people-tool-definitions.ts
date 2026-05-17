// People tool definitions — client tool shapes for Botsson voice agent.
// Registered via usePeopleVoiceTools in people-voice-tools-bridge.tsx.
// Read-only: people data queries for roster, readiness, and status lookups.

import type { ClientToolDefinition } from "@/components/voice-tools-context";

const body = "PARAMETER_LOCATION_BODY" as const;

// -- Read tools ---------------------------------------------------------------

const getPeopleState = {
  temporaryTool: {
    modelToolName: "getPeopleState",
    description:
      "Get the current people overview: total employee count, active count, department breakdown, average readiness score, and trainee count. Call this first to understand the workforce at a glance.",
    dynamicParameters: [],
    client: {},
  },
} satisfies { temporaryTool: ClientToolDefinition["temporaryTool"] };

const getEmployeeInfo = {
  temporaryTool: {
    modelToolName: "getEmployeeInfo",
    description:
      "Get detailed information about a specific employee: role, department, status, readiness score, contract status. Search by name (partial match).",
    dynamicParameters: [
      {
        name: "employeeName",
        location: body,
        schema: {
          type: "string",
          description: "Employee name or partial name to search for.",
        },
        required: true,
      },
    ],
    client: {},
  },
} satisfies { temporaryTool: ClientToolDefinition["temporaryTool"] };

const getPeopleByDepartment = {
  temporaryTool: {
    modelToolName: "getPeopleByDepartment",
    description:
      "Get all employees in a specific department. Shows names, roles, statuses, and readiness scores.",
    dynamicParameters: [
      {
        name: "departmentName",
        location: body,
        schema: {
          type: "string",
          description: "Department name or partial department name.",
        },
        required: true,
      },
    ],
    client: {},
  },
} satisfies { temporaryTool: ClientToolDefinition["temporaryTool"] };

const getReadinessSummary = {
  temporaryTool: {
    modelToolName: "getReadinessSummary",
    description:
      "Get a readiness summary across the workforce: how many employees are policy-compliant, who has the lowest scores, and who needs attention. Use when manager asks about team readiness or compliance.",
    dynamicParameters: [],
    client: {},
  },
} satisfies { temporaryTool: ClientToolDefinition["temporaryTool"] };

// -- Export ------------------------------------------------------------------

export const peopleToolDefinitions = [
  getPeopleState,
  getEmployeeInfo,
  getPeopleByDepartment,
  getReadinessSummary,
];
