"use client";

/**
 * ConfirmPositions — operational positions per department.
 *
 * Only selected positions are visible. Unselected positions appear
 * in a popover when clicking "+ Legg til". Same pattern as ConfirmRoles.
 */

import { useEffect, useRef, useState } from "react";
import { Plus, X, Sparkles } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";

export function ConfirmPositions({
  state,
  updateState,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  const selectedDepts = state.departments.filter((d) => d.selected);

  const totalSelected = selectedDepts.reduce(
    (sum, d) => sum + d.positions.filter((p) => p.selected).length,
    0,
  );

  // Close popover on outside click
  useEffect(() => {
    if (!openPopover) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
        setCustomInput(null);
        setCustomName("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openPopover]);

  function removePosition(deptId: string, posId: string) {
    updateState({
      departments: state.departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              positions: d.positions.map((p) => (p.id === posId ? { ...p, selected: false } : p)),
            }
          : d,
      ),
    });
  }

  function addPosition(deptId: string, posId: string) {
    updateState({
      departments: state.departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              positions: d.positions.map((p) => (p.id === posId ? { ...p, selected: true } : p)),
            }
          : d,
      ),
    });
    setOpenPopover(null);
  }

  function addCustomPosition(deptId: string) {
    const trimmed = customName.trim();
    if (!trimmed) return;
    updateState({
      departments: state.departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              positions: [
                ...d.positions,
                {
                  id: `pos-custom-${Date.now()}`,
                  name: trimmed,
                  slug: trimmed.toLowerCase().replace(/\s+/g, "-"),
                  isLeader: false,
                  selected: true,
                },
              ],
            }
          : d,
      ),
    });
    setCustomName("");
    setCustomInput(null);
    setOpenPopover(null);
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="font-heading text-foreground text-2xl font-bold">
          {t("confirm.positions_title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("confirm.positions_description")}</p>
        <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
          <Sparkles className="h-3 w-3" />
          {t("positions.selectedCount", { count: totalSelected })}
        </p>
      </div>

      <div className="space-y-5">
        {selectedDepts.map((dept) => {
          const selected = dept.positions.filter((p) => p.selected);
          const unselected = dept.positions.filter((p) => !p.selected);

          return (
            <div key={dept.id}>
              <h3 className="font-heading text-foreground mb-2 text-sm font-semibold">
                {dept.name}
              </h3>

              <div className="space-y-1.5">
                {selected.map((pos) => (
                  <div
                    key={pos.id}
                    className="text-foreground flex w-full items-center justify-between rounded-lg border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5 px-3 py-2 text-left text-sm"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex size-4 shrink-0 items-center justify-center rounded border border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/20 text-[10px] text-[var(--brand-orange)]">
                        &#10003;
                      </span>
                      <span className="font-medium">{pos.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removePosition(dept.id, pos.id)}
                      className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}

                {selected.length === 0 && (
                  <p className="text-muted-foreground/60 text-xs italic">
                    {t("positions.noneSelected")}
                  </p>
                )}

                {/* Add more positions */}
                <div className="relative" ref={openPopover === dept.id ? popoverRef : undefined}>
                  <button
                    type="button"
                    onClick={() => setOpenPopover(openPopover === dept.id ? null : dept.id)}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 py-1 text-xs transition-colors"
                  >
                    <Plus className="size-3.5" />
                    {t("positions.addPosition")}
                  </button>

                  {openPopover === dept.id && (
                    <div className="border-border bg-card absolute left-0 z-20 mt-1 w-52 rounded-lg border py-1 shadow-lg">
                      {unselected.map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => addPosition(dept.id, pos.id)}
                          className="text-foreground flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)]"
                        >
                          {pos.name}
                        </button>
                      ))}

                      {unselected.length > 0 && <div className="border-border my-1 border-t" />}

                      {customInput === dept.id ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                          <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addCustomPosition(dept.id);
                              if (e.key === "Escape") {
                                setCustomInput(null);
                                setCustomName("");
                              }
                            }}
                            placeholder={t("confirm.positions_custom_placeholder")}
                            className="border-border bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded border px-2 py-1 text-xs focus-visible:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => addCustomPosition(dept.id)}
                            className="px-1 text-xs font-medium text-[var(--brand-orange)]"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCustomInput(dept.id)}
                          className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs"
                        >
                          <Plus className="size-3" />
                          {t("confirm.positions_custom")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {selectedDepts.length === 0 && (
          <p className="text-muted-foreground text-sm italic">{t("positions.noDepartments")}</p>
        )}
      </div>
    </div>
  );
}
