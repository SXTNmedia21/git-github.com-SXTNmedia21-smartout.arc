"use client";

// ============================================
// useHelpTour.ts
// State and side-effects for the /dashboard/help same-page tour harness.
// Why: centralises scroll, highlight, cancellation, focus, and telemetry so
// both the UI overlay and the Botsson tool bridge share one source of truth.
// ============================================

import { useState, useEffect, useRef, useCallback } from "react";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveAnchorId } from "../_lib/tour-anchors";
import type { TourAnchor } from "../_lib/tour-anchors";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export interface ActiveHighlight {
  target_id: TourAnchor;
  label: string;
  duration_ms: number;
}

export interface UseHelpTourOptions {
  workspaceId: string;
  actorId: string;
}

export interface UseHelpTourResult {
  activeHighlight: ActiveHighlight | null;
  navigateTo: (target_id: TourAnchor) => void;
  highlightElement: (target_id: TourAnchor, opts: { label: string; duration_ms: number }) => void;
  cancel: (trigger: "esc" | "off_target_click") => void;
}

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// A tour "session" is considered complete when >= 3 steps occur within 60 s.
const SESSION_WINDOW_MS = 60_000;
const COMPLETION_THRESHOLD = 3;

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useHelpTour({ workspaceId, actorId }: UseHelpTourOptions): UseHelpTourResult {
  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlight | null>(null);

  // Ref-based counters avoid stale closures in event handlers.
  const stepCountRef = useRef(0);
  const sessionStartTsRef = useRef<number | null>(null);
  // Track whether we already fired help.tour_completed for this session window.
  const completedRef = useRef(false);
  // Timer handle for auto-clear of the highlight.
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Shared: reduced-motion ─────────────────────────────────────────── */
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  /* ── Shared: step counter + completion tracking ──────────────────────── */
  const recordStep = useCallback(() => {
    const now = Date.now();
    if (sessionStartTsRef.current === null) {
      sessionStartTsRef.current = now;
    }

    stepCountRef.current += 1;

    // Fire help.tour_completed once when threshold is met within the window.
    if (
      !completedRef.current &&
      stepCountRef.current >= COMPLETION_THRESHOLD &&
      sessionStartTsRef.current !== null &&
      now - sessionStartTsRef.current <= SESSION_WINDOW_MS
    ) {
      completedRef.current = true;
      void emit({
        event: "help.tour_completed",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          workspaceId: nonEmpty(workspaceId, "workspaceId"),
          actorId: nonEmpty(actorId, "actorId"),
          step_count: stepCountRef.current,
          duration_ms: now - (sessionStartTsRef.current ?? now),
        },
      });
    }
  }, [workspaceId, actorId]);

  /* ── navigateTo ─────────────────────────────────────────────────────── */
  const navigateTo = useCallback(
    (target_id: TourAnchor) => {
      const elementId = resolveAnchorId(target_id);
      const el = document.getElementById(elementId);
      if (!el) return;

      // Scroll — smooth unless the user prefers reduced motion.
      el.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });

      // Focus management — ensure the element is keyboard-reachable.
      if (!el.hasAttribute("tabindex")) {
        el.setAttribute("tabindex", "-1");
      }
      el.focus({ preventScroll: true });

      recordStep();

      void emit({
        event: "help.tour_step_invoked",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          workspaceId: nonEmpty(workspaceId, "workspaceId"),
          actorId: nonEmpty(actorId, "actorId"),
          tool: "navigate_to",
          target_id,
          reduced_motion: reducedMotion,
        },
      });
    },
    [workspaceId, actorId, reducedMotion, recordStep],
  );

  /* ── highlightElement ────────────────────────────────────────────────── */
  const highlightElement = useCallback(
    (target_id: TourAnchor, opts: { label: string; duration_ms: number }) => {
      // Clear any existing highlight timer before starting a new one.
      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }

      setActiveHighlight({ target_id, label: opts.label, duration_ms: opts.duration_ms });

      // Auto-clear after duration — no telemetry on auto-clear (normal completion).
      highlightTimerRef.current = setTimeout(() => {
        setActiveHighlight(null);
        highlightTimerRef.current = null;
      }, opts.duration_ms);

      recordStep();

      void emit({
        event: "help.tour_step_invoked",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          workspaceId: nonEmpty(workspaceId, "workspaceId"),
          actorId: nonEmpty(actorId, "actorId"),
          tool: "highlight_element",
          target_id,
          reduced_motion: reducedMotion,
        },
      });
    },
    [workspaceId, actorId, reducedMotion, recordStep],
  );

  /* ── cancel ─────────────────────────────────────────────────────────── */
  const cancel = useCallback(
    (trigger: "esc" | "off_target_click") => {
      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      setActiveHighlight(null);

      void emit({
        event: "help.tour_cancelled",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          workspaceId: nonEmpty(workspaceId, "workspaceId"),
          actorId: nonEmpty(actorId, "actorId"),
          trigger,
          step_count: stepCountRef.current,
        },
      });
    },
    [workspaceId, actorId],
  );

  /* ── ESC key handler ─────────────────────────────────────────────────── */
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape" && activeHighlight !== null) {
        cancel("esc");
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [activeHighlight, cancel]);

  /* ── Off-target click handler ────────────────────────────────────────── */
  useEffect(() => {
    if (activeHighlight === null) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;

      // Find the active anchor element by DOM id.
      const anchorEl = document.getElementById(resolveAnchorId(activeHighlight!.target_id));

      // Cancel if click is outside both the anchor AND any overlay element.
      const insideAnchor = anchorEl?.contains(target) ?? false;
      const insideOverlay = target.closest(".help-tour-overlay") !== null;

      if (!insideAnchor && !insideOverlay) {
        cancel("off_target_click");
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [activeHighlight, cancel]);

  /* ── Cleanup on unmount ──────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  return { activeHighlight, navigateTo, highlightElement, cancel };
}
