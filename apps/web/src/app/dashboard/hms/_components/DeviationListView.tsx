"use client";

import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DeviationRow } from "@smartout/hms";

function severityBadge(severity: string) {
  const styles: Record<string, string> = {
    critical: "bg-destructive text-destructive-foreground",
    high: "bg-destructive/80 text-destructive-foreground",
    medium: "bg-warning text-warning-foreground",
    low: "bg-info text-info-foreground",
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border border-b">
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
              className={`hover:bg-muted/30 border-border/50 cursor-pointer border-b transition-colors ${d.status === "resolved" ? "opacity-60" : ""}`}
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
