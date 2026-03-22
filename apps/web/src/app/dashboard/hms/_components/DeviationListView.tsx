"use client";

import { useContext } from "react";
import { User } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Badge } from "@/components/ui/badge";
import type { DeviationRow } from "@smartout/hms";

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
  if (hours < 1) return "Na";
  if (hours < 24) return `${hours}t`;
  return `${Math.floor(hours / 24)}d`;
}

type Props = {
  deviations: DeviationRow[];
  onSelect: (deviation: DeviationRow) => void;
};

export function DeviationListView({ deviations, onSelect }: Props) {
  const { isDark } = useContext(DashboardContext);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b ${isDark ? "border-zinc-800" : "border-border"}`}>
            <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
              Alvorlighet
            </th>
            <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
              Tittel
            </th>
            <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">Avd.</th>
            <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
              Domene
            </th>
            <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
              Rapportert
            </th>
            <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">Alder</th>
          </tr>
        </thead>
        <tbody>
          {deviations.map((d) => (
            <tr
              key={d.deviationId}
              onClick={() => onSelect(d)}
              className={`hover:bg-muted/30 cursor-pointer border-b transition-colors ${isDark ? "border-zinc-800/50" : "border-border/50"} ${d.status === "resolved" ? "opacity-60" : ""}`}
            >
              <td className="px-3 py-2.5">{severityBadge(d.severity)}</td>
              <td className="text-foreground px-3 py-2.5 font-medium">{d.title}</td>
              <td className="text-muted-foreground px-3 py-2.5 text-xs">
                {d.departmentName ?? "—"}
              </td>
              <td className="text-muted-foreground px-3 py-2.5 text-xs capitalize">{d.domain}</td>
              <td className="text-muted-foreground px-3 py-2.5 text-xs">{d.reporterName ?? "—"}</td>
              <td className="text-muted-foreground px-3 py-2.5 text-xs">
                {relativeTime(d.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
