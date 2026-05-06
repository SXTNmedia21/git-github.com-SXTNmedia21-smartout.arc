/**
 * HistoryTable.tsx — read-only table of past settlement runs.
 *
 * Columns: Periode, Workspaces, Status, Startet, Fullført, Handlinger.
 * Click "Vis pakke" → /avstemming/{run_id}.
 * Nordic Split: CSS vars only.
 */

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SettlementRunRow } from "@/lib/avstemming/fetchers";

type Props = {
  runs: SettlementRunRow[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function periodLabel(periodStart: string): string {
  return new Date(periodStart + "T00:00:00Z").toLocaleDateString("nb-NO", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "succeeded") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

function statusLabel(status: string): string {
  if (status === "succeeded") return "Fullført";
  if (status === "failed") return "Feilet";
  if (status === "running") return "Kjører";
  return status;
}

export function HistoryTable({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <div className="border-border bg-card rounded-md border px-6 py-10 text-center">
        <p className="text-muted-foreground text-sm">Ingen tidligere avstemmingar.</p>
      </div>
    );
  }

  return (
    <div className="border-border overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border bg-muted/50 text-muted-foreground border-b text-left text-xs">
            <th className="px-4 py-3 font-medium">Periode</th>
            <th className="px-4 py-3 font-medium">Workspaces</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Startet</th>
            <th className="px-4 py-3 font-medium">Fullført</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="bg-card divide-border divide-y">
          {runs.map((run) => (
            <tr key={run.run_id} className="hover:bg-muted/30 transition-colors">
              <td className="text-foreground px-4 py-3 font-medium">
                {periodLabel(run.period_start)}
              </td>
              <td className="text-muted-foreground px-4 py-3 tabular-nums">
                {run.workspace_ids.length}
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant(run.status)} className="text-xs">
                  {statusLabel(run.status)}
                </Badge>
              </td>
              <td className="text-muted-foreground px-4 py-3 tabular-nums">
                {fmtDate(run.started_at)}
              </td>
              <td className="text-muted-foreground px-4 py-3 tabular-nums">
                {fmtDate(run.completed_at)}
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/avstemming/${run.run_id}`}>Vis pakke</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
