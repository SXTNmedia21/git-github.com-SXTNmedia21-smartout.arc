"use client";

/**
 * ConfirmDepartments — department selection only.
 *
 * Simple toggle cards for departments. No positions here —
 * those are handled in separate Roles and Positions steps.
 */

import { useState } from "react";
import { Plus, X, Sparkles } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useDepartmentsTools } from "./tools/departments-tools";

export function ConfirmDepartments({
  state,
  updateState,
  next,
  back,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const tools = useDepartmentsTools(state, updateState, next, back);
  useRegisterTools("wizard-onboarding-departments", tools);

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
        <h2 className="font-heading text-foreground text-2xl font-bold">
          {t("confirm.departments_title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("confirm.departments_description")}</p>
        <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
          <Sparkles className="h-3 w-3" />
          {t("confirm.departments_selected_count", {
            selected: selectedCount,
            total: departments.length,
          })}
        </p>
      </div>

      <div className="space-y-2">
        {departments.map((dept) => (
          <button
            key={dept.id}
            type="button"
            onClick={() => toggleDepartment(dept.id)}
            className={[
              "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-200",
              dept.selected
                ? "text-foreground border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5"
                : "border-border text-muted-foreground hover:text-foreground border-dashed bg-white/50 hover:border-[var(--brand-orange)]/30 hover:bg-[var(--brand-orange)]/5",
            ].join(" ")}
          >
            <span className="flex items-center gap-3">
              <span
                className={[
                  "flex size-5 shrink-0 items-center justify-center rounded border text-xs transition-all duration-200",
                  dept.selected
                    ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]"
                    : "border-border bg-card text-transparent",
                ].join(" ")}
              >
                &#10003;
              </span>
              <span className="text-sm font-medium">{dept.name}</span>
            </span>

            {!dept.selected && (
              <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
                {t("confirm.proposal_badge")}
              </span>
            )}
          </button>
        ))}

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
              placeholder={t("confirm.departments_name_placeholder")}
              className="border-input bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 focus-visible:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={addCustomDepartment}
              className="rounded-lg bg-[var(--brand-orange)]/10 px-3 py-2 text-sm text-[var(--brand-orange)] transition-colors hover:bg-[var(--brand-orange)]/20"
            >
              {t("confirm.add_button")}
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
            {t("confirm.departments_add_custom")}
          </button>
        )}
      </div>
    </div>
  );
}
