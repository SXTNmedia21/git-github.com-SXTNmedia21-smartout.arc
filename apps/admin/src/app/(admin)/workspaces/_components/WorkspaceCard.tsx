// WorkspaceCard.tsx — single row in the workspace list table
//
// Receives one WorkspaceListItem and renders it as a <TableRow>.
// Status badge uses CSS variable colors only (Nordic Split constraint).
// onClick navigates to /workspaces/<id>.

import type { WorkspaceListItem } from "@smartout/billing";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";

type Props = {
  workspace: WorkspaceListItem;
  onNavigate: () => void;
  formatNok: (amount: number | null) => string;
  formatDate: (iso: string | null) => string;
};

/** Map workspace status to a Badge variant + human label. */
function statusDisplay(status: WorkspaceListItem["status"]): {
  label: string;
  className: string;
} {
  switch (status) {
    case "active":
      return {
        label: "Aktiv",
        // Use inline CSS variables — no hardcoded zinc/green.
        // bg-primary is the warm OKLCH brand color from Nordic Split tokens.
        className: "bg-primary/15 text-primary border-primary/30",
      };
    case "sandbox":
      return {
        label: "Sandbox",
        className: "bg-muted text-muted-foreground border-border",
      };
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
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

export function WorkspaceCard({ workspace, onNavigate, formatNok, formatDate }: Props) {
  const { label, className } = statusDisplay(workspace.status);

  return (
    <TableRow
      onClick={onNavigate}
      className="hover:bg-muted/50 cursor-pointer transition-colors"
      role="link"
      aria-label={`Åpne kartotek for ${workspace.workspace_name}`}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span>{workspace.workspace_name}</span>
          <Badge variant="outline" className={className}>
            {label}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{workspace.company_name}</TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">
        {workspace.org_nr ?? "—"}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {workspace.outstanding_amount != null && workspace.outstanding_amount > 0 ? (
          <span className="text-destructive font-semibold">
            {formatNok(workspace.outstanding_amount)}
          </span>
        ) : (
          <span className="text-muted-foreground">{formatNok(workspace.outstanding_amount)}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDate(workspace.last_invoice_at)}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDate(workspace.last_paid_at)}
      </TableCell>
    </TableRow>
  );
}
