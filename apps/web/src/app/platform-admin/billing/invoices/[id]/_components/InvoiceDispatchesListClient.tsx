"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DispatchStatusBadge, type DispatchStatus } from "@/components/ui/DispatchStatusBadge";
import { retryDispatchAction } from "../../../_actions/retryDispatch";

import { AdHocDispatchSheet } from "./AdHocDispatchSheet";
import type { InvoiceDispatchRow } from "./InvoiceDispatchesList";

// InvoiceDispatchesListClient — the platform-admin interactive surface
// for an invoice's dispatch history. One row per invoice_dispatch
// (platform rule, workspace rule, or ad-hoc). Each row exposes "Send
// på nytt" (= retry) for transparency; "Legg til ad-hoc mottaker"
// opens a Sheet that posts through createAdHocDispatchAction.
//
// Retry resets the engine_state — operators tend to reach for this
// when dunning escalates, so the button is per-row rather than bulk.

const CHANNEL_LABELS: Record<string, string> = {
  email_customer: "Epost (kunde)",
  email_internal: "Epost (intern)",
  http_api: "HTTP API",
  peppol_ehf: "EHF / Peppol",
};

const RULE_SOURCE_LABELS: Record<InvoiceDispatchRow["rule_source"], string> = {
  platform: "Platform",
  workspace: "Workspace",
  ad_hoc: "Ad-hoc",
};

type Props = {
  invoiceId: string;
  rows: InvoiceDispatchRow[];
};

export function InvoiceDispatchesListClient({ invoiceId, rows }: Props) {
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [pendingRetryId, setPendingRetryId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleRetry = (row: InvoiceDispatchRow) => {
    setPendingRetryId(row.invoice_dispatch_id);
    startTransition(async () => {
      const result = await retryDispatchAction({
        invoice_dispatch_id: row.invoice_dispatch_id,
      });
      setPendingRetryId(null);
      if (result.ok) {
        toast.success("Utsending køet på nytt.");
      } else {
        toast.error(`Kunne ikke sende på nytt: ${result.error}`);
      }
    });
  };

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="font-heading text-xl">Dispatches</h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            Leveranser per kanal. Én rad per regel (+ ad-hoc). Retry køer regelen inn igjen via
            engine_process.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setAdHocOpen(true)}>
          <Plus className="size-4" aria-hidden />
          <span className="ml-1">Legg til ad-hoc mottaker</span>
        </Button>
      </header>

      {rows.length === 0 ? (
        <div className="border-border/60 bg-muted/10 rounded-xl border p-6 text-sm">
          <p className="text-muted-foreground">
            Ingen dispatches registrert ennå. Når fakturaen utstedes matcher dispatch-regler
            platform- og workspace-scope.
          </p>
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
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.invoice_dispatch_id}>
                  <TableCell>{CHANNEL_LABELS[row.channel] ?? row.channel}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {describeTarget(row.target)}
                  </TableCell>
                  <TableCell className="text-xs">{RULE_SOURCE_LABELS[row.rule_source]}</TableCell>
                  <TableCell>
                    <DispatchStatusBadge status={row.status as DispatchStatus} size="sm" />
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
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetry(row)}
                      disabled={pendingRetryId === row.invoice_dispatch_id}
                    >
                      <RefreshCw className="size-3.5" aria-hidden />
                      <span className="ml-1">
                        {pendingRetryId === row.invoice_dispatch_id ? "Sender…" : "Send på nytt"}
                      </span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AdHocDispatchSheet invoiceId={invoiceId} open={adHocOpen} onOpenChange={setAdHocOpen} />
    </section>
  );
}

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
