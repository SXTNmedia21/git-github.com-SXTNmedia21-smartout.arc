// WorkspaceHeader.tsx — kartotek header section
//
// Shows company name, workspace name, org_nr, status badge, and
// outstanding amount. Receives the summary slice from the page.
// Server Component — no "use client".
//
// If summary is null (workspace not found or RLS denied at the summary
// level), renders a minimal header from the workspace name alone.

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { KartotekSummary } from "@smartout/billing/server";

type Props = {
  summary: KartotekSummary | null;
  workspaceName: string;
  workspaceId: string;
  /** actor_id for potential future telemetry use. */
  userId: string;
};

function statusDisplay(status: string | null): { label: string; className: string } {
  switch (status) {
    case "active":
      return { label: "Aktiv", className: "bg-primary/15 text-primary border-primary/30" };
    case "sandbox":
      return { label: "Sandbox", className: "bg-muted text-muted-foreground border-border" };
    case "suspended":
      return {
        label: "Suspendert",
        className: "bg-destructive/15 text-destructive border-destructive/30",
      };
    case "archived":
      return {
        label: "Arkivert",
        className: "bg-muted text-muted-foreground border-border opacity-60",
      };
    default:
      return { label: "Ukjent", className: "bg-muted text-muted-foreground" };
  }
}

function formatNok(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function WorkspaceHeader({ summary, workspaceName, workspaceId: _workspaceId }: Props) {
  if (!summary) {
    return (
      <Card>
        <CardContent className="p-6">
          <h1 className="font-heading text-2xl">{workspaceName}</h1>
          <p className="text-muted-foreground mt-1 text-sm">Sammendragsdata ikke tilgjengelig</p>
        </CardContent>
      </Card>
    );
  }

  const { label, className } = statusDisplay(summary.subscription_status);
  const hasOutstanding =
    summary.amount_outstanding_incl_vat != null && summary.amount_outstanding_incl_vat > 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl">{summary.workspace_name ?? workspaceName}</h1>
              <Badge variant="outline" className={className}>
                {label}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">{summary.company_name}</p>
          </div>

          {hasOutstanding && (
            <div className="text-right">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Utestående</p>
              <p className="text-destructive font-heading text-2xl font-semibold">
                {formatNok(summary.amount_outstanding_incl_vat)}
              </p>
            </div>
          )}
        </div>

        {/* Metadata row */}
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          {summary.company_org_number && (
            <div>
              <span className="text-muted-foreground">Org.nr </span>
              <span className="font-mono">{summary.company_org_number}</span>
            </div>
          )}
          {summary.invoice_count_total != null && (
            <div>
              <span className="text-muted-foreground">Fakturaer totalt </span>
              <span className="font-mono">{summary.invoice_count_total}</span>
            </div>
          )}
          {summary.invoice_count_outstanding != null && summary.invoice_count_outstanding > 0 && (
            <div>
              <span className="text-muted-foreground">Utestående </span>
              <span className="text-destructive font-mono">
                {summary.invoice_count_outstanding}
              </span>
            </div>
          )}
          {summary.member_count != null && (
            <div>
              <span className="text-muted-foreground">Medlemmer </span>
              <span className="font-mono">{summary.member_count}</span>
            </div>
          )}
          {summary.subscription_plan && (
            <div>
              <span className="text-muted-foreground">Plan </span>
              <span>{summary.subscription_plan}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
