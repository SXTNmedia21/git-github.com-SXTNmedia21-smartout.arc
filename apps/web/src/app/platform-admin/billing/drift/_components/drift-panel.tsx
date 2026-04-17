"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { resolveDriftEvent } from "../../_actions/resolveDriftEvent";

// Drift panel — list of unreviewed basis_drift_event rows. For each
// row we show the drift_type (what changed), before/after JSON, the
// parent invoice link, and three resolution actions.

export type DriftRow = {
  drift_event_id: string;
  invoice_id: string | null;
  usage_snapshot_id: string;
  shift_id: string | null;
  drift_type: string;
  old_value: unknown;
  new_value: unknown;
  detected_at: string;
  resolution: string | null;
  reviewed_at: string | null;
};

export function DriftPanel({ rows }: { rows: DriftRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="font-heading mb-2 text-2xl">Ingen drift å gjennomgå</h2>
        <p className="text-muted-foreground">
          Grunnlag-drift oppstår når en `schedule_shift` blir endret etter at et fakturagrunnlag er
          frosset. Trigger: `detect_billing_basis_drift`.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <DriftRowCard key={row.drift_event_id} row={row} />
      ))}
    </div>
  );
}

function DriftRowCard({ row }: { row: DriftRow }) {
  const [pending, start] = useTransition();

  const resolve = (resolution: "ignored" | "credit_note_issued" | "reinvoiced") => {
    start(async () => {
      const result = await resolveDriftEvent({
        drift_event_id: row.drift_event_id,
        resolution,
      });
      if (result.ok) {
        toast.success("Drift registrert som løst.");
      } else {
        toast.error(`Kunne ikke løse drift: ${result.error}`);
      }
    });
  };

  return (
    <div className="border-border/40 bg-card space-y-3 rounded-lg border p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-heading text-base">{driftLabel(row.drift_type)}</h3>
          <p className="text-muted-foreground text-xs">
            Oppdaget <time>{new Date(row.detected_at).toLocaleString("nb-NO")}</time>
          </p>
        </div>
        {row.invoice_id ? (
          <Link
            href={`/platform-admin/billing/invoices/${row.invoice_id}`}
            className="text-foreground text-sm underline"
          >
            Åpne faktura →
          </Link>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Før</p>
          <pre className="bg-muted/20 max-h-48 overflow-auto rounded p-2 text-xs">
            {JSON.stringify(row.old_value, null, 2)}
          </pre>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Etter</p>
          <pre className="bg-muted/20 max-h-48 overflow-auto rounded p-2 text-xs">
            {JSON.stringify(row.new_value, null, 2)}
          </pre>
        </div>
      </div>

      <footer className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => resolve("ignored")} disabled={pending}>
          Ignorer (ikke vesentlig)
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => resolve("credit_note_issued")}
          disabled={pending}
        >
          Kreditnota utstedt
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => resolve("reinvoiced")}
          disabled={pending}
        >
          Refakturert
        </Button>
      </footer>

      {row.shift_id ? (
        <p className="text-muted-foreground font-mono text-xs">Shift-ID: {row.shift_id}</p>
      ) : null}
    </div>
  );
}

function driftLabel(type: string): string {
  switch (type) {
    case "shift_updated":
      return "Skift endret etter frysing";
    case "shift_deleted":
      return "Skift slettet etter frysing";
    default:
      return type;
  }
}
