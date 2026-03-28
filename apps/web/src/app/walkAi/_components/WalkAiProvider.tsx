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
  WalkAiDensity,
  WalkAiNote,
  WalkAiPosition,
  WalkAiSize,
  WalkAiState,
} from "./types";
import { DENSITY_DIMENSIONS, DEFAULT_VOICE_TUNING, DEFAULT_VOICE_ID } from "./types";
import { buildPersonaPrompt, identityLabel } from "./persona-engine";
import { buildWalkAiToolKit, type ViewActions, type ScheduledTask } from "./walkai-tools";
import { useEntityDrawer } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { useEmmaTelemetry, buildTelemetrySummary, type TelemetryEntry } from "./emma-awareness";
import { useRegisteredTools } from "./tool-registry";
import { useEmmaTriggeredTasks } from "./use-emma-tasks";

/* ━━━ Actions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type Action =
  | { type: "SET_DENSITY"; density: WalkAiDensity }
  | { type: "SET_POSITION"; position: WalkAiPosition }
  | { type: "SET_ARENA_SIZE"; size: WalkAiSize }
  | { type: "SET_DRAGGING"; isDragging: boolean }
  | { type: "SET_RESIZING"; isResizing: boolean }
  | { type: "SET_ORB_STATUS"; status: OrbStatus }
  | { type: "PUSH_CONTENT"; item: ContentStackItem }
  | { type: "POP_CONTENT" }
  | { type: "CLEAR_CONTENT" }
  | { type: "SWITCH_VIEW"; item: ContentStackItem };

function reducer(state: WalkAiState, action: Action): WalkAiState {
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

type WalkAiContextValue = {
  state: WalkAiState;
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
  notes: WalkAiNote[];
  activeNoteId: string | null;
  activeNote: WalkAiNote | null;
  createNote: (topic: string, content: string, context?: string) => WalkAiNote;
  updateNote: (noteId: string, content: string, topic?: string) => void;
  setActiveNote: (noteId: string | null) => void;
  /** @deprecated — use activeNote.content instead */
  notepadContent: string;
  /** @deprecated — use updateNote instead */
  setNotepadContent: (content: string) => void;
  setPosition: (pos: WalkAiPosition) => void;
  setDragging: (d: boolean) => void;
  setResizing: (r: boolean) => void;
  setArenaSize: (size: WalkAiSize) => void;
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
  preSettingsSize: WalkAiSize | null;
  setPreSettingsSize: (size: WalkAiSize | null) => void;
};

const WalkAiContext = createContext<WalkAiContextValue | null>(null);

/* ━━━ Provider ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const INITIAL_STATE: WalkAiState = {
  density: "orb",
  position: { x: 24, y: 0 },
  arenaSize: { width: DENSITY_DIMENSIONS.arena.width, height: DENSITY_DIMENSIONS.arena.height },
  orbStatus: "idle",
  contentStack: [],
  isDragging: false,
  isResizing: false,
};

/** User context passed to the agent so Emma knows who she's talking to */
export type WalkAiUserContext = {
  name?: string;
  role?: string;
  workspace?: string;
  department?: string;
  locale?: string;
  /** Summary of what happened last time — Emma can reference this naturally */
  lastSession?: string;
};

export function WalkAiProvider({
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
  userContext?: WalkAiUserContext;
  workspaceId?: string | null;
}) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [identity, setIdentityState] = useState<AgentIdentity>({
    rank: initialRank,
    persona: initialPersona,
    blend: initialBlend,
  });
  const [voiceTuning, setVoiceTuningState] = useState<VoiceTuning>(DEFAULT_VOICE_TUNING);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE_ID);
  const [customPrompt, setCustomPromptState] = useState("");
  const [preSettingsSize, setPreSettingsSize] = useState<WalkAiSize | null>(null);
  const [notes, setNotes] = useState<WalkAiNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const { events: telemetryEvents, clearEvents: clearTelemetry } = useEmmaTelemetry();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const scheduleTask = useCallback((task: ScheduledTask) => {
    setTasks((prev) => [task, ...prev]);
    setUnreadCount((c) => c + 1);
  }, []);

  const completeTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "done" as const } : t)));
  }, []);

  const updateTask = useCallback(
    (taskId: string, updates: Partial<Pick<ScheduledTask, "priority" | "dueAt" | "position">>) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
    },
    [],
  );

  const reorderTask = useCallback((taskId: string, newPosition: number) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task) return prev;
      const without = prev.filter((t) => t.id !== taskId);
      without.splice(newPosition, 0, { ...task, position: newPosition });
      return without.map((t, i) => ({ ...t, position: i }));
    });
  }, []);

  const clearUnread = useCallback(() => setUnreadCount(0), []);
  const setCustomPrompt = useCallback((prompt: string) => setCustomPromptState(prompt), []);

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

  const createNote = useCallback((topic: string, content: string, context = "") => {
    const note: WalkAiNote = {
      id: `note-${Date.now()}`,
      content,
      topic,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      screen: "walkai",
      context,
      tags: (content.match(/@\w+/g) ?? []).map((t) => t.slice(1)),
    };
    setNotes((prev) => [note, ...prev]);
    setActiveNoteId(note.id);
    setUnreadCount((c) => c + 1);
    return note;
  }, []);

  const updateNote = useCallback((noteId: string, content: string, topic?: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              content,
              ...(topic !== undefined ? { topic } : {}),
              updatedAt: Date.now(),
              tags: (content.match(/@\w+/g) ?? []).map((t) => t.slice(1)),
            }
          : n,
      ),
    );
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
  const { openDrawer } = useEntityDrawer();

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
  const [baseTools, setBaseTools] = useState<ReturnType<typeof buildWalkAiToolKit> | null>(null);
  useEffect(() => {
    setBaseTools(buildWalkAiToolKit(viewActionsRef));
  }, []); // viewActionsRef is stable, only need to build once

  const registeredTools = useRegisteredTools();

  // Merge base tools + page-registered tools
  const walkAiTools = useMemo(
    () =>
      baseTools
        ? {
            definitions: [...baseTools.definitions, ...registeredTools.definitions],
            implementations: {
              ...baseTools.implementations,
              ...registeredTools.implementations,
            },
          }
        : {
            definitions: registeredTools.definitions,
            implementations: registeredTools.implementations,
          },
    [baseTools, registeredTools],
  );

  /* ━━━ Voice agent — Emma via Ultravox ━━━ */
  const agent = useAgent({
    missionId: "walkai-session",
    provider: "ultravox",
    tools: walkAiTools,
    apiParams: {
      voice: selectedVoice,
      language: "no",
      language_hint: "nb-NO",
      first_speaker: voiceTuning.firstSpeaker,
      context: {
        page: "dashboard.walkai",
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

  /* ━━━ Identity control ━━━ */
  const setIdentity = useCallback((partial: Partial<AgentIdentity>) => {
    setIdentityState((prev) => ({ ...prev, ...partial }));
  }, []);

  const setVoiceTuning = useCallback((partial: Partial<VoiceTuning>) => {
    setVoiceTuningState((prev) => ({ ...prev, ...partial }));
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

  /* ━━━ Derive active view from stack ━━━ */
  const topItem = state.contentStack[state.contentStack.length - 1];
  const activeView: ContentViewType = topItem ? topItem.type : "chat";

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
      getDensity: () => state.density,
      navigateTo: (path: string) => {
        if (typeof window !== "undefined") window.location.href = path;
      },
      openEntityDrawer: (entityType: string, entityId: string) => {
        openDrawer(entityType as Parameters<typeof openDrawer>[0], entityId);
      },
      completeTask: (taskId: string) => {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "done" as const } : t)),
        );
      },
      updateTask: (taskId, updates) => {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
      },
      reorderTask: (taskId, newPosition) => {
        setTasks((prev) => {
          const task = prev.find((t) => t.id === taskId);
          if (!task) return prev;
          const without = prev.filter((t) => t.id !== taskId);
          without.splice(newPosition, 0, { ...task, position: newPosition });
          return without.map((t, i) => ({ ...t, position: i }));
        });
      },
      getTasks: () => tasks,
    };
  }, [switchView, activeView, workspaceId, state.density, tasks, openDrawer]);
  const setPosition = useCallback(
    (position: WalkAiPosition) => dispatch({ type: "SET_POSITION", position }),
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
    (size: WalkAiSize) => dispatch({ type: "SET_ARENA_SIZE", size }),
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
    ],
  );

  return <WalkAiContext.Provider value={value}>{children}</WalkAiContext.Provider>;
}

export function useWalkAi() {
  const ctx = useContext(WalkAiContext);
  if (!ctx) throw new Error("useWalkAi must be used within <WalkAiProvider>");
  return ctx;
}
