/**
 * runner-header.tsx — Controls and status overview for the E2E runner.
 *
 * Two action buttons (smoke / full run), a status dot showing idle/running/done,
 * a progress bar tracking completed tests, and a summary line after completion.
 */

"use client";

import { Zap, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { RunState, RunSummary } from "../_hooks/use-e2e-runner";

type RunnerHeaderProps = {
  state: RunState;
  isRunning: boolean;
  onRunSmoke: () => void;
  onRunAll: () => void;
};

// Compute completed test count across all specs
function completedCount(state: RunState): number {
  let count = 0;
  for (const spec of state.specs.values()) {
    for (const test of spec.tests) {
      if (test.status === "pass" || test.status === "fail" || test.status === "skip") {
        count++;
      }
    }
  }
  return count;
}

// Total tests in the current run
function totalCount(state: RunState): number {
  let count = 0;
  for (const spec of state.specs.values()) {
    count += spec.tests.length;
  }
  return count;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function SummaryLine({ summary }: { summary: RunSummary }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-medium text-emerald-500">{summary.passed} ok</span>
      {summary.failed > 0 && (
        <span className="font-medium text-rose-500">{summary.failed} feil</span>
      )}
      {summary.skipped > 0 && (
        <span className="text-muted-foreground">{summary.skipped} hoppet</span>
      )}
      <span className="text-muted-foreground">{formatDuration(summary.duration)}</span>
    </div>
  );
}

export function RunnerHeader({ state, isRunning, onRunSmoke, onRunAll }: RunnerHeaderProps) {
  const total = totalCount(state);
  const completed = completedCount(state);
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Status dot color + pulse
  const dotClass = cn(
    "h-2.5 w-2.5 rounded-full flex-shrink-0",
    state.status === "idle" && "bg-muted-foreground/40",
    state.status === "running" && "animate-pulse bg-orange-400",
    state.status === "done" && (state.summary?.failed ?? 0) > 0
      ? "bg-rose-500"
      : state.status === "done"
        ? "bg-emerald-500"
        : "",
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Action buttons + status dot */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onRunSmoke} disabled={isRunning}>
          <Zap className="mr-1.5 h-4 w-4" />
          Kör smoke
        </Button>

        <Button size="sm" onClick={onRunAll} disabled={isRunning}>
          <Play className="mr-1.5 h-4 w-4" />
          Kör alle
        </Button>

        {/* Status dot */}
        <div className="flex items-center gap-1.5 pl-1">
          <span className={dotClass} />
          <span className="text-muted-foreground text-xs">
            {state.status === "idle" && "Inaktiv"}
            {state.status === "running" && `${completed}/${total} tester`}
            {state.status === "done" && "Ferdig"}
          </span>
        </div>
      </div>

      {/* Progress bar — visible only while a run is active or just finished */}
      {state.status !== "idle" && total > 0 && <Progress value={progress} className="h-1.5" />}

      {/* Summary line — shown after run completes */}
      {state.status === "done" && state.summary && <SummaryLine summary={state.summary} />}

      {/* Error banner */}
      {state.error && (
        <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{state.error}</p>
      )}
    </div>
  );
}
