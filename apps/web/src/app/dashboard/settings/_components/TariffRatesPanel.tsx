"use client";

// Panel for viewing and adjusting workspace tariff rates.
//
// Shows tariff rates with platform baseline comparison and allows admins
// to create new effective-dated workspace overrides via inline form.
// Rates follow append-only pattern — existing rows are never mutated.
//
// UI Events:
// - action: click "Juster" → expand inline adjustment form
// - action: submit adjustment → adjustRate mutation (new row)
// - color-regime: workspace overrides highlighted, platform baseline muted

import { useState, useContext } from "react";
import { Calculator, Plus } from "lucide-react";
import { Button, Card, Skeleton } from "@smartout/ui";
import { Input } from "@/components/ui/input";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceTariffs, type TariffRateDisplay } from "../_hooks/use-workspace-tariffs";

// ─── Rate type labels ─────────────────────────────────────────────────────────

const RATE_TYPE_LABELS: Record<string, string> = {
  kveldstillegg: "Kveldstillegg",
  helgetillegg: "Helgetillegg",
  helligdagstillegg: "Helligdagstillegg",
  overtid_50: "Overtid 50%",
  overtid_100: "Overtid 100%",
  base_hourly: "Grunnlønn (time)",
  nattillegg: "Nattillegg",
};

const UNIT_LABELS: Record<string, string> = {
  nok_per_hour: "kr/t",
  percentage: "%",
};

// ─── Adjustment form ──────────────────────────────────────────────────────────

function AdjustmentForm({
  rate,
  isDark,
  onSubmit,
  onCancel,
  isPending,
}: {
  rate: TariffRateDisplay;
  isDark: boolean;
  onSubmit: (amount: number, effectiveFrom: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [amount, setAmount] = useState(rate.amount.toString());
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]!);

  return (
    <div
      className={`mt-3 rounded-lg border p-3 ${
        isDark ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-muted-foreground mb-1 block text-xs">Ny sats</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-muted-foreground mb-1 block text-xs">Gjelder fra</label>
          <Input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} className="h-8 text-xs">
            Avbryt
          </Button>
          <Button
            size="sm"
            disabled={isPending || !amount || !effectiveFrom}
            onClick={() => onSubmit(parseFloat(amount), effectiveFrom)}
            className="h-8 text-xs"
          >
            Lagre
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Rate card ────────────────────────────────────────────────────────────────

function RateCard({
  rate,
  isDark,
  isExpanded,
  onToggleExpand,
  onAdjust,
  isPending,
}: {
  rate: TariffRateDisplay;
  isDark: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAdjust: (amount: number, effectiveFrom: string) => void;
  isPending: boolean;
}) {
  const typeLabel = RATE_TYPE_LABELS[rate.rateType] ?? rate.rateType;
  const unitLabel = UNIT_LABELS[rate.unit] ?? rate.unit;
  const effectiveDate = new Date(rate.effectiveFrom).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        {/* Type + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-foreground text-sm font-semibold">{typeLabel}</p>
            {rate.isWorkspaceOverride && (
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-400">
                Justert
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Fra {effectiveDate}</span>
            {rate.seniorityYears !== null && rate.seniorityYears > 0 && (
              <span className="text-muted-foreground text-xs">
                ({rate.seniorityYears} års ansiennitet)
              </span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right">
          <p className="text-foreground text-sm font-bold">
            {rate.amount.toFixed(2)} {unitLabel}
          </p>
          {rate.platformAmount !== null && rate.isWorkspaceOverride && (
            <p className="text-muted-foreground text-xs">
              Riksavtalen: {rate.platformAmount.toFixed(2)} {unitLabel}
            </p>
          )}
          {!rate.isWorkspaceOverride && (
            <p className="text-muted-foreground text-xs">Riksavtalen</p>
          )}
        </div>

        {/* Adjust button */}
        <Button size="sm" variant="outline" onClick={onToggleExpand} className="h-7 text-xs">
          {isExpanded ? "Lukk" : "Juster"}
        </Button>
      </div>

      {/* Inline adjustment form */}
      {isExpanded && (
        <AdjustmentForm
          rate={rate}
          isDark={isDark}
          onSubmit={onAdjust}
          onCancel={onToggleExpand}
          isPending={isPending}
        />
      )}
    </Card>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RatesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="flex items-center gap-4 p-4">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-16 rounded" />
        </Card>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TariffRatesPanel() {
  const { isDark } = useContext(DashboardContext);
  const { rates, isLoading, adjustRate } = useWorkspaceTariffs();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-96" />
        </div>
        <RatesSkeleton />
      </div>
    );
  }

  // Deduplicate: show only the most recent rate per type
  const latestByType = new Map<string, TariffRateDisplay>();
  for (const rate of rates) {
    const key = `${rate.rateType}:${rate.seniorityYears ?? "all"}`;
    if (!latestByType.has(key)) {
      latestByType.set(key, rate);
    }
  }
  const currentRates = Array.from(latestByType.values());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-foreground text-lg font-semibold">Tariffsatser</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Satser fra riksavtalen og egne justeringer. Justeringer oppretter en ny sats med
          gyldighetsdato — eksisterende satser endres aldri.
        </p>
      </div>

      {/* Empty state */}
      {currentRates.length === 0 && (
        <div className="border-border bg-muted/40 rounded-lg border border-dashed px-4 py-8">
          <div className="flex flex-col items-center text-center">
            <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-full">
              <Calculator className="text-muted-foreground h-5 w-5" />
            </div>
            <p className="text-muted-foreground text-sm">
              Ingen tariffsatser er satt opp. Satser opprettes automatisk ved aktivering av
              rammeverk.
            </p>
          </div>
        </div>
      )}

      {/* Rate cards */}
      {currentRates.length > 0 && (
        <div className="space-y-2">
          {currentRates.map((rate) => (
            <RateCard
              key={rate.id}
              rate={rate}
              isDark={isDark}
              isExpanded={expandedId === rate.id}
              onToggleExpand={() => setExpandedId(expandedId === rate.id ? null : rate.id)}
              onAdjust={(amount, effectiveFrom) => {
                adjustRate.mutate(
                  {
                    rateType: rate.rateType,
                    amount,
                    unit: rate.unit,
                    effectiveFrom,
                    seniorityYears: rate.seniorityYears,
                  },
                  {
                    onSuccess: () => setExpandedId(null),
                  },
                );
              }}
              isPending={adjustRate.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
