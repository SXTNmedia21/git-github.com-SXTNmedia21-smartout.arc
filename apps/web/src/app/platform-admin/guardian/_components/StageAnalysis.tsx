"use client";

// UI Events:
// - visual: stage analysis table with avg time and bottleneck identification
// - color-regime: time-based (long stages orange, very long red)

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StageAnalysisEntry } from "../_hooks/useStageAnalysis";

type StageAnalysisProps = {
  stages: StageAnalysisEntry[] | undefined;
  isLoading: boolean;
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (remaining === 0) return `${minutes}m`;
  return `${minutes}m ${remaining}s`;
}

function durationColor(seconds: number): string {
  if (seconds > 300) return "text-red-400"; // > 5 min
  if (seconds > 120) return "text-orange-400"; // > 2 min
  return "text-foreground";
}

function isBottleneck(entry: StageAnalysisEntry, all: StageAnalysisEntry[]): boolean {
  if (all.length < 2) return false;
  const avg = all.reduce((sum, e) => sum + e.avgTimeSeconds, 0) / all.length;
  return entry.avgTimeSeconds > avg * 1.5;
}

export function StageAnalysis({ stages, isLoading }: StageAnalysisProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-zinc-800/30" />
        ))}
      </div>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Ingen stage-data tilgjengelig.
      </p>
    );
  }

  return (
    <div className="border-border rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Stage</TableHead>
            <TableHead className="text-xs">Oppdrag</TableHead>
            <TableHead className="text-right text-xs">Snitt tid</TableHead>
            <TableHead className="text-right text-xs">Fullfort</TableHead>
            <TableHead className="text-right text-xs">Frafall</TableHead>
            <TableHead className="text-right text-xs">Rate</TableHead>
            <TableHead className="text-right text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages.map((stage) => {
            const bottleneck = isBottleneck(stage, stages);
            return (
              <TableRow key={`${stage.missionId}-${stage.stageId}`}>
                <TableCell className="text-foreground text-sm font-medium">
                  {stage.stageName}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[120px] truncate text-xs">
                  {stage.missionId === "unknown" ? "—" : stage.missionId}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right text-sm font-medium tabular-nums",
                    durationColor(stage.avgTimeSeconds),
                  )}
                >
                  {stage.avgTimeSeconds > 0 ? formatDuration(stage.avgTimeSeconds) : "—"}
                </TableCell>
                <TableCell className="text-right text-sm text-emerald-400 tabular-nums">
                  {stage.completionCount}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right text-sm tabular-nums",
                    stage.dropOffCount > 0 ? "text-red-400" : "text-muted-foreground",
                  )}
                >
                  {stage.dropOffCount}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right text-sm font-medium tabular-nums",
                    stage.completionRate >= 80
                      ? "text-emerald-400"
                      : stage.completionRate >= 50
                        ? "text-orange-400"
                        : "text-red-400",
                  )}
                >
                  {stage.completionRate}%
                </TableCell>
                <TableCell className="text-right">
                  {bottleneck ? (
                    <Badge
                      variant="outline"
                      className="border-orange-500/20 bg-orange-500/10 px-1.5 py-0 text-[10px] text-orange-400"
                    >
                      Flaskehals
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-400"
                    >
                      OK
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
