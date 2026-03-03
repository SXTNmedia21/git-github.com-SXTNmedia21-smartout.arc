"use client";

// UI Events:
// - action: setTimeRange("today" | "7d" | "30d") — changes analytics time window
// - visual: session stats, tool usage, stage analysis sections
// - color-regime: rate-based across all sub-components

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TimeRange } from "../_hooks/useSessionHistory";
import { useSessionHistory } from "../_hooks/useSessionHistory";
import { useToolUsageStats } from "../_hooks/useToolUsageStats";
import { useStageAnalysis } from "../_hooks/useStageAnalysis";
import { SessionStats } from "./SessionStats";
import { ToolUsageTable } from "./ToolUsageTable";
import { StageAnalysis } from "./StageAnalysis";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "I dag" },
  { value: "7d", label: "7 dager" },
  { value: "30d", label: "30 dager" },
];

export function GuardianAnalytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>("today");

  const { data: sessionStats, isLoading: sessionsLoading } = useSessionHistory(timeRange);
  const { data: toolStats, isLoading: toolsLoading } = useToolUsageStats(timeRange);
  const { data: stageStats, isLoading: stagesLoading } = useStageAnalysis();

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">Analyse</h2>
        <div className="bg-muted inline-flex items-center rounded-lg p-1">
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeRange(option.value)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                timeRange === option.value
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Session Statistics */}
      <div>
        <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
          Sesjonsstatistikk
        </h3>
        <SessionStats stats={sessionStats} isLoading={sessionsLoading} />
      </div>

      {/* Tool Usage */}
      <div>
        <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
          Tool-bruk
        </h3>
        <ToolUsageTable tools={toolStats} isLoading={toolsLoading} />
      </div>

      {/* Stage Analysis */}
      <div>
        <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
          Stage-analyse
        </h3>
        <StageAnalysis stages={stageStats} isLoading={stagesLoading} />
      </div>
    </div>
  );
}
