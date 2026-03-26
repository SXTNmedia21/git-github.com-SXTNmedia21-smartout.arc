"use client";

/**
 * MalGrid — Main orchestrator for Mal-modus (template-based schedule).
 * Wires together command bar, template selector, grid header/rows, and action bar.
 * Handles week navigation, template switching via URL params, and all mutations.
 *
 * Must be wrapped in <Suspense> at the integration point because it calls useSearchParams().
 */

import { useState, useContext, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { useMalData, useFillFromTemplate, usePublishWeek, useResetWeek } from "@smartout/schedule";

import { MalCommandBar } from "./mal-command-bar";
import { MalTemplateBar } from "./mal-template-bar";
import { MalGridHeader } from "./mal-grid-header";
import { MalGridRow } from "./mal-grid-row";
import { MalEmptyState } from "./mal-empty-state";
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
  const searchParams = useSearchParams();
  const router = useRouter();

  const [weekOffset, setWeekOffset] = useState(0);
  const [showTasks, setShowTasks] = useState(false);

  const { workspace } = useWorkspace();
  const { isDark, activeLocation, setActiveLocation, profileId } = useContext(DashboardContext);

  // Offset the base weekStart by the navigation offset to get the displayed week
  const currentWeekStart = useMemo(() => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + weekOffset * 7);
    return d.toISOString().slice(0, 10);
  }, [weekStart, weekOffset]);

  const weekLabel = "Uke " + getISOWeek(new Date(currentWeekStart + "T00:00:00"));

  const { data, isLoading, error, templates, departmentId } = useMalData({
    workspaceId: workspace.workspace_id,
    departmentName,
    weekStart: currentWeekStart,
    templateId: searchParams.get("template"),
    showTasks,
  });

  const fillMutation = useFillFromTemplate();
  const publishMutation = usePublishWeek();
  const resetMutation = useResetWeek();

  const { proposals, approveProposal, rejectProposal, approveAllProposals, clearAllProposals } =
    useAgentProposals();

  // Filter proposals relevant to this template (create-type with templateShiftId)
  const malProposals = useMemo(
    () =>
      proposals.filter(
        (p): p is ShiftProposalCreate =>
          p.type === "create" && "templateShiftId" in p && !!p.templateShiftId,
      ),
    [proposals],
  );

  // Group proposals by cell key for efficient lookup in MalGridRow
  const proposalsByCell = useMemo(() => {
    const map = new Map<string, ShiftProposalCreate[]>();
    for (const p of malProposals) {
      if (!p.templateShiftId) continue;
      const key = `${p.dateId}::${p.templateShiftId}`;
      const existing = map.get(key) ?? [];
      existing.push(p);
      map.set(key, existing);
    }
    return map;
  }, [malProposals]);

  // Switching templates updates the URL so the selection survives a page refresh
  const handleTemplateChange = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("template", id);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  return (
    <div className="flex h-full flex-col">
      <MalCommandBar
        isDark={isDark}
        departmentName={departmentName}
        departmentOptions={departmentOptions}
        onDepartmentChange={setActiveLocation}
        showTasks={showTasks}
        onShowTasksChange={setShowTasks}
        weekLabel={weekLabel}
        onPrevWeek={() => setWeekOffset((prev) => prev - 1)}
        onNextWeek={() => setWeekOffset((prev) => prev + 1)}
      />

      {/* Template bar — only shown when at least one template exists */}
      {templates.length > 0 && (
        <MalTemplateBar
          templates={templates}
          activeTemplateId={data?.templateId ?? null}
          onTemplateChange={handleTemplateChange}
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

      {/* Empty state — no templates configured for this department */}
      {!isLoading && !error && templates.length === 0 && <MalEmptyState />}

      {/* Grid — only rendered when we have resolved data */}
      {!isLoading && !error && data && (
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
          {malProposals.length > 0 && (
            <div className="border-border bg-card/80 flex items-center gap-2 border-t px-4 py-2 backdrop-blur-sm">
              <span className="text-muted-foreground text-xs">
                {malProposals.length} forslag venter
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
                    () => toast.success(`${malProposals.length} forslag godkjent`),
                    () => toast.error("Kunne ikke godkjenne alle forslag"),
                  );
                }}
                className="rounded-[10px] border border-green-500 bg-green-500/10 px-3.5 py-1.5 text-xs font-bold text-green-500 transition-all hover:bg-green-500/20"
              >
                Godkjenn alle forslag ({malProposals.length})
              </button>
            </div>
          )}

          {/* Action bar — publish, fill, and reset actions */}
          <div className="border-border bg-card flex items-center gap-2 rounded-b-[14px] border-t px-4 py-2">
            <button
              onClick={() => {
                if (!departmentId || !data.templateId) return;
                publishMutation.mutate(
                  {
                    workspaceId: workspace.workspace_id,
                    weekStart: currentWeekStart,
                    templateId: data.templateId,
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

            <button
              onClick={() => {
                if (!departmentId || !data.templateId) return;
                fillMutation.mutate(
                  {
                    workspaceId: workspace.workspace_id,
                    weekStart: currentWeekStart,
                    templateId: data.templateId,
                    departmentId,
                    actorId: profileId ?? "",
                  },
                  {
                    onSuccess: () => toast.success("Vakter fylt fra mal"),
                    onError: () => toast.error("Kunne ikke fylle fra mal"),
                  },
                );
              }}
              disabled={fillMutation.isPending}
              className="border-border bg-card text-foreground hover:bg-muted rounded-[10px] border px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-50"
            >
              Fyll fra mal
            </button>

            <button className="border-border bg-card text-foreground hover:bg-muted rounded-[10px] border px-3.5 py-1.5 text-xs font-bold transition-all">
              Legg til vakttype
            </button>

            {/* Turnus creation — planned for a future iteration */}
            <button
              disabled
              className="border-border bg-card text-muted-foreground cursor-not-allowed rounded-[10px] border px-3.5 py-1.5 text-xs font-bold opacity-50"
            >
              Opprett turnus
            </button>

            <div className="flex-1" />

            <button
              onClick={() => {
                if (!departmentId || !data.templateId) return;
                resetMutation.mutate(
                  {
                    workspaceId: workspace.workspace_id,
                    weekStart: currentWeekStart,
                    templateId: data.templateId,
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
          </div>
        </>
      )}
    </div>
  );
}
