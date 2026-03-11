"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWalkAi } from "./WalkAiProvider";
import { EASING } from "./types";
import { PERSONAS } from "./persona-engine";
import type { ContentViewType } from "./types";
import type { ScheduledTask } from "./walkai-tools";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  WalkAi Arena — Premium floating card      */
/*                                             */
/*  Profile header with Emma + dropdown menu. */
/*  Tools bloom FAB (bottom-left).            */
/*  Settings / reminders / tasks via Emma.    */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type DragHandleProps = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
};

/* ━━━ Emma Menu — click avatar to configure ━━━ */

function EmmaMenu({ onClose }: { onClose: () => void }) {
  const { switchView } = useWalkAi();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [onClose]);

  const items = [
    {
      id: "settings" as ContentViewType,
      label: "Agent-innstillinger",
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M6.5 1.5L6 3.5L4.5 4.5L2.5 4L1.5 5.5L3 7L3 9L1.5 10.5L2.5 12L4.5 11.5L6 12.5L6.5 14.5H9.5L10 12.5L11.5 11.5L13.5 12L14.5 10.5L13 9L13 7L14.5 5.5L13.5 4L11.5 4.5L10 3.5L9.5 1.5H6.5Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      ),
    },
    {
      id: "tasks" as ContentViewType,
      label: "Påminnelser & gjøremål",
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6V9L2 11H14L12.5 9V6C12.5 3.5 10.5 1.5 8 1.5Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M6 11V12C6 13.1 6.9 14 8 14C9.1 14 10 13.1 10 12V11"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      ),
    },
  ];

  return (
    <div
      ref={menuRef}
      className="bg-popover/95 border-border/40 absolute top-full left-0 z-40 mt-1.5 w-52 rounded-xl border p-1 shadow-xl backdrop-blur-xl"
      style={{ animation: `walkai-fade-in 120ms ${EASING}` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            switchView(item.id);
            onClose();
          }}
          className="text-foreground/80 hover:bg-accent/60 hover:text-foreground flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors duration-100"
        >
          <span className="text-muted-foreground/60">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ━━━ Header — Emma's profile + status + menu ━━━ */

function ArenaHeader({ dragHandleProps }: { dragHandleProps?: DragHandleProps }) {
  const { collapse, agent, identity } = useWalkAi();
  const personaName = PERSONAS[identity.persona].name;
  const [menuOpen, setMenuOpen] = useState(false);

  const statusText = agent.isConnected
    ? agent.isSpeaking
      ? "Snakker"
      : agent.status === "thinking" || agent.status === "connecting"
        ? "Tenker..."
        : agent.status === "listening"
          ? "Lytter"
          : "Tilkoblet"
    : "Ikke tilkoblet";

  const statusColor = agent.isConnected
    ? agent.isSpeaking
      ? "bg-brand-orange"
      : "bg-emerald-500"
    : "bg-muted-foreground/30";

  return (
    <div
      className="border-border/20 flex animate-[walkai-slide-down_250ms_ease-out_forwards] cursor-grab items-center gap-3 border-b px-4 py-3 opacity-0 active:cursor-grabbing"
      {...dragHandleProps}
    >
      {/* Avatar — click to open Emma menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          onPointerDown={(e) => e.stopPropagation()}
          className="group relative"
        >
          <div className="from-brand-orange/80 to-brand-orange/40 group-hover:ring-brand-orange/20 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br transition-all duration-150 group-hover:ring-2">
            <span className="text-xs font-semibold text-white/90">E</span>
          </div>
          <div
            className={`border-card absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 ${statusColor} transition-colors duration-300`}
          >
            {agent.isConnected && agent.isSpeaking && (
              <div className="bg-brand-orange/40 absolute inset-0 animate-ping rounded-full" />
            )}
          </div>
        </button>
        {menuOpen && <EmmaMenu onClose={() => setMenuOpen(false)} />}
      </div>

      {/* Name + status */}
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm leading-tight font-medium">
          Emma
          <span className="text-muted-foreground/50 ml-1.5 text-[11px] font-normal">
            {personaName}
          </span>
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-muted-foreground/60 text-[10px]">{statusText}</span>
          {agent.isConnected && agent.isSpeaking && (
            <div className="ml-0.5 flex items-center gap-[2px]" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-brand-orange/60 w-[2px] animate-[walkai-bar_0.8s_ease-in-out_infinite] rounded-full"
                  style={{ height: 4 + i * 2, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Collapse */}
      <button
        onClick={collapse}
        onPointerDown={(e) => e.stopPropagation()}
        className="text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/50 flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-150"
        aria-label="Minimer"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path
            d="M3 5L7 9L11 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

/* ━━━ Tools FAB — bloom icons from bottom-left ━━━ */

type ToolDef = { id: ContentViewType; icon: React.ReactNode; label: string };

const TOOLS: ToolDef[] = [
  {
    id: "visualizer",
    label: "Voice",
    icon: (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2C8.34 2 7 3.34 7 5V10C7 11.66 8.34 13 10 13C11.66 13 13 11.66 13 10V5C13 3.34 11.66 2 10 2Z"
          fill="currentColor"
        />
        <path
          d="M15 10C15 12.76 12.76 15 10 15C7.24 15 5 12.76 5 10H3C3 13.53 5.61 16.43 9 16.92V19H11V16.92C14.39 16.43 17 13.53 17 10H15Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "notepad",
    label: "Notepad",
    icon: (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <path
          d="M5 3H15V17H5V3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 7H12M8 10H12M8 13H10"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "tasks",
    label: "Gjøremål",
    icon: (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 5L6 7L9 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 5.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M4 10L6 12L9 9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 10.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M4 15L6 17L9 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 15.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "calculator",
    label: "Kalkulator",
    icon: (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <rect x="4" y="3" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M7 6H13M7 10H9M11 10H13M7 13H9M11 13H13"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const BLOOM_SPACING = 38;

function ToolsFab() {
  const { switchView, activeView } = useWalkAi();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 300);
  };

  return (
    <div
      className="absolute bottom-2.5 left-2.5 z-20"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      data-walkai-no-drag
    >
      {TOOLS.map((tool, i) => (
        <button
          key={tool.id}
          onClick={() => {
            switchView(tool.id);
            setOpen(false);
          }}
          aria-label={tool.label}
          className={[
            "absolute left-0 flex h-8 w-8 items-center justify-center rounded-full transition-all",
            activeView === tool.id
              ? "bg-brand-orange/15 text-brand-orange"
              : "bg-card text-muted-foreground hover:text-foreground hover:bg-accent",
            open
              ? "border-border/30 scale-100 border opacity-100 shadow-md"
              : "pointer-events-none scale-50 opacity-0",
          ].join(" ")}
          style={{
            bottom: open ? (i + 1) * BLOOM_SPACING : 0,
            transitionDuration: open ? `${150 + i * 40}ms` : "120ms",
            transitionTimingFunction: EASING,
            transitionDelay: open ? `${i * 30}ms` : "0ms",
          }}
        >
          {tool.icon}
        </button>
      ))}

      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "relative flex h-8 w-8 animate-[walkai-pop-in_300ms_ease-out_180ms_forwards] items-center justify-center rounded-full opacity-0 transition-all duration-200",
          open
            ? "bg-accent text-foreground rotate-45"
            : "text-muted-foreground/0 hover:text-muted-foreground/50",
        ].join(" ")}
        aria-label="Verktoy"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/* ━━━ Voice controls footer ━━━ */

function VoiceControls() {
  const { agent, state } = useWalkAi();
  const isCompact = state.arenaSize.width < 400;

  // Mute = end session (dvala). No inactivity prompts, no "er du fortsatt der?"
  const handleSleep = useCallback(() => {
    agent.endSession();
  }, [agent]);

  return (
    <div
      className="border-border/20 animate-[walkai-slide-up_220ms_ease-out_120ms_forwards] border-t px-3 py-2.5 opacity-0"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-center gap-2.5">
        {!agent.isConnected ? (
          <button
            onClick={() => void agent.startSession()}
            className={[
              "bg-brand-orange shadow-brand-orange/25 flex items-center justify-center rounded-full text-white shadow-md transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95",
              isCompact ? "h-9 w-9" : "h-10 w-10",
            ].join(" ")}
            aria-label="Start samtale"
          >
            <MicIcon size={isCompact ? 15 : 17} />
          </button>
        ) : (
          <>
            {/* Sleep button — ends session cleanly, no inactivity prompts */}
            <button
              onClick={handleSleep}
              className="bg-muted/60 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150"
              aria-label="Dvala"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13.5 8.5C13.5 11.5 11 14 8 14C5 14 2.5 11.5 2.5 8.5C2.5 5.8 4.5 3.5 7 3C6.5 4 6.5 5.5 7.5 7C8.5 8.5 10.5 9 12 8C12.8 8.2 13.5 8.5 13.5 8.5Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Mic — active session indicator + end */}
            <button
              onClick={agent.endSession}
              className={[
                "flex items-center justify-center rounded-full transition-all duration-200 hover:scale-105 active:scale-95",
                isCompact ? "h-9 w-9" : "h-10 w-10",
                "bg-brand-orange shadow-brand-orange/25 text-white shadow-md",
              ].join(" ")}
              aria-label="Avslutt"
            >
              <MicIcon size={isCompact ? 15 : 17} />
            </button>

            {agent.isSpeaking && (
              <div className="flex items-center gap-[2px]" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-brand-orange/50 w-[2px] animate-[walkai-bar_0.8s_ease-in-out_infinite] rounded-full"
                    style={{ height: 5 + i * 2, animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ━━━ SVG Icons ━━━ */

function MicIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2C8.34 2 7 3.34 7 5V10C7 11.66 8.34 13 10 13C11.66 13 13 11.66 13 10V5C13 3.34 11.66 2 10 2Z"
        fill="currentColor"
      />
      <path
        d="M15 10C15 12.76 12.76 15 10 15C7.24 15 5 12.76 5 10H3C3 13.53 5.61 16.43 9 16.92V19H11V16.92C14.39 16.43 17 13.53 17 10H15Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ━━━ View: Visualizer (voice-first, default) ━━━ */

function VisualizerView() {
  const { agent, state } = useWalkAi();
  const isCompact = state.arenaSize.height < 400;

  return (
    <div className="flex h-full flex-col items-center justify-center" data-walkai-content>
      <div
        className="relative flex items-center justify-center"
        style={{ width: isCompact ? 80 : 120, height: isCompact ? 80 : 120 }}
      >
        <div
          className={[
            "absolute animate-[walkai-breathe_3s_ease-in-out_infinite] rounded-full border",
            isCompact ? "h-20 w-20" : "h-28 w-28",
            agent.isSpeaking ? "border-brand-orange/25" : "border-brand-orange/12",
          ].join(" ")}
          aria-hidden
        />
        <div
          className={[
            "absolute animate-[walkai-breathe_3s_ease-in-out_infinite_0.5s] rounded-full border",
            isCompact ? "h-14 w-14" : "h-20 w-20",
            "border-brand-orange/8",
          ].join(" ")}
          aria-hidden
        />

        <div
          className={[
            "relative flex items-center justify-center rounded-full transition-all duration-300",
            isCompact ? "h-10 w-10" : "h-14 w-14",
            agent.isSpeaking
              ? "bg-brand-orange/20 scale-110"
              : agent.isConnected
                ? "bg-brand-orange/8"
                : "bg-muted/40",
          ].join(" ")}
        >
          {agent.isSpeaking ? (
            <div className="flex items-center gap-[3px]" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-brand-orange w-[3px] animate-[walkai-bar_0.8s_ease-in-out_infinite] rounded-full"
                  style={{
                    height: (isCompact ? 6 : 8) + Math.abs(2 - i) * (isCompact ? 2.5 : 3.5),
                    animationDelay: `${i * 0.07}s`,
                  }}
                />
              ))}
            </div>
          ) : agent.status === "thinking" || agent.status === "connecting" ? (
            <div className="bg-brand-orange/40 h-2 w-2 animate-[walkai-pulse_1.5s_ease-in-out_infinite] rounded-full" />
          ) : agent.isConnected ? (
            <div className="border-brand-orange/25 bg-brand-orange/12 h-2.5 w-2.5 rounded-full border-2" />
          ) : (
            <div className="bg-muted-foreground/15 h-1.5 w-1.5 rounded-full" />
          )}
        </div>
      </div>

      {/* Live speech — fixed height, no jump */}
      <div className="mt-3 flex h-14 w-full items-start justify-center px-6">
        <p className="text-foreground/60 line-clamp-2 text-center text-[13px] leading-relaxed">
          {agent.isSpeaking && agent.currentText
            ? agent.currentText
            : agent.isConnected
              ? agent.status === "listening"
                ? "Lytter..."
                : agent.status === "thinking"
                  ? "Tenker..."
                  : ""
              : ""}
        </p>
      </div>
    </div>
  );
}

/* ━━━ View: Chat (tabbed — Chat / Minne / Logg) ━━━ */

type ChatTab = "chat" | "memory" | "log";

function ChatView() {
  const [tab, setTab] = useState<ChatTab>("chat");

  const tabs: { id: ChatTab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "memory", label: "Minne" },
    { id: "log", label: "Logg" },
  ];

  return (
    <div className="flex h-full flex-col" data-walkai-content>
      {/* Tab bar */}
      <div className="border-border/20 flex border-b px-3 pt-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "-mb-px border-b-2 px-3 py-1.5 text-[11px] font-medium transition-colors duration-100",
              tab === t.id
                ? "border-brand-orange text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground border-transparent",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "chat" && <TranscriptPane />}
      {tab === "memory" && <MemoryPane />}
      {tab === "log" && <LogPane />}
    </div>
  );
}

function TranscriptPane() {
  const { agent } = useWalkAi();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [agent.transcript]);

  return (
    <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
      {agent.transcript.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground/40 text-xs">{agent.isConnected ? "Lytter..." : ""}</p>
        </div>
      ) : (
        agent.transcript.map((entry, i) => (
          <div
            key={i}
            className={
              entry.role === "user"
                ? "bg-brand-orange/10 text-foreground ml-auto max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2 text-[13px]"
                : "bg-accent/50 text-foreground max-w-[80%] rounded-2xl rounded-bl-sm px-3.5 py-2 text-[13px]"
            }
          >
            {entry.text}
          </div>
        ))
      )}
      {/* currentText is already included in agent.transcript — no extra bubble needed */}
    </div>
  );
}

function MemoryPane() {
  const { notes, telemetryEvents } = useWalkAi();

  const recentNotes = notes.slice(0, 10);
  const uniquePages = [...new Set(telemetryEvents.map((e) => e.category))].slice(0, 8);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
      {/* What Emma knows */}
      <div>
        <p className="text-muted-foreground/40 mb-2 text-[10px] tracking-wider uppercase">
          Emmas notater
        </p>
        {recentNotes.length === 0 ? (
          <p className="text-muted-foreground/30 text-xs">Ingen notater ennå</p>
        ) : (
          <div className="space-y-1.5">
            {recentNotes.map((note) => (
              <div key={note.id} className="bg-accent/20 rounded-lg px-3 py-2">
                <p className="text-foreground truncate text-[11px] font-medium">{note.topic}</p>
                <p className="text-muted-foreground/50 mt-0.5 line-clamp-2 text-[10px]">
                  {note.content}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-muted-foreground/30 text-[9px]">
                    {formatTimeAgo(note.createdAt)}
                  </span>
                  {note.tags.length > 0 && (
                    <div className="flex gap-0.5">
                      {note.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="bg-brand-orange/10 text-brand-orange/60 rounded px-1 text-[8px]"
                        >
                          @{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context awareness */}
      <div>
        <p className="text-muted-foreground/40 mb-2 text-[10px] tracking-wider uppercase">
          Kontekst
        </p>
        <div className="space-y-1">
          {uniquePages.length > 0 ? (
            uniquePages.map((cat) => (
              <div key={cat} className="bg-accent/10 flex items-center gap-2 rounded-md px-2 py-1">
                <div className="bg-brand-orange/40 h-1.5 w-1.5 rounded-full" />
                <span className="text-foreground/60 text-[11px]">{cat}</span>
                <span className="text-muted-foreground/30 ml-auto text-[9px]">
                  {telemetryEvents.filter((e) => e.category === cat).length}
                </span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground/30 text-xs">Ingen aktivitet registrert</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatAgo(timestamp: number, now: number): string {
  const ago = Math.round((now - timestamp) / 1000);
  if (ago < 60) return `${ago}s`;
  return `${Math.round(ago / 60)}m`;
}

function LogPane() {
  const { telemetryEvents, clearTelemetry } = useWalkAi();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [telemetryEvents]);

  // Update "now" when events change so time labels refresh
  useEffect(() => {
    setNow(Date.now());
  }, [telemetryEvents]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header with clear */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <p className="text-muted-foreground/40 text-[10px] tracking-wider uppercase">
          {telemetryEvents.length} hendelser
        </p>
        {telemetryEvents.length > 0 && (
          <button
            onClick={clearTelemetry}
            className="text-muted-foreground/30 hover:text-muted-foreground text-[10px] transition-colors"
          >
            Tøm
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-0.5 overflow-y-auto px-4 pb-3">
        {telemetryEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground/30 text-xs">Ingen hendelser</p>
          </div>
        ) : (
          telemetryEvents.map((ev, i) => (
            <div
              key={i}
              className="border-border/5 flex items-start gap-2 border-b py-1 last:border-0"
            >
              <span className="text-muted-foreground/30 mt-0.5 w-6 flex-shrink-0 text-right font-mono text-[9px]">
                {formatAgo(ev.timestamp, now)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground/70 truncate text-[11px]">{ev.event}</p>
                {ev.summary !== ev.event && (
                  <p className="text-muted-foreground/40 truncate text-[9px]">{ev.summary}</p>
                )}
              </div>
              <span className="bg-accent/30 text-muted-foreground/40 flex-shrink-0 rounded px-1.5 py-0.5 text-[8px]">
                {ev.category}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ━━━ View: Notepad — multi-note with sidebar, always writable ━━━ */

function NotepadView() {
  const { notes, activeNote, activeNoteId, setActiveNote, updateNote, createNote } = useWalkAi();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const content = activeNote?.content ?? "";

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing, activeNoteId]);

  // Auto-title: use first line as topic (up to 30 chars)
  useEffect(() => {
    if (!activeNoteId || !activeNote) return;
    const firstLine = content.split("\n")[0]?.trim() ?? "";
    const autoTopic = firstLine.slice(0, 30) || "Notat";
    if (autoTopic !== activeNote.topic) {
      // Only update if meaningfully different (avoid loops)
      updateNote(activeNoteId, content, autoTopic);
    }
  }, [content]);

  const hasContent = content.trim().length > 0;
  const hasNotes = notes.length > 0;

  // When no notes exist, show a create-first UI
  if (!hasNotes) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-4 px-6"
        data-walkai-content
      >
        <div className="flex animate-[walkai-fade-in_300ms_ease-out_forwards] flex-col items-center gap-2 opacity-0">
          <svg
            width="32"
            height="32"
            viewBox="0 0 20 20"
            fill="none"
            className="text-muted-foreground/20"
          >
            <path
              d="M5 3H15V17H5V3Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 7H12M8 10H12M8 13H10"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-muted-foreground/40 text-sm">Ingen notater ennå</p>
        </div>
        <button
          onClick={() => {
            createNote("Notat", "");
            setIsEditing(true);
          }}
          className="bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/15 flex animate-[walkai-fade-in_300ms_ease-out_100ms_forwards] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium opacity-0 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3V13M3 8H13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Nytt notat
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full" data-walkai-content>
      {/* Note list sidebar — compact */}
      <div className="border-border/20 w-[120px] flex-shrink-0 overflow-y-auto border-r py-2">
        {/* New note button */}
        <button
          onClick={() => {
            createNote("Notat", "");
            setIsEditing(true);
          }}
          className="text-brand-orange/60 hover:text-brand-orange hover:bg-brand-orange/5 flex w-full items-center gap-1 px-3 py-1.5 text-left text-[10px] transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3V13M3 8H13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Nytt notat
        </button>

        {notes.map((note) => (
          <button
            key={note.id}
            onClick={() => setActiveNote(note.id)}
            className={[
              "w-full px-3 py-2 text-left transition-colors",
              note.id === activeNoteId
                ? "bg-brand-orange/5 border-brand-orange/40 border-r-2"
                : "hover:bg-accent/30",
            ].join(" ")}
          >
            <span className="text-foreground block truncate text-[11px] font-medium">
              {note.topic}
            </span>
            <span className="text-muted-foreground/50 mt-0.5 block text-[9px]">
              {formatTimeAgo(note.createdAt)}
            </span>
            {note.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-0.5">
                {note.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="bg-brand-orange/10 text-brand-orange/70 rounded px-1 text-[8px]"
                  >
                    @{tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Active note content */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Mode toggle */}
        {activeNoteId && (
          <div className="absolute top-2 right-3 z-10 flex gap-1">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={[
                "flex h-6 items-center rounded-md px-2 text-[10px] transition-all duration-150",
                isEditing
                  ? "text-brand-orange bg-brand-orange/8"
                  : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50",
              ].join(" ")}
            >
              {isEditing ? (
                <span className="flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Redigerer
                </span>
              ) : (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Metadata bar */}
        {activeNote && (
          <div className="border-border/10 flex items-center gap-2 border-b px-4 py-1.5">
            <span className="text-muted-foreground/40 text-[10px]">{activeNote.topic}</span>
            <span className="text-muted-foreground/30 text-[9px]">·</span>
            <span className="text-muted-foreground/30 text-[9px]">
              {formatTime(activeNote.createdAt)}
            </span>
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {isEditing && activeNoteId ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => updateNote(activeNoteId, e.target.value)}
              placeholder="Skriv dine notater her..."
              className="text-foreground placeholder:text-muted-foreground/30 h-full w-full resize-none bg-transparent font-mono text-sm leading-relaxed focus:outline-none"
            />
          ) : hasContent ? (
            <NotepadBlocks
              content={content}
              onToggleTask={(idx) => {
                if (!activeNoteId) return;
                const lines = content.split("\n");
                if (lines[idx]) {
                  lines[idx] = lines[idx]!.includes("- [ ]")
                    ? lines[idx]!.replace("- [ ]", "- [x]")
                    : lines[idx]!.replace("- [x]", "- [ ]");
                  updateNote(activeNoteId, lines.join("\n"));
                }
              }}
            />
          ) : (
            <textarea
              ref={textareaRef}
              value=""
              onChange={(e) => {
                if (activeNoteId) updateNote(activeNoteId, e.target.value);
              }}
              placeholder="Skriv dine notater her..."
              className="text-foreground placeholder:text-muted-foreground/30 h-full w-full resize-none bg-transparent font-mono text-sm leading-relaxed focus:outline-none"
              autoFocus
            />
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "nå";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}t`;
  return new Date(ts).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

/** Renders markdown-ish notepad content as structured blocks */
function NotepadBlocks({
  content,
  onToggleTask,
}: {
  content: string;
  onToggleTask: (lineIdx: number) => void;
}) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        if (trimmed.startsWith("### "))
          return (
            <h4 key={i} className="text-foreground/80 mt-3 mb-0.5 text-xs font-semibold">
              {trimmed.slice(4)}
            </h4>
          );
        if (trimmed.startsWith("## "))
          return (
            <h3 key={i} className="text-foreground mt-3 mb-0.5 text-sm font-semibold">
              {trimmed.slice(3)}
            </h3>
          );
        if (trimmed.startsWith("# "))
          return (
            <h2 key={i} className="text-foreground mt-3 mb-1 text-base font-bold">
              {trimmed.slice(2)}
            </h2>
          );

        if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
          return (
            <button
              key={i}
              onClick={() => onToggleTask(i)}
              className="group flex w-full items-start gap-2 text-left"
            >
              <div className="border-brand-orange/40 bg-brand-orange/10 mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-brand-orange"
                  />
                </svg>
              </div>
              <span className="text-muted-foreground text-sm line-through">{trimmed.slice(6)}</span>
            </button>
          );
        }
        if (trimmed.startsWith("- [ ]")) {
          return (
            <button
              key={i}
              onClick={() => onToggleTask(i)}
              className="group flex w-full items-start gap-2 text-left"
            >
              <div className="border-border/60 group-hover:border-brand-orange/40 mt-0.5 h-4 w-4 flex-shrink-0 rounded border transition-colors" />
              <span className="text-foreground text-sm">{trimmed.slice(6)}</span>
            </button>
          );
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={i} className="flex items-start gap-2">
              <div className="bg-brand-orange/40 mt-2 h-1 w-1 flex-shrink-0 rounded-full" />
              <span className="text-foreground text-sm">
                {renderInlineContent(trimmed.slice(2))}
              </span>
            </div>
          );
        }

        if (trimmed.startsWith("@")) {
          return <ProfileTag key={i} text={trimmed} />;
        }

        return (
          <p key={i} className="text-foreground text-sm leading-relaxed">
            {renderInlineContent(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineContent(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const mentionMatch = remaining.match(/^(.*?)@(\w+)/);
    if (mentionMatch && mentionMatch.index === 0) {
      if (mentionMatch[1]) parts.push(<span key={key++}>{mentionMatch[1]}</span>);
      parts.push(
        <span
          key={key++}
          className="bg-brand-orange/10 text-brand-orange inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium"
        >
          @{mentionMatch[2]}
        </span>,
      );
      remaining = remaining.slice(mentionMatch[0].length);
      continue;
    }

    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index === 0) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(
        <strong key={key++} className="font-semibold">
          {boldMatch[2]}
        </strong>,
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}

function ProfileTag({ text }: { text: string }) {
  const names = text
    .split(/\s+/)
    .filter((t) => t.startsWith("@"))
    .map((t) => t.slice(1));
  return (
    <div className="flex flex-wrap gap-1.5 py-0.5">
      {names.map((name) => (
        <span
          key={name}
          className="bg-brand-orange/10 text-foreground inline-flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1 text-xs font-medium"
        >
          <div className="bg-brand-orange/30 text-brand-orange flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
            {name[0]?.toUpperCase()}
          </div>
          {name}
        </span>
      ))}
    </div>
  );
}

/* ━━━ View: Calculator — proper display + button grid ━━━ */

function CalculatorView() {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [hasResult, setHasResult] = useState(false);

  const handleNumber = useCallback(
    (num: string) => {
      if (hasResult) {
        setDisplay(num);
        setExpression("");
        setHasResult(false);
      } else {
        setDisplay((prev) => (prev === "0" ? num : prev + num));
      }
    },
    [hasResult],
  );

  const handleOperator = useCallback(
    (op: string) => {
      setExpression((prev) => {
        if (hasResult) {
          setHasResult(false);
          return display + " " + op + " ";
        }
        return prev + display + " " + op + " ";
      });
      setDisplay("0");
      setHasResult(false);
    },
    [display, hasResult],
  );

  const handleEquals = useCallback(() => {
    try {
      const fullExpr = expression + display;
      // Safe eval: only allow numbers and basic operators
      const sanitized = fullExpr.replace(/[^0-9+\-*/.() ]/g, "");
      if (!sanitized) return;
      const result = Function(`"use strict"; return (${sanitized})`)() as number;
      setDisplay(Number.isFinite(result) ? String(result) : "Feil");
      setExpression("");
      setHasResult(true);
    } catch {
      setDisplay("Feil");
      setExpression("");
      setHasResult(true);
    }
  }, [expression, display]);

  const handleClear = useCallback(() => {
    setDisplay("0");
    setExpression("");
    setHasResult(false);
  }, []);

  const handleDecimal = useCallback(() => {
    if (!display.includes(".")) {
      setDisplay((prev) => prev + ".");
    }
  }, [display]);

  const handleBackspace = useCallback(() => {
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
  }, []);

  const handlePercent = useCallback(() => {
    const num = parseFloat(display);
    if (!isNaN(num)) {
      setDisplay(String(num / 100));
      setHasResult(true);
    }
  }, [display]);

  // Keyboard support
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") handleNumber(e.key);
      else if (e.key === "+") handleOperator("+");
      else if (e.key === "-") handleOperator("-");
      else if (e.key === "*") handleOperator("*");
      else if (e.key === "/") {
        e.preventDefault();
        handleOperator("/");
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        handleEquals();
      } else if (e.key === "Backspace") handleBackspace();
      else if (e.key === "Escape" || e.key === "c" || e.key === "C") handleClear();
      else if (e.key === ".") handleDecimal();
      else if (e.key === "%") handlePercent();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    handleNumber,
    handleOperator,
    handleEquals,
    handleBackspace,
    handleClear,
    handleDecimal,
    handlePercent,
  ]);

  const buttons = [
    { label: "C", action: handleClear, style: "func" as const },
    { label: "%", action: handlePercent, style: "func" as const },
    { label: "\u232B", action: handleBackspace, style: "func" as const },
    { label: "\u00F7", action: () => handleOperator("/"), style: "op" as const },
    { label: "7", action: () => handleNumber("7"), style: "num" as const },
    { label: "8", action: () => handleNumber("8"), style: "num" as const },
    { label: "9", action: () => handleNumber("9"), style: "num" as const },
    { label: "\u00D7", action: () => handleOperator("*"), style: "op" as const },
    { label: "4", action: () => handleNumber("4"), style: "num" as const },
    { label: "5", action: () => handleNumber("5"), style: "num" as const },
    { label: "6", action: () => handleNumber("6"), style: "num" as const },
    { label: "\u2212", action: () => handleOperator("-"), style: "op" as const },
    { label: "1", action: () => handleNumber("1"), style: "num" as const },
    { label: "2", action: () => handleNumber("2"), style: "num" as const },
    { label: "3", action: () => handleNumber("3"), style: "num" as const },
    { label: "+", action: () => handleOperator("+"), style: "op" as const },
    { label: "00", action: () => handleNumber("00"), style: "num" as const },
    { label: "0", action: () => handleNumber("0"), style: "num" as const },
    { label: ".", action: handleDecimal, style: "num" as const },
    { label: "=", action: handleEquals, style: "equals" as const },
  ];

  const btnClass = (style: "num" | "func" | "op" | "equals") => {
    switch (style) {
      case "num":
        return "bg-accent/30 text-foreground hover:bg-accent/50 active:bg-accent/70";
      case "func":
        return "bg-muted/40 text-muted-foreground hover:bg-muted/60 active:bg-muted/80";
      case "op":
        return "bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 active:bg-brand-orange/30";
      case "equals":
        return "bg-brand-orange text-white hover:brightness-110 active:brightness-90";
    }
  };

  return (
    <div className="flex h-full flex-col px-4 py-3" data-walkai-content>
      {/* Display */}
      <div className="bg-accent/20 mb-3 animate-[walkai-fade-in_200ms_ease-out_forwards] rounded-xl px-4 py-3 opacity-0">
        {expression && (
          <p className="text-muted-foreground/40 mb-0.5 truncate text-right font-mono text-[11px]">
            {expression}
          </p>
        )}
        <p className="text-foreground truncate text-right font-mono text-2xl font-light tracking-tight">
          {display}
        </p>
      </div>

      {/* Button grid */}
      <div className="grid max-h-[280px] flex-1 animate-[walkai-fade-in_250ms_ease-out_80ms_forwards] grid-cols-4 gap-1.5 opacity-0">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            onClick={btn.action}
            className={[
              "flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-100",
              btnClass(btn.style),
            ].join(" ")}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ━━━ View: Settings — Agent configuration ━━━ */

function SettingsView() {
  const { identity, voiceTuning, setIdentity, setVoiceTuning } = useWalkAi();

  return (
    <div className="flex h-full flex-col space-y-5 overflow-y-auto px-4 py-4" data-walkai-content>
      <div className="animate-[walkai-fade-in_200ms_ease-out_forwards] opacity-0">
        <label className="text-muted-foreground/50 mb-1.5 block text-[10px] tracking-wider uppercase">
          Persona
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {(["saga", "puls", "gnist", "vakt"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setIdentity({ persona: p })}
              className={[
                "rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-100",
                identity.persona === p
                  ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20 border"
                  : "bg-accent/30 text-muted-foreground hover:bg-accent/60",
              ].join(" ")}
            >
              {PERSONAS[p].name}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-[walkai-fade-in_200ms_ease-out_60ms_forwards] opacity-0">
        <label className="text-muted-foreground/50 mb-1.5 block text-[10px] tracking-wider uppercase">
          Temperatur
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={voiceTuning.temperature}
          onChange={(e) => setVoiceTuning({ temperature: parseFloat(e.target.value) })}
          className="accent-brand-orange w-full"
        />
        <div className="text-muted-foreground/40 mt-0.5 flex justify-between text-[10px]">
          <span>Presis</span>
          <span>{voiceTuning.temperature}</span>
          <span>Kreativ</span>
        </div>
      </div>

      <div className="animate-[walkai-fade-in_200ms_ease-out_120ms_forwards] opacity-0">
        <label className="text-muted-foreground/50 mb-1.5 block text-[10px] tracking-wider uppercase">
          Første taler
        </label>
        <div className="flex gap-1.5">
          {(["user", "agent"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setVoiceTuning({ firstSpeaker: s })}
              className={[
                "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-100",
                voiceTuning.firstSpeaker === s
                  ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20 border"
                  : "bg-accent/30 text-muted-foreground hover:bg-accent/60",
              ].join(" ")}
            >
              {s === "user" ? "Du" : "Emma"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ━━━ View: Tasks & Reminders — with manual task creation ━━━ */

function TasksView() {
  const { tasks, completeTask, scheduleTask } = useWalkAi();
  const [newTitle, setNewTitle] = useState("");
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = tasks.filter((t) => t.status === "pending");
  const done = tasks.filter((t) => t.status === "done");

  useEffect(() => {
    if (showInput && inputRef.current) inputRef.current.focus();
  }, [showInput]);

  const handleAddTask = useCallback(() => {
    const title = newTitle.trim();
    if (!title) return;

    const task: ScheduledTask = {
      id: crypto.randomUUID(),
      title,
      description: "",
      dueAt: null,
      status: "pending",
      createdAt: Date.now(),
    };
    scheduleTask(task);
    setNewTitle("");
  }, [newTitle, scheduleTask]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTask();
      } else if (e.key === "Escape") {
        setShowInput(false);
        setNewTitle("");
      }
    },
    [handleAddTask],
  );

  return (
    <div className="flex h-full flex-col" data-walkai-content>
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {pending.length === 0 && done.length === 0 && !showInput ? (
          <div className="flex h-full animate-[walkai-fade-in_300ms_ease-out_forwards] flex-col items-center justify-center gap-3 opacity-0">
            <svg
              width="32"
              height="32"
              viewBox="0 0 20 20"
              fill="none"
              className="text-muted-foreground/15"
            >
              <path
                d="M4 5L6 7L9 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M12 5.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path
                d="M4 10L6 12L9 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M12 10.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-muted-foreground/30 text-sm">Ingen gjøremål ennå</p>
            <button
              onClick={() => setShowInput(true)}
              className="bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/15 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 3V13M3 8H13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Legg til gjøremål
            </button>
          </div>
        ) : (
          <>
            {/* Add task input area */}
            {showInput ? (
              <div className="border-brand-orange/20 bg-brand-orange/5 mb-3 animate-[walkai-fade-in_150ms_ease-out_forwards] rounded-xl border p-2.5 opacity-0">
                <input
                  ref={inputRef}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Hva skal gjøres?"
                  className="text-foreground placeholder:text-muted-foreground/30 w-full bg-transparent text-sm focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-muted-foreground/30 text-[9px]">
                    Enter for å legge til · Esc for å lukke
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setShowInput(false);
                        setNewTitle("");
                      }}
                      className="text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50 flex h-6 items-center rounded-md px-2 text-[10px] transition-colors"
                    >
                      Lukk
                    </button>
                    <button
                      onClick={handleAddTask}
                      disabled={!newTitle.trim()}
                      className="bg-brand-orange flex h-6 items-center rounded-md px-2.5 text-[10px] font-medium text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Legg til
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                className="text-muted-foreground/40 hover:text-brand-orange hover:bg-brand-orange/5 mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 3V13M3 8H13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Legg til gjøremål
              </button>
            )}

            {pending.length > 0 && (
              <div className="space-y-1">
                <p className="text-muted-foreground/40 mb-2 text-[10px] tracking-wider uppercase">
                  Å gjøre
                </p>
                {pending.map((task, i) => (
                  <button
                    key={task.id}
                    onClick={() => completeTask(task.id)}
                    className="group hover:bg-accent/30 flex w-full animate-[walkai-fade-in_200ms_ease-out_forwards] items-start gap-2.5 rounded-lg px-2 py-2 text-left opacity-0 transition-colors"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="border-border/60 group-hover:border-brand-orange/40 mt-0.5 h-4 w-4 flex-shrink-0 rounded border transition-colors" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm">{task.title}</p>
                      {task.description && (
                        <p className="text-muted-foreground/50 mt-0.5 line-clamp-2 text-[11px]">
                          {task.description}
                        </p>
                      )}
                      {task.dueAt && (
                        <p className="text-brand-orange/60 mt-1 text-[10px]">
                          {new Date(task.dueAt).toLocaleString("nb-NO", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {done.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-muted-foreground/30 mb-2 text-[10px] tracking-wider uppercase">
                  Fullført
                </p>
                {done.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center gap-2.5 px-2 py-1.5">
                    <div className="border-brand-orange/30 bg-brand-orange/10 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-brand-orange"
                        />
                      </svg>
                    </div>
                    <p className="text-muted-foreground/50 truncate text-sm line-through">
                      {task.title}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ━━━ Placeholders ━━━ */
function FormView() {
  return (
    <div
      className="text-muted-foreground/20 flex h-full items-center justify-center text-xs"
      data-walkai-content
    >
      Skjema
    </div>
  );
}
function VideoView() {
  return (
    <div
      className="text-muted-foreground/20 flex h-full items-center justify-center text-xs"
      data-walkai-content
    >
      Video
    </div>
  );
}

/* ━━━ View registry ━━━ */

const VIEW_COMPONENTS: Record<ContentViewType, React.ComponentType> = {
  visualizer: VisualizerView,
  chat: ChatView,
  notepad: NotepadView,
  calculator: CalculatorView,
  settings: SettingsView,
  tasks: TasksView,
  form: FormView,
  video: VideoView,
};

/* ━━━ Arena ━━━ */

export function WalkAiArena({ dragHandleProps }: { dragHandleProps?: DragHandleProps }) {
  const { activeView } = useWalkAi();
  const ViewComponent = VIEW_COMPONENTS[activeView];

  return (
    <div className="relative flex h-full flex-col">
      <ArenaHeader dragHandleProps={dragHandleProps} />
      <div className="min-h-0 flex-1 animate-[walkai-scale-up_280ms_ease-out_60ms_forwards] opacity-0">
        <ViewComponent />
      </div>
      <VoiceControls />
      <ToolsFab />
    </div>
  );
}
