"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useWalkAi } from "./WalkAiProvider";
import { EASING } from "./types";
import { PERSONAS } from "./persona-engine";
import { EmmaProfile } from "./EmmaProfile";
import type { ContentViewType } from "./types";
import type { ScheduledTask } from "./walkai-tools";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  WalkAi Arena — Premium floating card      */
/*                                             */
/*  Profile header with Emma + dropdown menu. */
/*  Tools bloom FAB (bottom-left).            */
/*  Settings / reminders / tasks via Emma.    */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// UI Events:
// - action: switchView(type) (tab/tool click)
// - action: collapse() (header minimize button)
// - action: agent.startSession() (mic button)
// - action: agent.endSession() (mic button when connected)
// - action: completeTask(id) (task checkbox click)
// - action: createNote(topic, content) (notepad new note)
// - nav: EmmaMenu > settings | tasks (dropdown items)

type DragHandleProps = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
};

/* ━━━ View title map — Norwegian headings ━━━ */

const VIEW_TITLES: Record<ContentViewType, string> = {
  visualizer: "Stemme",
  chat: "Samtale",
  notepad: "Notater",
  calculator: "Kalkulator",
  settings: "Innstillinger",
  tasks: "Gjøremål",
  form: "Skjema",
  video: "Video",
  log: "Logg",
  memory: "Minne",
  history: "Historikk",
};

/* ━━━ Emma Menu — SOLID card, big touch targets ━━━ */

function EmmaMenuOverlay({ onClose }: { onClose: () => void }) {
  const { switchView } = useWalkAi();

  const items = [
    {
      id: "settings" as ContentViewType,
      label: "Agent-innstillinger",
      description: "Persona, stemme, temperatur",
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
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
      description: "Oppgaver, frister, sjekklister",
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
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
    <>
      {/* Backdrop — click to close */}
      <div
        className="absolute inset-0 z-50 bg-black/20"
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
      />
      {/* Menu card — sits below header */}
      <div
        className="border-border bg-card absolute top-[52px] right-3 left-3 z-50 rounded-2xl border p-2.5 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]"
        style={{ animation: `walkai-fade-in 120ms ${EASING}` }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="border-border/30 mb-1.5 border-b px-3 pt-1 pb-2">
          <p className="text-muted-foreground/50 text-[10px] font-semibold tracking-wider uppercase">
            Emma-meny
          </p>
        </div>
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              switchView(item.id);
              onClose();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-foreground hover:bg-accent/60 active:bg-accent/80 group flex w-full cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3.5 transition-colors duration-100"
          >
            <div className="bg-brand-orange/8 text-brand-orange/70 group-hover:bg-brand-orange/12 group-hover:text-brand-orange flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors duration-150">
              {item.icon}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium">{item.label}</p>
              <p className="text-muted-foreground/50 truncate text-[11px]">{item.description}</p>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              className="text-muted-foreground/20 group-hover:text-muted-foreground/40 flex-shrink-0 transition-colors"
            >
              <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
    </>
  );
}

/* ━━━ Header — Emma's profile + status + menu ━━━ */

function ArenaHeader({
  dragHandleProps,
  menuOpen,
  setMenuOpen,
}: {
  dragHandleProps?: DragHandleProps;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}) {
  const { collapse, agent, identity, activeView } = useWalkAi();
  const personaName = PERSONAS[identity.persona].name;

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
      className="border-border/30 flex animate-[walkai-slide-down_250ms_ease-out_forwards] cursor-grab items-center gap-3 border-b px-4 py-3 opacity-0 active:cursor-grabbing"
      {...dragHandleProps}
    >
      {/* Avatar — click to open Emma menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
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

      {/* View title badge */}
      <span className="text-muted-foreground/40 hidden text-[10px] font-medium tracking-wider uppercase sm:block">
        {VIEW_TITLES[activeView]}
      </span>

      {/* Collapse */}
      <button
        onClick={collapse}
        onPointerDown={(e) => e.stopPropagation()}
        className="text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
        aria-label="Minimer"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
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
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
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
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
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
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
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

const BLOOM_SPACING = 44;

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
      className="absolute bottom-3 left-3 z-20"
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
          title={tool.label}
          className={[
            "absolute left-0 flex items-center justify-center rounded-xl transition-all",
            "h-10 w-10",
            activeView === tool.id
              ? "bg-brand-orange/15 text-brand-orange ring-brand-orange/20 ring-1"
              : "bg-popover text-muted-foreground hover:text-foreground hover:bg-accent border-border/40 border",
            open ? "scale-100 opacity-100 shadow-lg" : "pointer-events-none scale-50 opacity-0",
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
          "relative flex h-10 w-10 animate-[walkai-pop-in_300ms_ease-out_180ms_forwards] items-center justify-center rounded-xl opacity-0 transition-all duration-200",
          open
            ? "bg-accent text-foreground rotate-45 shadow-md"
            : "text-muted-foreground/0 hover:text-muted-foreground/50",
        ].join(" ")}
        aria-label="Verktoy"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/* ━━━ Context FAB — bloom icons from bottom-right ━━━ */

type ContextDef = { id: ContentViewType; icon: React.ReactNode; label: string };

const CONTEXT_ITEMS: ContextDef[] = [
  {
    id: "log",
    label: "Logg",
    icon: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 5H16M4 9H13M4 13H15M4 17H10"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "memory",
    label: "Minne",
    icon: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="10" cy="10" r="3" fill="currentColor" opacity="0.5" />
        <path
          d="M10 3V6M10 14V17M3 10H6M14 10H17"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "history",
    label: "Historikk",
    icon: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 10C4 6.69 6.69 4 10 4C13.31 4 16 6.69 16 10C16 13.31 13.31 16 10 16C7.81 16 5.93 14.82 5 13.1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M3 7L5 10L7.5 8"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 7V10.5L12.5 12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function ContextFab() {
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
      className="absolute right-3 bottom-3 z-20"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      data-walkai-no-drag
    >
      {CONTEXT_ITEMS.map((item, i) => (
        <button
          key={item.id}
          onClick={() => {
            switchView(item.id);
            setOpen(false);
          }}
          aria-label={item.label}
          title={item.label}
          className={[
            "absolute left-0 flex items-center justify-center rounded-xl transition-all",
            "h-10 w-10",
            activeView === item.id
              ? "bg-brand-orange/15 text-brand-orange ring-brand-orange/20 ring-1"
              : "bg-popover text-muted-foreground hover:text-foreground hover:bg-accent border-border/40 border",
            open ? "scale-100 opacity-100 shadow-lg" : "pointer-events-none scale-50 opacity-0",
          ].join(" ")}
          style={{
            bottom: open ? (i + 1) * BLOOM_SPACING : 0,
            transitionDuration: open ? `${150 + i * 40}ms` : "120ms",
            transitionTimingFunction: EASING,
            transitionDelay: open ? `${i * 30}ms` : "0ms",
          }}
        >
          {item.icon}
        </button>
      ))}

      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "relative flex h-10 w-10 animate-[walkai-pop-in_300ms_ease-out_180ms_forwards] items-center justify-center rounded-xl opacity-0 transition-all duration-200",
          open
            ? "bg-accent text-foreground rotate-45 shadow-md"
            : "text-muted-foreground/0 hover:text-muted-foreground/50",
        ].join(" ")}
        aria-label="Kontekst"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
      className="border-border/30 animate-[walkai-slide-up_220ms_ease-out_120ms_forwards] border-t px-3 py-3 opacity-0"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-center gap-3">
        {!agent.isConnected ? (
          <button
            onClick={() => void agent.startSession()}
            className={[
              "bg-brand-orange flex items-center justify-center rounded-full text-white shadow-lg shadow-[oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95",
              isCompact ? "h-11 w-11" : "h-12 w-12",
            ].join(" ")}
            aria-label="Start samtale"
          >
            <MicIcon size={isCompact ? 18 : 20} />
          </button>
        ) : (
          <>
            {/* Sleep button — ends session cleanly */}
            <button
              onClick={handleSleep}
              className="bg-muted/60 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150"
              aria-label="Dvala"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
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
                isCompact ? "h-11 w-11" : "h-12 w-12",
                "bg-brand-orange text-white shadow-lg shadow-[oklch(0.65_0.22_40/0.25)]",
              ].join(" ")}
              aria-label="Avslutt"
            >
              <MicIcon size={isCompact ? 18 : 20} />
            </button>

            {agent.isSpeaking && (
              <div className="flex items-center gap-[3px]" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-brand-orange/50 w-[3px] animate-[walkai-bar_0.8s_ease-in-out_infinite] rounded-full"
                    style={{ height: 6 + i * 2.5, animationDelay: `${i * 0.08}s` }}
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

/* ━━━ View: Visualizer — PREMIUM voice emulator ━━━ */

/** Generate particle positions for the speaking state */
/* ━━━ Ambient idle particles — glitter + skyfall ━━━ */

function useIdleParticles(count: number) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        // Random positions across the arena
        left: `${5 + Math.random() * 90}%`,
        top: `${Math.random() * 100}%`,
        delay: Math.random() * 12,
        duration: 6 + Math.random() * 10,
        size: 1 + Math.random() * 2,
        drift: -8 + Math.random() * 16,
        kind: i % 3 === 0 ? ("glitter" as const) : ("skyfall" as const),
        opacity: 0.15 + Math.random() * 0.35,
      })),
    [count],
  );
}

function useParticles(count: number, isSpeaking: boolean) {
  return useMemo(() => {
    if (!isSpeaking) return [];
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const radius = 35 + Math.random() * 20;
      return {
        tx: Math.cos(angle) * radius,
        ty: Math.sin(angle) * radius,
        delay: Math.random() * 1.5,
        duration: 1.2 + Math.random() * 0.8,
        size: 2 + Math.random() * 2,
      };
    });
  }, [count, isSpeaking]);
}

function VisualizerView() {
  const { agent, state } = useWalkAi();
  const isCompact = state.arenaSize.height < 400;
  const isSpeaking = agent.isSpeaking;
  const isListening = agent.isConnected && agent.status === "listening";
  const isThinking = agent.status === "thinking" || agent.status === "connecting";
  const isConnected = agent.isConnected;
  const isIdle = !isConnected;

  const particles = useParticles(12, isSpeaking);
  const idleParticles = useIdleParticles(20);

  // Sizes — responsive to arena
  const outerSize = isCompact ? 140 : 200;
  const middleSize = isCompact ? 100 : 150;
  const innerSize = isCompact ? 64 : 96;
  const coreSize = isCompact ? 44 : 64;

  return (
    <div
      className="relative flex h-full flex-col items-center justify-center overflow-hidden"
      data-walkai-content
    >
      {/* Ambient idle layer — glitter & skyfall */}
      {isIdle && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {/* Aurora shimmer */}
          <div
            className="absolute inset-0 rounded-b-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 140, 50, 0.04) 0%, transparent 40%, rgba(255, 140, 50, 0.02) 70%, transparent 100%)",
              animation: "walkai-aurora 20s ease-in-out infinite",
            }}
          />
          {/* Particles */}
          {idleParticles.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: p.left,
                top: p.kind === "skyfall" ? "-4px" : p.top,
                width: p.size,
                height: p.size,
                background:
                  p.kind === "glitter" ? "rgba(255, 140, 50, 0.6)" : "rgba(255, 140, 50, 0.25)",
                boxShadow: p.kind === "glitter" ? "0 0 3px rgba(255, 140, 50, 0.4)" : "none",
                // @ts-expect-error -- CSS custom properties for drift
                "--drift": `${p.drift}px`,
                animation:
                  p.kind === "glitter"
                    ? `walkai-glitter ${p.duration}s ease-in-out infinite`
                    : `walkai-skyfall ${p.duration}s linear infinite`,
                animationDelay: `${p.delay}s`,
                opacity: p.opacity,
              }}
            />
          ))}
        </div>
      )}

      {/* Section title */}
      <div className="absolute top-3 left-4">
        <h3 className="text-muted-foreground/40 text-xs font-semibold tracking-wider uppercase">
          Stemme
        </h3>
      </div>

      <div
        className="relative flex items-center justify-center"
        style={{ width: outerSize + 20, height: outerSize + 20 }}
      >
        {/* Ring 1 — outermost, slow rotation */}
        <div
          className="absolute rounded-full"
          style={{
            width: outerSize,
            height: outerSize,
            background: isSpeaking
              ? "conic-gradient(from 0deg, transparent, rgba(255, 140, 50, 0.15), transparent, rgba(255, 140, 50, 0.1), transparent)"
              : isConnected
                ? "conic-gradient(from 0deg, transparent, rgba(255, 140, 50, 0.06), transparent)"
                : "none",
            border: isConnected ? "1px solid rgba(255, 140, 50, 0.08)" : "1px solid var(--border)",
            opacity: isConnected ? 1 : 0.3,
            animation: isConnected ? "walkai-orb-ring-slow 8s linear infinite" : undefined,
            transition: "opacity 300ms, border-color 300ms",
          }}
          aria-hidden
        />

        {/* Ring 2 — middle, counter-rotation */}
        <div
          className="absolute rounded-full"
          style={{
            width: middleSize,
            height: middleSize,
            background: isSpeaking
              ? "conic-gradient(from 120deg, transparent, rgba(255, 140, 50, 0.2), transparent, rgba(255, 140, 50, 0.12), transparent)"
              : isListening
                ? "conic-gradient(from 120deg, transparent, rgba(255, 140, 50, 0.08), transparent)"
                : "none",
            border: isConnected ? "1px solid rgba(255, 140, 50, 0.12)" : "1px solid var(--border)",
            opacity: isConnected ? 1 : 0.2,
            animation: isConnected
              ? isSpeaking
                ? "walkai-orb-ring-reverse 5s linear infinite, walkai-orb-speak-pulse 1.2s ease-in-out infinite"
                : "walkai-orb-ring-reverse 12s linear infinite"
              : undefined,
            transition: "opacity 300ms, border-color 300ms",
          }}
          aria-hidden
        />

        {/* Ring 3 — inner glow ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: innerSize,
            height: innerSize,
            background: isSpeaking
              ? "radial-gradient(circle, rgba(255, 140, 50, 0.15) 0%, rgba(255, 140, 50, 0.05) 60%, transparent 100%)"
              : isListening
                ? "radial-gradient(circle, rgba(255, 140, 50, 0.08) 0%, transparent 70%)"
                : isThinking
                  ? "radial-gradient(circle, rgba(255, 140, 50, 0.06) 0%, transparent 70%)"
                  : "none",
            border: isConnected ? "1px solid rgba(255, 140, 50, 0.15)" : "1px solid var(--border)",
            opacity: isConnected ? 1 : 0.15,
            animation: isListening ? "walkai-orb-listen 3s ease-in-out infinite" : undefined,
            transition: "all 300ms",
          }}
          aria-hidden
        />

        {/* Core orb — gradient fill */}
        <div
          className="relative flex items-center justify-center rounded-full transition-all duration-300"
          style={{
            width: coreSize,
            height: coreSize,
            background: isSpeaking
              ? "radial-gradient(circle at 35% 35%, rgba(255, 140, 50, 0.5), rgba(255, 140, 50, 0.25) 60%, rgba(255, 140, 50, 0.1) 100%)"
              : isConnected
                ? "radial-gradient(circle at 35% 35%, rgba(255, 140, 50, 0.2), rgba(255, 140, 50, 0.08) 70%, transparent 100%)"
                : "var(--accent)",
            boxShadow: isSpeaking
              ? "0 0 30px 8px rgba(255, 140, 50, 0.2), 0 0 60px 16px rgba(255, 140, 50, 0.08), inset 0 0 20px rgba(255, 140, 50, 0.15)"
              : isListening
                ? "0 0 20px 4px rgba(255, 140, 50, 0.1), inset 0 0 12px rgba(255, 140, 50, 0.05)"
                : "none",
            transform: isSpeaking ? "scale(1.08)" : "scale(1)",
          }}
        >
          {/* Waveform bars inside core when speaking */}
          {isSpeaking ? (
            <div className="flex items-center justify-center gap-[3px]" aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-full bg-white/70"
                  style={{
                    width: isCompact ? 2 : 3,
                    height: isCompact ? 16 : 24,
                    animation: `walkai-waveform-${(i % 3) + 1} ${0.6 + i * 0.08}s ease-in-out infinite`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>
          ) : isThinking ? (
            <div
              className="bg-brand-orange/40 animate-[walkai-pulse_1.5s_ease-in-out_infinite] rounded-full"
              style={{ width: isCompact ? 8 : 12, height: isCompact ? 8 : 12 }}
            />
          ) : isConnected ? (
            <div
              className="bg-brand-orange/30 rounded-full"
              style={{
                width: isCompact ? 10 : 14,
                height: isCompact ? 10 : 14,
                border: "2px solid rgba(255, 140, 50, 0.2)",
              }}
            />
          ) : (
            <div className="bg-muted-foreground/15 h-2 w-2 rounded-full" />
          )}
        </div>

        {/* Particles — burst outward when speaking */}
        {isSpeaking &&
          particles.map((p, i) => (
            <div
              key={i}
              className="bg-brand-orange/70 pointer-events-none absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                top: "50%",
                left: "50%",
                marginTop: -p.size / 2,
                marginLeft: -p.size / 2,
                // @ts-expect-error -- CSS custom properties for particle animation
                "--tx": `${p.tx}px`,
                "--ty": `${p.ty}px`,
                animation: `walkai-orb-particle ${p.duration}s ease-out infinite`,
                animationDelay: `${p.delay}s`,
              }}
              aria-hidden
            />
          ))}

        {/* Thinking shimmer ring */}
        {isThinking && (
          <div
            className="pointer-events-none absolute rounded-full"
            style={{
              width: innerSize + 8,
              height: innerSize + 8,
              border: "1px dashed rgba(255, 140, 50, 0.2)",
              animation: "walkai-orb-think 3s ease-in-out infinite",
            }}
            aria-hidden
          />
        )}
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

/* ━━━ View: Chat — conversation transcript ━━━ */

function ChatView() {
  return (
    <div className="flex h-full flex-col" data-walkai-content>
      {/* Section title */}
      <div className="border-border/20 flex items-center justify-between border-b px-4 pt-3 pb-2">
        <div>
          <h3 className="text-foreground text-sm font-bold">Samtale</h3>
          <p className="text-muted-foreground/40 text-[10px]">Transkripsjon av samtalen</p>
        </div>
      </div>
      <TranscriptPane />
    </div>
  );
}

function TranscriptPane() {
  const { agent } = useWalkAi();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [agent.transcript]);

  // When the agent is speaking, the live "speaking" bubble (below) already shows
  // the current text with an animated cursor. Filter out the last agent entry
  // from the transcript to avoid showing the same message twice.
  const lastAgentIdx = (() => {
    for (let i = agent.transcript.length - 1; i >= 0; i--) {
      if (agent.transcript[i]?.role === "agent") return i;
    }
    return -1;
  })();
  const displayTranscript =
    agent.isSpeaking && lastAgentIdx >= 0
      ? agent.transcript.filter((_, i) => i !== lastAgentIdx)
      : agent.transcript;

  return (
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {agent.transcript.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <div className="bg-accent/30 flex h-12 w-12 items-center justify-center rounded-2xl">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="text-muted-foreground/20"
            >
              <path
                d="M3 4H17V14H6L3 17V4Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M7 8H13M7 11H10"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-muted-foreground/30 text-xs">
            {agent.isConnected ? "Lytter..." : "Start en samtale med Emma"}
          </p>
        </div>
      ) : (
        displayTranscript.map((entry, i) => (
          <div
            key={i}
            className={entry.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            {entry.role !== "user" && (
              <div className="mt-1 mr-2 flex-shrink-0">
                <div className="from-brand-orange/60 to-brand-orange/30 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br">
                  <span className="text-[9px] font-bold text-white/90">E</span>
                </div>
              </div>
            )}
            <div
              className={
                entry.role === "user"
                  ? "bg-brand-orange/10 border-brand-orange/10 text-foreground max-w-[78%] rounded-2xl rounded-br-md border px-3.5 py-2.5 text-[13px] leading-relaxed"
                  : "bg-card border-border/30 text-foreground max-w-[78%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm"
              }
            >
              {entry.text}
            </div>
          </div>
        ))
      )}
      {agent.isSpeaking && agent.currentText && (
        <div className="flex justify-start">
          <div className="mt-1 mr-2 flex-shrink-0">
            <div className="from-brand-orange/40 to-brand-orange/20 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br">
              <span className="text-[9px] font-bold text-white/60">E</span>
            </div>
          </div>
          <div className="bg-card/50 border-border/20 text-foreground/50 max-w-[78%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-[13px] leading-relaxed">
            {agent.currentText}
            <span className="bg-brand-orange/40 ml-1 inline-block h-3.5 w-1.5 animate-[walkai-pulse_1s_ease-in-out_infinite] rounded-sm" />
          </div>
        </div>
      )}
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
      updateNote(activeNoteId, content, autoTopic);
    }
  }, [content, activeNoteId, activeNote, updateNote]);

  const hasContent = content.trim().length > 0;
  const hasNotes = notes.length > 0;

  // When no notes exist, show a create-first UI
  if (!hasNotes) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-4 px-6"
        data-walkai-content
      >
        {/* Section title */}
        <div className="absolute top-3 left-4">
          <h3 className="text-muted-foreground/40 text-xs font-semibold tracking-wider uppercase">
            Notater
          </h3>
        </div>
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
          className="bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/15 flex animate-[walkai-fade-in_300ms_ease-out_100ms_forwards] items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium opacity-0 transition-colors"
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
      {/* Section title */}
      <div className="absolute top-1 left-4 z-10">
        <h3 className="text-muted-foreground/30 text-[10px] font-semibold tracking-wider uppercase">
          Notater
        </h3>
      </div>

      {/* Note list sidebar — mini-card style */}
      <div className="border-border/20 w-[140px] flex-shrink-0 space-y-1 overflow-y-auto border-r px-1.5 py-2">
        {/* New note button — prominent */}
        <button
          onClick={() => {
            createNote("Notat", "");
            setIsEditing(true);
          }}
          className="border-brand-orange/25 bg-brand-orange/5 text-brand-orange hover:bg-brand-orange/10 hover:border-brand-orange/40 flex w-full items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-2 text-left text-[11px] font-medium transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
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
              "w-full rounded-lg px-2.5 py-2 text-left transition-all duration-150",
              note.id === activeNoteId
                ? "bg-brand-orange/8 border-brand-orange/20 border shadow-[0_0_8px_-2px_rgba(255,140,50,0.1)]"
                : "hover:bg-accent/40 hover:border-border/30 border border-transparent",
            ].join(" ")}
          >
            <span className="text-foreground block truncate text-[11px] leading-tight font-semibold">
              {note.topic}
            </span>
            <span className="bg-accent/60 text-muted-foreground/60 mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium">
              {formatTimeAgo(note.createdAt)}
            </span>
            {note.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {note.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="bg-brand-orange/10 text-brand-orange/70 rounded-full px-1.5 py-px text-[8px] font-medium"
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
                "flex h-7 items-center rounded-lg px-2.5 text-[11px] transition-all duration-150",
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

        {/* Metadata header bar */}
        {activeNote && (
          <div className="border-border/20 bg-accent/20 flex items-center gap-3 border-b px-4 py-2.5">
            <h4 className="text-foreground flex-1 truncate text-sm font-semibold">
              {activeNote.topic}
            </h4>
            <span className="bg-accent/60 text-muted-foreground/60 flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium">
              {formatTime(activeNote.createdAt)}
            </span>
            {activeNote.tags.length > 0 && (
              <div className="flex flex-shrink-0 gap-1">
                {activeNote.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-brand-orange/10 text-brand-orange/70 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  >
                    @{tag}
                  </span>
                ))}
              </div>
            )}
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
      const sanitized = fullExpr.replace(/[^0-9+\-*/.() ]/g, "");
      if (!sanitized || sanitized.length > 100) return;
      // Guard against deeply nested parens (DoS via stack overflow)
      const depth = sanitized.split("(").length - 1;
      if (depth > 20) {
        setDisplay("Feil");
        return;
      }
      // Safe eval: regex already strips everything except digits and basic operators
      const result = new Function(`"use strict"; return (${sanitized})`)() as number;
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
    <div className="relative flex h-full flex-col px-4 py-3" data-walkai-content>
      {/* Section title */}
      <div className="mb-2">
        <h3 className="text-muted-foreground/40 text-xs font-semibold tracking-wider uppercase">
          Kalkulator
        </h3>
      </div>

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
              "flex min-h-[40px] items-center justify-center rounded-xl text-sm font-medium transition-all duration-100",
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

/* ━━━ View: Settings — Emma's profile (same as WalkAi page) ━━━ */

function SettingsView() {
  const { switchView } = useWalkAi();

  return (
    <div className="flex h-full flex-col" data-walkai-content>
      {/* Fixed header with close button */}
      <div className="border-border/20 flex items-center justify-between border-b px-5 pt-3 pb-2">
        <div>
          <h3 className="text-foreground text-sm font-bold">Agent-innstillinger</h3>
          <p className="text-muted-foreground/40 text-[10px]">
            Endringer tar effekt ved neste samtale
          </p>
        </div>
        <button
          onClick={() => switchView("visualizer")}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
          aria-label="Lukk innstillinger"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 3L11 11M11 3L3 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <EmmaProfile />
      </div>
    </div>
  );
}

/* ━━━ View: Tasks & Reminders — with manual task creation ━━━ */

function TasksView() {
  const { tasks, completeTask, scheduleTask, updateTask, reorderTask } = useWalkAi();
  const [newTitle, setNewTitle] = useState("");
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);

  const pending = tasks
    .filter((t) => t.status === "pending")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const done = tasks.filter((t) => t.status === "done");

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDragId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, taskId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(taskId);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      setDragId(null);
      setDragOverId(null);
      if (!dragId || dragId === targetId) return;
      const targetIdx = pending.findIndex((t) => t.id === targetId);
      if (targetIdx !== -1) reorderTask(dragId, targetIdx);
    },
    [dragId, pending, reorderTask],
  );

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverId(null);
  }, []);

  const priorityColors: Record<string, string> = {
    high: "bg-brand-orange/80",
    medium: "bg-amber-400/60",
    low: "bg-muted-foreground/30",
  };

  const priorityLabels: Record<string, string> = {
    high: "Høy",
    medium: "Middels",
    low: "Lav",
  };

  const cyclePriority = useCallback(
    (taskId: string, current: string) => {
      const order = ["high", "medium", "low"] as const;
      const idx = order.indexOf(current as (typeof order)[number]);
      const next = order[(idx + 1) % order.length]!;
      updateTask(taskId, { priority: next });
    },
    [updateTask],
  );

  const handleDeadlineChange = useCallback(
    (taskId: string, value: string) => {
      if (!value) {
        updateTask(taskId, { dueAt: null });
      } else {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          updateTask(taskId, { dueAt: parsed.toISOString() });
        }
      }
      setEditingDeadlineId(null);
    },
    [updateTask],
  );

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
      {/* Section header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <h3 className="text-foreground text-sm font-bold">Gjøremål</h3>
          {pending.length > 0 && (
            <p className="text-muted-foreground/50 text-[11px]">{pending.length} ventende</p>
          )}
        </div>
        {!showInput && (pending.length > 0 || done.length > 0) && (
          <button
            onClick={() => setShowInput(true)}
            className="text-brand-orange hover:bg-brand-orange/5 flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 3V13M3 8H13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Ny
          </button>
        )}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-4 pb-3">
        {pending.length === 0 && done.length === 0 && !showInput ? (
          <div className="flex h-full animate-[walkai-fade-in_300ms_ease-out_forwards] flex-col items-center justify-center gap-4 opacity-0">
            <div className="relative">
              <div className="bg-brand-orange/5 absolute inset-0 rounded-full blur-xl" />
              <div className="bg-accent/30 border-border/20 relative flex h-14 w-14 items-center justify-center rounded-2xl border">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="text-muted-foreground/25"
                >
                  <path
                    d="M4 5L6 7L9 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 5.5H16"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 10L6 12L9 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 10.5H16"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground/40 text-sm font-medium">Ingen gjøremål ennå</p>
              <p className="text-muted-foreground/25 mt-0.5 text-[11px]">
                Emma kan også opprette gjøremål for deg
              </p>
            </div>
            <button
              onClick={() => setShowInput(true)}
              className="bg-brand-orange/10 border-brand-orange/20 text-brand-orange hover:bg-brand-orange/15 flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all duration-200 hover:shadow-[0_0_12px_-3px_rgba(255,140,50,0.2)]"
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
            {showInput && (
              <div className="border-brand-orange/20 bg-brand-orange/5 mb-3 animate-[walkai-fade-in_150ms_ease-out_forwards] rounded-xl border p-3.5 opacity-0">
                <input
                  ref={inputRef}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Hva skal gjøres?"
                  className="text-foreground placeholder:text-muted-foreground/30 w-full bg-transparent text-sm focus:outline-none"
                />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-muted-foreground/30 text-[10px]">Enter for å legge til</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setShowInput(false);
                        setNewTitle("");
                      }}
                      className="text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50 flex h-7 items-center rounded-lg px-3 text-[11px] transition-colors"
                    >
                      Lukk
                    </button>
                    <button
                      onClick={handleAddTask}
                      disabled={!newTitle.trim()}
                      className="bg-brand-orange flex h-7 items-center rounded-lg px-3 text-[11px] font-medium text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Legg til
                    </button>
                  </div>
                </div>
              </div>
            )}

            {pending.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground/40 mb-1 text-[10px] tracking-wider uppercase">
                  Å gjøre
                </p>
                {pending.map((task, i) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragOver={(e) => handleDragOver(e, task.id)}
                    onDrop={(e) => handleDrop(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={[
                      "group border-border/20 bg-card/50 hover:border-brand-orange/20 hover:bg-brand-orange/[0.03]",
                      "relative flex w-full animate-[walkai-fade-in_200ms_ease-out_forwards] items-start gap-3",
                      "overflow-hidden rounded-xl border px-3.5 py-3 text-left opacity-0 transition-all duration-150",
                      dragId === task.id && "opacity-40",
                      dragOverId === task.id &&
                        dragId !== task.id &&
                        "border-brand-orange/40 bg-brand-orange/5",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ animationDelay: `${i * 40}ms`, cursor: "grab" }}
                  >
                    {/* Left accent bar — colored by priority */}
                    <div
                      className={[
                        "absolute top-0 bottom-0 left-0 w-[3px] rounded-l-xl transition-colors",
                        task.priority === "high"
                          ? "bg-brand-orange/60 group-hover:bg-brand-orange"
                          : task.priority === "low"
                            ? "bg-muted-foreground/20 group-hover:bg-muted-foreground/40"
                            : "bg-amber-400/40 group-hover:bg-amber-400/60",
                      ].join(" ")}
                    />

                    {/* Checkbox — click to complete */}
                    <button
                      onClick={() => completeTask(task.id)}
                      className="border-border/40 group-hover:border-brand-orange/50 mt-0.5 h-5 w-5 flex-shrink-0 rounded-md border-2 transition-colors"
                      aria-label={`Fullfør ${task.title}`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-foreground truncate text-sm font-medium">{task.title}</p>
                        {/* Priority badge — click to cycle */}
                        <button
                          onClick={() => cyclePriority(task.id, task.priority ?? "medium")}
                          className={[
                            "flex h-4 items-center rounded-full px-1.5 text-[9px] font-medium text-white/90 transition-all hover:scale-110",
                            priorityColors[task.priority ?? "medium"],
                          ].join(" ")}
                          title={`Prioritet: ${priorityLabels[task.priority ?? "medium"]}. Klikk for å endre.`}
                        >
                          {priorityLabels[task.priority ?? "medium"]}
                        </button>
                      </div>
                      {task.description && (
                        <p className="text-muted-foreground/50 mt-1 line-clamp-2 text-[11px] leading-relaxed">
                          {task.description}
                        </p>
                      )}
                      {/* Deadline — click to edit */}
                      <div className="mt-1.5 flex items-center gap-1">
                        {editingDeadlineId === task.id ? (
                          <input
                            type="datetime-local"
                            defaultValue={
                              task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : ""
                            }
                            onBlur={(e) => handleDeadlineChange(task.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleDeadlineChange(task.id, e.currentTarget.value);
                              if (e.key === "Escape") setEditingDeadlineId(null);
                            }}
                            autoFocus
                            className="bg-card border-border/40 text-foreground rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDeadlineId(task.id);
                            }}
                            className={[
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors",
                              task.dueAt
                                ? "bg-brand-orange/8 border-brand-orange/15 text-brand-orange/70 hover:bg-brand-orange/15"
                                : "border-border/20 text-muted-foreground/30 hover:border-border/40 hover:text-muted-foreground/50",
                            ].join(" ")}
                            title="Klikk for å sette/endre frist"
                          >
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                              <path
                                d="M8 5V8.5L10.5 10"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                            </svg>
                            {task.dueAt
                              ? new Date(task.dueAt).toLocaleString("nb-NO", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Sett frist"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {done.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-muted-foreground/30 mb-1 text-[10px] tracking-wider uppercase">
                  Fullført
                </p>
                {done.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="border-border/10 bg-accent/15 relative flex items-center gap-3 overflow-hidden rounded-xl border px-3.5 py-2.5"
                  >
                    {/* Left accent bar — muted for done */}
                    <div className="absolute top-0 bottom-0 left-0 w-[3px] rounded-l-xl bg-emerald-500/20" />
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-emerald-500/60"
                        />
                      </svg>
                    </div>
                    <p className="text-muted-foreground/40 truncate text-sm line-through">
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
function LogView() {
  return (
    <div
      className="text-muted-foreground/20 flex h-full items-center justify-center text-xs"
      data-walkai-content
    >
      Logg
    </div>
  );
}
function MemoryView() {
  return (
    <div
      className="text-muted-foreground/20 flex h-full items-center justify-center text-xs"
      data-walkai-content
    >
      Minne
    </div>
  );
}
function HistoryView() {
  return (
    <div
      className="text-muted-foreground/20 flex h-full items-center justify-center text-xs"
      data-walkai-content
    >
      Historikk
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
  log: LogView,
  memory: MemoryView,
  history: HistoryView,
};

/* ━━━ Resize handles — visible grip indicators ━━━ */

function ResizeHandles() {
  const { setArenaSize, setResizing, state } = useWalkAi();
  const resizeState = useRef({ startX: 0, startY: 0, startW: 0, startH: 0, edge: "" });

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, edge: string) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      resizeState.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: state.arenaSize.width,
        startH: state.arenaSize.height,
        edge,
      };
      setResizing(true);
    },
    [state.arenaSize, setResizing],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!state.isResizing) return;
      const dx = e.clientX - resizeState.current.startX;
      const dy = e.clientY - resizeState.current.startY;
      const edge = resizeState.current.edge;

      let w = resizeState.current.startW;
      let h = resizeState.current.startH;

      if (edge.includes("e")) w += dx;
      if (edge.includes("s")) h += dy;
      if (edge.includes("w")) w -= dx;
      if (edge.includes("n")) h -= dy;

      setArenaSize({
        width: Math.max(320, Math.min(w, 900)),
        height: Math.max(300, Math.min(h, 800)),
      });
    },
    [state.isResizing, setArenaSize],
  );

  const handleResizeEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!state.isResizing) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setResizing(false);
    },
    [state.isResizing, setResizing],
  );

  const sharedProps = (edge: string, cursor: string) => ({
    onPointerDown: (e: React.PointerEvent) => handleResizeStart(e, edge),
    onPointerMove: handleResizeMove,
    onPointerUp: handleResizeEnd,
    style: { cursor } as React.CSSProperties,
  });

  return (
    <>
      {/* Bottom-right corner — primary resize, with visible grip */}
      <div
        className="group absolute right-0 bottom-0 z-30"
        onPointerDown={(e) => handleResizeStart(e, "se")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        style={{ width: 24, height: 24, cursor: "nwse-resize" }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 10 10"
          className="text-muted-foreground/20 group-hover:text-muted-foreground/50 absolute right-1.5 bottom-1.5 transition-colors duration-200"
        >
          <path
            d="M9 1L1 9M9 4L4 9M9 7L7 9"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Bottom edge */}
      <div
        className="hover:bg-brand-orange/5 absolute right-6 bottom-0 left-6 z-20 h-2 rounded-b-xl transition-colors"
        {...sharedProps("s", "ns-resize")}
      />

      {/* Right edge */}
      <div
        className="hover:bg-brand-orange/5 absolute top-6 right-0 bottom-6 z-20 w-2 rounded-r-xl transition-colors"
        {...sharedProps("e", "ew-resize")}
      />

      {/* Resize overlay — captures all pointer events during resize */}
      {state.isResizing && (
        <div
          className="fixed inset-0 z-50"
          style={{ cursor: "nwse-resize" }}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        />
      )}
    </>
  );
}

/* ━━━ Arena ━━━ */

export function WalkAiArena({ dragHandleProps }: { dragHandleProps?: DragHandleProps }) {
  const { activeView, state, setArenaSize, setPosition, preSettingsSize, setPreSettingsSize } =
    useWalkAi();
  const ViewComponent = VIEW_COMPONENTS[activeView];
  const isArena = state.density === "arena";
  const _isSettings = activeView === "settings";
  const [menuOpen, setMenuOpen] = useState(false);
  const prevViewRef = useRef(activeView);

  // Expand arena when entering settings, restore when leaving
  useEffect(() => {
    const prev = prevViewRef.current;
    prevViewRef.current = activeView;

    if (activeView === "settings" && prev !== "settings") {
      // Save current size and expand to ~80% viewport
      setPreSettingsSize({ width: state.arenaSize.width, height: state.arenaSize.height });
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const newW = Math.min(Math.round(vw * 0.75), 900);
      const newH = Math.min(Math.round(vh * 0.8), 800);
      setArenaSize({ width: newW, height: newH });
      // Center it
      setPosition({
        x: Math.round((vw - newW) / 2),
        y: Math.round((vh - newH) / 2),
      });
    } else if (prev === "settings" && activeView !== "settings" && preSettingsSize) {
      // Restore previous size
      setArenaSize(preSettingsSize);
      setPreSettingsSize(null);
    }
  }, [activeView]); // intentional: only track activeView changes

  return (
    <div className="relative flex h-full flex-col">
      <ArenaHeader
        dragHandleProps={dragHandleProps}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
      <div className="relative z-0 min-h-0 flex-1 animate-[walkai-scale-up_280ms_ease-out_60ms_forwards] opacity-0">
        <ViewComponent />
      </div>
      <VoiceControls />
      <ToolsFab />
      <ContextFab />
      {isArena && <ResizeHandles />}
      {/* Menu overlay — renders at arena level, above everything */}
      {menuOpen && <EmmaMenuOverlay onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
