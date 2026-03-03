// packages/ai/src/capabilities/ui/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

// Extended context — Stage Engine provides the broadcast callback
export type UIToolContext = AgentToolContext & {
  broadcast?: (event: unknown) => void;
};

export const navigateTool = defineTool({
  name: "navigate_to",
  description:
    "Navigate the user's screen to a specific section or step. Use when the user should move to a different part of the interface.",
  schema: z.object({
    target: z
      .string()
      .describe("The section or step ID to navigate to, e.g. 'departments', 'season'"),
  }),
  execute: async ({ target }, ctx: UIToolContext) => {
    ctx.broadcast?.({
      type: "ui_command",
      sessionId: ctx.sessionId,
      command: { action: "navigate", target },
      timestamp: Date.now(),
    });
    return `Navigated to ${target}`;
  },
});

export const fillFieldTool = defineTool({
  name: "fill_field",
  description:
    "Fill a form field on the user's screen with a value. Use when you have information to populate into the UI.",
  schema: z.object({
    field: z.string().describe("The field name to fill, e.g. 'businessName', 'orgNumber'"),
    value: z.string().describe("The value to set"),
  }),
  execute: async ({ field, value }, ctx: UIToolContext) => {
    ctx.broadcast?.({
      type: "ui_command",
      sessionId: ctx.sessionId,
      command: { action: "fill_field", field, value },
      timestamp: Date.now(),
    });
    return `Set ${field} to "${value}"`;
  },
});

export const highlightTool = defineTool({
  name: "highlight_element",
  description:
    "Highlight a UI element to draw the user's attention. Use to guide the user visually.",
  schema: z.object({
    target: z.string().describe("CSS selector or element ID to highlight"),
    duration: z.number().optional().describe("Duration in milliseconds (default: 3000)"),
  }),
  execute: async ({ target, duration }, ctx: UIToolContext) => {
    ctx.broadcast?.({
      type: "ui_command",
      sessionId: ctx.sessionId,
      command: { action: "highlight", target, duration },
      timestamp: Date.now(),
    });
    return `Highlighted ${target}`;
  },
});

export const showPanelTool = defineTool({
  name: "show_panel",
  description:
    "Show a UI panel with data. Use for key facts, help text, or contextual information.",
  schema: z.object({
    panel: z.string().describe("Panel name, e.g. 'keyFacts', 'help', 'contract'"),
    data: z.record(z.unknown()).optional().describe("Data to display in the panel"),
  }),
  execute: async ({ panel, data }, ctx: UIToolContext) => {
    ctx.broadcast?.({
      type: "ui_command",
      sessionId: ctx.sessionId,
      command: { action: "show_panel", panel, data },
      timestamp: Date.now(),
    });
    return `Showed panel ${panel}`;
  },
});

export const toastTool = defineTool({
  name: "show_toast",
  description: "Show a brief notification message on the user's screen.",
  schema: z.object({
    message: z.string().describe("The notification text"),
    variant: z
      .enum(["info", "success", "warning"])
      .optional()
      .describe("Toast style (default: info)"),
  }),
  execute: async ({ message, variant }, ctx: UIToolContext) => {
    ctx.broadcast?.({
      type: "ui_command",
      sessionId: ctx.sessionId,
      command: { action: "toast", message, variant },
      timestamp: Date.now(),
    });
    return `Showed toast: "${message}"`;
  },
});
