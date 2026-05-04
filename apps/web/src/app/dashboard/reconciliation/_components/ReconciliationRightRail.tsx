"use client";

/**
 * ReconciliationRightRail — 320px right rail for reconciliation detail view.
 *
 * Per design spec Daily operations/avstemming.css:102 — the 4-column shell is:
 *   232px sidebar (DashboardShell) + 320-380px daylist/approve + 560px+ main + 320px right rail.
 *
 * The rail surfaces ambient context for the current reconciliation:
 *   1. Live KPI glance — Omsetning + Labor % (compact, monospace, tabular-nums).
 *   2. Unresolved deviations — count + blocker sub-count, tone-coded.
 *   3. Shift-leader + close-day affordance — who owned the shift, one-click lock CTA when approved.
 *
 * `hideRail` prop supports `.main.no-rail` equivalent (e.g. deviations tab where
 * the rail content is redundant with the tab itself, or when session has no data).
 */

import { Lock, Loader2, UserCircle2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  revenueTotal: number | null;
  laborPercentage: number | null;
  openDeviationCount: number;
  blockingDeviationCount: number;
  shiftLeaderName: string | null;
  sessionClosedAt: string | null;
  isApproved: boolean;
  isLocked: boolean;
  onLock?: () => void;
  isLocking?: boolean;
};

function nok(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("nb-NO").format(Math.round(n));
}

function laborPct(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(1);
}

function laborTone(n: number | null): string {
  if (n === null) return "text-foreground";
  if (n <= 15) return "text-[color:var(--success)]";
  if (n >= 22) return "text-[color:var(--warning)]";
  return "text-foreground";
}

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function ReconciliationRightRail({
  revenueTotal,
  laborPercentage,
  openDeviationCount,
  blockingDeviationCount,
  shiftLeaderName,
  sessionClosedAt,
  isApproved,
  isLocked,
  onLock,
  isLocking,
}: Props) {
  return (
    <aside aria-label="Kontekst-rail" className="hidden w-[320px] shrink-0 space-y-4 xl:block">
      {/* Live KPI glance */}
      <section
        aria-labelledby="rail-kpi-heading"
        className="border-border bg-card rounded-xl border p-4"
      >
        <h3
          id="rail-kpi-heading"
          className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase"
        >
          Dagens pulse
        </h3>

        <div className="mt-3 space-y-3">
          <div>
            <p className="text-muted-foreground text-xs">Omsetning</p>
            <p className="text-foreground font-mono text-xl font-black tabular-nums">
              {nok(revenueTotal)}
              <span className="text-muted-foreground ml-1 text-sm font-medium">kr</span>
            </p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs">Labor %</p>
            <p
              className={`font-mono text-xl font-black tabular-nums ${laborTone(laborPercentage)}`}
            >
              {laborPct(laborPercentage)}
              <span className="text-muted-foreground ml-1 text-sm font-medium">%</span>
            </p>
          </div>
        </div>
      </section>

      {/* Unresolved deviations */}
      <section
        aria-labelledby="rail-deviations-heading"
        className="border-border bg-card rounded-xl border p-4"
      >
        <div className="flex items-center gap-2">
          {openDeviationCount > 0 ? (
            <AlertTriangle className="h-4 w-4 text-[color:var(--warning)]" aria-hidden />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" aria-hidden />
          )}
          <h3
            id="rail-deviations-heading"
            className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase"
          >
            Avvik
          </h3>
        </div>

        <p
          className={`mt-2 font-mono text-2xl font-black tabular-nums ${
            openDeviationCount > 0 ? "text-[color:var(--warning)]" : "text-[color:var(--success)]"
          }`}
        >
          {openDeviationCount}
        </p>
        <p className="text-muted-foreground text-xs">
          {openDeviationCount === 0
            ? "Ingen åpne avvik"
            : blockingDeviationCount > 0
              ? `${blockingDeviationCount} blokker godkjenning`
              : "Ikke-blokkerende"}
        </p>
      </section>

      {/* Shift-leader + close-day */}
      <section
        aria-labelledby="rail-leader-heading"
        className="border-border bg-card rounded-xl border p-4"
      >
        <h3
          id="rail-leader-heading"
          className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase"
        >
          Vaktleder
        </h3>

        <div className="mt-3 flex items-center gap-2.5">
          <UserCircle2 className="text-muted-foreground h-7 w-7 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">
              {shiftLeaderName ?? "Ikke registrert"}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              Stengte {formatClock(sessionClosedAt)}
            </p>
          </div>
        </div>

        {/* Close-day affordance — mirrors primary lock in approve-panel.
            Only shown when session is approved (and not yet locked) so the
            rail stays a *secondary* surface to the canonical approve-panel. */}
        {isApproved && !isLocked && onLock && (
          <div className="mt-4 border-t pt-3">
            <Button
              type="button"
              onClick={onLock}
              disabled={isLocking}
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
            >
              {isLocking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Lock className="h-3.5 w-3.5" aria-hidden />
              )}
              Lås dag
            </Button>
          </div>
        )}

        {isLocked && (
          <div className="mt-4 flex items-center gap-1.5 border-t pt-3">
            <Lock className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
            <p className="text-muted-foreground text-xs">Dagen er låst</p>
          </div>
        )}
      </section>
    </aside>
  );
}
