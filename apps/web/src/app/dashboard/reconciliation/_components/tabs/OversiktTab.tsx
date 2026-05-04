"use client";

import { KpiTile, type DayKpi } from "@smartout/ui";

type Props = {
  reconciliationDate: string;
  departmentName: string;
  revenueTotal: number | null;
  revenueCash: number | null;
  revenueCard: number | null;
  totalActualHours: number | null;
  totalLaborCost: number | null;
  laborPercentage: number | null;
  deviationCount: number;
  openDeviationCount: number;
  pendingShiftCount: number;
  openedAt: string | null;
  closedAt: string | null;
};

function nok(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("nb-NO").format(Math.round(n));
}

function hours(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(1);
}

function laborPct(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(1);
}

function marginDir(labor: number | null): "up" | "down" | "flat" | undefined {
  if (labor === null) return undefined;
  if (labor <= 15) return "up"; // healthy
  if (labor >= 22) return "down"; // high labor cost
  return "flat";
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

export function OversiktTab({
  reconciliationDate,
  departmentName,
  revenueTotal,
  revenueCash,
  revenueCard,
  totalActualHours,
  totalLaborCost,
  laborPercentage,
  deviationCount,
  openDeviationCount,
  pendingShiftCount,
  openedAt,
  closedAt,
}: Props) {
  const tiles: DayKpi[] = [
    {
      key: "revenue",
      label: "Omsetning",
      value: nok(revenueTotal),
      unit: "kr",
      source: "post-reconciliation",
      sub:
        revenueCard !== null || revenueCash !== null
          ? `Kort ${nok(revenueCard)} · Kontant ${nok(revenueCash)}`
          : undefined,
    },
    {
      key: "hours",
      label: "Arbeidstid",
      value: hours(totalActualHours),
      unit: "t",
      source: "post-reconciliation",
    },
    {
      key: "labor-cost",
      label: "Lønnskostnad",
      value: nok(totalLaborCost),
      unit: "kr",
      source: "post-reconciliation",
    },
    {
      key: "labor-pct",
      label: "Labor %",
      value: laborPct(laborPercentage),
      unit: "%",
      deltaDir: marginDir(laborPercentage),
      sub:
        laborPercentage !== null
          ? laborPercentage <= 15
            ? "Innenfor mål"
            : laborPercentage >= 22
              ? "Over mål"
              : "Nær mål"
          : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Session summary header */}
      <section
        aria-labelledby="session-summary-heading"
        className="border-border bg-card rounded-xl border p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
              Dag-sammendrag
            </p>
            <h2
              id="session-summary-heading"
              className="font-heading text-foreground mt-1 text-2xl tracking-[-0.01em]"
            >
              {new Date(reconciliationDate + "T00:00:00").toLocaleDateString("nb-NO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            <p className="text-muted-foreground text-sm">{departmentName}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Åpnet</dt>
            <dd className="text-foreground font-mono tabular-nums">{formatClock(openedAt)}</dd>
            <dt className="text-muted-foreground">Stengt</dt>
            <dd className="text-foreground font-mono tabular-nums">{formatClock(closedAt)}</dd>
          </dl>
        </div>
      </section>

      {/* KPI grid */}
      <section aria-label="KPI oversikt">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <KpiTile key={t.key} tile={t} variant="compact" />
          ))}
        </div>
      </section>

      {/* Compliance row */}
      <section className="border-border bg-card rounded-xl border p-5">
        <h3 className="text-foreground mb-4 text-sm font-semibold">Oppgaver & compliance</h3>
        <div className="grid grid-cols-3 gap-4">
          <ComplianceTile
            label="Vakter venter"
            value={pendingShiftCount}
            sub={pendingShiftCount === 0 ? "Alle godkjent" : "Krever behandling"}
            tone={pendingShiftCount > 0 ? "warning" : "success"}
          />
          <ComplianceTile
            label="Åpne avvik"
            value={openDeviationCount}
            sub={openDeviationCount === 0 ? "Ingen åpne" : "Krever oppfølging"}
            tone={openDeviationCount > 0 ? "warning" : "success"}
          />
          <ComplianceTile
            label="Avvik totalt i dag"
            value={deviationCount}
            sub={
              deviationCount === 0
                ? "Ingen rapportert"
                : `${deviationCount - openDeviationCount} løst`
            }
            tone="muted"
          />
        </div>
      </section>
    </div>
  );
}

function ComplianceTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-[color:var(--success)]"
      : tone === "warning"
        ? "text-[color:var(--warning)]"
        : "text-foreground";

  return (
    <div>
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className={`font-mono text-xl font-black tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-muted-foreground text-xs">{sub}</p>
    </div>
  );
}
