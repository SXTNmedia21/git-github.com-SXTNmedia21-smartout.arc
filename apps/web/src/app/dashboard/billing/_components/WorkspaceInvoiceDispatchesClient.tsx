"use client";

import { useTranslation } from "@smartout/i18n";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DispatchStatusBadge, type DispatchStatus } from "@/components/ui/DispatchStatusBadge";

import type { WorkspaceInvoiceDispatchRow } from "./WorkspaceInvoiceDispatches";

// Workspace-admin client-side renderer for the dispatches section on
// the invoice detail page. Read-only — no retry / ad-hoc buttons. All
// strings come through @smartout/i18n (invoice_dispatches namespace).

type Props = {
  rows: WorkspaceInvoiceDispatchRow[];
};

export function WorkspaceInvoiceDispatchesClient({ rows }: Props) {
  const { t } = useTranslation("billing");

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h2 className="font-heading text-lg">{t("invoice_dispatches.section_title")}</h2>
        <p className="text-muted-foreground text-xs">
          {t("invoice_dispatches.section_description")}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="border-border/60 bg-muted/10 rounded-md border p-4 text-sm">
          <p className="text-muted-foreground">{t("invoice_dispatches.empty")}</p>
        </div>
      ) : (
        <div className="border-border/60 overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice_dispatches.channel_column")}</TableHead>
                <TableHead>{t("invoice_dispatches.recipient_column")}</TableHead>
                <TableHead>{t("invoice_dispatches.status_column")}</TableHead>
                <TableHead className="text-right">
                  {t("invoice_dispatches.attempts_column")}
                </TableHead>
                <TableHead>{t("invoice_dispatches.reference_column")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.invoice_dispatch_id}>
                  <TableCell>{getChannelLabel(t, row.channel)}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {describeTarget(row.target)}
                  </TableCell>
                  <TableCell>
                    <DispatchStatusBadge status={row.status as DispatchStatus} size="sm" />
                    {row.error_message ? (
                      <div className="text-destructive mt-1 max-w-60 truncate text-[11px]">
                        {row.error_message}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
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

function getChannelLabel(t: (key: string) => string, channel: string): string {
  const key = `invoice_dispatches.channel_${channel}`;
  const label = t(key);
  return label === key ? channel : label;
}

function describeTarget(target: unknown): string {
  if (target && typeof target === "object" && !Array.isArray(target)) {
    const t = target as Record<string, unknown>;
    if (typeof t.email === "string") return t.email;
    if (typeof t.endpoint === "string") return t.endpoint;
    if (typeof t.peppol_participant_id === "string") return t.peppol_participant_id;
  }
  return "—";
}
