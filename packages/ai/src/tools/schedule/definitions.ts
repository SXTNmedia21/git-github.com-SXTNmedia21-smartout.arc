// packages/ai/src/tools/schedule/definitions.ts
//
// Ultravox client tool definitions for the schedule module.
// These are the "shape" of each tool — name, description, parameters.
// Implementations live client-side in the web app (use-schedule-voice-tools.ts)
// because they need React state access.

export type ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: Array<{
      name: string;
      location: "PARAMETER_LOCATION_BODY";
      schema: Record<string, unknown>;
      required?: boolean;
    }>;
    client: Record<string, never>;
  };
};

// -- Read tools ---------------------------------------------------------------

export const getScheduleState: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "getScheduleState",
    description:
      "Get the current schedule overview: which week is displayed, how many shifts, employees, coverage gaps, and draft/published counts. Call this first to understand what the manager is looking at.",
    dynamicParameters: [],
    client: {},
  },
};

export const getShiftsForDay: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "getShiftsForDay",
    description:
      "Get all shifts for a specific day. Returns employee names, times, roles, and status (draft/published). Use day name like 'monday' or date like '2026-03-03'.",
    dynamicParameters: [
      {
        name: "day",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description:
            "Day name (monday, tuesday, etc.) or date (YYYY-MM-DD). Day names are relative to the currently displayed week.",
        },
        required: true,
      },
    ],
    client: {},
  },
};

export const getEmployeeSchedule: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "getEmployeeSchedule",
    description:
      "Get one employee's shifts and absences for the current week. Search by name (partial match).",
    dynamicParameters: [
      {
        name: "employeeName",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Employee name or partial name to search for",
        },
        required: true,
      },
    ],
    client: {},
  },
};

export const getCoverage: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "getCoverage",
    description:
      "Get staffing coverage for a specific day or the whole week. Shows gaps, overtime risks, and team coverage. If no day specified, returns week summary.",
    dynamicParameters: [
      {
        name: "day",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description:
            "Optional: day name or date. If omitted, returns full week coverage summary.",
        },
      },
    ],
    client: {},
  },
};

// -- Write tools --------------------------------------------------------------

export const createShift: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "createShift",
    description:
      "Create a new shift. Requires employee name, day, start time, and end time. Role is optional.",
    dynamicParameters: [
      {
        name: "employeeName",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Employee name (partial match)" },
        required: true,
      },
      {
        name: "day",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Day name or date (YYYY-MM-DD)" },
        required: true,
      },
      {
        name: "startTime",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Start time in HH:MM format (e.g. '08:00')" },
        required: true,
      },
      {
        name: "endTime",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "End time in HH:MM format (e.g. '16:00')" },
        required: true,
      },
      {
        name: "role",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Job role (e.g. 'Kokk', 'Servitoer'). Optional." },
      },
    ],
    client: {},
  },
};

export const updateShift: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "updateShift",
    description:
      "Update an existing shift. Find it by employee name + day, then change time, role, or notes.",
    dynamicParameters: [
      {
        name: "employeeName",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Employee whose shift to update" },
        required: true,
      },
      {
        name: "day",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Day of the shift" },
        required: true,
      },
      {
        name: "startTime",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "New start time (HH:MM). Optional." },
      },
      {
        name: "endTime",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "New end time (HH:MM). Optional." },
      },
      {
        name: "role",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "New role. Optional." },
      },
      {
        name: "notes",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Shift notes. Optional." },
      },
    ],
    client: {},
  },
};

export const deleteShift: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "deleteShift",
    description:
      "Delete a shift. Find it by employee name + day. If multiple shifts, specify the time to disambiguate.",
    dynamicParameters: [
      {
        name: "employeeName",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Employee whose shift to delete" },
        required: true,
      },
      {
        name: "day",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Day of the shift" },
        required: true,
      },
      {
        name: "time",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Start time to disambiguate if multiple shifts (HH:MM). Optional.",
        },
      },
    ],
    client: {},
  },
};

export const publishShifts: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "publishShifts",
    description:
      "Publish draft shifts. Specify a day to publish all drafts for that day, or 'all' to publish everything.",
    dynamicParameters: [
      {
        name: "day",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Day name, date, or 'all' to publish all draft shifts in the current week",
        },
        required: true,
      },
    ],
    client: {},
  },
};

// -- Navigation tools ---------------------------------------------------------

export const focusDay: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "focusDay",
    description:
      "Scroll to a day in the visible schedule and highlight it for showcase guidance. Does not open the day planner.",
    dynamicParameters: [
      {
        name: "day",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Day name or date (YYYY-MM-DD) to focus and highlight in the schedule grid",
        },
        required: true,
      },
    ],
    client: {},
  },
};

export const openDayPlanner: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "openDayPlanner",
    description:
      "Open the day planner for a specific day, scroll to that day in the schedule grid, and highlight it.",
    dynamicParameters: [
      {
        name: "day",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Day name or date (YYYY-MM-DD) to open in day planner",
        },
        required: true,
      },
    ],
    client: {},
  },
};

export const closeDayPlanner: ScheduleClientToolDefinition = {
  temporaryTool: {
    modelToolName: "closeDayPlanner",
    description: "Close the currently open day planner sheet if it is visible.",
    dynamicParameters: [],
    client: {},
  },
};

// -- Grouped exports ----------------------------------------------------------

export const SCHEDULE_READ_TOOLS = [
  getScheduleState,
  getShiftsForDay,
  getEmployeeSchedule,
  getCoverage,
] as const;

export const SCHEDULE_WRITE_TOOLS = [createShift, updateShift, deleteShift, publishShifts] as const;

export const SCHEDULE_NAV_TOOLS = [focusDay, openDayPlanner, closeDayPlanner] as const;

export const SCHEDULE_TOOL_DEFINITIONS = [
  ...SCHEDULE_READ_TOOLS,
  ...SCHEDULE_WRITE_TOOLS,
  ...SCHEDULE_NAV_TOOLS,
] as const;

export const SCHEDULE_TOOL_NAMES = SCHEDULE_TOOL_DEFINITIONS.map(
  (t) => t.temporaryTool.modelToolName,
);
