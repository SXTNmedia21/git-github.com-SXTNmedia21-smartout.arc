/**
 * use-day-control-tools — tool definitions for the DayControlPanel surface.
 *
 * Replaces the legacy DaySessionProvider voice-tool path (ADR-0282).
 * V1 ships a single read-only context tool; mutation tools (re-time, assign)
 * belong to the day-line capability and are dispatched by the stage-engine,
 * not registered here.
 *
 * Returns a ClientToolKit (definitions + implementations) ready for
 * useRegisterTools("day-control", kit) in DayControlToolsBridge.
 */

import type { ClientToolDefinition, ClientToolKit } from "@smartout/agent-sdk";

export type DayControlToolContext = {
  sessionId: string;
  departmentId: string;
  departmentName: string;
  dateISO: string;
};

const DEFINITIONS: ClientToolDefinition[] = [
  {
    temporaryTool: {
      modelToolName: "get_day_control_panel_context",
      description:
        "Returns the currently focused department_session for the day control panel — session id, department, and date. Call this to orient before asking about session state.",
      dynamicParameters: [],
      client: {},
    },
  },
];

export function useDayControlTools(ctx: DayControlToolContext): ClientToolKit {
  const definitions = DEFINITIONS;

  const implementations: ClientToolKit["implementations"] = {
    get_day_control_panel_context: async () =>
      JSON.stringify({
        session_id: ctx.sessionId,
        department_id: ctx.departmentId,
        department_name: ctx.departmentName,
        date_iso: ctx.dateISO,
      }),
  };

  return { definitions, implementations };
}
