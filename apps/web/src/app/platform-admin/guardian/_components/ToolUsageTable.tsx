"use client";

// UI Events:
// - visual: tool usage table sorted by call count
// - color-regime: success rate (>=90% good, >=70% warning, <70% critical)

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ToolUsageStat } from "../_hooks/useToolUsageStats";

type ToolUsageTableProps = {
  tools: ToolUsageStat[] | undefined;
  isLoading: boolean;
};

function rateColor(rate: number): string {
  if (rate >= 90) return "text-emerald-400";
  if (rate >= 70) return "text-orange-400";
  return "text-red-400";
}

export function ToolUsageTable({ tools, isLoading }: ToolUsageTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-muted/30 h-10 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!tools || tools.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">Ingen tool-data i perioden.</p>
    );
  }

  return (
    <div className="border-border rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Tool</TableHead>
            <TableHead className="text-right text-xs">Kall</TableHead>
            <TableHead className="text-right text-xs">Suksess</TableHead>
            <TableHead className="text-right text-xs">Feil</TableHead>
            <TableHead className="text-right text-xs">Suksessrate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tools.map((tool) => (
            <TableRow key={tool.toolName}>
              <TableCell className="text-foreground text-sm font-medium">{tool.toolName}</TableCell>
              <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                {tool.callCount}
              </TableCell>
              <TableCell className="text-right text-sm text-emerald-400 tabular-nums">
                {tool.successCount}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right text-sm tabular-nums",
                  tool.failureCount > 0 ? "text-red-400" : "text-muted-foreground",
                )}
              >
                {tool.failureCount}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right text-sm font-medium tabular-nums",
                  rateColor(tool.successRate),
                )}
              >
                {tool.successRate}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
