"use client";

// ============================================
// schedule-voice-tools-bridge.tsx
// Registers schedule voice tools inside the shared voice tools context.
// Exists to keep schedule/page.tsx free from inline registration lifecycle code.
// Connected to: use-schedule-voice-tools.ts and voice-tools-context.tsx.
// ============================================

import { useEffect } from "react";

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import type { ScheduleViewChangePayload } from "@/app/Botsson/_components/BotssonOrbVoiceMount";

import { useScheduleVoiceTools } from "../_hooks/use-schedule-voice-tools";
import { AgentConfirmationDialog } from "./agent-confirmation-dialog";
import { useAgentProposals } from "./agent-proposals-context";
import type { ScheduleComputed } from "../_hooks/use-schedule-computed";
import type { ScheduleEmployee } from "../_hooks/use-employees";
import type { Absence, Shift, ShiftProposal } from "./schedule-types";

type ScheduleVoiceToolsBridgeProps = {
  weekStart: string;
  weekEnd: string;
  workspaceId?: string;
  enrichedDays: Array<{ id: string; label: string; isToday?: boolean; isHoliday?: boolean }>;
  shifts: Shift[];
  absences: Absence[];
  employees: ScheduleEmployee[];
  computed: ScheduleComputed;
  focusDayInUI: (dateId: string, openPlanner: boolean) => void;
  setSelectedDate: (date: string | null) => void;
  switchScheduleView?: (view: string) => void;
  setTimePeriod?: (weeks: number) => void;
  setFilterSituation?: (filter: string) => void;
  navigateToDate?: (weekOffset: number) => void;
  switchLayout?: (layout: string) => void;
};

/**
 * Bridges schedule module data/mutations into voice tool registration.
 * Why: avoids duplicated setup in page-level component composition.
 * Returns: null (side-effect registration only).
 */
export function ScheduleVoiceToolsBridge({
  weekStart,
  weekEnd,
  workspaceId,
  enrichedDays,
  shifts,
  absences,
  employees,
  computed,
  focusDayInUI,
  setSelectedDate,
  switchScheduleView,
  setTimePeriod,
  setFilterSituation,
  navigateToDate,
  switchLayout,
}: ScheduleVoiceToolsBridgeProps) {
  const { addProposal, pendingConfirmation, resolveConfirmation } = useAgentProposals();

  // Receive shift proposals from voice-agent via BotssonShell data-channel bridge.
  // Voice-agent publishes shift_proposal_* events → BotssonShell dispatches
  // "botsson:shift-proposal" → here we call addProposal() → ghost card renders.
  useEffect(() => {
    const handler = (e: Event) => {
      const proposal = (e as CustomEvent<ShiftProposal>).detail;
      if (proposal && typeof proposal === "object" && "type" in proposal) {
        addProposal(proposal);
      }
    };
    window.addEventListener("botsson:shift-proposal", handler);
    return () => window.removeEventListener("botsson:shift-proposal", handler);
  }, [addProposal]);

  // 2026-05-13: receive schedule view-state changes from voice-agent. The
  // voice tool set_schedule_* publishes schedule_view_change → BotssonShell
  // dispatches "botsson:schedule-view-change" → we route to the matching
  // uiAction setter. Path-gating already happens in the voice tool; here we
  // only verify the React setter is wired (fail-fast if undefined — voice
  // tool returned "success" optimistically, but the page may not have wired
  // that capability yet).
  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<ScheduleViewChangePayload>).detail;
      if (!payload || typeof payload !== "object" || !("action" in payload)) return;
      switch (payload.action) {
        case "navigate_date":
          if (!navigateToDate) {
            console.warn("[schedule-bridge] navigate_date received but navigateToDate not wired");
            return;
          }
          navigateToDate(payload.weekOffset);
          return;
        case "switch_columns":
          if (!switchScheduleView) {
            console.warn(
              "[schedule-bridge] switch_columns received but switchScheduleView not wired",
            );
            return;
          }
          switchScheduleView(payload.view);
          return;
        case "set_period":
          if (!setTimePeriod) {
            console.warn("[schedule-bridge] set_period received but setTimePeriod not wired");
            return;
          }
          setTimePeriod(payload.weeks);
          return;
        case "set_filter":
          if (!setFilterSituation) {
            console.warn("[schedule-bridge] set_filter received but setFilterSituation not wired");
            return;
          }
          setFilterSituation(payload.filter);
          return;
        case "switch_layout":
          if (!switchLayout) {
            console.warn("[schedule-bridge] switch_layout received but switchLayout not wired");
            return;
          }
          switchLayout(payload.layout);
          return;
        case "focus_day":
          focusDayInUI(payload.dateId, payload.openPlanner);
          return;
        default: {
          const _exhaustive: never = payload;
          console.warn("[schedule-bridge] unknown view-change action:", _exhaustive);
        }
      }
    };
    window.addEventListener("botsson:schedule-view-change", handler);
    return () => window.removeEventListener("botsson:schedule-view-change", handler);
  }, [
    navigateToDate,
    switchScheduleView,
    setTimePeriod,
    setFilterSituation,
    switchLayout,
    focusDayInUI,
  ]);

  const voiceTools = useScheduleVoiceTools({
    weekStart,
    weekEnd,
    workspaceId,
    days: enrichedDays,
    shifts,
    absences,
    employees,
    computed,
    uiActions: {
      focusDay: (dateId: string) => focusDayInUI(dateId, false),
      openDayPlanner: (dateId: string) => focusDayInUI(dateId, true),
      closeDayPlanner: () => setSelectedDate(null),
      switchScheduleView,
      setTimePeriod,
      setSelectedDate,
      setFilterSituation,
      navigateToDate,
      switchLayout,
    },
    // All write ops go through proposals — Botsson never mutates shifts directly
    addProposal,
  });

  // Register into Botsson tool registry — Emma gets schedule tools when on this page
  useRegisterTools("schedule", voiceTools);

  return (
    <AgentConfirmationDialog
      open={!!pendingConfirmation}
      title={pendingConfirmation?.title ?? ""}
      description={pendingConfirmation?.description ?? ""}
      onConfirm={() => resolveConfirmation(true)}
      onCancel={() => resolveConfirmation(false)}
    />
  );
}
