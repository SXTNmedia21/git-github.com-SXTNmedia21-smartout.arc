"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff } from "lucide-react";
import { useBotsson } from "./BotssonProvider";
import { useDomainChatOwnership } from "./DomainChatOwnership";
import { BotssonOrb } from "./BotssonOrb";
import { BotssonSticky } from "./BotssonSticky";
import { BotssonArena } from "./BotssonArena";
import {
  BotssonOrbVoiceMount,
  voiceStatusToOrb,
  type BotssonActivityEvent,
} from "./BotssonOrbVoiceMount";
import { DENSITY_DIMENSIONS, TIMING, EASING, ARENA_MIN, ARENA_MAX, EDGE_GAP } from "./types";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Botsson Shell — One div that morphs        */
/*                                             */
/*  Magnetic edges — attracted but not flush. */
/*  Smooth retract. Resize grip. Rich glow.  */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** How close before the magnet pulls */
const MAGNET_RANGE = 40;
const THROW_SPEED = 500;
const RETRACT_DELAY = 4000;

/** Retracted sticky — sliver with neon */
const RETRACTED_WIDTH = 10;
/** Hover gently grows sticky */
const HOVER_SCALE = 1.05;

type DockedSide = "left" | "right";

function getVw() {
  return typeof window !== "undefined" ? window.innerWidth : 1920;
}
function getVh() {
  return typeof window !== "undefined" ? window.innerHeight : 1080;
}

/**
 * Magnetic edge clamping — attracted to edges but keeps EDGE_GAP.
 * Within MAGNET_RANGE → snaps to EDGE_GAP. Otherwise free.
 */
function magneticClamp(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const maxX = getVw() - w;
  const maxY = getVh() - h;

  let mx = Math.max(EDGE_GAP, Math.min(x, maxX - EDGE_GAP));
  let my = Math.max(EDGE_GAP, Math.min(y, maxY - EDGE_GAP));

  if (x <= EDGE_GAP + MAGNET_RANGE) mx = EDGE_GAP;
  else if (x >= maxX - EDGE_GAP - MAGNET_RANGE) mx = maxX - EDGE_GAP;

  if (y <= EDGE_GAP + MAGNET_RANGE) my = EDGE_GAP;
  else if (y >= maxY - EDGE_GAP - MAGNET_RANGE) my = maxY - EDGE_GAP;

  return { x: mx, y: my };
}

function clampSize(w: number, h: number): { w: number; h: number } {
  return {
    w: Math.max(ARENA_MIN.width, Math.min(w, ARENA_MAX.width)),
    h: Math.max(ARENA_MIN.height, Math.min(h, ARENA_MAX.height)),
  };
}

export function BotssonShell() {
  const {
    state,
    expand,
    collapse,
    goSticky,
    agent,
    setPosition,
    setDragging,
    setResizing,
    setArenaSize,
    setOrbStatus,
    unreadCount,
    workspaceId,
    voiceActive,
    setVoiceActive,
    voiceCallStatus,
    setVoiceCallStatus,
    pushVoiceActivity,
  } = useBotsson();
  // ADR-0238 — suppress Orb to passive mode when a domain chat surface owns the UI.
  const { isOwned: isDomainChatOwned, reason: domainChatReason } = useDomainChatOwnership();

  const shellRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [stickySide, setStickySide] = useState<DockedSide>("right");
  const [stickyRetracted, setStickyRetracted] = useState(true);
  const [stickyHovered, setStickyHovered] = useState(false);

  /* ━━━ LiveKit voice call activity router (ADR-0282 R1.1) ━━━ */
  // Activity feed from voice-agent (tool_call, tool_response, intent, navigate,
  // shift_proposal_*). Forwarded into BotssonProvider so Arena LogView renders
  // it alongside chat debugLog — single visible surface, single state.
  const router = useRouter();
  const handleVoiceActivity = useCallback(
    (ev: BotssonActivityEvent) => {
      pushVoiceActivity(ev);
      // Navigation events — server-side agent cannot navigate; browser does.
      if (ev.type === "navigate" && ev.path.startsWith("/")) {
        router.push(ev.path);
      }
      // Forward shift proposals to schedule page's AgentProposalsContext.
      if (
        ev.type === "shift_proposal_create" ||
        ev.type === "shift_proposal_update" ||
        ev.type === "shift_proposal_delete"
      ) {
        window.dispatchEvent(new CustomEvent("botsson:shift-proposal", { detail: ev.payload }));
      }
      // 2026-05-13: forward schedule view-state changes (date/columns/period/
      // filter/layout/focus_day) so the schedule page's voice-tools-bridge can
      // call the matching uiAction setter. Payload carries discriminated `action`.
      if (ev.type === "schedule_view_change") {
        window.dispatchEvent(
          new CustomEvent("botsson:schedule-view-change", { detail: ev.payload }),
        );
      }
    },
    [router, pushVoiceActivity],
  );

  // Sync LiveKit voice status into the Orb when a Botsson call is running.
  useEffect(() => {
    if (!voiceActive) return;
    setOrbStatus(voiceStatusToOrb(voiceCallStatus));
  }, [voiceActive, voiceCallStatus, setOrbStatus]);
  const retractTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const dragState = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false });
  const resizeState = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 });
  const velocityBuffer = useRef<{ x: number; y: number; t: number }[]>([]);

  const { density, position, arenaSize, isDragging, isResizing } = state;
  const isOrb = density === "orb";
  const isSticky = density === "sticky";
  const isArena = density === "arena";
  const isImmersive = density === "immersive";

  const getShellSize = useCallback(
    (d: typeof density = density) => {
      if (d === "immersive") return { w: getVw(), h: getVh() };
      if (d === "arena") return { w: arenaSize.width, h: arenaSize.height };
      const dd = DENSITY_DIMENSIONS[d];
      return { w: dd.width, h: dd.height };
    },
    [density, arenaSize],
  );

  /* ━━━ Initial position — restore or bottom-right ━━━ */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("botsson-position");
      if (saved) {
        const pos = JSON.parse(saved) as { x: number; y: number };
        const orbSize = DENSITY_DIMENSIONS.orb;
        // Validate saved position is still on screen
        const maxX = window.innerWidth - orbSize.width - EDGE_GAP;
        const maxY = window.innerHeight - orbSize.height - EDGE_GAP;
        if (pos.x >= EDGE_GAP && pos.x <= maxX && pos.y >= EDGE_GAP && pos.y <= maxY) {
          setPosition(pos);
          setMounted(true);
          return;
        }
      }
    } catch {
      /* ignore corrupt localStorage */
    }
    const orbSize = DENSITY_DIMENSIONS.orb;
    setPosition({
      x: window.innerWidth - orbSize.width - 24,
      y: window.innerHeight - orbSize.height - 24,
    });
    setMounted(true);
  }, [setPosition]);

  /* ━━━ Sticky retract/extend ━━━ */
  const stickyActive =
    agent.isConnected &&
    (agent.isSpeaking || agent.status === "listening" || agent.status === "thinking");

  useEffect(() => {
    if (!isSticky) return;
    if (stickyHovered || stickyActive) {
      setStickyRetracted(false);
      if (retractTimer.current) clearTimeout(retractTimer.current);
    } else {
      retractTimer.current = setTimeout(() => setStickyRetracted(true), RETRACT_DELAY);
    }
    return () => {
      if (retractTimer.current) clearTimeout(retractTimer.current);
    };
  }, [isSticky, stickyHovered, stickyActive]);

  useEffect(() => {
    if (isSticky) {
      setStickyRetracted(false);
      retractTimer.current = setTimeout(() => setStickyRetracted(true), RETRACT_DELAY);
    }
    return () => {
      if (retractTimer.current) clearTimeout(retractTimer.current);
    };
  }, [isSticky]);

  useEffect(() => {
    if (isSticky && agent.isSpeaking) setStickyRetracted(false);
  }, [isSticky, agent.isSpeaking]);

  /* ━━━ Background click → sticky ━━━ */
  useEffect(() => {
    if (!isArena || isDragging || isResizing) return;
    function handleBgClick(e: MouseEvent) {
      if (shellRef.current?.contains(e.target as Node)) return;
      const { w } = getShellSize();
      const centerX = position.x + w / 2;
      setStickySide(centerX < getVw() / 2 ? "left" : "right");
      goSticky();
    }
    window.addEventListener("pointerdown", handleBgClick);
    return () => window.removeEventListener("pointerdown", handleBgClick);
  }, [isArena, isDragging, isResizing, position.x, getShellSize, goSticky]);

  /* ━━━ Position sticky at edge with gap ━━━ */
  useEffect(() => {
    if (!isSticky) return;
    const stickyDim = DENSITY_DIMENSIONS.sticky;
    const x = stickySide === "left" ? EDGE_GAP : getVw() - stickyDim.width - EDGE_GAP;
    const y = Math.max(EDGE_GAP, Math.min(position.y, getVh() - stickyDim.height - EDGE_GAP));
    setPosition({ x, y });
  }, [isSticky, stickySide, setPosition]); // intentional: position.y excluded to avoid recalc loop

  /* ━━━ Magnetic clamp on density change ━━━ */
  useEffect(() => {
    if (isImmersive || isSticky || !mounted) return;
    const { w, h } = getShellSize();
    const clamped = magneticClamp(position.x, position.y, w, h);
    if (clamped.x !== position.x || clamped.y !== position.y) setPosition(clamped);
  }, [density, mounted, isImmersive, isSticky, getShellSize, position.x, position.y, setPosition]);

  /* ━━━ Clamp on window resize ━━━ */
  useEffect(() => {
    if (isImmersive) return;
    function handleResize() {
      if (isSticky) {
        const stickyDim = DENSITY_DIMENSIONS.sticky;
        const x = stickySide === "left" ? EDGE_GAP : getVw() - stickyDim.width - EDGE_GAP;
        setPosition({
          x,
          y: Math.max(EDGE_GAP, Math.min(position.y, getVh() - stickyDim.height - EDGE_GAP)),
        });
      } else {
        const { w, h } = getShellSize();
        const clamped = magneticClamp(position.x, position.y, w, h);
        if (clamped.x !== position.x || clamped.y !== position.y) setPosition(clamped);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isImmersive, isSticky, stickySide, position.x, position.y, getShellSize, setPosition]);

  /* ━━━ Drag ━━━ */
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (isImmersive) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: position.x,
        startPosY: position.y,
        moved: false,
      };
      velocityBuffer.current = [{ x: e.clientX, y: e.clientY, t: Date.now() }];
      setDragging(true);
    },
    [isImmersive, position.x, position.y, setDragging],
  );

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.current.moved = true;

      const buf = velocityBuffer.current;
      buf.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      if (buf.length > 6) buf.shift();

      const { w, h } = getShellSize();
      const clamped = magneticClamp(
        dragState.current.startPosX + dx,
        dragState.current.startPosY + dy,
        w,
        h,
      );
      setPosition(clamped);
    },
    [isDragging, getShellSize, setPosition],
  );

  const handleDragEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setDragging(false);

      // Save position to localStorage for memory across sessions
      try {
        localStorage.setItem("botsson-position", JSON.stringify(position));
      } catch {
        /* */
      }

      if (!dragState.current.moved && isOrb) {
        expand();
        velocityBuffer.current = [];
        return;
      }

      if (isSticky) {
        if (!dragState.current.moved) {
          expand();
          velocityBuffer.current = [];
          return;
        }
        const { w } = getShellSize();
        const centerX = position.x + w / 2;
        const side: DockedSide = centerX < getVw() / 2 ? "left" : "right";
        setStickySide(side);
        const x = side === "left" ? EDGE_GAP : getVw() - w - EDGE_GAP;
        setPosition({ x, y: position.y });
        velocityBuffer.current = [];
        return;
      }

      if (isArena && dragState.current.moved) {
        const { w, h } = getShellSize();
        const buf = velocityBuffer.current;
        if (buf.length >= 2) {
          const last = buf[buf.length - 1]!;
          const first = buf[0]!;
          const dt = (last.t - first.t) / 1000;
          if (dt > 0) {
            const speed = Math.sqrt(
              Math.pow((last.x - first.x) / dt, 2) + Math.pow((last.y - first.y) / dt, 2),
            );
            if (speed > THROW_SPEED) {
              const atEdge =
                position.x <= EDGE_GAP + 2 ||
                position.y <= EDGE_GAP + 2 ||
                position.x >= getVw() - w - EDGE_GAP - 2 ||
                position.y >= getVh() - h - EDGE_GAP - 2;
              if (atEdge) {
                collapse();
                velocityBuffer.current = [];
                return;
              }
            }
          }
        }
      }

      velocityBuffer.current = [];
    },
    [
      isDragging,
      isOrb,
      isSticky,
      isArena,
      expand,
      collapse,
      setDragging,
      getShellSize,
      position.x,
      position.y,
      setPosition,
    ],
  );

  const dragHandleProps = {
    onPointerDown: handleDragStart,
    onPointerMove: handleDragMove,
    onPointerUp: handleDragEnd,
  };

  /* ━━━ Resize — corner grip, arena only ━━━ */
  const _handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      resizeState.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: arenaSize.width,
        startH: arenaSize.height,
      };
      setResizing(true);
    },
    [arenaSize, setResizing],
  );

  const _handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      const dx = e.clientX - resizeState.current.startX;
      const dy = e.clientY - resizeState.current.startY;
      const clamped = clampSize(resizeState.current.startW + dx, resizeState.current.startH + dy);
      setArenaSize({ width: clamped.w, height: clamped.h });
    },
    [isResizing, setArenaSize],
  );

  const _handleResizeEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setResizing(false);
    },
    [isResizing, setResizing],
  );

  /* ━━━ ESC steps down ━━━ */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (isArena) goSticky();
      else if (isSticky) collapse();
      else if (isImmersive) expand();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isArena, isSticky, isImmersive, goSticky, collapse, expand]);

  if (!mounted) return null;

  /* ━━━ Sticky retract transform ━━━ */
  const stickyDim = DENSITY_DIMENSIONS.sticky;
  const stickyTranslateX =
    isSticky && stickyRetracted
      ? stickySide === "left"
        ? -(stickyDim.width - RETRACTED_WIDTH)
        : stickyDim.width - RETRACTED_WIDTH
      : 0;

  /* ━━━ Border radius — always rounded, never flat ━━━ */
  const borderRadius = isOrb
    ? DENSITY_DIMENSIONS.orb.borderRadius
    : isImmersive
      ? 0
      : isSticky
        ? stickyDim.borderRadius
        : DENSITY_DIMENSIONS.arena.borderRadius;

  /* ━━━ Dimensions ━━━ */
  const dim = isSticky
    ? { width: stickyDim.width, height: stickyDim.height }
    : isArena
      ? { width: arenaSize.width, height: arenaSize.height }
      : DENSITY_DIMENSIONS[density];

  /* ━━━ Transition — per-property for smoothness ━━━ */
  const morphMs = isDragging || isResizing ? 0 : TIMING.morph;
  const retractMs = TIMING.stickyRetract;

  const transitionParts = [
    `width ${morphMs}ms ${EASING}`,
    `height ${morphMs}ms ${EASING}`,
    `border-radius ${morphMs}ms ${EASING}`,
    `box-shadow ${morphMs}ms ${EASING}`,
    `top ${isDragging ? 0 : Math.round(morphMs * 0.8)}ms ${EASING}`,
    `left ${isDragging ? 0 : Math.round(morphMs * 0.8)}ms ${EASING}`,
    `transform ${isSticky ? retractMs : morphMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
  ];

  /* Hover scale */
  const stickyScale = isSticky && stickyHovered && !stickyRetracted ? HOVER_SCALE : 1;
  const stickyTransform = isSticky
    ? `translateX(${stickyTranslateX}px) scale(${stickyScale})`
    : undefined;

  /* Active glow flag */
  const isActive = agent.isConnected && (agent.isSpeaking || agent.status === "thinking");
  const isNotification = state.orbStatus === "notification";

  const shellStyle: React.CSSProperties = isImmersive
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        borderRadius: 0,
        transition: `all ${TIMING.morph}ms ${EASING}`,
        zIndex: 65,
      }
    : {
        position: "fixed",
        top: position.y,
        left: position.x,
        width: dim.width,
        height: dim.height,
        borderRadius,
        transition: transitionParts.join(", "),
        transform: stickyTransform,
        transformOrigin: isSticky
          ? stickySide === "left"
            ? "left center"
            : "right center"
          : undefined,
        zIndex: 65,
        cursor: isDragging ? "grabbing" : isOrb ? "pointer" : "default",
      };

  return (
    <div
      ref={shellRef}
      style={shellStyle}
      onMouseEnter={() => isSticky && setStickyHovered(true)}
      onMouseLeave={() => isSticky && setStickyHovered(false)}
      className={[
        "select-none",
        isSticky ? "overflow-visible" : "overflow-hidden",
        isOrb
          ? isNotification
            ? "from-card via-card bg-gradient-to-br to-black shadow-[0_0_20px_4px_rgba(255,140,50,0.25),0_0_40px_8px_rgba(255,140,50,0.1)] hover:scale-110 active:scale-95"
            : "from-brand-orange/90 to-brand-orange/60 bg-gradient-to-br shadow-lg shadow-[oklch(0.65_0.22_40/0.25)] hover:scale-110 hover:shadow-[oklch(0.65_0.22_40/0.4)] active:scale-95"
          : isSticky
            ? [
                "border-border/20 border backdrop-blur-xl",
                "from-card/95 via-card/90 to-card/80 bg-gradient-to-br",
                isActive
                  ? "shadow-[0_4px_24px_-4px_rgba(255,140,50,0.15),0_8px_32px_-8px_rgba(0,0,0,0.12)]"
                  : "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1),0_2px_8px_-2px_rgba(0,0,0,0.06)]",
              ].join(" ")
            : [
                "border-border/30 border backdrop-blur-2xl",
                "from-card via-card to-card/95 bg-gradient-to-b",
                "ring-1 ring-white/[0.04]",
                isActive
                  ? "shadow-[0_8px_40px_-8px_rgba(255,140,50,0.12),0_20px_50px_-12px_rgba(0,0,0,0.2)]"
                  : "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15),0_4px_16px_-4px_rgba(0,0,0,0.08)]",
              ].join(" "),
        isDragging && !isOrb && "!shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)]",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Top edge shimmer — subtle accent line */}
      {!isOrb && !stickyRetracted && (
        <div
          className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-px"
          style={{
            background: isActive
              ? "linear-gradient(90deg, transparent, rgba(255, 140, 50, 0.25), transparent)"
              : "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }}
        />
      )}

      {/* Neon edge indicator — retracted sticky */}
      {isSticky && stickyRetracted && (
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-30"
          style={{ [stickySide === "left" ? "right" : "left"]: 0, width: RETRACTED_WIDTH }}
        >
          <div
            className="absolute top-1/2 rounded-full"
            style={{
              width: 3,
              height: 28,
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: agent.isConnected
                ? "var(--brand-orange)"
                : "var(--muted-foreground)",
              opacity: agent.isConnected ? 1 : 0.15,
              animation: agent.isConnected
                ? "botsson-neon-blink 2.5s ease-in-out infinite"
                : undefined,
              color: agent.isConnected ? "var(--brand-orange)" : "var(--muted-foreground)",
            }}
          />
          {unreadCount > 0 && (
            <div
              className="bg-brand-orange absolute top-3 flex items-center justify-center rounded-full text-[8px] font-bold text-white"
              style={{ width: 14, height: 14, left: "50%", transform: "translateX(-50%)" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </div>
          )}
        </div>
      )}

      {/* Orb — ADR-0238: passive mode when a domain chat surface owns the UI */}
      {isOrb && (
        <div
          className="relative h-full w-full"
          // Passive mode: no drag, no click interaction. Full mode: drag + click to expand.
          {...(isDomainChatOwned ? {} : dragHandleProps)}
          style={
            isDomainChatOwned
              ? {
                  transform: "scale(0.7)",
                  opacity: 0.5,
                  // Smooth transition into/out of passive mode
                  transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms ease",
                  // Block pointer events — Orb is purely decorative when passive
                  pointerEvents: "none",
                }
              : {
                  transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms ease",
                }
          }
          // Tooltip indicates why the Orb is passive — helpful for debugging
          title={
            isDomainChatOwned
              ? `Botsson watching — ${domainChatReason ?? "domain chat"} owns chat`
              : undefined
          }
          aria-hidden={isDomainChatOwned ? true : undefined}
        >
          <BotssonOrb />
          {unreadCount > 0 && !isDomainChatOwned && (
            <div
              className="bg-brand-orange absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[8px] font-bold text-white shadow-sm"
              style={{ width: 16, height: 16 }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </div>
          )}

          {/* Mic button — hidden in passive mode (ADR-0238 + ADR-0282 R1.1) */}
          {workspaceId && !isDomainChatOwned && (
            <button
              type="button"
              aria-label={voiceActive ? "Avslutt Botsson-samtale" : "Start Botsson-samtale"}
              aria-pressed={voiceActive}
              onClick={(e) => {
                e.stopPropagation();
                setVoiceActive((v) => !v);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={[
                "absolute -bottom-9 left-1/2 -translate-x-1/2",
                "flex items-center justify-center rounded-full",
                "transition-all duration-200",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                voiceActive
                  ? "bg-brand-orange text-white opacity-100 shadow-[0_0_12px_2px_oklch(0.65_0.22_40/0.35)]"
                  : "bg-background/70 text-muted-foreground hover:text-foreground border-border/40 border opacity-0 backdrop-blur-sm group-hover:opacity-100 hover:opacity-100",
              ].join(" ")}
              style={{ width: 28, height: 28 }}
            >
              {voiceActive ? (
                <MicOff aria-hidden className="h-3 w-3" />
              ) : (
                <Mic aria-hidden className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      )}

      {/* LiveKit voice call — mounts when voiceActive (ADR-0282 R1.1: single plane). */}
      {voiceActive && workspaceId && (
        <BotssonOrbVoiceMount
          active={voiceActive}
          workspaceId={workspaceId}
          onStatusChange={setVoiceCallStatus}
          onActivity={handleVoiceActivity}
          onError={(msg) => {
            console.error("[BotssonShell] voice call error:", msg);
            setVoiceActive(false);
          }}
        />
      )}

      {/* Voice-agent activity now routes into Arena LogView via
          BotssonProvider.pushVoiceActivity — no separate floating panel. */}

      {/* Sticky */}
      {isSticky && (
        <div
          className="h-full w-full"
          style={{
            opacity: stickyRetracted ? 0 : 1,
            transition: `opacity ${retractMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
        >
          <BotssonSticky dragHandleProps={dragHandleProps} dockedSide={stickySide} />
        </div>
      )}

      {/* Arena / Immersive */}
      {(isArena || isImmersive) && (
        <div
          className="h-full w-full"
          style={{ animation: `botsson-fade-in ${TIMING.contentEnter}ms ${EASING}` }}
        >
          <BotssonArena dragHandleProps={dragHandleProps} />
        </div>
      )}

      {/* Resize is now handled inside BotssonArena via ResizeHandles component */}
    </div>
  );
}
