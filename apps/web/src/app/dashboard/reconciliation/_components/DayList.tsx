"use client";

import { useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";
import { PhaseBadge } from "@smartout/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { reconciliationStatusToPhase, reconciliationStatusLabel } from "../_lib/status-mapping";
import { buildReconciliationCsv, triggerCsvDownload } from "../_lib/csv-export";

type ReconciliationRow = {
  reconciliation_id: string;
  reconciliation_date: string;
  status: string;
  revenue_total: number | null;
  total_actual_hours: number | null;
  total_labor_cost: number | null;
  labor_percentage: number | null;
  locked_at?: string | null;
  department_session: {
    department: {
      name: string;
    };
  } | null;
};

type DayListProps = {
  reconciliations: ReconciliationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type StatusFilter = "all" | "pending_signoff" | "closed" | "locked" | "missed";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "pending_signoff", label: "Venter oppgjør" },
  { key: "closed", label: "Klar til å låse" },
  { key: "locked", label: "Låst" },
  { key: "missed", label: "Ikke åpnet" },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatAmount(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DayList({ reconciliations, selectedId, onSelect }: DayListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>();
    reconciliations.forEach((r) => {
      const name = r.department_session?.department?.name;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [reconciliations]);

  const filtered = useMemo(() => {
    return reconciliations.filter((r) => {
      if (statusFilter !== "all") {
        const phase = reconciliationStatusToPhase(r.status);
        if (phase !== statusFilter) return false;
      }
      if (deptFilter) {
        const deptName = r.department_session?.department?.name;
        if (deptName !== deptFilter) return false;
      }
      return true;
    });
  }, [reconciliations, statusFilter, deptFilter]);

  // Derive header counters from the list data (no extra query)
  const counters = useMemo(() => {
    let venter = 0;
    let klar = 0;
    let laast = 0;
    for (const r of reconciliations) {
      const phase = reconciliationStatusToPhase(r.status);
      if (phase === "pending_signoff") venter += 1;
      else if (phase === "closed") klar += 1;
      else if (phase === "locked") laast += 1;
    }
    return { venter, klar, laast };
  }, [reconciliations]);

  function handleExport() {
    if (filtered.length === 0) return;
    const csv = buildReconciliationCsv(filtered);
    const now = new Date();
    const year = now.getFullYear();
    const weekNum = Math.ceil(
      ((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 +
        new Date(year, 0, 1).getDay() +
        1) /
        7,
    );
    triggerCsvDownload(csv, `avstemming-uke-${weekNum}-${year}.csv`);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header: title + counters + export */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
            Avstemming
          </p>
          <h1 className="font-heading text-foreground text-3xl tracking-[-0.02em]">
            Dagens oppgjør
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <CounterTile label="Venter oppgjør" value={counters.venter} tone="warning" />
          <CounterTile label="Klar til å låse" value={counters.klar} tone="info" />
          <CounterTile label="Låst" value={counters.laast} tone="muted" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" aria-hidden />
            Eksporter CSV
          </Button>
        </div>
      </header>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "focus-visible:ring-ring rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
                aria-pressed={active}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {departments.length > 0 && (
          <div className="border-border/50 flex flex-wrap items-center gap-1.5 border-l pl-2">
            {departments.map((d) => {
              const active = deptFilter === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDeptFilter(active ? null : d)}
                  className={cn(
                    "focus-visible:ring-ring rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  aria-pressed={active}
                >
                  {d}
                </button>
              );
            })}
            {(deptFilter || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setDeptFilter(null);
                  setStatusFilter("all");
                }}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 text-xs"
              >
                <X className="h-3 w-3" aria-hidden />
                Nullstill
              </button>
            )}
          </div>
        )}
      </div>

      {/* List */}
      <div className="border-border bg-card flex-1 overflow-hidden rounded-xl border">
        <div
          role="row"
          className="text-muted-foreground border-border bg-muted/30 grid grid-cols-[120px_1fr_140px_140px_140px_40px] gap-3 border-b px-5 py-2.5 text-[10px] font-semibold tracking-[0.14em] uppercase"
        >
          <span>Dato</span>
          <span>Avdeling</span>
          <span className="text-right">Omsetning</span>
          <span className="text-right">Labor %</span>
          <span>Status</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <EmptyState hasFilter={statusFilter !== "all" || deptFilter !== null} />
        ) : (
          <ul className="divide-border divide-y" role="list">
            {filtered.map((r) => {
              const phase = reconciliationStatusToPhase(r.status);
              const isSelected = r.reconciliation_id === selectedId;
              const actionable = phase === "pending_signoff" || phase === "closed";

              return (
                <li key={r.reconciliation_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(r.reconciliation_id)}
                    aria-current={isSelected ? "true" : undefined}
                    aria-label={`${formatDate(r.reconciliation_date)} ${r.department_session?.department?.name ?? ""} — ${reconciliationStatusLabel(r.status)}`}
                    className={cn(
                      "focus-visible:ring-ring hover:bg-muted/40 grid w-full grid-cols-[120px_1fr_140px_140px_140px_40px] items-center gap-3 px-5 py-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                      isSelected && "bg-muted/60",
                      actionable &&
                        phase === "pending_signoff" &&
                        "bg-[color:color-mix(in_oklch,var(--warning)_3%,transparent)]",
                    )}
                  >
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {formatDate(r.reconciliation_date)}
                    </span>
                    <span className="text-foreground truncate text-sm">
                      {r.department_session?.department?.name ?? "—"}
                    </span>
                    <span className="text-foreground text-right font-mono text-sm tabular-nums">
                      {formatAmount(r.revenue_total)}
                    </span>
                    <span
                      className={cn(
                        "text-right font-mono text-sm tabular-nums",
                        r.labor_percentage !== null && r.labor_percentage > 18
                          ? "text-[color:var(--warning)]"
                          : "text-foreground",
                      )}
                    >
                      {r.labor_percentage !== null ? `${r.labor_percentage.toFixed(1)}%` : "—"}
                    </span>
                    <span>
                      <PhaseBadge phase={phase} size="sm" />
                    </span>
                    <span className="text-muted-foreground text-xs">{actionable ? "→" : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CounterTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "info" | "muted";
}) {
  const toneClass =
    tone === "warning"
      ? "text-[color:var(--warning)]"
      : tone === "info"
        ? "text-[color:var(--info)]"
        : "text-muted-foreground";

  return (
    <div className="border-border bg-card min-w-[120px] rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-[9px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className={cn("font-mono text-2xl leading-none font-black tabular-nums", toneClass)}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Search className="text-muted-foreground h-8 w-8" aria-hidden />
      <p className="text-foreground text-sm font-semibold">
        {hasFilter ? "Ingen avdelinger matcher filteret" : "Ingen oppgjør registrert denne uka"}
      </p>
      <p className="text-muted-foreground text-xs">
        {hasFilter
          ? "Prøv å nullstille filtrene eller se forrige uke."
          : "Oppgjør genereres automatisk når skift-leder stempler ut."}
      </p>
    </div>
  );
}
