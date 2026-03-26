"use client";

/**
 * ConfirmDepartments — Step 2 of onboarding confirmation wizard.
 *
 * Shows department suggestions from Industry Intelligence (I1) as ghost cards.
 * Unselected = translucent ghost card (suggestion). Selected = solid card (confirmed).
 * User can toggle and add custom departments.
 */

import { useState } from "react";
import { Plus, X, Sparkles } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";

export function ConfirmDepartments({
  state,
  updateState,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const [showInput, setShowInput] = useState(false);
  const [customName, setCustomName] = useState("");

  const departments = state.departments;
  const selectedCount = departments.filter((d) => d.selected).length;
  const hasSuggestions = departments.some((d) => !d.selected);

  function toggleDepartment(id: string) {
    updateState({
      departments: departments.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)),
    });
  }

  function addCustomDepartment() {
    const trimmed = customName.trim();
    if (!trimmed) return;

    const id = `custom-${Date.now()}-${departments.length}`;
    updateState({
      departments: [
        ...departments,
        { id, name: trimmed, icon: "plus", selected: true, positions: [] },
      ],
    });
    setCustomName("");
    setShowInput(false);
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">{t("confirm.departments_title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("confirm.departments_description")}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-orange-500">
          <Sparkles className="h-3 w-3" />
          {selectedCount} valgt av {departments.length} forslag
        </p>
      </div>

      {/* Department ghost cards */}
      <div className="space-y-2">
        {departments.map((dept) => (
          <button
            key={dept.id}
            type="button"
            onClick={() => toggleDepartment(dept.id)}
            className={[
              "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-200",
              dept.selected
                ? "text-foreground border-orange-500/30 bg-orange-500/5"
                : "border-dashed border-gray-200 bg-white/50 text-gray-400 hover:border-orange-300 hover:bg-orange-50/50 hover:text-gray-600",
            ].join(" ")}
          >
            <span className="flex items-center gap-3">
              <span
                className={[
                  "flex size-5 shrink-0 items-center justify-center rounded border text-xs transition-all duration-200",
                  dept.selected
                    ? "border-orange-500/40 bg-orange-500/20 text-orange-600"
                    : "border-gray-200 bg-white text-transparent",
                ].join(" ")}
              >
                &#10003;
              </span>
              <span className="text-sm font-medium">{dept.name}</span>
              {dept.positions.length > 0 && (
                <span
                  className={[
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    dept.selected
                      ? "bg-orange-500/10 text-orange-600"
                      : "bg-gray-100 text-gray-400",
                  ].join(" ")}
                >
                  {dept.positions.length} stillinger
                </span>
              )}
            </span>

            {!dept.selected && (
              <span className="text-[10px] tracking-wider text-gray-300 uppercase">Forslag</span>
            )}
          </button>
        ))}

        {/* Add custom department */}
        {showInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomDepartment();
                if (e.key === "Escape") {
                  setShowInput(false);
                  setCustomName("");
                }
              }}
              placeholder="Avdelingsnavn"
              className="border-input bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={addCustomDepartment}
              className="rounded-lg bg-orange-500/10 px-3 py-2 text-sm text-orange-600 transition-colors hover:bg-orange-500/20"
            >
              Legg til
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setCustomName("");
              }}
              className="text-muted-foreground hover:text-foreground p-1.5 transition-colors"
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
            Legg til egen avdeling
          </button>
        )}
      </div>

      {hasSuggestions && (
        <p className="text-muted-foreground text-xs">
          Stiplede kort er forslag basert på bransjen din. Klikk for å velge.
        </p>
      )}
    </div>
  );
}
