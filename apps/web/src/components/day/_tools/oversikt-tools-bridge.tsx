"use client";

/**
 * oversikt-tools-bridge.tsx — registers Botsson read tools for the day-control
 * "Oversikt" surface inside the harness registry.
 *
 * Why a bridge:
 *  - Keeps WebDayControl free from voice-tool registration bookkeeping.
 *  - Mounts ONLY in the `ready` state (session resolved). When mounted in
 *    loading / no-session, write tools could fire against missing context;
 *    keeping the bridge gated avoids that class of bug entirely.
 *
 * Data sourcing:
 *  - Re-uses the same TanStack hooks the tabs already call (useRoster,
 *    useDeviations, useDayBudget, useSessionHooksWithTasks,
 *    useDayTimelineEvents). Query-key dedup means there is no extra
 *    network cost — the bridge reads from the same cache entries.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically. When the
 *    bridge unmounts (e.g. session goes from active → no-session), tools
 *    are removed from the registry.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useRoster } from "@/app/dashboard/_hooks/use-roster";
import { useDeviations } from "@/app/dashboard/hms/_hooks/use-deviations";
import { useDayBudget } from "@/app/dashboard/_hooks/use-day-budget";
import { useSessionHooksWithTasks } from "@/app/dashboard/_hooks/use-session-hooks-with-tasks";
import { useDayTimelineEvents } from "@/app/dashboard/_hooks/use-day-timeline-events";
import { useCascadeTasks } from "@/app/dashboard/_hooks/use-cascade-tasks";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useAdminContext, type AdminViewType } from "@/components/dashboard/contexts";
import type { UiPhase } from "@smartout/utils";

import { useOversiktTools } from "./use-oversikt-tools";

type Props = {
  sessionId: string;
  departmentId: string;
  departmentName: string;
  dateISO: string;
  phase: UiPhase;
  uiActions: {
    setTab: (tab: string) => void;
    setDate: (iso: string) => void;
  };
};

export function OversiktToolsBridge({
  sessionId,
  departmentId,
  departmentName,
  dateISO,
  phase,
  uiActions,
}: Props) {
  const ws = useWorkspaceOptional();
  const { setAdminView } = useAdminContext();
  const workspaceId = ws?.workspace.workspace_id ?? null;

  const rosterQ = useRoster(departmentId, dateISO);
  const openDevsQ = useDeviations({ status: ["open", "acknowledged"] });
  const escalatedDevsQ = useDeviations({ status: ["escalated"] });
  const budgetQ = useDayBudget(departmentId, dateISO);
  const hooksQ = useSessionHooksWithTasks(sessionId);
  const timelineQ = useDayTimelineEvents({
    workspaceId,
    departmentId,
    sessionId,
    dateISO,
  });
  // Flatten all tasks from all groups for the tool — same pattern as OverviewTab.tsx:111
  const cascadeQ = useCascadeTasks();
  const cascadeTasks = (cascadeQ.data?.groups ?? []).flatMap((g) => g.tasks);

  const tools = useOversiktTools({
    dateISO,
    phase,
    departmentId,
    departmentName,
    sessionId,
    roster: rosterQ.data ?? [],
    deviationsOpen: openDevsQ.data ?? [],
    deviationsEscalated: escalatedDevsQ.data ?? [],
    sessionHooks: hooksQ.data ?? [],
    dayBudget: budgetQ.data ?? null,
    timelineEvents: timelineQ.data ?? [],
    cascadeTasks,
    uiActions: {
      setTab: uiActions.setTab,
      setDate: uiActions.setDate,
      // Cast through AdminViewType — validated at runtime inside switchVariantView impl.
      setVariantView: (v: string) => setAdminView(v as AdminViewType),
    },
  });

  useRegisterTools("oversikt", tools);

  return null;
}
