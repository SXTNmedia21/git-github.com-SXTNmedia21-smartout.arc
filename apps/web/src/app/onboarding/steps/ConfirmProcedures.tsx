"use client";

/**
 * ConfirmProcedures — Step 4 of onboarding confirmation wizard.
 *
 * Shows procedure toggles with "Anbefalt" badges for recommended ones.
 * Pre-selected by I1 based on industry NACE code.
 * Reuses the toggle/warning pattern from ProceduresSection.
 */

import { useState } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";

export function ConfirmProcedures({
  state,
  updateState,
  next,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const [showInput, setShowInput] = useState(false);
  const [customName, setCustomName] = useState("");
  const [pendingDeselect, setPendingDeselect] = useState<string | null>(null);

  const procedures = state.procedures;
  const selectedCount = procedures.filter((p) => p.selected).length;
  const pendingProc = pendingDeselect ? procedures.find((p) => p.id === pendingDeselect) : null;

  function handleToggle(id: string) {
    const proc = procedures.find((p) => p.id === id);
    if (!proc) return;

    // Warn before deselecting a recommended procedure
    if (proc.recommended && proc.selected) {
      setPendingDeselect(id);
      return;
    }

    updateState({
      procedures: procedures.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)),
    });
  }

  function confirmDeselect() {
    if (!pendingDeselect) return;
    updateState({
      procedures: procedures.map((p) => (p.id === pendingDeselect ? { ...p, selected: false } : p)),
    });
    setPendingDeselect(null);
  }

  function addCustomProcedure() {
    const trimmed = customName.trim();
    if (!trimmed) return;

    updateState({
      procedures: [
        ...procedures,
        {
          id: `proc-custom-${Date.now()}-${procedures.length}`,
          name: trimmed,
          selected: true,
          isCustom: true,
        },
      ],
    });
    setCustomName("");
    setShowInput(false);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <div>
        <h2 className="font-heading text-foreground text-3xl tracking-tight">
          {t("confirm.procedures_title")}
        </h2>
        <p className="text-muted-foreground mt-2 text-base">
          {t("confirm.procedures_description")}
        </p>
        <p className="text-muted-foreground/60 mt-1 text-sm">
          {selectedCount} av {procedures.length} valgt
        </p>
      </div>

      {/* Procedure toggle list */}
      <div className="flex flex-col gap-2">
        {procedures.map((proc) => (
          <button
            key={proc.id}
            type="button"
            onClick={() => handleToggle(proc.id)}
            className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all ${
              proc.selected
                ? "border-primary/20 bg-primary/5 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                  proc.selected
                    ? "border-primary/30 bg-primary/20 text-primary"
                    : "border-border text-transparent"
                }`}
              >
                &#10003;
              </span>
              <span className="text-base">{proc.name}</span>
              {proc.recommended && (
                <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                  Anbefalt
                </span>
              )}
              {proc.isCustom && (
                <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-xs">
                  Egendefinert
                </span>
              )}
            </span>
          </button>
        ))}

        {/* Deselect warning for recommended procedures */}
        {pendingProc && (
          <div className="mt-2 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="flex flex-col gap-2">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                <strong>{pendingProc.name}</strong> er anbefalt for din bransje. Sikker?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmDeselect}
                  className="bg-muted text-foreground hover:bg-muted/80 rounded-lg px-3 py-1.5 text-xs"
                >
                  Ja, fjern
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeselect(null)}
                  className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5 text-xs"
                >
                  Behold
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add custom procedure */}
        {showInput ? (
          <div className="mt-2 flex items-center gap-3">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomProcedure();
                if (e.key === "Escape") {
                  setShowInput(false);
                  setCustomName("");
                }
              }}
              placeholder="Prosedyrenavn"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary flex-1 rounded-2xl border px-5 py-4 text-base outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={addCustomProcedure}
              className="bg-primary/10 text-foreground hover:bg-primary/20 rounded-2xl px-5 py-4 text-base"
            >
              Legg til
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setCustomName("");
              }}
              className="text-muted-foreground hover:text-foreground p-2"
            >
              <X className="size-5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-2 px-2 text-sm transition-colors"
          >
            <Plus className="size-4" />
            Legg til egen prosedyre
          </button>
        )}
      </div>

      {/* Continue button */}
      <button
        type="button"
        onClick={next}
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-colors"
      >
        {t("confirm.summary_title")} &rarr;
      </button>
    </div>
  );
}
