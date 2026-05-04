"use client";

import { History, ShieldAlert, Loader2 } from "lucide-react";
import { useReconciliationAuditTrail } from "../../_hooks/useReconciliationAuditTrail";

type Props = {
  reconciliationId: string;
};

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * J5 — Admin leser Revisjonslogg. Read-only chronological list of all
 * audit-trail entries for this reconciliation. Override entries are
 * visually distinguished to support Invariant #9 monitoring.
 */
export function RevisjonsloggTab({ reconciliationId }: Props) {
  const { data, isLoading, isError } = useReconciliationAuditTrail(reconciliationId);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        Kunne ikke laste revisjonslogg.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <History className="text-muted-foreground h-8 w-8" aria-hidden />
        <p className="text-foreground text-sm font-semibold">Ingen historikk registrert</p>
        <p className="text-muted-foreground text-xs">
          Revisjonslogg fylles automatisk ved hver endring.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <ul className="divide-border divide-y" aria-label="Revisjonslogg">
        {data.map((entry) => (
          <li
            key={entry.id}
            className={
              entry.isOverride
                ? "bg-[color:color-mix(in_oklch,var(--warning)_5%,transparent)] px-5 py-4"
                : "px-5 py-4"
            }
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {entry.isOverride ? (
                  <ShieldAlert className="h-5 w-5 text-[color:var(--warning)]" aria-hidden />
                ) : (
                  <History className="text-muted-foreground h-5 w-5" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-foreground text-sm font-semibold">
                    {entry.actorName ?? "System"}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {humanizeAction(entry.action, entry.eventName)}
                  </span>
                  {entry.isOverride && (
                    <span className="text-[10px] font-bold tracking-[0.12em] text-[color:var(--warning)] uppercase">
                      Overstyring
                    </span>
                  )}
                </div>
                {entry.reason && (
                  <p className="text-foreground mt-1 text-sm italic">
                    &ldquo;{entry.reason}&rdquo;
                  </p>
                )}
                <p className="text-muted-foreground mt-1 font-mono text-xs tabular-nums">
                  {formatClock(entry.createdAt)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function humanizeAction(action: string, eventName: string): string {
  const map: Record<string, string> = {
    approved: "godkjente oppgjør",
    rejected: "avviste oppgjør",
    locked: "låste dag",
    submitted: "sendte inn oppgjør",
    resolved: "løste avvik",
  };
  return map[action] ?? eventName.replace(/_/g, " ");
}
