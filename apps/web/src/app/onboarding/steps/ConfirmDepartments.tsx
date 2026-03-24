"use client";

/**
 * ConfirmDepartments — Step 2 of onboarding confirmation wizard.
 *
 * Shows department chips pre-selected by Industry Intelligence (I1).
 * User can toggle departments on/off and add custom ones.
 * Reuses the chip toggle pattern from the existing DepartmentsSection.
 */

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";

export function ConfirmDepartments({
  state,
  updateState,
  next,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const [showInput, setShowInput] = useState(false);
  const [customName, setCustomName] = useState("");

  const departments = state.departments;
  const selectedCount = departments.filter((d) => d.selected).length;

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
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <div>
        <h2 className="font-heading text-foreground text-3xl tracking-tight">
          {t("confirm.departments_title")}
        </h2>
        <p className="text-muted-foreground mt-2 text-base">
          {t("confirm.departments_description")}
        </p>
        <p className="text-muted-foreground/60 mt-1 text-sm">
          {selectedCount} av {departments.length} valgt
        </p>
      </div>

      {/* Department chips */}
      <div className="flex flex-wrap gap-3">
        {departments.map((dept) => (
          <button
            key={dept.id}
            type="button"
            onClick={() => toggleDepartment(dept.id)}
            className={`flex items-center gap-2.5 rounded-2xl border px-5 py-3.5 text-base transition-all ${
              dept.selected
                ? "border-primary/30 bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
            }`}
          >
            <span className="font-medium">{dept.name}</span>
            {dept.positions.length > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  dept.selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {dept.positions.length}
              </span>
            )}
          </button>
        ))}

        {/* Add custom department */}
        {!showInput ? (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="border-border text-muted-foreground hover:border-border/80 hover:text-foreground flex items-center gap-2 rounded-2xl border border-dashed px-5 py-3.5 text-base transition-all"
          >
            <Plus className="size-4" />
            Legg til
          </button>
        ) : (
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
              className="border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary rounded-2xl border px-5 py-3.5 text-base focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={addCustomDepartment}
              className="bg-primary/10 text-foreground hover:bg-primary/20 rounded-2xl px-4 py-3.5 text-base transition-colors"
            >
              Legg til
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setCustomName("");
              }}
              className="text-muted-foreground hover:text-foreground p-2 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
      </div>

      {/* Continue button */}
      <button
        type="button"
        onClick={next}
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-colors"
      >
        {t("confirm.locations_title")} &rarr;
      </button>
    </div>
  );
}
