// DispatchesList.tsx — read-only dispatch history for the accountant surface.
//
// Adapted from platform-admin InvoiceDispatchesList + InvoiceDispatchesListClient.
// Retry + ad-hoc mottaker buttons removed — accountant has read-only access.
//
// Uses @smartout/billing InvoiceDispatchWithRule type from queries.
// Props passed from the detail page (server component — no separate data fetch here).

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InvoiceDispatchWithRule } from "@/lib/orders/fetchers";

type Props = {
  dispatches: InvoiceDispatchWithRule[];
};

const CHANNEL_LABELS: Record<string, string> = {
  email_customer: "Epost (kunde)",
  email_internal: "Epost (intern)",
  http_api: "HTTP API",
  peppol_ehf: "EHF / Peppol",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Venter",
  queued: "I kø",
  sending: "Sender",
  delivered: "Levert",
  failed: "Feilet",
  bounced: "Returnert",
  retrying: "Prøver igjen",
};

function describeTarget(target: unknown): string {
  if (target && typeof target === "object" && !Array.isArray(target)) {
    const t = target as Record<string, unknown>;
    if (typeof t.email === "string") return t.email;
    if (typeof t.endpoint === "string") return t.endpoint;
    if (typeof t.peppol_participant_id === "string") return t.peppol_participant_id;
    try {
      return JSON.stringify(t);
    } catch {
      return "(ugyldig mål)";
    }
  }
  return "—";
}

export function DispatchesList({ dispatches }: Props) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-heading text-xl">Leveransehistorikk</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          Leveranser per kanal. Én rad per regel (+ ad-hoc).
        </p>
      </header>

      {dispatches.length === 0 ? (
        <div className="border-border/60 bg-muted/10 rounded-xl border p-6 text-sm">
          <p className="text-muted-foreground">Ingen leveranser registrert ennå.</p>
        </div>
      ) : (
        <div className="border-border/60 overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kanal</TableHead>
                <TableHead>Mottaker</TableHead>
                <TableHead>Kilde</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Forsøk</TableHead>
                <TableHead>Referanse</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dispatches.map((row) => (
                <TableRow key={row.invoice_dispatch_id}>
                  <TableCell>{CHANNEL_LABELS[row.channel] ?? row.channel}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {describeTarget(row.target)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.rule ? (row.rule.workspace_id ? "Workspace" : "Platform") : "Ad-hoc"}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{STATUS_LABELS[row.status] ?? row.status}</span>
                    {row.error_message ? (
                      <div className="text-destructive mt-1 max-w-60 truncate text-[11px]">
                        {row.error_message}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs tabular-nums">
                    {row.attempts}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-40 truncate font-mono text-xs">
                    {row.external_reference ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
