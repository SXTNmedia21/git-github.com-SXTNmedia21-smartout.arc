"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useFinancialCloseConfig } from "@/app/dashboard/_hooks/use-financial-close-config";

export function FinancialCloseSettings() {
  const { config, isLoading, upsert } = useFinancialCloseConfig();
  const [toleranceType, setToleranceType] = useState(config.tolerance_type);
  const [toleranceValue, setToleranceValue] = useState(String(config.tolerance_value));
  const [requireCashCount, setRequireCashCount] = useState(config.require_cash_count);
  const [cashToleranceType, setCashToleranceType] = useState(config.cash_tolerance_type);
  const [cashToleranceValue, setCashToleranceValue] = useState(String(config.cash_tolerance_value));
  const [approvalRequired, setApprovalRequired] = useState(config.approval_required);
  const [deadlineHours, setDeadlineHours] = useState(String(config.approval_deadline_hours));
  const [saved, setSaved] = useState(false);

  function handleSave() {
    upsert.mutate(
      {
        tolerance_type: toleranceType,
        tolerance_value: parseFloat(toleranceValue) || 50,
        require_cash_count: requireCashCount,
        cash_tolerance_type: cashToleranceType,
        cash_tolerance_value: parseFloat(cashToleranceValue) || 20,
        approval_required: approvalRequired,
        approval_deadline_hours: parseInt(deadlineHours, 10) || 24,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  const selectClass =
    "bg-muted/30 border-border text-foreground w-full rounded-lg border px-3 py-2 text-sm";
  const inputClass = selectClass;
  const labelClass = "text-muted-foreground mb-1 block text-xs font-medium";

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-foreground text-lg font-bold">Dagsoppgjor</h3>
        <p className="text-muted-foreground text-sm">
          Innstillinger for daglig avstemming og godkjenning av omsetningstall.
        </p>
      </div>

      {/* Tolerance */}
      <section className="space-y-4">
        <h4 className="text-foreground text-sm font-bold">Toleranse for avvik</h4>
        <p className="text-muted-foreground text-xs">
          Maks avvik mellom POS og terminal for automatisk godkjenning av dagstall.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Type</label>
            <select
              value={toleranceType}
              onChange={(e) => setToleranceType(e.target.value as "fixed" | "percentage")}
              className={selectClass}
            >
              <option value="fixed">Fast belop (NOK)</option>
              <option value="percentage">Prosent (%)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Verdi ({toleranceType === "fixed" ? "NOK" : "%"})</label>
            <input
              type="number"
              step="0.01"
              value={toleranceValue}
              onChange={(e) => setToleranceValue(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Cash count */}
      <section className="space-y-4">
        <h4 className="text-foreground text-sm font-bold">Kontantkasse</h4>
        <div className="flex items-center gap-3">
          <input
            id="require-cash"
            type="checkbox"
            checked={requireCashCount}
            onChange={(e) => setRequireCashCount(e.target.checked)}
            className="accent-primary h-4 w-4 rounded"
          />
          <label htmlFor="require-cash" className="text-foreground text-sm">
            Krev opptelling av kontantkasse
          </label>
        </div>
        {requireCashCount && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Toleranse-type</label>
              <select
                value={cashToleranceType}
                onChange={(e) => setCashToleranceType(e.target.value as "fixed" | "percentage")}
                className={selectClass}
              >
                <option value="fixed">Fast belop (NOK)</option>
                <option value="percentage">Prosent (%)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Verdi ({cashToleranceType === "fixed" ? "NOK" : "%"})
              </label>
              <input
                type="number"
                step="0.01"
                value={cashToleranceValue}
                onChange={(e) => setCashToleranceValue(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </section>

      {/* Approval */}
      <section className="space-y-4">
        <h4 className="text-foreground text-sm font-bold">Godkjenning</h4>
        <div className="flex items-center gap-3">
          <input
            id="require-approval"
            type="checkbox"
            checked={approvalRequired}
            onChange={(e) => setApprovalRequired(e.target.checked)}
            className="accent-primary h-4 w-4 rounded"
          />
          <label htmlFor="require-approval" className="text-foreground text-sm">
            Krev godkjenning fra leder
          </label>
        </div>
        {approvalRequired && (
          <div className="max-w-xs">
            <label className={labelClass}>Tidsfrist (timer)</label>
            <input
              type="number"
              min="1"
              max="168"
              value={deadlineHours}
              onChange={(e) => setDeadlineHours(e.target.value)}
              className={inputClass}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Eskaleres hvis ikke godkjent innen denne fristen.
            </p>
          </div>
        )}
      </section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={upsert.isPending}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"
      >
        {upsert.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saved ? "Lagret!" : "Lagre innstillinger"}
      </button>
    </div>
  );
}
