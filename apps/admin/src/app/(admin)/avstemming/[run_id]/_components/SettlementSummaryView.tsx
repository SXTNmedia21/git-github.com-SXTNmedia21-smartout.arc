/**
 * SettlementSummaryView.tsx — renders settlement_run.summary JSONB.
 *
 * Shows per-workspace breakdown table + global totals block + discrepancy list.
 * Data comes from the SettlementSummary shape (packages/billing/src/types.ts).
 * Nordic Split: CSS vars only.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  SettlementSummary,
  SettlementWorkspaceSummary,
  SettlementDiscrepancy,
} from "@smartout/billing";

type Props = {
  summary: SettlementSummary;
};

/** Format a number as NOK with Norwegian thousand-separator. */
function fmtNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Map status_summary text to a badge variant hint. */
function statusVariant(statusSummary: string): "default" | "secondary" | "outline" | "destructive" {
  if (statusSummary.includes("100%")) return "secondary";
  if (statusSummary.includes("forfalt") || statusSummary.includes("utestående")) return "outline";
  return "outline";
}

function WorkspaceTable({
  byWorkspace,
}: {
  byWorkspace: Record<string, SettlementWorkspaceSummary>;
}) {
  const rows = Object.entries(byWorkspace);
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Ingen workspaces i denne kjøringen.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left text-xs">
            <th className="pb-2 pr-4 font-medium">Workspace</th>
            <th className="pb-2 pr-4 font-medium">Ordre</th>
            <th className="pb-2 pr-4 text-right font-medium">Ekskl MVA</th>
            <th className="pb-2 pr-4 text-right font-medium">Inkl MVA</th>
            <th className="pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map(([_wsId, ws]) => (
            <tr key={_wsId} className="py-2">
              <td className="text-foreground py-2 pr-4 font-medium">{ws.workspace_name}</td>
              <td className="text-muted-foreground py-2 pr-4">{ws.count_orders}</td>
              <td className="text-foreground py-2 pr-4 text-right tabular-nums">
                {fmtNok(ws.amount_excl_vat)}
              </td>
              <td className="text-foreground py-2 pr-4 text-right tabular-nums">
                {fmtNok(ws.amount_incl_vat)}
              </td>
              <td className="py-2">
                <Badge variant={statusVariant(ws.status_summary)} className="text-xs">
                  {ws.status_summary}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TotalsBlock({ totals }: { totals: SettlementSummary["totals"] }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Fakturert ekskl MVA</span>
        <span className="text-foreground font-medium tabular-nums">
          {fmtNok(totals.amount_excl_vat)} NOK
        </span>
      </div>
      {Object.entries(totals.vat_breakdown).map(([rate, amount]) => (
        <div key={rate} className="flex justify-between">
          <span className="text-muted-foreground">MVA ({Math.round(Number(rate) * 100)}%)</span>
          <span className="text-muted-foreground tabular-nums">{fmtNok(amount)} NOK</span>
        </div>
      ))}
      <div className="border-border flex justify-between border-t pt-1">
        <span className="text-foreground font-medium">Fakturert inkl MVA</span>
        <span className="text-foreground font-semibold tabular-nums">
          {fmtNok(totals.amount_incl_vat)} NOK
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Mottatt</span>
        <span className="text-foreground tabular-nums">{fmtNok(totals.amount_paid)} NOK</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Utestående</span>
        <span className="text-foreground tabular-nums">
          {fmtNok(totals.amount_outstanding)} NOK
        </span>
      </div>
    </div>
  );
}

function DiscrepancyList({ discrepancies }: { discrepancies: SettlementDiscrepancy[] }) {
  if (discrepancies.length === 0) {
    return <p className="text-muted-foreground text-sm">Ingen avvik i denne perioden.</p>;
  }

  return (
    <ul className="space-y-2">
      {discrepancies.map((d, i) => {
        let label = "";
        if (d.type === "overdue") {
          label = `${d.company_name} — faktura forfalt ${d.days_overdue} dager`;
        } else if (d.type === "partial_payment") {
          label = `Faktura — partial betaling ${fmtNok(d.received)} av ${fmtNok(d.expected)} NOK`;
        } else if (d.type === "missing_org_nr") {
          label = `${d.company_name} — mangler org.nr`;
        }
        return (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Badge
              variant={d.severity === "high" ? "destructive" : "outline"}
              className="mt-0.5 flex-shrink-0 text-xs"
            >
              {d.severity}
            </Badge>
            <span className="text-foreground">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function SettlementSummaryView({ summary }: Props) {
  const discrepancyCount = summary.discrepancies.length;

  return (
    <div className="space-y-4">
      {/* Per-workspace breakdown */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Per workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceTable byWorkspace={summary.by_workspace} />
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Totalt</CardTitle>
        </CardHeader>
        <CardContent>
          <TotalsBlock totals={summary.totals} />
        </CardContent>
      </Card>

      {/* Discrepancies */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Avvik{discrepancyCount > 0 ? ` (${discrepancyCount})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DiscrepancyList discrepancies={summary.discrepancies} />
        </CardContent>
      </Card>
    </div>
  );
}
