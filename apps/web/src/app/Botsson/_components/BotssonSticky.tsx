"use client";

import { useEffect, useRef, useState } from "react";
import { useBotsson } from "./BotssonProvider";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Botsson Sticky — The post-it note          */
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

export function BotssonSticky({
  dragHandleProps,
  dockedSide = "right",
}: {
  dragHandleProps?: DragHandleProps;
  dockedSide?: "left" | "right";
}) {
  const {
    expand,
    agent,
    notepadContent,
    activeView,
    tasks,
    unreadCount,
    clearUnread,
    voiceActive,
    setVoiceActive,
  } = useBotsson();
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
    if (!(e.target as HTMLElement).closest("[data-botsson-no-expand]")) {
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
      className="relative flex h-full w-full cursor-pointer flex-col"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...dragHandleProps}
    >
      {/* ━━━ Always-visible status indicator — subtle orange blink when connected ━━━ */}
      <div className="absolute top-3 z-20" style={{ [controlsSide]: 10 }}>
        {voiceActive ? (
          <div
            className="bg-brand-orange h-2.5 w-2.5 rounded-full"
            style={{
              animation: "botsson-neon-blink 2.5s ease-in-out infinite",
              color: "var(--brand-orange)",
            }}
          />
        ) : (
          <div className="bg-muted-foreground/15 h-2 w-2 rounded-full" />
        )}
      </div>

      {/* ━━━ Hover voice controls — face outward, bigger on hover ━━━ */}
      {hovered && (
        <div
          className="absolute top-1/2 z-20 flex -translate-y-1/2 animate-[botsson-fade-in_120ms_ease-out_forwards] flex-col gap-2 opacity-0"
          style={{ [controlsSide]: -20 }}
          data-botsson-no-expand
          onPointerDown={(e) => e.stopPropagation()}
        >
          {!voiceActive ? (
            /* Start Botsson — ADR-0282 R1.1 */
            <button
              onClick={() => setVoiceActive(true)}
              className="bg-brand-orange flex h-9 w-9 items-center justify-center rounded-full text-white shadow-[var(--shadow-cta-sm)] shadow-lg transition-[transform,box-shadow] duration-150 hover:scale-110 hover:shadow-[var(--shadow-cta-md)] active:scale-90"
              aria-label="Start Botsson"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 2C8.34 2 7 3.34 7 5V10C7 11.66 8.34 13 10 13C11.66 13 13 11.66 13 10V5C13 3.34 11.66 2 10 2Z"
                  fill="currentColor"
                />
                <path
                  d="M15 10C15 12.76 12.76 15 10 15C7.24 15 5 12.76 5 10H3C3 13.53 5.61 16.43 9 16.92V19H11V16.92C14.39 16.43 17 13.53 17 10H15Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          ) : (
            /* Mute + Hangup */
            <>
              <button
                onClick={agent.toggleMic}
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-all duration-150 hover:scale-110 active:scale-90",
                  agent.isMuted
                    ? "bg-card border-border/40 text-muted-foreground hover:text-foreground hover:border-border border"
                    : "bg-brand-orange text-white shadow-[var(--shadow-cta-sm)] hover:shadow-[var(--shadow-cta-md)]",
                ].join(" ")}
                aria-label={agent.isMuted ? "Unmute" : "Mute"}
              >
                {agent.isMuted ? (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 2C8.34 2 7 3.34 7 5V10C7 11.66 8.34 13 10 13C11.66 13 13 11.66 13 10V5C13 3.34 11.66 2 10 2Z"
                      fill="currentColor"
                      opacity="0.3"
                    />
                    <path
                      d="M3 3L17 17"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 2C8.34 2 7 3.34 7 5V10C7 11.66 8.34 13 10 13C11.66 13 13 11.66 13 10V5C13 3.34 11.66 2 10 2Z"
                      fill="currentColor"
                    />
                    <path
                      d="M15 10C15 12.76 12.76 15 10 15C7.24 15 5 12.76 5 10H3C3 13.53 5.61 16.43 9 16.92V19H11V16.92C14.39 16.43 17 13.53 17 10H15Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setVoiceActive(false)}
                className="bg-card border-destructive/20 text-destructive/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-all duration-150 hover:scale-110 active:scale-90"
                aria-label="Legg på"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 4L12 12M4 12L12 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
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
          <div
            className="flex items-center gap-1"
            style={{ marginLeft: controlsSide === "left" ? 16 : 0 }}
          >
            <div className="bg-brand-orange/60 h-1.5 w-1.5 rounded-full" />
            <span className="text-muted-foreground/50 text-[9px]">{pendingTasks.length}</span>
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
                className="bg-brand-orange w-[2px] animate-[botsson-bar_0.8s_ease-in-out_infinite] rounded-full"
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
          <p className="text-foreground/70 line-clamp-5 text-[12px] leading-relaxed">
            {agent.currentText}
          </p>
        ) : hasTasks ? (
          /* Pending tasks preview */
          <div className="space-y-1">
            <p className="text-muted-foreground/40 mb-1 text-[9px] tracking-wider uppercase">
              Gjøremål
            </p>
            {pendingTasks.slice(0, 4).map((task) => (
              <div key={task.id} className="flex items-start gap-1.5">
                <div className="border-brand-orange/30 mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-sm border" />
                <p className="text-foreground/70 truncate text-[11px]">{task.title}</p>
              </div>
            ))}
            {pendingTasks.length > 4 && (
              <p className="text-muted-foreground/40 text-[9px]">+{pendingTasks.length - 4} til</p>
            )}
          </div>
        ) : activeView === "notepad" && hasNote ? (
          /* Notepad preview */
          <div className="space-y-0.5">
            {notepadContent
              .split("\n")
              .slice(0, 6)
              .map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
                  return (
                    <p
                      key={i}
                      className="text-muted-foreground/50 truncate text-[11px] line-through"
                    >
                      {trimmed.slice(6)}
                    </p>
                  );
                }
                if (trimmed.startsWith("- [ ]")) {
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="border-border/40 h-2.5 w-2.5 flex-shrink-0 rounded-sm border" />
                      <p className="text-foreground/70 truncate text-[11px]">{trimmed.slice(6)}</p>
                    </div>
                  );
                }
                if (trimmed.startsWith("# ")) {
                  return (
                    <p key={i} className="text-foreground/80 truncate text-[11px] font-semibold">
                      {trimmed.slice(2)}
                    </p>
                  );
                }
                return (
                  <p key={i} className="text-foreground/60 truncate text-[11px]">
                    {trimmed}
                  </p>
                );
              })}
          </div>
        ) : hasTranscript ? (
          /* Last chat message */
          <div>
            <p className="text-muted-foreground/40 mb-0.5 text-[10px]">
              {lastMessage?.role === "user" ? "Du" : "Botsson"}
            </p>
            <p className="text-foreground/60 line-clamp-4 text-[12px] leading-relaxed">
              {lastMessage?.text}
            </p>
          </div>
        ) : (
          /* Empty state */
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground/25 text-[10px]">Botsson</p>
          </div>
        )}
      </div>
    </div>
  );
}
