"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAgent } from "@smartout/agent-sdk";
import type { AgentSession, AgentStatus } from "@smartout/agent-sdk";
import type {
  AgentIdentity,
  AgentPersona,
  AgentRank,
  ContentStackItem,
  ContentViewType,
  OrbStatus,
  PersonaRankBlend,
  VoiceTuning,
  BotssonDensity,
  BotssonNote,
  BotssonPosition,
  BotssonSize,
  BotssonState,
} from "./types";
import { DENSITY_DIMENSIONS, DEFAULT_VOICE_TUNING, DEFAULT_VOICE_ID } from "./types";
import { buildPersonaPrompt, identityLabel } from "./persona-engine";
import { buildBotssonToolKit, type ViewActions, type ScheduledTask } from "./BotssonTools";
import { SCHEDULE_TOOL_DEFINITIONS } from "@/app/dashboard/schedule/_hooks/schedule-tool-definitions";
import { useEntityDrawerOptional } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { useEmmaTelemetry, buildTelemetrySummary, type TelemetryEntry } from "./emma-awareness";
import { useRegisteredTools } from "./tool-registry";
import { useEmmaTriggeredTasks } from "./use-emma-tasks";

/* ━━━ Actions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type Action =
  | { type: "SET_DENSITY"; density: BotssonDensity }
  | { type: "SET_POSITION"; position: BotssonPosition }
  | { type: "SET_ARENA_SIZE"; size: BotssonSize }
  | { type: "SET_DRAGGING"; isDragging: boolean }
  | { type: "SET_RESIZING"; isResizing: boolean }
  | { type: "SET_ORB_STATUS"; status: OrbStatus }
  | { type: "PUSH_CONTENT"; item: ContentStackItem }
  | { type: "POP_CONTENT" }
  | { type: "CLEAR_CONTENT" }
  | { type: "SWITCH_VIEW"; item: ContentStackItem };

function reducer(state: BotssonState, action: Action): BotssonState {
  switch (action.type) {
    case "SET_DENSITY":
      return { ...state, density: action.density };
    case "SET_POSITION":
      return { ...state, position: action.position };
    case "SET_ARENA_SIZE":
      return { ...state, arenaSize: action.size };
    case "SET_DRAGGING":
      return { ...state, isDragging: action.isDragging };
    case "SET_RESIZING":
      return { ...state, isResizing: action.isResizing };
    case "SET_ORB_STATUS":
      return { ...state, orbStatus: action.status };
    case "PUSH_CONTENT":
      return { ...state, contentStack: [...state.contentStack, action.item] };
    case "POP_CONTENT":
      return { ...state, contentStack: state.contentStack.slice(0, -1) };
    case "CLEAR_CONTENT":
      return { ...state, contentStack: [] };
    case "SWITCH_VIEW":
      // Replace entire stack — agent morphs to a new view
      return { ...state, contentStack: [action.item] };
    default:
      return state;
  }
}

/* ━━━ Map agent status → orb status ━━━━━━━ */

function agentStatusToOrb(status: AgentStatus): OrbStatus {
  switch (status) {
    case "speaking":
      return "speaking";
    case "thinking":
      return "thinking";
    case "listening":
      return "listening";
    case "connecting":
      return "thinking";
    default:
      return "idle";
  }
}

/* ━━━ Context shape ━━━━━━━━━━━━━━━━━━━━━━━ */

type BotssonContextValue = {
  state: BotssonState;
  identity: AgentIdentity;
  identityDisplay: string;
  voiceTuning: VoiceTuning;
  agent: AgentSession;

  expand: () => void;
  collapse: () => void;
  goSticky: () => void;
  goImmersive: () => void;
  switchView: (type: ContentViewType, props?: Record<string, unknown>) => void;
  pushView: (type: ContentViewType, props?: Record<string, unknown>) => void;
  popView: () => void;
  activeView: ContentViewType;
  notes: BotssonNote[];
  activeNoteId: string | null;
  activeNote: BotssonNote | null;
  createNote: (topic: string, content: string, context?: string) => BotssonNote;
  updateNote: (noteId: string, content: string, topic?: string) => void;
  setActiveNote: (noteId: string | null) => void;
  /** @deprecated — use activeNote.content instead */
  notepadContent: string;
  /** @deprecated — use updateNote instead */
  setNotepadContent: (content: string) => void;
  setPosition: (pos: BotssonPosition) => void;
  setDragging: (d: boolean) => void;
  setResizing: (r: boolean) => void;
  setArenaSize: (size: BotssonSize) => void;
  setOrbStatus: (s: OrbStatus) => void;
  selectedVoice: string;
  setSelectedVoice: (voiceId: string) => void;
  setIdentity: (identity: Partial<AgentIdentity>) => void;
  setVoiceTuning: (tuning: Partial<VoiceTuning>) => void;
  telemetryEvents: TelemetryEntry[];
  clearTelemetry: () => void;
  tasks: ScheduledTask[];
  completeTask: (taskId: string) => void;
  scheduleTask: (task: ScheduledTask) => void;
  updateTask: (
    taskId: string,
    updates: Partial<Pick<ScheduledTask, "priority" | "dueAt" | "position">>,
  ) => void;
  reorderTask: (taskId: string, newPosition: number) => void;
  /** Count of unread items Emma has produced (notes, tasks) since last interaction */
  unreadCount: number;
  clearUnread: () => void;
  /** Custom agent prompt — appended to persona prompt */
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  /** The computed persona prompt (read-only) */
  personaPrompt: string;
  /** Saved arena size before settings expansion */
  preSettingsSize: BotssonSize | null;
  setPreSettingsSize: (size: BotssonSize | null) => void;
  /** Workspace ID for the current session — needed by BotssonOrbVoiceMount */
  workspaceId: string | null;
  /** ADR-0282 R1.1 — Botsson/LiveKit voice active. Shared across all density modes. */
  voiceActive: boolean;
  setVoiceActive: (active: boolean | ((prev: boolean) => boolean)) => void;
};

const BotssonContext = createContext<BotssonContextValue | null>(null);

/* ━━━ Provider ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const INITIAL_STATE: BotssonState = {
  density: "orb",
  position: { x: 24, y: 0 },
  arenaSize: { width: DENSITY_DIMENSIONS.arena.width, height: DENSITY_DIMENSIONS.arena.height },
  orbStatus: "idle",
  contentStack: [],
  isDragging: false,
  isResizing: false,
};

/** User context passed to the agent so Emma knows who she's talking to */
export type BotssonUserContext = {
  name?: string;
  role?: string;
  workspace?: string;
  department?: string;
  locale?: string;
  /** Summary of what happened last time — Emma can reference this naturally */
  lastSession?: string;
};

export function BotssonProvider({
  children,
  initialRank = "admin",
  initialPersona = "puls",
  initialBlend = 5,
  userContext,
  workspaceId,
}: {
  children: ReactNode;
  initialRank?: AgentRank;
  initialPersona?: AgentPersona;
  initialBlend?: PersonaRankBlend;
  userContext?: BotssonUserContext;
  workspaceId?: string | null;
}) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  // ── Settings persistence (localStorage) ──
  // Loads saved settings on mount, saves on every change.
  const [identity, setIdentityState] = useState<AgentIdentity>(() => {
    if (typeof window === "undefined")
      return { rank: initialRank, persona: initialPersona, blend: initialBlend };
    try {
      const saved = localStorage.getItem("emma-identity");
      if (saved) return JSON.parse(saved) as AgentIdentity;
    } catch {
      /* ignore parse errors */
    }
    return { rank: initialRank, persona: initialPersona, blend: initialBlend };
  });
  const [voiceTuning, setVoiceTuningState] = useState<VoiceTuning>(() => {
    if (typeof window === "undefined") return DEFAULT_VOICE_TUNING;
    try {
      const saved = localStorage.getItem("emma-voice-tuning");
      if (saved) return { ...DEFAULT_VOICE_TUNING, ...JSON.parse(saved) };
    } catch {
      /* ignore parse errors */
    }
    return DEFAULT_VOICE_TUNING;
  });
  const [selectedVoice, setSelectedVoiceRaw] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_VOICE_ID;
    return localStorage.getItem("emma-voice-id") ?? DEFAULT_VOICE_ID;
  });
  // ADR-0282 R1.1 — Botsson/LiveKit voice active flag. Lifted to provider so all
  // density modes (Orb, Sticky, Arena) share one session.
  const [voiceActive, setVoiceActive] = useState(false);
  const setSelectedVoice = useCallback((voiceId: string) => {
    setSelectedVoiceRaw(voiceId);
    try {
      localStorage.setItem("emma-voice-id", voiceId);
    } catch {
      /* quota */
    }
  }, []);
  const [customPrompt, setCustomPromptState] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("emma-custom-prompt") ?? "";
  });
  const [preSettingsSize, setPreSettingsSize] = useState<BotssonSize | null>(null);
  const [notes, setNotes] = useState<BotssonNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const { events: telemetryEvents, clearEvents: clearTelemetry } = useEmmaTelemetry();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const scheduleTask = useCallback(
    (task: ScheduledTask) => {
      setTasks((prev) => {
        const withDefaults = {
          ...task,
          priority: task.priority ?? ("medium" as const),
          position: task.position ?? prev.length,
        };
        return [withDefaults, ...prev];
      });
      setUnreadCount((c) => c + 1);

      // Persist to DB
      const wsId = workspaceId;
      if (wsId) {
        void fetch("/api/emma/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: wsId,
            title: task.title,
            description: task.description,
            due_at: task.dueAt,
            priority: task.priority ?? "medium",
            position: task.position,
          }),
        })
          .then(async (res) => {
            if (!res.ok) return;
            const data = (await res.json()) as { task: { id: string } };
            // Replace temp ID with DB ID
            if (data.task?.id) {
              setTasks((prev) =>
                prev.map((t) => (t.id === task.id ? { ...t, id: data.task.id } : t)),
              );
            }
          })
          .catch(() => {
            /* Silent */
          });
      }
    },
    [workspaceId],
  );

  const completeTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "done" as const } : t)));
  }, []);

  const updateTask = useCallback(
    (taskId: string, updates: Partial<Pick<ScheduledTask, "priority" | "dueAt" | "position">>) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));

      void fetch("/api/emma/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          priority: updates.priority,
          due_at: updates.dueAt,
          position: updates.position,
        }),
      }).catch(() => {
        /* Silent — local state is primary */
      });
    },
    [],
  );

  const reorderTask = useCallback((taskId: string, newPosition: number) => {
    setTasks((prev) => {
      const pending = prev.filter((t) => t.status === "pending");
      const done = prev.filter((t) => t.status !== "pending");
      const taskIdx = pending.findIndex((t) => t.id === taskId);
      if (taskIdx === -1) return prev;

      const [task] = pending.splice(taskIdx, 1);
      const clampedPos = Math.max(0, Math.min(newPosition, pending.length));
      pending.splice(clampedPos, 0, task!);

      const reordered = pending.map((t, i) => ({ ...t, position: i }));
      return [...reordered, ...done];
    });
  }, []);

  // Load persisted data from DB on mount (tasks, notes, memories)
  const [emmaMemories, setEmmaMemories] = useState<Array<{ content: string; memory_type: string }>>(
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const [tasksRes, notesRes, memoriesRes] = await Promise.allSettled([
        fetch("/api/emma/tasks?status=pending"),
        fetch("/api/emma/notes"),
        fetch("/api/emma/memory"),
      ]);

      if (cancelled) return;

      // Tasks
      if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
        const data = (await tasksRes.value.json()) as {
          tasks: Array<{
            id: string;
            title: string;
            description: string | null;
            due_at: string | null;
            priority: string;
            position: number;
            status: string;
            created_at: string;
          }>;
        };
        if (data.tasks?.length) {
          setTasks(
            data.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description ?? "",
              dueAt: t.due_at,
              priority: (t.priority as ScheduledTask["priority"]) ?? "medium",
              position: t.position ?? 0,
              status: t.status === "done" ? ("done" as const) : ("pending" as const),
              createdAt: new Date(t.created_at).getTime(),
            })),
          );
        }
      }

      // Notes
      if (notesRes.status === "fulfilled" && notesRes.value.ok) {
        const data = (await notesRes.value.json()) as {
          notes: Array<{
            id: string;
            topic: string;
            content: string;
            tags: string[];
            screen: string;
            context: string;
            created_at: string;
            updated_at: string;
          }>;
        };
        if (data.notes?.length) {
          setNotes(
            data.notes.map((n) => ({
              id: n.id,
              topic: n.topic,
              content: n.content,
              tags: n.tags ?? [],
              screen: n.screen ?? "botsson",
              context: n.context ?? "",
              createdAt: new Date(n.created_at).getTime(),
              updatedAt: new Date(n.updated_at).getTime(),
            })),
          );
          setActiveNoteId(data.notes[0]!.id);
        }
      }

      // Memories — loaded into context for Emma
      if (memoriesRes.status === "fulfilled" && memoriesRes.value.ok) {
        const data = (await memoriesRes.value.json()) as {
          memories: Array<{
            content: string;
            memory_type: string;
          }>;
        };
        if (data.memories?.length) {
          setEmmaMemories(data.memories);
        }
      }
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearUnread = useCallback(() => setUnreadCount(0), []);
  const setCustomPrompt = useCallback((prompt: string) => {
    setCustomPromptState(prompt);
    try {
      localStorage.setItem("emma-custom-prompt", prompt);
    } catch {
      /* quota */
    }
  }, []);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) ?? null,
    [notes, activeNoteId],
  );

  // Legacy compat — maps to active note content
  const notepadContent = activeNote?.content ?? "";
  const setNotepadContent = useCallback(
    (content: string) => {
      if (!activeNoteId) return;
      setNotes((prev) =>
        prev.map((n) => (n.id === activeNoteId ? { ...n, content, updatedAt: Date.now() } : n)),
      );
    },
    [activeNoteId],
  );

  const createNote = useCallback(
    (topic: string, content: string, context = "") => {
      // Strip leading markdown title if it duplicates the topic — prevents double-heading
      let cleanContent = content;
      const firstLine = content.split("\n")[0]?.trim() ?? "";
      if (firstLine.startsWith("# ")) {
        const titleFromContent = firstLine.slice(2).trim();
        if (titleFromContent.toLowerCase() === topic.toLowerCase()) {
          cleanContent = content.slice(content.indexOf("\n") + 1).trimStart();
        }
      }

      const note: BotssonNote = {
        id: `note-${Date.now()}`,
        content: cleanContent,
        topic,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        screen: "botsson",
        context,
        tags: (content.match(/@\w+/g) ?? []).map((t) => t.slice(1)),
      };
      setNotes((prev) => [note, ...prev]);
      setActiveNoteId(note.id);
      setUnreadCount((c) => c + 1);

      // Persist to DB
      const wsId = workspaceId;
      if (wsId) {
        void fetch("/api/emma/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: wsId,
            topic,
            content: cleanContent,
            tags: note.tags,
            screen: "botsson",
            context,
          }),
        })
          .then(async (res) => {
            if (!res.ok) return;
            const data = (await res.json()) as { note: { id: string } };
            // Replace temp ID with DB ID
            if (data.note?.id) {
              setNotes((prev) =>
                prev.map((n) => (n.id === note.id ? { ...n, id: data.note.id } : n)),
              );
              setActiveNoteId(data.note.id);
            }
          })
          .catch(() => {
            /* Silent */
          });
      }

      return note;
    },
    [workspaceId],
  );

  // Debounce note updates to DB (avoid spamming on every keystroke)
  const noteUpdateTimer = useRef<ReturnType<typeof setTimeout>>(null);
  // Cleanup debounce timer on unmount
  useEffect(
    () => () => {
      if (noteUpdateTimer.current) clearTimeout(noteUpdateTimer.current);
    },
    [],
  );
  const updateNote = useCallback((noteId: string, content: string, topic?: string) => {
    const tags = (content.match(/@\w+/g) ?? []).map((t) => t.slice(1));
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              content,
              ...(topic !== undefined ? { topic } : {}),
              updatedAt: Date.now(),
              tags,
            }
          : n,
      ),
    );

    // Debounced DB persist (1s after last keystroke)
    if (noteUpdateTimer.current) clearTimeout(noteUpdateTimer.current);
    noteUpdateTimer.current = setTimeout(() => {
      if (noteId.startsWith("note-")) return; // Temp ID — not yet in DB
      void fetch("/api/emma/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_id: noteId,
          content,
          ...(topic !== undefined ? { topic } : {}),
          tags,
        }),
      }).catch(() => {
        /* Silent */
      });
    }, 1000);
  }, []);

  const notepadRef = useRef(notepadContent);
  useEffect(() => {
    notepadRef.current = notepadContent;
  }, [notepadContent]);

  /* ━━━ Resolve user context (prop or playground default) ━━━ */
  const resolvedUser = useMemo(
    () =>
      userContext ?? {
        name: "Pontus",
        role: "admin",
        workspace: "Smartout",
        lastSession:
          "Dere jobbet med å sette opp voice-agenten. Pontus justerte personlighetsinnstillinger og testet notepad-verktøyet.",
      },
    [userContext],
  );

  /* ━━━ Build persona prompt for the agent ━━━ */
  const personaPrompt = useMemo(() => buildPersonaPrompt(identity), [identity]);
  const identityDisplay = useMemo(() => identityLabel(identity), [identity]);

  /* ━━━ Entity drawer bridge — lets Emma open entity panels ━━━ */
  // useEntityDrawerOptional returns null on /onboarding (no EntityDrawerProvider).
  // openEntityDrawer calls become no-ops in that context.
  const entityDrawer = useEntityDrawerOptional();

  /* ━━━ View actions ref — lets tool impls morph the view ━━━ */
  const viewActionsRef = useRef<ViewActions | null>(null);

  /* ━━━ Triggered tasks — checked on page load ━━━ */
  const { triggeredTasks, dismissTask: _dismissTask } = useEmmaTriggeredTasks();

  /* ━━━ Telemetry summary for Emma's context ━━━ */
  const telemetrySummary = useMemo(
    () => buildTelemetrySummary(telemetryEvents, 10),
    [telemetryEvents],
  );

  /* ━━━ Client tools — Emma morphs the view ━━━ */

  // Build toolkit in effect to avoid "cannot access refs during render".
  // Tool implementations read viewActionsRef.current lazily when invoked.
  const [baseTools, setBaseTools] = useState<ReturnType<typeof buildBotssonToolKit> | null>(null);
  useEffect(() => {
    setBaseTools(buildBotssonToolKit(viewActionsRef));
  }, []); // viewActionsRef is stable, only need to build once

  const registeredTools = useRegisteredTools();

  // Merge base tools + page-registered tools + schedule tool definitions (always included
  // so Ultravox knows about them at session start — implementations register dynamically)
  const botssonTools = useMemo(() => {
    const defs = [...(baseTools?.definitions ?? []), ...registeredTools.definitions];
    const impls = {
      ...(baseTools?.implementations ?? {}),
      ...registeredTools.implementations,
    };

    // Include schedule tool definitions if not already registered by the page
    // (ensures Ultravox always has the schemas, even before navigating to schedule)
    const registeredNames = new Set(
      defs.map(
        (d) => (d as { temporaryTool?: { modelToolName?: string } }).temporaryTool?.modelToolName,
      ),
    );
    for (const def of SCHEDULE_TOOL_DEFINITIONS) {
      const name = (def as { temporaryTool?: { modelToolName?: string } }).temporaryTool
        ?.modelToolName;
      if (name && !registeredNames.has(name)) {
        defs.push(def);
      }
    }

    return { definitions: defs, implementations: impls };
  }, [baseTools, registeredTools]);

  /* ━━━ Derive active view from stack ━━━ */
  const topItem = state.contentStack[state.contentStack.length - 1];
  const activeView: ContentViewType = topItem ? topItem.type : "chat";

  /* ━━━ Track current page for Emma's context ━━━ */
  const [currentPage, setCurrentPage] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/dashboard",
  );
  // Patch routerRef.push to capture navigation events without polling
  const originalPushRef = useRef<typeof router.push | null>(null);
  useEffect(() => {
    const update = () => setCurrentPage(window.location.pathname);
    window.addEventListener("popstate", update);

    // Monkey-patch router.push to detect client-side navigation
    if (!originalPushRef.current) {
      const originalPush = routerRef.current.push.bind(routerRef.current);
      originalPushRef.current = originalPush;
      routerRef.current.push = (...args: Parameters<typeof router.push>) => {
        const result = originalPush(...args);
        // Update after Next.js has processed the navigation
        setTimeout(update, 100);
        return result;
      };
    }

    return () => {
      window.removeEventListener("popstate", update);
    };
  }, []);

  /* ━━━ Voice agent — Emma via Ultravox ━━━ */
  const agent = useAgent({
    missionId: "botsson-session",
    provider: "ultravox",
    tools: botssonTools,
    apiParams: {
      voice: selectedVoice,
      language: "no",
      language_hint: "nb-NO",
      first_speaker: voiceTuning.firstSpeaker,
      context: {
        page: currentPage,
        active_view: activeView,
        density: state.density,
        persona_prompt: customPrompt
          ? `${personaPrompt}\n\n## Egendefinert instruks\n${customPrompt}`
          : personaPrompt,
        identity: {
          rank: identity.rank,
          persona: identity.persona,
          blend: identity.blend,
        },
        user: resolvedUser,
        recent_activity: telemetrySummary || undefined,
        saved_memories:
          emmaMemories.length > 0
            ? emmaMemories.slice(0, 15).map((m) => `[${m.memory_type}] ${m.content}`)
            : undefined,
        pending_missions:
          triggeredTasks.length > 0
            ? triggeredTasks.map((t) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                mission: t.mission,
                due_at: t.due_at,
              }))
            : undefined,
        voice_tuning: {
          temperature: voiceTuning.temperature,
          max_duration: voiceTuning.maxDuration,
          greeting: voiceTuning.greeting || undefined,
          inactivity_timeout: voiceTuning.inactivityTimeout,
          inactivity_message: voiceTuning.inactivityMessage,
          time_exceeded_message: voiceTuning.timeExceededMessage,
        },
      },
    },
    onStatusChange: (status) => {
      dispatch({ type: "SET_ORB_STATUS", status: agentStatusToOrb(status) });
    },
  });

  /* ━━━ Sync orb from agent status ━━━ */
  useEffect(() => {
    dispatch({ type: "SET_ORB_STATUS", status: agentStatusToOrb(agent.status) });
  }, [agent.status]);

  /* ━━━ Conversation logging — start/end sessions, log transcripts ━━━ */
  const conversationIdRef = useRef<string | null>(null);
  const prevConnected = useRef(false);
  const transcriptBuffer = useRef<Array<{ role: string; content: string }>>([]);

  const flushTranscript = useCallback((convId: string) => {
    if (transcriptBuffer.current.length === 0) return;
    const toFlush = [...transcriptBuffer.current];
    transcriptBuffer.current = [];
    void fetch("/api/emma/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "append", conversation_id: convId, entries: toFlush }),
    }).catch(() => {
      /* Silent */
    });
  }, []);

  useEffect(() => {
    const wsId = workspaceId;
    if (!wsId) return;

    // Session started
    if (agent.isConnected && !prevConnected.current) {
      void (async () => {
        try {
          const res = await fetch("/api/emma/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start", workspace_id: wsId }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as { conversation: { id: string } };
          const convId = data.conversation?.id ?? null;
          conversationIdRef.current = convId;
          // Flush any entries that were buffered while waiting for the ID
          if (convId && transcriptBuffer.current.length > 0) {
            flushTranscript(convId);
          }
        } catch {
          /* Silent */
        }
      })();
    }

    // Session ended
    if (!agent.isConnected && prevConnected.current && conversationIdRef.current) {
      const convId = conversationIdRef.current;
      flushTranscript(convId);
      void fetch("/api/emma/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", conversation_id: convId }),
      }).catch(() => {
        /* Silent */
      });
      conversationIdRef.current = null;
    }

    prevConnected.current = agent.isConnected;
  }, [agent.isConnected, workspaceId, flushTranscript]);

  // Log transcript entries from agent
  const lastTranscriptLen = useRef(0);
  useEffect(() => {
    if (!agent.isConnected || !agent.transcript) return;
    const latest = agent.transcript;
    if (latest.length === 0 || latest.length <= lastTranscriptLen.current) return;

    // Buffer only new entries since last check
    const newEntries = latest.slice(lastTranscriptLen.current);
    lastTranscriptLen.current = latest.length;

    for (const entry of newEntries) {
      transcriptBuffer.current.push({
        role: entry.role,
        content: entry.text,
      });
    }

    // Flush every 10 entries if conversation ID is available
    const convId = conversationIdRef.current;
    if (convId && transcriptBuffer.current.length >= 10) {
      flushTranscript(convId);
    }
  }, [agent.isConnected, agent.transcript]);

  // Reset transcript counter when session ends
  useEffect(() => {
    if (!agent.isConnected) lastTranscriptLen.current = 0;
  }, [agent.isConnected]);

  /* ━━━ Identity control — persisted to localStorage ━━━ */
  const setIdentity = useCallback((partial: Partial<AgentIdentity>) => {
    setIdentityState((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem("emma-identity", JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  }, []);

  const setVoiceTuning = useCallback((partial: Partial<VoiceTuning>) => {
    setVoiceTuningState((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem("emma-voice-tuning", JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  }, []);

  /* ━━━ Actions ━━━ */
  const expand = useCallback(() => dispatch({ type: "SET_DENSITY", density: "arena" }), []);
  const collapse = useCallback(() => dispatch({ type: "SET_DENSITY", density: "orb" }), []);
  const goSticky = useCallback(() => dispatch({ type: "SET_DENSITY", density: "sticky" }), []);
  const goImmersive = useCallback(
    () => dispatch({ type: "SET_DENSITY", density: "immersive" }),
    [],
  );
  const switchView = useCallback((type: ContentViewType, props: Record<string, unknown> = {}) => {
    dispatch({
      type: "SWITCH_VIEW",
      item: { id: `${type}-${Date.now()}`, type, props },
    });
  }, []);
  const pushView = useCallback((type: ContentViewType, props: Record<string, unknown> = {}) => {
    dispatch({
      type: "PUSH_CONTENT",
      item: { id: `${type}-${Date.now()}`, type, props },
    });
  }, []);
  const popView = useCallback(() => dispatch({ type: "POP_CONTENT" }), []);

  /**
   * Listen for `botsson:open` window events dispatched from elsewhere in the dashboard
   * (e.g. the "Lag kontrakt med Botsson" button on /dashboard/contracts). The event
   * carries an optional view type and prime context that we forward as the next view's
   * props. The admin-chat view reads `props.primeContext` on mount.
   *
   * Wired here in BotssonProvider rather than at the page level so any consumer of the
   * dashboard surface can fire the event without knowing about Botsson internals.
   */
  useEffect(() => {
    function handleBotssonOpen(e: Event) {
      const customEvent = e as CustomEvent<{
        view?: ContentViewType;
        primeContext?: Record<string, unknown>;
      }>;
      const view = customEvent.detail?.view ?? "admin-chat";
      const primeContext = customEvent.detail?.primeContext;

      // Bring Botsson out of orb mode so the view is visible.
      dispatch({ type: "SET_DENSITY", density: "immersive" });

      // Switch the active view, forwarding primeContext as props.
      const props: Record<string, unknown> = primeContext ? { primeContext } : {};
      dispatch({
        type: "SWITCH_VIEW",
        item: { id: `${view}-${Date.now()}`, type: view, props },
      });
    }

    window.addEventListener("botsson:open", handleBotssonOpen);
    return () => window.removeEventListener("botsson:open", handleBotssonOpen);
  }, []);

  // activeView is derived above (before useAgent) — kept here for reference

  /* ━━━ Keep view actions ref in sync for tool implementations ━━━ */
  const createNoteRef = useRef(createNote);
  const updateNoteRef = useRef(updateNote);
  const activeNoteIdRef = useRef(activeNoteId);
  const scheduleTaskRef = useRef(scheduleTask);
  useEffect(() => {
    createNoteRef.current = createNote;
  }, [createNote]);
  useEffect(() => {
    updateNoteRef.current = updateNote;
  }, [updateNote]);
  useEffect(() => {
    activeNoteIdRef.current = activeNoteId;
  }, [activeNoteId]);
  useEffect(() => {
    scheduleTaskRef.current = scheduleTask;
  }, [scheduleTask]);

  // Refs for task operations — lets tool impls call the latest version
  const completeTaskRef = useRef(completeTask);
  const updateTaskRef = useRef(updateTask);
  const reorderTaskRef = useRef(reorderTask);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    completeTaskRef.current = completeTask;
  }, [completeTask]);
  useEffect(() => {
    updateTaskRef.current = updateTask;
  }, [updateTask]);
  useEffect(() => {
    reorderTaskRef.current = reorderTask;
  }, [reorderTask]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Keep density in a ref so tool impls can read it synchronously without stale closures
  const densityRef = useRef(state.density);
  useEffect(() => {
    densityRef.current = state.density;
  }, [state.density]);

  useEffect(() => {
    viewActionsRef.current = {
      switchView,
      currentView: () => activeView,
      appendNotepad: (text: string, topic?: string) => {
        createNoteRef.current(topic ?? "Notat", text);
      },
      getNotepadContent: () => notepadRef.current,
      scheduleTask: (task) => scheduleTaskRef.current(task),
      getCurrentPage: () => (typeof window !== "undefined" ? window.location.pathname : "/"),
      getWorkspaceId: () => workspaceId ?? null,
      expandArena: () => dispatch({ type: "SET_DENSITY", density: "arena" }),
      collapseArena: () => dispatch({ type: "SET_DENSITY", density: "orb" }),
      getDensity: () => densityRef.current,
      navigateTo: (path: string) => routerRef.current.push(path),
      openEntityDrawer: (entityType: string, entityId: string) => {
        entityDrawer?.openDrawer(
          entityType as Parameters<typeof entityDrawer.openDrawer>[0],
          entityId,
        );
      },
      completeTask: (taskId: string) => completeTaskRef.current(taskId),
      updateTask: (taskId: string, updates) => updateTaskRef.current(taskId, updates),
      reorderTask: (taskId: string, newPos: number) => reorderTaskRef.current(taskId, newPos),
      getTasks: () => tasksRef.current,
    };
  }, [switchView, activeView, workspaceId, state.density, tasks, entityDrawer]);
  const setPosition = useCallback(
    (position: BotssonPosition) => dispatch({ type: "SET_POSITION", position }),
    [],
  );
  const setDragging = useCallback(
    (isDragging: boolean) => dispatch({ type: "SET_DRAGGING", isDragging }),
    [],
  );
  const setResizing = useCallback(
    (isResizing: boolean) => dispatch({ type: "SET_RESIZING", isResizing }),
    [],
  );
  const setArenaSize = useCallback(
    (size: BotssonSize) => dispatch({ type: "SET_ARENA_SIZE", size }),
    [],
  );
  const setOrbStatus = useCallback(
    (status: OrbStatus) => dispatch({ type: "SET_ORB_STATUS", status }),
    [],
  );

  const value = useMemo(
    () => ({
      state,
      identity,
      identityDisplay,
      voiceTuning,
      agent,
      expand,
      collapse,
      goSticky,
      goImmersive,
      switchView,
      pushView,
      popView,
      setPosition,
      setDragging,
      setResizing,
      setArenaSize,
      setOrbStatus,
      selectedVoice,
      setSelectedVoice,
      setIdentity,
      setVoiceTuning,
      activeView,
      notes,
      activeNoteId,
      activeNote,
      createNote,
      updateNote,
      setActiveNote: setActiveNoteId,
      notepadContent,
      setNotepadContent,
      telemetryEvents,
      clearTelemetry,
      tasks,
      completeTask,
      scheduleTask,
      updateTask,
      reorderTask,
      unreadCount,
      clearUnread,
      customPrompt,
      setCustomPrompt,
      personaPrompt,
      preSettingsSize,
      setPreSettingsSize,
      workspaceId: workspaceId ?? null,
      voiceActive,
      setVoiceActive,
    }),
    [
      state,
      identity,
      identityDisplay,
      voiceTuning,
      agent,
      selectedVoice,
      activeView,
      notes,
      activeNoteId,
      activeNote,
      createNote,
      updateNote,
      setNotepadContent,
      notepadContent,
      expand,
      collapse,
      goSticky,
      goImmersive,
      switchView,
      pushView,
      popView,
      setPosition,
      setDragging,
      setResizing,
      setArenaSize,
      setOrbStatus,
      setSelectedVoice,
      setIdentity,
      setVoiceTuning,
      telemetryEvents,
      clearTelemetry,
      tasks,
      completeTask,
      scheduleTask,
      updateTask,
      reorderTask,
      unreadCount,
      clearUnread,
      customPrompt,
      setCustomPrompt,
      personaPrompt,
      preSettingsSize,
      setPreSettingsSize,
      workspaceId,
      voiceActive,
    ],
  );

  return <BotssonContext.Provider value={value}>{children}</BotssonContext.Provider>;
}

export function useBotsson() {
  const ctx = useContext(BotssonContext);
  if (!ctx) throw new Error("useBotsson must be used within <BotssonProvider>");
  return ctx;
}
