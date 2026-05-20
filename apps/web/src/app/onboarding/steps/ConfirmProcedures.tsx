"use client";

/**
 * ConfirmProcedures — Step 4 of onboarding confirmation wizard.
 *
 * Shows procedure suggestions from I1 as ghost cards.
 * Recommended procedures are pre-selected with solid styling.
 * Non-recommended appear as translucent ghost cards (optional suggestions).
 * Warning before deselecting a recommended procedure.
 */

import { useState } from "react";
import { Plus, X, AlertTriangle, Sparkles } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useProceduresTools } from "./tools/procedures-tools";

export function ConfirmProcedures({
  state,
  updateState,
  next,
  back,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const tools = useProceduresTools(state, updateState, next, back);
  useRegisterTools("wizard-onboarding-procedures", tools);

  const [showInput, setShowInput] = useState(false);
  const [customName, setCustomName] = useState("");
  const [pendingDeselect, setPendingDeselect] = useState<string | null>(null);

  const procedures = state.procedures;
  const selectedCount = procedures.filter((p) => p.selected).length;
  const pendingProc = pendingDeselect ? procedures.find((p) => p.id === pendingDeselect) : null;

  function handleToggle(id: string) {
    const proc = procedures.find((p) => p.id === id);
    if (!proc) return;

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
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="font-heading text-foreground text-2xl font-bold">
          {t("confirm.procedures_title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("confirm.procedures_description")}</p>
        <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
          <Sparkles className="h-3 w-3" />
          {t("confirm.procedures_selected_count", {
            selected: selectedCount,
            total: procedures.length,
          })}
        </p>
      </div>

      {/* Procedure ghost card list */}
      <div className="space-y-2">
        {procedures.map((proc) => (
          <button
            key={proc.id}
            type="button"
            onClick={() => handleToggle(proc.id)}
            className={[
              "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-200",
              proc.selected
                ? "text-foreground border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5"
                : "border-border text-muted-foreground hover:text-foreground border-dashed bg-white/50 hover:border-[var(--brand-orange)]/30 hover:bg-[var(--brand-orange)]/5",
            ].join(" ")}
          >
            <span className="flex items-center gap-3">
              <span
                className={[
                  "flex size-5 shrink-0 items-center justify-center rounded border text-xs transition-all duration-200",
                  proc.selected
                    ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]"
                    : "border-border bg-card text-transparent",
                ].join(" ")}
              >
                &#10003;
              </span>
              <span className="text-sm">{proc.name}</span>
              {proc.recommended && (
                <span className="rounded bg-[var(--success)]/10 px-1.5 py-0.5 text-[10px] text-[var(--success)]">
                  {t("confirm.recommended_badge")}
                </span>
              )}
              {proc.isCustom && (
                <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                  {t("confirm.custom_badge")}
                </span>
              )}
            </span>

            {!proc.selected && !proc.recommended && (
              <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
                {t("confirm.proposal_badge")}
              </span>
            )}
          </button>
        ))}

        {/* Deselect warning for recommended procedures */}
        {pendingProc && (
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--warning)]/20 bg-[var(--warning)]/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--warning)]" />
            <div className="flex flex-col gap-2">
              <p className="text-xs text-[var(--warning)]">
                <strong>{pendingProc.name}</strong> {t("confirm.procedures_deselect_warning")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmDeselect}
                  className="bg-muted text-muted-foreground hover:bg-accent rounded-md px-2.5 py-1 text-xs"
                >
                  {t("confirm.procedures_deselect_confirm")}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeselect(null)}
                  className="text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 text-xs"
                >
                  {t("confirm.procedures_deselect_cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add custom procedure */}
        {showInput ? (
          <div className="flex items-center gap-2">
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
              placeholder={t("confirm.procedures_name_placeholder")}
              className="border-input bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded-lg border px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 focus-visible:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={addCustomProcedure}
              className="rounded-lg bg-[var(--brand-orange)]/10 px-3 py-2.5 text-sm text-[var(--brand-orange)] transition-colors hover:bg-[var(--brand-orange)]/20"
            >
              {t("confirm.add_button")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setCustomName("");
              }}
              className="text-muted-foreground hover:text-foreground p-1.5"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 text-xs transition-colors"
          >
            <Plus className="size-3.5" />
            {t("confirm.procedures_add_custom")}
          </button>
        )}
      </div>
    </div>
  );
}
