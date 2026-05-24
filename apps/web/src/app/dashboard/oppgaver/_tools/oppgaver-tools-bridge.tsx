"use client";

/**
 * oppgaver-tools-bridge.tsx — registers Botsson read tools for the oppgaver
 * Manager Timeline surface inside the harness registry.
 *
 * Why a bridge:
 *  - Keeps ManagerTimelineShell free from voice-tool registration bookkeeping.
 *  - Mounted inside ManagerTimelineShell after workspace context is available.
 *    When unmounted (e.g. workspace changes), tools are auto-unregistered by
 *    useRegisterTools.
 *
 * Context pinning (L-0340 emit-site #6 — oppgaver.context_pinned):
 *  - On mount, calls pinOppgaverContextAction to write the current view state
 *    to engine_memory (TTL 24h) so the global Botsson agent knows which date +
 *    view mode the manager is looking at.
 *  - On significant state changes (date, viewMode), fires a debounced re-pin
 *    (800ms) to keep context fresh.
 *  - On success, emits oppgaver.context_pinned (posthog + logger + activity_trail).
 *
 * L-0177 guard: emit() is only called when both workspace_id and actor_id are
 * non-empty. Skipped with // L-0177 comment when either is missing.
 *
 * ADR-0238 / L-0178: DomainChatOwnership is declared in ManagerTimelineShell,
 * not here. This bridge handles tool registration only.
 */

import { useContext, useEffect, useRef } from "react";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { emit, nonEmpty } from "@smartout/telemetry";
import { pinOppgaverContextAction } from "@/app/dashboard/_actions/pin-oppgaver-context";
import { useOppgaverTools } from "./use-oppgaver-tools";
import type { Band } from "../_chart/AreaBand";
import type { TimelineTask } from "../_chart/TaskBlock";

type ViewMode = "area" | "role" | "person";

type Props = {
  dateISO: string;
  viewMode: ViewMode;
  activeAreaIds: string[];
  onlyOpen: boolean;
  deviationsOnly: boolean;
  zoom: number;
  bands: Band[];
  tasks: TimelineTask[];
  uiActions: {
    setDate: (iso: string) => void;
    setViewMode: (mode: ViewMode) => void;
    toggleArea: (id: string) => void;
    focusTask: (taskId: string) => void;
  };
};

export function OppgaverToolsBridge({
  dateISO,
  viewMode,
  activeAreaIds,
  onlyOpen,
  deviationsOnly,
  zoom,
  bands,
  tasks,
  uiActions,
}: Props) {
  const ws = useWorkspaceOptional();
  const { profileId } = useContext(DashboardContext);
  const workspaceId = ws?.workspace.workspace_id ?? null;

  const tools = useOppgaverTools({
    dateISO,
    viewMode,
    activeAreaIds,
    onlyOpen,
    deviationsOnly,
    zoom,
    bands,
    tasks,
    uiActions,
  });

  useRegisterTools("oppgaver", tools);

  // ── Context pinning — oppgaver.context_pinned ─────────────────────────────
  // Debounced 800ms: initial mount + subsequent date/viewMode changes.
  const pinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPinKeyRef = useRef<string>("");

  useEffect(() => {
    const pinKey = `${dateISO}:${viewMode}`;
    if (pinKey === prevPinKeyRef.current) return;
    prevPinKeyRef.current = pinKey;

    if (pinTimerRef.current) clearTimeout(pinTimerRef.current);

    pinTimerRef.current = setTimeout(() => {
      void pinOppgaverContextAction({
        date_iso: dateISO,
        active_view: viewMode,
        active_filters: {
          area_ids: activeAreaIds.length > 0 ? activeAreaIds : undefined,
        },
      }).then((result) => {
        if (!result.ok) return;

        // L-0177: skip emit if either workspace_id or actor_id is missing/empty.
        if (!workspaceId || !profileId) return; // L-0177

        void emit({
          event: "oppgaver.context_pinned",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            data: {
              date_iso: dateISO,
              active_view: viewMode,
            },
          },
        });
      });
    }, 800);

    return () => {
      if (pinTimerRef.current) clearTimeout(pinTimerRef.current);
    };
  }, [dateISO, viewMode, activeAreaIds, workspaceId, profileId]);

  return null;
}
