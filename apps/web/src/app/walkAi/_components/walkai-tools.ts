/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  WalkAi Client Tools                      */
/*                                           */
/*  Tools that Emma calls to morph the view, */
/*  navigate pages, and schedule tasks.      */
/*  Implementations read from a mutable ref  */
/*  so they always see the latest dispatch.  */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import type { MutableRefObject } from "react";
import type {
  ClientToolKit,
  ClientToolDefinition,
  ClientToolImplementation,
} from "@smartout/agent-sdk";
import type { ContentViewType } from "./types";

/* ━━━ View actions ref — set by WalkAiProvider ━━━ */

export type ViewActions = {
  switchView: (type: ContentViewType, props?: Record<string, unknown>) => void;
  currentView: () => ContentViewType;
  appendNotepad: (text: string, topic?: string) => void;
  getNotepadContent: () => string;
  /** Schedule a task — stored in provider state */
  scheduleTask: (task: ScheduledTask) => void;
  /** Get current page path */
  getCurrentPage: () => string;
  /** Get current workspace ID for task persistence */
  getWorkspaceId?: () => string | null;
};

export type ScheduledTask = {
  id: string;
  title: string;
  description: string;
  dueAt: string | null; // ISO 8601 or null for "as soon as possible"
  status: "pending" | "done";
  createdAt: number;
};

/* ━━━ Tool definitions (Ultravox temporaryTool format) ━━━ */

const SILENT_INSTRUCTION =
  "The view is now open. Do NOT speak. Stay silent and wait for the user to interact or speak. " +
  "Only speak again when the user addresses you.";

const showVisualizerDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "show_visualizer",
    description:
      "Show the voice visualizer view — a large animated display of the voice conversation. " +
      "Use when the user wants to see the voice animation, or when there is nothing else to show. " +
      "This is the default resting view. After calling this tool, stay silent.",
    dynamicParameters: [],
    client: {},
  },
};

const showNotepadDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "show_notepad",
    description:
      "Open the notepad view. Use when the user says 'ta fram notepad', 'skriv ned', 'noter dette', 'ta et notat', or similar. " +
      "After opening the notepad, stay completely silent and wait. Do not speak. " +
      "If you want to write something, use write_notepad instead.",
    dynamicParameters: [
      {
        name: "title",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Optional title for the note" },
        required: false,
      },
    ],
    client: {},
  },
};

const writeNotepadDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "write_notepad",
    description:
      "Create a NEW note in the notepad. Each call creates a separate note with its own metadata. " +
      "Use this when the user asks you to write something down, take a note, or jot something. " +
      "If the notepad is not already open, it will be opened automatically. " +
      "Write structured content: use markdown with # Title as the first line, then body with " +
      "bullet points (- item), tasks (- [ ] task), @mentions for people, and clear formatting. " +
      "After writing, confirm briefly ('Skrevet.' or 'Lagt til.') but do NOT read back the content.",
    dynamicParameters: [
      {
        name: "text",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Markdown-formatted note content. Start with # Title.",
        },
        required: true,
      },
      {
        name: "topic",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Short topic/label for this note, e.g. 'Møtenotater', 'Oppgaver', 'Ideer'",
        },
        required: false,
      },
    ],
    client: {},
  },
};

const showCalculatorDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "show_calculator",
    description:
      "Open the calculator view. Use when the user says 'ta fram kalkylator', 'regn ut', 'beregn', or needs math. " +
      "After opening, stay completely silent and wait. Do not speak.",
    dynamicParameters: [
      {
        name: "expression",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Optional math expression to pre-fill, e.g. '150 * 8'",
        },
        required: false,
      },
    ],
    client: {},
  },
};

const showChatDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "show_chat",
    description:
      "Switch back to the chat/conversation view. " +
      "Use when the user is done with the current tool view and wants to return to the conversation transcript.",
    dynamicParameters: [],
    client: {},
  },
};

/* ━━━ Navigation tool ━━━━━━━━━━━━━━━━━━━━━ */

const DASHBOARD_PAGES: Record<string, { path: string; label: string }> = {
  dashboard: { path: "/dashboard", label: "Dashboard" },
  schedule: { path: "/dashboard/schedule", label: "Vaktplan" },
  "my-schedule": { path: "/dashboard/my-schedule", label: "Min vaktplan" },
  operations: { path: "/dashboard/operations", label: "Daglig drift" },
  people: { path: "/dashboard/people", label: "Ansatte" },
  organization: { path: "/dashboard/organization", label: "Organisasjon" },
  season: { path: "/dashboard/season", label: "Sesong" },
  handbook: { path: "/dashboard/handbook", label: "Håndbok" },
  governance: { path: "/dashboard/governance", label: "Retningslinjer" },
  "my-training": { path: "/dashboard/my-training", label: "Min opplæring" },
  reconciliation: { path: "/dashboard/reconciliation", label: "Avstemming" },
  reports: { path: "/dashboard/reports", label: "Rapporter" },
  close: { path: "/dashboard/close", label: "Dagsslutt" },
  settings: { path: "/dashboard/settings", label: "Innstillinger" },
  chat: { path: "/dashboard/chat", label: "Chat" },
  help: { path: "/dashboard/help", label: "Hjelp" },
};

const navigatePageDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "navigate_to_page",
    description:
      "Navigate the user to a different page in the dashboard. " +
      "Use when the user says 'gå til vaktplanen', 'vis ansatte', 'åpne rapporter', or similar. " +
      "Available pages: dashboard, schedule, my-schedule, operations, people, organization, " +
      "season, handbook, governance, my-training, reconciliation, reports, close, settings, chat, help. " +
      "After navigating, briefly confirm where you went.",
    dynamicParameters: [
      {
        name: "page",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description:
            "Page key: dashboard, schedule, people, operations, season, handbook, governance, etc.",
        },
        required: true,
      },
    ],
    client: {},
  },
};

/* ━━━ Memory tool — always available ━━━━━━ */

const saveMemoryDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "save_memory",
    description:
      "Save something to your persistent memory. Use this PROACTIVELY whenever you learn something " +
      "important about the user, their preferences, their team, their business, or recurring topics. " +
      "Also use when the user explicitly asks you to remember something. " +
      "Good things to save: names, roles, preferences, repeated requests, key facts about the business, " +
      "important dates, team dynamics, communication style. " +
      "Keep each memory atomic — one fact per save. Do NOT confirm to the user unless they explicitly asked you to remember.",
    dynamicParameters: [
      {
        name: "content",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "The fact or insight to remember. Be specific and concise.",
        },
        required: true,
      },
      {
        name: "topic",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description:
            "Category: 'person', 'preference', 'business', 'team', 'schedule', 'general'",
        },
        required: false,
      },
    ],
    client: {},
  },
};

/* ━━━ Task scheduling tool ━━━━━━━━━━━━━━━━ */

const scheduleTaskDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "schedule_task",
    description:
      "Schedule a task for the user. Use when the user says 'minn meg på', 'lag en oppgave', " +
      "'gjør klar en presentasjon til kl 6', 'sørg for at X er ferdig innen Y', or similar. " +
      "Creates a task with title, description, and optional due time. " +
      "Maximum 3 active tasks per user. If limit reached, tell the user to complete existing tasks first. " +
      "After scheduling, confirm briefly: 'Oppgave lagt til.'",
    dynamicParameters: [
      {
        name: "title",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Short task title, e.g. 'Forbered presentasjon'" },
        required: true,
      },
      {
        name: "description",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Longer description of what needs to be done" },
        required: false,
      },
      {
        name: "due_at",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description:
            "When the task is due. Use ISO 8601 format or natural language like '18:00', 'i morgen 09:00'. Leave empty for no deadline.",
        },
        required: false,
      },
    ],
    client: {},
  },
};

/* ━━━ Build toolkit — wired to a view actions ref ━━━ */

export function buildWalkAiToolKit(
  actionsRef: MutableRefObject<ViewActions | null>,
): ClientToolKit {
  const switchView = (type: ContentViewType, props?: Record<string, unknown>): string => {
    const actions = actionsRef.current;
    if (!actions) return "View system not ready";

    actions.switchView(type, props);
    return SILENT_INSTRUCTION;
  };

  const implementations: Record<string, ClientToolImplementation> = {
    show_visualizer: () => switchView("visualizer"),

    show_notepad: (params) =>
      switchView("notepad", {
        title: params.title ?? "",
      }),

    write_notepad: (params) => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";

      const text = String(params.text ?? "");
      if (!text) return SILENT_INSTRUCTION;
      const topic = String(params.topic ?? "Notat");

      // Open notepad if not already showing
      if (actions.currentView() !== "notepad") {
        actions.switchView("notepad");
      }

      // Create a NEW note (each write = separate note with metadata)
      actions.appendNotepad(text, topic);
      return "New note created. Confirm briefly to the user, e.g. 'Skrevet.' — but do NOT read back what you wrote.";
    },

    show_calculator: (params) =>
      switchView("calculator", {
        expression: params.expression ?? "",
      }),

    show_chat: () => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";
      actions.switchView("chat");
      return "Switched to chat view. You may speak now.";
    },

    navigate_to_page: (params) => {
      const pageKey = String(params.page ?? "")
        .toLowerCase()
        .trim();
      const page = DASHBOARD_PAGES[pageKey];

      if (!page) {
        const available = Object.keys(DASHBOARD_PAGES).join(", ");
        return `Unknown page "${pageKey}". Available: ${available}`;
      }

      // Use window.location for navigation (works outside router context)
      if (typeof window !== "undefined") {
        window.location.href = page.path;
      }

      return `Navigating to ${page.label} (${page.path}). The page will load shortly.`;
    },

    save_memory: (params) => {
      const content = String(params.content ?? "");
      if (!content) return "Nothing to save.";
      const topic = String(params.topic ?? "general");

      // Persist to DB if workspace is available
      const actions = actionsRef.current;
      const workspaceId = actions?.getWorkspaceId?.();
      if (workspaceId) {
        void fetch("/api/emma/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_id: workspaceId, content, topic }),
        }).catch(() => {
          /* Silent — fire and forget */
        });
      }

      return "Memory saved. Do NOT confirm to the user unless they explicitly asked you to remember.";
    },

    schedule_task: (params) => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";

      const title = String(params.title ?? "");
      if (!title) return "Task needs a title.";

      const description = String(params.description ?? "");
      const dueAtRaw = String(params.due_at ?? "");

      // Parse due time — support "18:00" as today at 18:00
      let dueAt: string | null = null;
      if (dueAtRaw) {
        if (/^\d{2}:\d{2}$/.test(dueAtRaw)) {
          // Time only — assume today
          const today = new Date();
          const [h, m] = dueAtRaw.split(":").map(Number);
          today.setHours(h!, m!, 0, 0);
          dueAt = today.toISOString();
        } else {
          // Try parsing as ISO or other format
          const parsed = new Date(dueAtRaw);
          if (!isNaN(parsed.getTime())) {
            dueAt = parsed.toISOString();
          }
        }
      }

      // Add to local state
      actions.scheduleTask({
        id: `task-${Date.now()}`,
        title,
        description,
        dueAt,
        status: "pending",
        createdAt: Date.now(),
      });

      // Persist to DB if workspace is available
      const workspaceId = actions.getWorkspaceId?.();
      if (workspaceId) {
        void fetch("/api/emma/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            title,
            description,
            due_at: dueAt,
          }),
        }).catch(() => {
          /* Silent — local state is primary */
        });
      }

      const timeStr = dueAt
        ? ` Frist: ${new Date(dueAt).toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" })}`
        : "";
      return `Task scheduled: "${title}".${timeStr} Confirm briefly to the user.`;
    },
  };

  return {
    definitions: [
      showVisualizerDef,
      showNotepadDef,
      writeNotepadDef,
      showCalculatorDef,
      showChatDef,
      navigatePageDef,
      saveMemoryDef,
      scheduleTaskDef,
    ],
    implementations,
  };
}
