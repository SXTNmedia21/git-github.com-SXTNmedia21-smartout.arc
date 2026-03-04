"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Send,
  MessageSquare,
  Radio,
  User,
  Bot,
  Shield,
  Eye,
  Settings,
  Clock,
  ChevronDown,
  WifiOff,
} from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { useGuardianSocket, type GuardianEvent } from "@/app/dashboard/_hooks/useGuardianSocket";

// ── Types ─────────────────────────────────────────────────

type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

type StageOption = {
  id: string;
  stage_id: string;
  stage_order: number;
  goal: string;
};

type SessionMeta = {
  mission_name: string | null;
  channel: string;
  created_at: string;
  mission_id: string | null;
};

// ── Props ─────────────────────────────────────────────────

type MissionControlPanelProps = {
  sessionId: string | null;
  onClose: () => void;
  isDark: boolean;
};

// ── Actor Colors ──────────────────────────────────────────

function getActorColor(actor: string, isDark: boolean): string {
  switch (actor) {
    case "user":
      return isDark ? "text-emerald-400" : "text-emerald-600";
    case "agent":
      return isDark ? "text-blue-400" : "text-blue-600";
    case "guardian":
      return isDark ? "text-purple-400" : "text-purple-600";
    case "admin":
      return isDark ? "text-amber-400" : "text-amber-600";
    default:
      return isDark ? "text-zinc-400" : "text-zinc-500";
  }
}

function getActorBg(actor: string, isDark: boolean): string {
  switch (actor) {
    case "user":
      return isDark ? "bg-emerald-500/10" : "bg-emerald-50";
    case "agent":
      return isDark ? "bg-blue-500/10" : "bg-blue-50";
    case "guardian":
      return isDark ? "bg-purple-500/10" : "bg-purple-50";
    case "admin":
      return isDark ? "bg-amber-500/10" : "bg-amber-50";
    default:
      return isDark ? "bg-zinc-800" : "bg-zinc-100";
  }
}

function getActorIcon(actor: string) {
  switch (actor) {
    case "user":
      return <User className="h-3 w-3" />;
    case "agent":
      return <Bot className="h-3 w-3" />;
    case "guardian":
      return <Shield className="h-3 w-3" />;
    case "admin":
      return <Eye className="h-3 w-3" />;
    default:
      return <Settings className="h-3 w-3" />;
  }
}

// ── Main Component ────────────────────────────────────────

export function MissionControlPanel({ sessionId, onClose, isDark }: MissionControlPanelProps) {
  const isOpen = sessionId !== null;
  const { connected, events, subscribe, unsubscribe, whisper, changeStage } = useGuardianSocket();

  const [tab, setTab] = useState<"events" | "conversation">("events");
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [whisperText, setWhisperText] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [historicalEvents, setHistoricalEvents] = useState<GuardianEvent[]>([]);

  const eventFeedRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  // Merge historical + live events
  const allEvents = useMemo(() => {
    const merged = [...historicalEvents, ...events];
    // Dedupe by timestamp + event_type
    const seen = new Set<string>();
    return merged.filter((e) => {
      const key = `${e.timestamp}-${e.event_type}-${e.actor}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [historicalEvents, events]);

  // ── Subscribe/Unsubscribe on sessionId change ──────────
  useEffect(() => {
    if (!sessionId || !connected) return;

    subscribe(sessionId);
    return () => {
      unsubscribe(sessionId);
    };
  }, [sessionId, connected, subscribe, unsubscribe]);

  // ── Fetch session metadata ─────────────────────────────
  useEffect(() => {
    if (!sessionId) {
      setSessionMeta(null);
      setConversation([]);
      setStages([]);
      setHistoricalEvents([]);
      return;
    }

    const supabase = createClient();

    // Fetch session + mission info
    async function fetchSessionMeta() {
      const { data } = await supabase
        .from("engine_sessions")
        .select(
          `
          id,
          channel,
          created_at,
          mission_id,
          engine_missions (name)
        `,
        )
        .eq("id", sessionId!)
        .limit(1)
        .maybeSingle();

      if (data) {
        const mission = data.engine_missions as unknown as { name: string } | null;
        setSessionMeta({
          mission_name: mission?.name ?? null,
          channel: data.channel,
          created_at: data.created_at,
          mission_id: data.mission_id,
        });
      }
    }

    // Fetch conversation from collected_data
    async function fetchConversation() {
      const { data } = await supabase
        .from("engine_sessions")
        .select("collected_data")
        .eq("id", sessionId!)
        .limit(1)
        .maybeSingle();

      if (data?.collected_data) {
        const cd = data.collected_data as Record<string, unknown>;
        const conv = cd.conversation as ConversationTurn[] | undefined;
        setConversation(conv ?? []);
      }
    }

    // Fetch historical events from guardian_log
    async function fetchHistoricalEvents() {
      const { data } = await supabase
        .from("guardian_log")
        .select("id, session_id, workspace_id, event_type, actor, summary, data, created_at")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true })
        .limit(200);

      if (data) {
        setHistoricalEvents(
          data.map((row) => ({
            type: "event" as const,
            session_id: row.session_id,
            workspace_id: row.workspace_id,
            event_type: row.event_type,
            actor: row.actor as GuardianEvent["actor"],
            summary: row.summary ?? "",
            data: (row.data as Record<string, unknown>) ?? {},
            timestamp: row.created_at,
          })),
        );
      }
    }

    // Fetch stages if session has a mission
    async function fetchStages() {
      // First get the mission_id
      const { data: sessionData } = await supabase
        .from("engine_sessions")
        .select("mission_id")
        .eq("id", sessionId!)
        .limit(1)
        .maybeSingle();

      if (!sessionData?.mission_id) {
        setStages([]);
        return;
      }

      const { data: stageData } = await supabase
        .from("engine_stages")
        .select("id, stage_id, stage_order, goal")
        .eq("mission_id", sessionData.mission_id)
        .order("stage_order", { ascending: true });

      setStages(
        (stageData ?? []).map((s) => ({
          id: s.id,
          stage_id: s.stage_id,
          stage_order: s.stage_order,
          goal: s.goal,
        })),
      );
    }

    fetchSessionMeta();
    fetchConversation();
    fetchHistoricalEvents();
    fetchStages();
  }, [sessionId]);

  // ── Refresh conversation on new message events ─────────
  useEffect(() => {
    if (!sessionId) return;

    const hasNewMessage = events.some(
      (e) =>
        e.session_id === sessionId &&
        (e.event_type === "user.message" || e.event_type === "agent.response"),
    );

    if (hasNewMessage) {
      const supabase = createClient();
      supabase
        .from("engine_sessions")
        .select("collected_data")
        .eq("id", sessionId)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.collected_data) {
            const cd = data.collected_data as Record<string, unknown>;
            const conv = cd.conversation as ConversationTurn[] | undefined;
            setConversation(conv ?? []);
          }
        });
    }
  }, [events, sessionId]);

  // ── Auto-scroll feeds ──────────────────────────────────
  useEffect(() => {
    if (tab === "events" && eventFeedRef.current) {
      eventFeedRef.current.scrollTop = eventFeedRef.current.scrollHeight;
    }
  }, [allEvents, tab]);

  useEffect(() => {
    if (tab === "conversation" && conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversation, tab]);

  // ── Escape to close ────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ── Actions ────────────────────────────────────────────
  const handleWhisper = useCallback(() => {
    if (!sessionId || !whisperText.trim()) return;
    whisper(sessionId, whisperText.trim());
    setWhisperText("");
  }, [sessionId, whisperText, whisper]);

  const handleChangeStage = useCallback(() => {
    if (!sessionId || !selectedStageId) return;
    changeStage(sessionId, selectedStageId);
    setSelectedStageId("");
  }, [sessionId, selectedStageId, changeStage]);

  // ── Elapsed time ───────────────────────────────────────
  const elapsed = useMemo(() => {
    if (!sessionMeta?.created_at) return "";
    const diff = Date.now() - new Date(sessionMeta.created_at).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return `${hours}t ${remainMinutes}m`;
  }, [sessionMeta?.created_at]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-[70] flex w-[480px] max-w-[90vw] flex-col border-l transition-transform duration-300 ease-out ${
          isDark ? "border-zinc-800 bg-[#0a0a0c]/[0.98]" : "border-zinc-200 bg-white/[0.98]"
        } shadow-[-16px_0_48px_rgba(0,0,0,0.2)] backdrop-blur-2xl ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header ──────────────────────────────────── */}
        <div
          className={`flex shrink-0 items-center justify-between border-b px-5 py-4 ${
            isDark ? "border-zinc-800" : "border-zinc-200"
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Radio
                className={`h-4 w-4 ${
                  connected
                    ? "animate-pulse text-emerald-500"
                    : isDark
                      ? "text-zinc-600"
                      : "text-zinc-300"
                }`}
              />
              <h2
                className={`truncate text-sm font-extrabold ${
                  isDark ? "text-zinc-100" : "text-zinc-800"
                }`}
              >
                {sessionMeta?.mission_name ?? "Mission Control"}
              </h2>
            </div>
            <div className="mt-1 flex items-center gap-3">
              {sessionMeta?.channel && (
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-bold capitalize ${
                    isDark
                      ? "border-zinc-700 bg-zinc-800 text-zinc-400"
                      : "border-zinc-200 bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {sessionMeta.channel}
                </span>
              )}
              {elapsed && (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {elapsed}
                </span>
              )}
              {!connected && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <WifiOff className="h-3 w-3" />
                  Frakoblet
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`ml-3 rounded-lg p-2 transition-colors ${
              isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────── */}
        <div className={`flex shrink-0 border-b ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
          <button
            onClick={() => setTab("events")}
            className={`flex-1 px-4 py-2.5 text-xs font-bold transition-colors ${
              tab === "events"
                ? isDark
                  ? "border-b-2 border-emerald-500 text-emerald-400"
                  : "border-b-2 border-emerald-500 text-emerald-600"
                : isDark
                  ? "text-zinc-500 hover:text-zinc-300"
                  : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Hendelser ({allEvents.length})
          </button>
          <button
            onClick={() => setTab("conversation")}
            className={`flex-1 px-4 py-2.5 text-xs font-bold transition-colors ${
              tab === "conversation"
                ? isDark
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "border-b-2 border-blue-500 text-blue-600"
                : isDark
                  ? "text-zinc-500 hover:text-zinc-300"
                  : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Samtale ({conversation.length})
          </button>
        </div>

        {/* ── Content ─────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "events" ? (
            <EventFeed ref={eventFeedRef} events={allEvents} isDark={isDark} />
          ) : (
            <ConversationView ref={conversationRef} turns={conversation} isDark={isDark} />
          )}
        </div>

        {/* ── Action Bar ──────────────────────────────── */}
        <div className={`shrink-0 border-t p-4 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
          {/* Whisper input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MessageSquare
                className={`absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 ${
                  isDark ? "text-zinc-500" : "text-zinc-400"
                }`}
              />
              <input
                type="text"
                value={whisperText}
                onChange={(e) => setWhisperText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleWhisper();
                  }
                }}
                placeholder="Hvisk til agenten..."
                className={`w-full rounded-lg border py-2 pr-3 pl-10 text-sm transition-colors outline-none ${
                  isDark
                    ? "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500/50"
                    : "border-zinc-200 bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 focus:border-purple-500/50"
                }`}
              />
            </div>
            <button
              onClick={handleWhisper}
              disabled={!whisperText.trim() || !connected}
              className={`rounded-lg p-2.5 transition-colors ${
                whisperText.trim() && connected
                  ? "bg-purple-500 text-white hover:bg-purple-600"
                  : isDark
                    ? "bg-zinc-800 text-zinc-600"
                    : "bg-zinc-100 text-zinc-400"
              }`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* Stage controls */}
          {stages.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(e.target.value)}
                  className={`w-full appearance-none rounded-lg border py-2 pr-8 pl-3 text-xs transition-colors outline-none ${
                    isDark
                      ? "border-zinc-700 bg-zinc-900 text-zinc-300 focus:border-amber-500/50"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 focus:border-amber-500/50"
                  }`}
                >
                  <option value="">Velg stage...</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.stage_id}>
                      {s.stage_order}. {s.goal}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className={`pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 ${
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  }`}
                />
              </div>
              <button
                onClick={handleChangeStage}
                disabled={!selectedStageId || !connected}
                className={`rounded-lg px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedStageId && connected
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : isDark
                      ? "bg-zinc-800 text-zinc-600"
                      : "bg-zinc-100 text-zinc-400"
                }`}
              >
                Endre stage
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Event Feed ────────────────────────────────────────────

import { forwardRef } from "react";

const EventFeed = forwardRef<HTMLDivElement, { events: GuardianEvent[]; isDark: boolean }>(
  function EventFeed({ events, isDark }, ref) {
    if (events.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
          <Radio className={`h-8 w-8 ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
          <p className={`text-sm font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Venter pa hendelser...
          </p>
        </div>
      );
    }

    return (
      <div ref={ref} className="flex flex-col gap-1 p-3">
        {events.map((event, i) => (
          <EventRow key={`${event.timestamp}-${i}`} event={event} isDark={isDark} />
        ))}
      </div>
    );
  },
);

function EventRow({ event, isDark }: { event: GuardianEvent; isDark: boolean }) {
  const time = new Date(event.timestamp).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const actorColor = getActorColor(event.actor, isDark);
  const actorBg = getActorBg(event.actor, isDark);

  return (
    <div
      className={`group flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors ${
        isDark ? "hover:bg-zinc-900" : "hover:bg-zinc-50"
      }`}
    >
      {/* Time */}
      <span
        className={`mt-0.5 flex-shrink-0 font-mono text-[10px] ${
          isDark ? "text-zinc-600" : "text-zinc-400"
        }`}
      >
        {time}
      </span>

      {/* Actor badge */}
      <span
        className={`mt-0.5 flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${actorColor} ${actorBg}`}
      >
        {getActorIcon(event.actor)}
        {event.actor}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={`text-xs ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{event.summary}</p>
        {event.event_type && (
          <span
            className={`mt-0.5 inline-block font-mono text-[10px] ${
              isDark ? "text-zinc-600" : "text-zinc-400"
            }`}
          >
            {event.event_type}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Conversation View ─────────────────────────────────────

const ConversationView = forwardRef<HTMLDivElement, { turns: ConversationTurn[]; isDark: boolean }>(
  function ConversationView({ turns, isDark }, ref) {
    if (turns.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
          <MessageSquare className={`h-8 w-8 ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
          <p className={`text-sm font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Ingen meldinger enna
          </p>
        </div>
      );
    }

    return (
      <div ref={ref} className="flex flex-col gap-3 p-4">
        {turns.map((turn, i) => (
          <ConversationBubble key={i} turn={turn} isDark={isDark} />
        ))}
      </div>
    );
  },
);

function ConversationBubble({ turn, isDark }: { turn: ConversationTurn; isDark: boolean }) {
  const isUser = turn.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? isDark
              ? "rounded-br-md bg-emerald-600/20 text-emerald-100"
              : "rounded-br-md bg-emerald-50 text-emerald-900"
            : isDark
              ? "rounded-bl-md bg-blue-600/20 text-blue-100"
              : "rounded-bl-md bg-blue-50 text-blue-900"
        }`}
      >
        <p className="whitespace-pre-wrap">{turn.content}</p>
      </div>
    </div>
  );
}
