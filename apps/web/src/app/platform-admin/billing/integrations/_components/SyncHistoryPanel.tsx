"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { BillingIntegration } from "@smartout/billing";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadIntegrationSyncHistory } from "../../_actions/integrations/loadIntegrationSyncHistory";
import { retriggerIntegrationSyncAction } from "../../_actions/integrations/retriggerIntegrationSyncAction";

// SyncHistoryPanel — right-hand side of EditIntegrationDialog (or
// standalone below the table, depending on layout). Loads the last 20
// engine_state rows for process_id='integration_sync' where
// context.integration_id matches the selected integration, and renders
// a compact list with a per-row "Retry" button routing to the
// retriggerIntegrationSyncAction Server Action.
//
// Placeholder rows render with a [PLACEHOLDER] prefix in muted tone per
// ADR-0129. The ADR prevents ops-readers from confusing a mocked run
// with a real remote call.

type SyncRow = {
  state_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  last_error: string | null;
  is_placeholder_hint: boolean;
  entity_type_synced: string | null;
  entity_id_synced: string | null;
  operation: string | null;
};

type Props = {
  integration: BillingIntegration;
};

export function SyncHistoryPanel({ integration }: Props) {
  const [rows, setRows] = useState<SyncRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadIntegrationSyncHistory({ integration_id: integration.integration_id })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setRows(result.rows);
        } else {
          toast.error(`Kunne ikke laste historikk: ${result.error}`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [integration.integration_id]);

  const onRetry = (row: SyncRow) => {
    if (!row.entity_type_synced || !row.entity_id_synced || !row.operation) {
      toast.error("Mangler kontekst for å kjøre på nytt.");
      return;
    }
    startRetry(async () => {
      const result = await retriggerIntegrationSyncAction({
        integration_id: integration.integration_id,
        entity_type: row.entity_type_synced as
          | "customer"
          | "invoice"
          | "contract"
          | "product"
          | "plan",
        entity_id: row.entity_id_synced as string,
        operation: row.operation as "create" | "update" | "delete",
      });
      if (result.ok) {
        toast.success("Retrigget — resultat følger i neste sync.");
      } else {
        toast.error(`Kunne ikke starte på nytt: ${result.error}`);
      }
    });
  };

  return (
    <section className="border-border/60 rounded-xl border p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base">Sync-historikk</h3>
          <p className="text-muted-foreground text-xs">Siste 20 forsøk.</p>
        </div>
      </header>

      {loading && <p className="text-muted-foreground text-sm">Laster…</p>}

      {!loading && rows && rows.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">
          Ingen sync-forsøk ennå for denne integrasjonen.
        </p>
      ) : null}

      {!loading && rows && rows.length > 0 ? (
        <ol className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.state_id}
              className={cn(
                "border-border/50 flex items-center justify-between rounded-md border px-3 py-2",
                row.is_placeholder_hint && "text-muted-foreground",
              )}
            >
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-mono">
                  {row.is_placeholder_hint ? "[PLACEHOLDER] " : ""}
                  {row.entity_type_synced ?? "—"}
                  {row.operation ? ` · ${row.operation}` : ""}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {formatTimestamp(row.started_at)} · {row.status}
                  {row.last_error ? ` · ${row.last_error}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={retrying}
                onClick={() => onRetry(row)}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                <span className="ml-1">Prøv på nytt</span>
              </Button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
