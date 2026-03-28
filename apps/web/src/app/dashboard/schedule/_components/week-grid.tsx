"use client";

/**
 * MalGrid — Main orchestrator for the week-first schedule grid.
 * Wires together command bar, context bar (stats), grid header/rows, and action bar.
 * Handles week navigation and all mutations.
 *
 * Columns are derived from department_shift_type_config — no template dependency.
 */

import { useState, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import {
  useWeekGridData,
  useFillFromTemplate,
  usePublishWeek,
  useResetWeek,
} from "@smartout/schedule";

import { MalCommandBar } from "./week-grid-command-bar";
import { WeekGridContextBar } from "./week-grid-context-bar";
import { MalGridHeader } from "./week-grid-header";
import { MalGridRow } from "./week-grid-row";
import { WeekGridEmptyState } from "./week-grid-empty-state";
import { CreateTemplateDialog } from "./create-template-dialog";
import { useAgentProposals } from "./agent-proposals-context";
import type { ShiftProposalCreate } from "./schedule-types";

// ISO week number calculation — avoids a date-fns dependency at the grid level
function getISOWeek(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

type MalGridProps = {
  departmentName: string;
  weekStart: string;
  departmentOptions: string[];
};

export function MalGrid({ departmentName, weekStart, departmentOptions }: MalGridProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTasks, setShowTasks] = useState(false);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);

  const { workspace } = useWorkspace();
  const { isDark, activeDepartment, setActiveDepartment, profileId } = useContext(DashboardContext);

  const router = useRouter();

  // Offset the base weekStart by the navigation offset to get the displayed week
  const currentWeekStart = useMemo(() => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + weekOffset * 7);
    return d.toISOString().slice(0, 10);
  }, [weekStart, weekOffset]);

  const weekLabel = "Uke " + getISOWeek(new Date(currentWeekStart + "T00:00:00"));

  const { data, isLoading, error, departmentId } = useWeekGridData({
    workspaceId: workspace.workspace_id,
    departmentName,
    weekStart: currentWeekStart,
    showTasks,
  });

  const fillMutation = useFillFromTemplate();
  const publishMutation = usePublishWeek();
  const resetMutation = useResetWeek();

  const { proposals, approveProposal, rejectProposal, approveAllProposals, clearAllProposals } =
    useAgentProposals();

  // Filter proposals relevant to this grid (create-type only)
  const gridProposals = useMemo(
    () => proposals.filter((p): p is ShiftProposalCreate => p.type === "create"),
    [proposals],
  );

  // Group proposals by cell key for efficient lookup in MalGridRow
  const proposalsByCell = useMemo(() => {
    const map = new Map<string, ShiftProposalCreate[]>();
    for (const p of gridProposals) {
      const configId = p.shiftTypeConfigId;
      if (!configId) continue;
      const key = `${p.dateId}::${configId}`;
      const existing = map.get(key) ?? [];
      existing.push(p);
      map.set(key, existing);
    }
    return map;
  }, [gridProposals]);

  return (
    <div className="flex h-full flex-col">
      <MalCommandBar
        isDark={isDark}
        departmentName={departmentName}
        departmentOptions={departmentOptions}
        onDepartmentChange={setActiveDepartment}
        showTasks={showTasks}
        onShowTasksChange={setShowTasks}
        weekLabel={weekLabel}
        onPrevWeek={() => setWeekOffset((prev) => prev - 1)}
        onNextWeek={() => setWeekOffset((prev) => prev + 1)}
      />

      {/* Context bar — stats + import/save actions, shown when columns exist */}
      {data && data.columns.length > 0 && (
        <WeekGridContextBar
          stats={{
            slotsPerDay: data ? Math.round(data.stats.totalSlots / 7) : 0,
            hoursPerDay: data ? Math.round(data.stats.totalHours / 7) : 0,
            costPerDay: data ? Math.round(data.stats.estimatedCost / 7) : 0,
          }}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground animate-pulse text-sm">Laster vaktplan...</div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-destructive text-sm">Kunne ikke laste vaktplan</div>
        </div>
      )}

      {/* Empty state — no shift type configs for this department */}
      {!isLoading && !error && (!data || data.columns.length === 0) && (
        <WeekGridEmptyState
          onCreateShiftType={() => router.push("/dashboard/settings#shift-types")}
        />
      )}

      {/* Grid — only rendered when we have resolved data with columns */}
      {!isLoading && !error && data && data.columns.length > 0 && (
        <>
          <div className="relative z-[1] flex-1 overflow-auto">
            <div
              className="min-w-[900px]"
              style={{
                display: "grid",
                gridTemplateColumns: `110px repeat(${data.columns.length}, 1fr)`,
              }}
            >
              <MalGridHeader columns={data.columns} />
              {data.weekDays.map((day) => (
                <MalGridRow
                  key={day.dateId}
                  day={day}
                  columns={data.columns}
                  cells={data.cells}
                  showTasks={showTasks}
                  proposalsByCell={proposalsByCell}
                  onApproveProposal={approveProposal}
                  onRejectProposal={rejectProposal}
                />
              ))}
            </div>
          </div>

          {/* Summary bar — quick stats across the entire week */}
          <div className="bg-muted border-border text-muted-foreground flex items-center justify-between border-t px-4 py-[7px] text-[11px]">
            <div className="flex gap-4">
              <span>
                Plasser{" "}
                <strong className="text-foreground font-bold">{data.stats.totalSlots}</strong>
              </span>
              <span>
                Bemannet{" "}
                <strong className="text-foreground font-bold">{data.stats.filledSlots}</strong>
              </span>
              <span>
                Timer{" "}
                <strong className="text-foreground font-mono font-bold">
                  {data.stats.totalHours}t
                </strong>
              </span>
              <span>
                Kostnad{" "}
                <strong className="text-foreground font-mono font-bold">
                  kr {data.stats.estimatedCost.toLocaleString("nb-NO")}
                </strong>
              </span>
              {showTasks && (
                <span>
                  Oppgaver{" "}
                  <strong className="text-foreground font-bold">{data.stats.taskCount}</strong>
                </span>
              )}
              {data.stats.swapRequests > 0 && (
                <span className="text-orange-500">
                  Bytter <strong className="font-bold">{data.stats.swapRequests}</strong>
                </span>
              )}
              {data.stats.emptySlots > 0 && (
                <span className="text-destructive">
                  Ubemannede <strong className="font-bold">{data.stats.emptySlots}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Proposal bulk actions — visible only when ghost proposals exist */}
          {gridProposals.length > 0 && (
            <div className="border-border bg-card/80 flex items-center gap-2 border-t px-4 py-2 backdrop-blur-sm">
              <span className="text-muted-foreground text-xs">
                {gridProposals.length} forslag venter
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => clearAllProposals()}
                className="text-muted-foreground hover:text-destructive rounded-[10px] px-3 py-1.5 text-xs font-bold transition-all"
              >
                Forkast alle
              </button>
              <button
                type="button"
                onClick={() => {
                  approveAllProposals().then(
                    () => toast.success(`${gridProposals.length} forslag godkjent`),
                    () => toast.error("Kunne ikke godkjenne alle forslag"),
                  );
                }}
                className="rounded-[10px] border border-green-500 bg-green-500/10 px-3.5 py-1.5 text-xs font-bold text-green-500 transition-all hover:bg-green-500/20"
              >
                Godkjenn alle forslag ({gridProposals.length})
              </button>
            </div>
          )}

          {/* Action bar — three tiers: secondary (left), tertiary (left), destructive + primary (right) */}
          <div className="border-border bg-card flex items-center gap-2 rounded-b-[14px] border-t px-4 py-2">
            {/* Secondary: Shift type + Turnus */}
            <button
              type="button"
              className="border-border bg-card text-foreground hover:bg-muted rounded-[10px] border px-3.5 py-1.5 text-xs font-bold transition-all"
            >
              Legg til vakttype
            </button>

            <button
              type="button"
              disabled
              className="border-border bg-card text-muted-foreground cursor-not-allowed rounded-[10px] border px-3.5 py-1.5 text-xs font-bold opacity-50"
            >
              Opprett turnus
            </button>

            {/* Tertiary: Import from template */}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground rounded-[10px] px-3 py-1.5 text-xs font-bold transition-all"
            >
              Last inn fra mal
            </button>

            <div className="flex-1" />

            {/* Destructive: Reset week */}
            <button
              type="button"
              onClick={() => {
                if (!departmentId) return;
                resetMutation.mutate(
                  {
                    workspaceId: workspace.workspace_id,
                    weekStart: currentWeekStart,
                    // templateId kept for mutation compat — will be removed when mutations are updated
                    templateId: "",
                    departmentId,
                    actorId: profileId ?? "",
                  },
                  {
                    onSuccess: () => toast.success("Uke tilbakestilt"),
                    onError: () => toast.error("Kunne ikke tilbakestille"),
                  },
                );
              }}
              disabled={resetMutation.isPending}
              className="text-destructive hover:bg-destructive/10 rounded-[10px] border-none px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-50"
            >
              Tilbakestill uke
            </button>

            {/* Primary: Publish */}
            <button
              type="button"
              onClick={() => {
                if (!departmentId) return;
                publishMutation.mutate(
                  {
                    workspaceId: workspace.workspace_id,
                    weekStart: currentWeekStart,
                    templateId: "",
                    departmentId,
                    actorId: profileId ?? "",
                  },
                  {
                    onSuccess: () => toast.success("Uke publisert"),
                    onError: () => toast.error("Kunne ikke publisere"),
                  },
                );
              }}
              disabled={publishMutation.isPending}
              className="rounded-[10px] border border-orange-500 bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all hover:shadow-[0_4px_16px_oklch(0.65_0.22_40/0.3)] disabled:opacity-50"
            >
              Publiser uke {weekLabel.replace("Uke ", "")}
            </button>
          </div>
        </>
      )}
      <CreateTemplateDialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen} />
    </div>
  );
}
