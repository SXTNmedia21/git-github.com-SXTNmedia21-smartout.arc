"use client";

import { useContext, useMemo } from "react";
import { AlertTriangle, Clock, User } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Badge } from "@/components/ui/badge";
import type { DeviationRow, DeviationStatus } from "@smartout/hms";

type Column = {
  status: DeviationStatus;
  label: string;
  color: string;
  borderColor: string;
};

const COLUMNS: Column[] = [
  { status: "open", label: "Apen", color: "text-red-500", borderColor: "border-red-500" },
  {
    status: "acknowledged",
    label: "Tildelt",
    color: "text-yellow-500",
    borderColor: "border-yellow-500",
  },
  {
    status: "escalated",
    label: "Eskalert",
    color: "text-blue-500",
    borderColor: "border-blue-500",
  },
  { status: "resolved", label: "Lukket", color: "text-green-500", borderColor: "border-green-500" },
];

function severityBadge(severity: string) {
  const styles: Record<string, string> = {
    critical: "bg-red-500 text-white",
    high: "bg-red-500/80 text-white",
    medium: "bg-yellow-500 text-white",
    low: "bg-blue-500 text-white",
  };
  const labels: Record<string, string> = {
    critical: "Kritisk",
    high: "Hoy",
    medium: "Middels",
    low: "Lav",
  };
  return (
    <span
      className={`${styles[severity] ?? "bg-muted"} rounded px-1.5 py-0.5 text-[8px] font-semibold`}
    >
      {labels[severity] ?? severity}
    </span>
  );
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Nå";
  if (hours < 24) return `${hours}t siden`;
  const days = Math.floor(hours / 24);
  return `${days}d siden`;
}

type Props = {
  deviations: DeviationRow[];
  onSelect: (deviation: DeviationRow) => void;
};

export function DeviationKanban({ deviations, onSelect }: Props) {
  const { isDark } = useContext(DashboardContext);

  const grouped = useMemo(() => {
    const map: Record<DeviationStatus, DeviationRow[]> = {
      open: [],
      acknowledged: [],
      escalated: [],
      resolved: [],
    };
    for (const d of deviations) {
      (map[d.status] ?? map.open).push(d);
    }
    return map;
  }, [deviations]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const items = grouped[col.status] ?? [];
        return (
          <div key={col.status} className="min-w-[200px] flex-1">
            {/* Column header */}
            <div
              className={`mb-2 flex items-center justify-between border-b-2 pb-2 ${col.borderColor}`}
            >
              <span className={`text-[10px] font-bold tracking-wider uppercase ${col.color}`}>
                {col.label}
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${col.status === "open" ? "bg-red-500" : col.status === "acknowledged" ? "bg-yellow-500" : col.status === "escalated" ? "bg-blue-500" : "bg-green-500"}`}
              >
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {items.map((d) => (
                <button
                  key={d.deviationId}
                  onClick={() => onSelect(d)}
                  className={`hover:bg-muted/50 w-full rounded-lg border p-3 text-left transition-colors ${
                    isDark ? "border-zinc-800 bg-zinc-900/50" : "border-border bg-card"
                  } ${d.status === "resolved" ? "opacity-60" : ""}`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    {severityBadge(d.severity)}
                    <span className="text-muted-foreground text-[9px]">
                      {relativeTime(d.createdAt)}
                    </span>
                  </div>
                  <p className="text-foreground mb-1 text-xs font-semibold">{d.title}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {d.departmentName ?? "—"} · {d.domain}
                  </p>
                  {d.reporterName && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <User className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground text-[9px]">{d.reporterName}</span>
                    </div>
                  )}
                </button>
              ))}
              {items.length === 0 && (
                <p className="text-muted-foreground py-4 text-center text-[10px]">Ingen</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
