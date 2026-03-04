import type { ClientTool } from "../types";

/**
 * Callbacks the dashboard tools invoke.
 * These will be wired to dashboard-specific actions.
 */
export type DashboardActions = {
  navigateTo: (path: string) => void;
  showModule: (module: string) => void;
};

/**
 * Creates client tools for the in-dashboard voice assistant.
 * Currently a minimal set — will grow as the dashboard assistant gains features.
 *
 * @param actionsRef - A React ref containing the current DashboardActions.
 */
export function createDashboardTools(actionsRef: {
  current: DashboardActions | undefined;
}): ClientTool[] {
  return [
    {
      name: "navigateToDashboard",
      description:
        "Navigate to a specific page in the dashboard. Pass the path, e.g. '/dashboard/schedule' or '/dashboard/operations'.",
      parameters: [
        {
          name: "path",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Dashboard path to navigate to" },
          required: true,
        },
      ],
      implementation: (params) => {
        const path = String(params.path ?? "");
        actionsRef.current?.navigateTo(path);
        return JSON.stringify({ success: true, navigatedTo: path });
      },
    },
    {
      name: "showModule",
      description:
        "Show a specific module or panel in the dashboard, e.g. 'schedule', 'operations', 'training'.",
      parameters: [
        {
          name: "module",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Module name to show" },
          required: true,
        },
      ],
      implementation: (params) => {
        const module = String(params.module ?? "");
        actionsRef.current?.showModule(module);
        return JSON.stringify({ success: true, module });
      },
    },
  ];
}
