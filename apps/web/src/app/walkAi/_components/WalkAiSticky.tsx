"use client";

import { useEffect, useRef, useState } from "react";
import { useWalkAi } from "./WalkAiProvider";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  WalkAi Sticky — The post-it note          */
/*                                             */
/*  No header chrome. Voice bars in corner.   */
/*  Shows compact content — speech, notes,    */
/*  tasks, or reminders. Click → arena.       */
/*  Hover → voice controls facing outward.    */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type DragHandleProps = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
};

export function WalkAiSticky({ dragHandleProps, dockedSide = "right" }: { dragHandleProps?: DragHandleProps; dockedSide?: "left" | "right" }) {
  const { expand, agent, notepadContent, activeView, tasks, unreadCount, clearUnread } = useWalkAi();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  // Controls face outward — if docked right, controls go on left side (toward screen center)
  const controlsSide = dockedSide === "right" ? "left" : "right";

  // Auto-scroll when new content
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [agent.currentText, agent.transcript, notepadContent]);

  // Clear unread when sticky is visible (hovered/extended)
  useEffect(() => {
    if (unreadCount > 0) clearUnread();
  }, [unreadCount, clearUnread]);

  // Click to expand — but not on drag or controls
  const handleClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest("[data-walkai-no-expand]")) {
      expand();
    }
  };

  const hasTranscript = agent.transcript.length > 0;
  const hasNote = notepadContent.trim().length > 0;
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const hasTasks = pendingTasks.length > 0;
  const lastMessage = agent.transcript[agent.transcript.length - 1];

  return (
    <div
      className="flex h-full w-full flex-col cursor-pointer relative"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...dragHandleProps}
    >
      {/* ━━━ Always-visible status indicator — subtle orange blink when connected ━━━ */}
      <div
        className="absolute top-3 z-20"
        style={{ [controlsSide]: 10 }}
      >
        {agent.isConnected ? (
          <div
            className="h-2.5 w-2.5 rounded-full bg-brand-orange"
            style={{
              animation: "walkai-neon-blink 2.5s ease-in-out infinite",
              color: "var(--brand-orange)",
            }}
          />
        ) : (
          <div className="h-2 w-2 rounded-full bg-muted-foreground/15" />
        )}
      </div>

      {/* ━━━ Hover voice controls — face outward, bigger on hover ━━━ */}
      {hovered && (
        <div
          className="absolute top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 opacity-0 animate-[walkai-fade-in_120ms_ease-out_forwards]"
          style={{ [controlsSide]: -20 }}
          data-walkai-no-expand
          onPointerDown={(e) => e.stopPropagation()}
        >
          {!agent.isConnected ? (
            /* Start Emma */
            <button
              onClick={() => void agent.startSession()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-orange text-white shadow-lg shadow-brand-orange/25 hover:shadow-brand-orange/40 hover:scale-110 active:scale-90 transition-all duration-150"
              aria-label="Start Emma"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C8.34 2 7 3.34 7 5V10C7 11.66 8.34 13 10 13C11.66 13 13 11.66 13 10V5C13 3.34 11.66 2 10 2Z" fill="currentColor" />
                <path d="M15 10C15 12.76 12.76 15 10 15C7.24 15 5 12.76 5 10H3C3 13.53 5.61 16.43 9 16.92V19H11V16.92C14.39 16.43 17 13.53 17 10H15Z" fill="currentColor" />
              </svg>
            </button>
          ) : (
            /* Mute + Hangup */
            <>
              <button
                onClick={agent.toggleMic}
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full shadow-lg hover:scale-110 active:scale-90 transition-all duration-150",
                  agent.isMuted
                    ? "bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                    : "bg-brand-orange text-white shadow-brand-orange/25 hover:shadow-brand-orange/40",
                ].join(" ")}
                aria-label={agent.isMuted ? "Unmute" : "Mute"}
              >
                {agent.isMuted ? (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2C8.34 2 7 3.34 7 5V10C7 11.66 8.34 13 10 13C11.66 13 13 11.66 13 10V5C13 3.34 11.66 2 10 2Z" fill="currentColor" opacity="0.3" />
                    <path d="M3 3L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2C8.34 2 7 3.34 7 5V10C7 11.66 8.34 13 10 13C11.66 13 13 11.66 13 10V5C13 3.34 11.66 2 10 2Z" fill="currentColor" />
                    <path d="M15 10C15 12.76 12.76 15 10 15C7.24 15 5 12.76 5 10H3C3 13.53 5.61 16.43 9 16.92V19H11V16.92C14.39 16.43 17 13.53 17 10H15Z" fill="currentColor" />
                  </svg>
                )}
              </button>
              <button
                onClick={agent.endSession}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-destructive/20 text-destructive/50 shadow-lg hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 hover:scale-110 active:scale-90 transition-all duration-150"
                aria-label="Legg på"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Top bar — task count + voice bars */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        {/* Task/reminder badge — opposite side from status dot */}
        {hasTasks ? (
          <div className="flex items-center gap-1" style={{ marginLeft: controlsSide === "left" ? 16 : 0 }}>
            <div className="h-1.5 w-1.5 rounded-full bg-brand-orange/60" />
            <span className="text-[9px] text-muted-foreground/50">{pendingTasks.length}</span>
          </div>
        ) : (
          <div />
        )}

        {/* Voice bars when speaking */}
        {agent.isConnected && agent.isSpeaking && (
          <div className="flex items-center gap-[2px]" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-[2px] rounded-full bg-brand-orange animate-[walkai-bar_0.8s_ease-in-out_infinite]"
                style={{
                  height: 4 + Math.abs(2 - i) * 2,
                  animationDelay: `${i * 0.07}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Compact content */}
      <div ref={scrollRef} className="flex-1 overflow-hidden px-3 pb-2.5">
        {/* Live speech takes priority */}
        {agent.isSpeaking && agent.currentText ? (
          <p className="text-[12px] text-foreground/70 leading-relaxed line-clamp-5">
            {agent.currentText}
          </p>
        ) : hasTasks ? (
          /* Pending tasks preview */
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-1">Gjøremål</p>
            {pendingTasks.slice(0, 4).map((task) => (
              <div key={task.id} className="flex items-start gap-1.5">
                <div className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-sm border border-brand-orange/30" />
                <p className="text-[11px] text-foreground/70 truncate">{task.title}</p>
              </div>
            ))}
            {pendingTasks.length > 4 && (
              <p className="text-[9px] text-muted-foreground/40">+{pendingTasks.length - 4} til</p>
            )}
          </div>
        ) : activeView === "notepad" && hasNote ? (
          /* Notepad preview */
          <div className="space-y-0.5">
            {notepadContent.split("\n").slice(0, 6).map((line, i) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
                return (
                  <p key={i} className="text-[11px] text-muted-foreground/50 line-through truncate">
                    {trimmed.slice(6)}
                  </p>
                );
              }
              if (trimmed.startsWith("- [ ]")) {
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 flex-shrink-0 rounded-sm border border-border/40" />
                    <p className="text-[11px] text-foreground/70 truncate">{trimmed.slice(6)}</p>
                  </div>
                );
              }
              if (trimmed.startsWith("# ")) {
                return <p key={i} className="text-[11px] font-semibold text-foreground/80 truncate">{trimmed.slice(2)}</p>;
              }
              return <p key={i} className="text-[11px] text-foreground/60 truncate">{trimmed}</p>;
            })}
          </div>
        ) : hasTranscript ? (
          /* Last chat message */
          <div>
            <p className="text-[10px] text-muted-foreground/40 mb-0.5">
              {lastMessage?.role === "user" ? "Du" : "Emma"}
            </p>
            <p className="text-[12px] text-foreground/60 leading-relaxed line-clamp-4">
              {lastMessage?.text}
            </p>
          </div>
        ) : (
          /* Empty state */
          <div className="flex h-full items-center justify-center">
            <p className="text-[10px] text-muted-foreground/25">Emma</p>
          </div>
        )}
      </div>
    </div>
  );
}
