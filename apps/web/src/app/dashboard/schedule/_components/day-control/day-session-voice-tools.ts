// ============================================
// day-control/day-session-voice-tools.ts
// Registers the day-session provider tools into the shared voice tool contract.
// Exists to make the panel's shared state available without broad DOM control.
// Connected to: day-session-agent-tools.ts and voice-tools-context.tsx
// ============================================

import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientTools,
} from "@/components/voice-tools-context";

import type { DaySessionEvidenceDraft } from "../../_hooks/day-session-model";
import type { DaySessionAgentToolSet } from "./day-session-agent-tools";

const DAY_SESSION_TOOL_DEFINITIONS: ClientToolDefinition[] = [
  {
    temporaryTool: {
      modelToolName: "getDaySessionState",
      description:
        "Get the currently open day-session panel state, including integrated tasks, evidence requirements, and readiness warnings.",
      dynamicParameters: [],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "focusTask",
      description: "Highlight a specific day-session task in the open panel.",
      dynamicParameters: [
        {
          name: "taskId",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "The day-session task identifier to focus.",
          },
          required: true,
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "focusField",
      description: "Highlight a specific field inside the open day-session panel.",
      dynamicParameters: [
        {
          name: "fieldId",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "The shared field identifier to focus, such as note:task-1.",
          },
          required: true,
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "updateEvidenceDraft",
      description: "Update the local evidence draft for a day-session task.",
      dynamicParameters: [
        {
          name: "taskId",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "The task identifier whose evidence draft should change.",
          },
          required: true,
        },
        {
          name: "patch",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "object",
            description:
              "A partial evidence draft patch containing note, measurement, or photoCount.",
          },
          required: true,
        },
      ],
      client: {},
    },
  },
];

/**
 * Creates the client-side voice tool bundle for the day-session panel.
 *
 * Why: the provider needs to register explicit shared-state actions while the
 * day panel is open.
 *
 * Returns: the additive client tool definitions and implementations.
 */
export function createDaySessionVoiceTools(daySessionTools: DaySessionAgentToolSet): ClientTools {
  const implementations: Record<string, ClientToolImplementation> = {
    getDaySessionState: () => JSON.stringify(daySessionTools.getDaySessionState()),
    focusTask: async (params) => {
      const taskId = String(params.taskId ?? "");
      daySessionTools.focusTask(taskId);
      return JSON.stringify({ success: true, taskId });
    },
    focusField: async (params) => {
      const fieldId = String(params.fieldId ?? "");
      daySessionTools.focusField(fieldId);
      return JSON.stringify({ success: true, fieldId });
    },
    updateEvidenceDraft: async (params) => {
      const taskId = String(params.taskId ?? "");
      const rawPatch = (params.patch ?? {}) as Record<string, unknown>;
      const patch: DaySessionEvidenceDraft = {};

      if (typeof rawPatch.note === "string") {
        patch.note = rawPatch.note;
      }
      if (typeof rawPatch.measurement === "string") {
        patch.measurement = rawPatch.measurement;
      }
      if (typeof rawPatch.photoCount === "number") {
        patch.photoCount = rawPatch.photoCount;
      }

      daySessionTools.updateEvidenceDraft(taskId, patch);
      return JSON.stringify({ success: true, taskId, patch });
    },
  };

  return {
    definitions: DAY_SESSION_TOOL_DEFINITIONS,
    implementations,
  };
}

/**
 * Merges the base schedule voice tools with the day-session additions.
 *
 * Why: the panel should extend the existing toolset, not replace it.
 *
 * Returns: one combined client tool object.
 */
export function mergeVoiceTools(baseTools: ClientTools, additiveTools: ClientTools): ClientTools {
  const definitionsByName = new Map<string, ClientToolDefinition>();
  for (const definition of baseTools.definitions) {
    definitionsByName.set(definition.temporaryTool.modelToolName, definition);
  }
  for (const definition of additiveTools.definitions) {
    definitionsByName.set(definition.temporaryTool.modelToolName, definition);
  }

  return {
    definitions: Array.from(definitionsByName.values()),
    implementations: {
      ...baseTools.implementations,
      ...additiveTools.implementations,
    },
  };
}
