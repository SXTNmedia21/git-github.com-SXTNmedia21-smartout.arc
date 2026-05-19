/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Botsson Client Tools                      */
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
import { emit, nonEmpty } from "@smartout/telemetry";
/* ━━━ View actions ref — set by BotssonProvider ━━━ */

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
  /** Expand arena from orb/sticky */
  expandArena: () => void;
  /** Collapse arena to orb */
  collapseArena: () => void;
  /** Current density state */
  getDensity: () => string;
  /** Client-side navigation via Next.js router — preserves Emma's session */
  navigateTo: (path: string) => void;
  /** Open the entity drawer to inspect an entity inline */
  openEntityDrawer?: (entityType: string, entityId: string) => void;
  /** Complete a task by ID */
  completeTask: (taskId: string) => void;
  /** Update task fields */
  updateTask: (
    taskId: string,
    updates: Partial<Pick<ScheduledTask, "priority" | "dueAt" | "position">>,
  ) => void;
  /** Reorder a task to a new position */
  reorderTask: (taskId: string, newPosition: number) => void;
  /** Get all current tasks (for fuzzy matching) */
  getTasks: () => ScheduledTask[];
};

export type TaskPriority = "high" | "medium" | "low";

export type ScheduledTask = {
  id: string;
  title: string;
  description: string;
  dueAt: string | null; // ISO 8601 or null for "as soon as possible"
  status: "pending" | "done";
  priority?: TaskPriority;
  position?: number;
  createdAt: number;
};

/* ━━━ Tool definitions (Ultravox temporaryTool format) ━━━ */

const SILENT_INSTRUCTION =
  "The view is now open. Do NOT speak. Stay silent and wait for the user to interact or speak. " +
  "Only speak again when the user addresses you.";

const COLLAPSE_INSTRUCTION =
  "You are now minimized to a small orb. The arena is closed. " +
  "Do NOT call expand_arena or any show_* tool unless the user explicitly asks. " +
  "Stay silent. Wait for the user to click you or speak to you.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const showTasksDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "show_tasks",
    description:
      "Open the tasks/reminders view. Use when the user says 'vis gjøremål', 'vis oppgaver', 'hva skal jeg gjøre', " +
      "'mine oppgaver', or wants to see their task list. " +
      "After opening, stay completely silent and wait. Do not speak.",
    dynamicParameters: [],
    client: {},
  },
};

const expandArenaDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "expand_arena",
    description:
      "Expand from the small orb/globe into the full arena view. " +
      "Use when you need to show content, open a tool, or when the user needs to see something. " +
      "NOTE: show_* tools already auto-expand, so you rarely need this directly. " +
      "After expanding, stay silent.",
    dynamicParameters: [],
    client: {},
  },
};

const collapseArenaDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "collapse_arena",
    description:
      "Collapse from the arena back to the small orb/globe. " +
      "Use when you are done showing content, when the user says 'lukk', 'minimer', 'gå bort', " +
      "or when the conversation is over and you should be unobtrusive. " +
      "IMPORTANT: After collapsing, do NOT call expand_arena or any show_* tool. Stay completely silent. " +
      "Only expand again if the user explicitly asks.",
    dynamicParameters: [],
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
  // SM-9: organization redirects to settings#struktur-overview; label kept for user display
  organization: { path: "/dashboard/settings#struktur-overview", label: "Organisasjon" },
  season: { path: "/dashboard/year-wheel", label: "Årshjul" },
  handbook: { path: "/dashboard/handbook", label: "Håndbok" },
  governance: { path: "/dashboard/governance", label: "Retningslinjer" },
  "my-training": { path: "/dashboard/my-training", label: "Min opplæring" },
  reconciliation: { path: "/dashboard/reconciliation", label: "Avstemming" },
  reports: { path: "/dashboard/reports", label: "Rapporter" },
  close: { path: "/dashboard/close", label: "Dagsslutt" },
  settings: { path: "/dashboard/settings", label: "Innstillinger" },
  komm: { path: "/dashboard/komm", label: "Kommunikasjon" },
  help: { path: "/dashboard/help", label: "Hjelp" },
};

const navigatePageDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "navigate_to_page",
    description:
      "Navigate the user to a different page in the dashboard. " +
      "Use when the user says 'gå til vaktplanen', 'vis ansatte', 'åpne rapporter', or similar. " +
      "Available pages: dashboard, schedule, my-schedule, operations, people, organization, " +
      "season, handbook, governance, my-training, reconciliation, reports, close, settings, komm, help. " +
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

/* ━━━ Entity drawer — inspect entities inline ━━━ */

const VALID_ENTITY_TYPES = new Set([
  "department",
  "profile",
  "team",
  "shift",
  "department_session",
  "cascade_task",
]);

const openEntityDrawerDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "open_entity_drawer",
    description:
      "Open the entity drawer to show details about a specific entity (department, employee, shift, etc.) " +
      "without navigating away from the current page. Use when the user asks about a specific entity and " +
      "you want to show its details inline. " +
      "Valid entity types: department, profile, shift, department_session, team, cascade_task.",
    dynamicParameters: [
      {
        name: "entity_type",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description:
            "Entity type: department, profile, shift, department_session, team, cascade_task",
        },
        required: true,
      },
      {
        name: "entity_id",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "UUID of the entity to inspect",
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
      {
        name: "priority",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Priority: 'high', 'medium', or 'low'. Default: medium.",
        },
        required: false,
      },
      {
        name: "position",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "number",
          description: "Position in the task list (1 = first). Default: last.",
        },
        required: false,
      },
    ],
    client: {},
  },
};

/* ━━━ Task management tools ━━━━━━━━━━━━━━━ */

const completeTaskDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "complete_task",
    description:
      "Mark a task as done. Use when the user says 'fullfør oppgaven', 'den er ferdig', " +
      "'marker som ferdig', or similar. Matches by partial title.",
    dynamicParameters: [
      {
        name: "title",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "The task title or a partial match, e.g. 'presentasjon'",
        },
        required: true,
      },
    ],
    client: {},
  },
};

const setTaskPriorityDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "set_task_priority",
    description:
      "Set priority on a task. Use when the user says 'sett høy prioritet på', " +
      "'den er viktig', 'nedprioritér', or similar.",
    dynamicParameters: [
      {
        name: "title",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Task title or partial match" },
        required: true,
      },
      {
        name: "priority",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Priority level: 'high', 'medium', or 'low'",
        },
        required: true,
      },
    ],
    client: {},
  },
};

const setTaskDeadlineDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "set_task_deadline",
    description:
      "Set or change the deadline on a task. Use when the user says 'sett frist', " +
      "'den må være ferdig innen', 'deadline er', or similar.",
    dynamicParameters: [
      {
        name: "title",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Task title or partial match" },
        required: true,
      },
      {
        name: "deadline",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "string",
          description: "Deadline as ISO 8601, 'HH:MM' (today), or natural like 'i morgen 09:00'",
        },
        required: true,
      },
    ],
    client: {},
  },
};

const reorderTaskDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "reorder_task",
    description:
      "Move a task to a new position in the list. Use when the user says 'flytt til toppen', " +
      "'legg den først', 'flytt ned', or similar. Position is 1-based (1 = first).",
    dynamicParameters: [
      {
        name: "title",
        location: "PARAMETER_LOCATION_BODY",
        schema: { type: "string", description: "Task title or partial match" },
        required: true,
      },
      {
        name: "position",
        location: "PARAMETER_LOCATION_BODY",
        schema: {
          type: "number",
          description: "New position (1 = first in list)",
        },
        required: true,
      },
    ],
    client: {},
  },
};

/* ━━━ Fuzzy task title matching for voice tools ━━━ */

function findTaskByTitle(tasks: ScheduledTask[], query: string): ScheduledTask | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const pending = tasks.filter((t) => t.status === "pending");
  const exact = pending.find((t) => t.title.toLowerCase() === q);
  if (exact) return exact;
  const partial = pending.find((t) => t.title.toLowerCase().includes(q));
  return partial ?? null;
}

/* ━━━ Build toolkit — wired to a view actions ref ━━━ */

export function buildBotssonToolKit(
  actionsRef: MutableRefObject<ViewActions | null>,
): ClientToolKit {
  const switchView = (type: ContentViewType, props?: Record<string, unknown>): string => {
    const actions = actionsRef.current;
    if (!actions) return "View system not ready";

    // Auto-expand from orb/sticky when switching to a content view
    const density = actions.getDensity();
    if (density === "orb" || density === "sticky") {
      actions.expandArena();
    }

    actions.switchView(type, props);
    return `View switched to "${type}". ${SILENT_INSTRUCTION}`;
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

    show_tasks: () => switchView("tasks"),

    expand_arena: () => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";
      const density = actions.getDensity();
      if (density === "arena" || density === "immersive") {
        return `Already expanded (density: ${density}). Current view: "${actions.currentView()}". No action taken.`;
      }
      actions.expandArena();
      return `Expanded to arena. Current view: "${actions.currentView()}". ${SILENT_INSTRUCTION}`;
    },

    collapse_arena: () => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";
      const density = actions.getDensity();
      if (density === "orb") {
        return "Already minimized. No action taken. Stay silent.";
      }
      actions.collapseArena();
      return COLLAPSE_INSTRUCTION;
    },

    show_chat: () => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";

      const currentView = actions.currentView();
      if (currentView === "chat") {
        return "Already showing chat view. No action taken. You may speak.";
      }

      // Auto-expand if minimized
      const density = actions.getDensity();
      if (density === "orb" || density === "sticky") {
        actions.expandArena();
      }

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

      const actions = actionsRef.current;
      if (actions?.navigateTo) {
        actions.navigateTo(page.path);
      } else if (typeof window !== "undefined") {
        window.location.href = page.path;
      }

      return (
        `Navigated to ${page.label}. The user is now on page: ${page.path}. ` +
        "You can see and discuss what's on this page. " +
        "Do NOT offer to navigate again — you are already there."
      );
    },

    open_entity_drawer: (params) => {
      const actions = actionsRef.current;
      if (!actions?.openEntityDrawer) return "Entity drawer not available";

      const entityType = String(params.entity_type ?? "").trim();
      const entityId = String(params.entity_id ?? "").trim();

      if (!VALID_ENTITY_TYPES.has(entityType)) {
        const valid = [...VALID_ENTITY_TYPES].join(", ");
        return `Unknown entity type "${entityType}". Valid: ${valid}`;
      }
      if (!entityId) return "entity_id is required";

      if (!UUID_RE.test(entityId)) {
        return (
          `entity_id "${entityId}" is not a valid UUID. ` +
          "Use search_profiles_by_name to find the correct profile_id first, " +
          "then call open_entity_drawer with the UUID."
        );
      }

      actions.openEntityDrawer(entityType, entityId);

      return (
        `Opened entity drawer for ${entityType} ${entityId}. ` +
        "The user can now see the entity details in the side panel. " +
        "Do NOT describe what is in the drawer — the user can see it."
      );
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

      const priority = String(params.priority ?? "medium") as TaskPriority;
      const position = params.position !== undefined ? Number(params.position) - 1 : undefined;

      // Add to local state
      actions.scheduleTask({
        id: `task-${Date.now()}`,
        title,
        description,
        dueAt,
        status: "pending",
        priority: (["high", "medium", "low"] as const).includes(priority) ? priority : "medium",
        position: position !== undefined && !isNaN(position) ? position : undefined,
        createdAt: Date.now(),
      });

      // Telemetry
      void emit({
        event: "emma_task scheduled",
        workspace_id: nonEmpty(actions.getWorkspaceId?.(), "workspace_id"),
        actor_id: nonEmpty("", "actor_id"),
        properties: {
          data: { title, priority, has_deadline: !!dueAt },
        },
      });

      // DB persistence handled by scheduleTask in BotssonProvider

      const timeStr = dueAt
        ? ` Frist: ${new Date(dueAt).toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" })}`
        : "";
      return `Task scheduled: "${title}".${timeStr} Confirm briefly to the user.`;
    },

    complete_task: (params) => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";
      const title = String(params.title ?? "");
      const allTasks = actions.getTasks();
      const task = findTaskByTitle(allTasks, title);
      if (!task) return `Fant ingen ventende oppgave med "${title}".`;
      actions.completeTask(task.id);
      void emit({
        event: "emma_task completed",
        workspace_id: nonEmpty(actions.getWorkspaceId?.(), "workspace_id"),
        actor_id: nonEmpty("", "actor_id"),
        properties: {
          data: { task_id: task.id, title: task.title },
        },
      });
      return `Fullført: "${task.title}". Bekreft kort til brukeren.`;
    },

    set_task_priority: (params) => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";
      const title = String(params.title ?? "");
      const priority = String(params.priority ?? "medium") as TaskPriority;
      if (!["high", "medium", "low"].includes(priority)) {
        return `Invalid priority "${priority}". Use: high, medium, low.`;
      }
      const allTasks = actions.getTasks();
      const task = findTaskByTitle(allTasks, title);
      if (!task) return `Fant ingen ventende oppgave med "${title}".`;
      actions.updateTask(task.id, { priority });
      const labels: Record<TaskPriority, string> = { high: "høy", medium: "middels", low: "lav" };
      return `Satt prioritet ${labels[priority]} på "${task.title}". Bekreft kort.`;
    },

    set_task_deadline: (params) => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";
      const title = String(params.title ?? "");
      const deadlineRaw = String(params.deadline ?? "");
      if (!deadlineRaw) return "Deadline mangler.";

      let parsedDueAt: string | null = null;
      if (/^\d{2}:\d{2}$/.test(deadlineRaw)) {
        const today = new Date();
        const [h, m] = deadlineRaw.split(":").map(Number);
        today.setHours(h!, m!, 0, 0);
        parsedDueAt = today.toISOString();
      } else {
        const parsed = new Date(deadlineRaw);
        if (!isNaN(parsed.getTime())) parsedDueAt = parsed.toISOString();
      }
      if (!parsedDueAt) return `Kunne ikke tolke frist: "${deadlineRaw}".`;

      const allTasks = actions.getTasks();
      const task = findTaskByTitle(allTasks, title);
      if (!task) return `Fant ingen ventende oppgave med "${title}".`;
      actions.updateTask(task.id, { dueAt: parsedDueAt });
      const timeStr = new Date(parsedDueAt).toLocaleTimeString("no", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `Frist satt til ${timeStr} på "${task.title}". Bekreft kort.`;
    },

    reorder_task: (params) => {
      const actions = actionsRef.current;
      if (!actions) return "View system not ready";
      const title = String(params.title ?? "");
      const pos = Number(params.position ?? 1);
      if (isNaN(pos) || pos < 1) return "Posisjon må være minst 1.";

      const allTasks = actions.getTasks();
      const task = findTaskByTitle(allTasks, title);
      if (!task) return `Fant ingen ventende oppgave med "${title}".`;
      actions.reorderTask(task.id, pos - 1);
      return `Flyttet "${task.title}" til posisjon ${pos}. Bekreft kort.`;
    },
  };

  return {
    definitions: [
      showVisualizerDef,
      showNotepadDef,
      writeNotepadDef,
      showCalculatorDef,
      showTasksDef,
      showChatDef,
      expandArenaDef,
      collapseArenaDef,
      navigatePageDef,
      openEntityDrawerDef,
      saveMemoryDef,
      scheduleTaskDef,
      completeTaskDef,
      setTaskPriorityDef,
      setTaskDeadlineDef,
      reorderTaskDef,
    ],
    implementations,
  };
}
