"use client";

/**
 * ConfirmDepartments — Step 2 of onboarding confirmation wizard.
 *
 * Shows department suggestions from Industry Intelligence (I1) as ghost cards.
 * Each selected department expands to show position tags with leader toggle
 * and an add-more popover for unselected positions and custom entries.
 */

import { useEffect, useRef, useState } from "react";
import { Plus, X, Sparkles, Star } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";

export function ConfirmDepartments({
  state,
  updateState,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const [showDeptInput, setShowDeptInput] = useState(false);
  const [customDeptName, setCustomDeptName] = useState("");
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [customPosInput, setCustomPosInput] = useState<string | null>(null);
  const [customPosName, setCustomPosName] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!openPopover) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
        setCustomPosInput(null);
        setCustomPosName("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openPopover]);

  const departments = state.departments;
  const selectedCount = departments.filter((d) => d.selected).length;
  const hasSuggestions = departments.some((d) => !d.selected);

  function toggleDepartment(id: string) {
    updateState({
      departments: departments.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)),
    });
  }

  function addCustomDepartment() {
    const trimmed = customDeptName.trim();
    if (!trimmed) return;
    updateState({
      departments: [
        ...departments,
        {
          id: `custom-${Date.now()}-${departments.length}`,
          name: trimmed,
          icon: "plus",
          selected: true,
          positions: [],
        },
      ],
    });
    setCustomDeptName("");
    setShowDeptInput(false);
  }

  function togglePosition(deptId: string, posId: string) {
    updateState({
      departments: departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              positions: d.positions.map((p) =>
                p.id === posId ? { ...p, selected: !p.selected } : p,
              ),
            }
          : d,
      ),
    });
  }

  function toggleLeader(deptId: string, posId: string) {
    updateState({
      departments: departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              positions: d.positions.map((p) =>
                p.id === posId ? { ...p, isLeader: !p.isLeader } : p,
              ),
            }
          : d,
      ),
    });
  }

  function addPositionFromSuggestion(deptId: string, posName: string) {
    updateState({
      departments: departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              positions: d.positions.map((p) =>
                p.name === posName ? { ...p, selected: true } : p,
              ),
            }
          : d,
      ),
    });
    setOpenPopover(null);
  }

  function addCustomPosition(deptId: string) {
    const trimmed = customPosName.trim();
    if (!trimmed) return;
    updateState({
      departments: departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              positions: [
                ...d.positions,
                { id: `pos-custom-${Date.now()}`, name: trimmed, isLeader: false, selected: true },
              ],
            }
          : d,
      ),
    });
    setCustomPosName("");
    setCustomPosInput(null);
    setOpenPopover(null);
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">{t("confirm.departments_title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("confirm.departments_description")}</p>
        <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
          <Sparkles className="h-3 w-3" />
          {selectedCount} valgt av {departments.length} forslag
        </p>
      </div>

      <div className="space-y-2">
        {departments.map((dept) => (
          <div key={dept.id}>
            {/* Department toggle */}
            <button
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
                  Forslag
                </span>
              )}
            </button>

            {/* Position tags — only when department is selected */}
            {dept.selected && (
              <div className="mt-2 mb-1 ml-8 flex flex-wrap items-center gap-1.5">
                {dept.positions.filter((p) => p.selected).length === 0 && (
                  <span className="text-muted-foreground/60 text-xs italic">
                    Ingen stillinger valgt
                  </span>
                )}
                {dept.positions
                  .filter((p) => p.selected)
                  .map((pos) => (
                    <span
                      key={pos.id}
                      className={[
                        "group flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        pos.isLeader
                          ? "border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                          : "border-border bg-muted/50 text-foreground",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => toggleLeader(dept.id, pos.id)}
                        title={t("confirm.positions_leader")}
                      >
                        <Star
                          className={[
                            "size-3",
                            pos.isLeader ? "fill-current" : "text-muted-foreground/40",
                          ].join(" ")}
                        />
                      </button>
                      {pos.name}
                      <button
                        type="button"
                        onClick={() => togglePosition(dept.id, pos.id)}
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}

                {/* + Legg til popover */}
                <div className="relative" ref={openPopover === dept.id ? popoverRef : undefined}>
                  <button
                    type="button"
                    onClick={() => setOpenPopover(openPopover === dept.id ? null : dept.id)}
                    className="border-border text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs transition-colors"
                  >
                    <Plus className="size-3" />
                    {t("confirm.positions_add")}
                  </button>

                  {openPopover === dept.id && (
                    <div className="border-border bg-card absolute left-0 z-20 mt-1 w-48 rounded-lg border py-1 shadow-lg">
                      {dept.positions
                        .filter((p) => !p.selected)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addPositionFromSuggestion(dept.id, p.name)}
                            className="text-foreground flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)]"
                          >
                            {p.name}
                          </button>
                        ))}

                      {dept.positions.filter((p) => !p.selected).length > 0 && (
                        <div className="border-border my-1 border-t" />
                      )}

                      {customPosInput === dept.id ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                          <input
                            type="text"
                            value={customPosName}
                            onChange={(e) => setCustomPosName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addCustomPosition(dept.id);
                              if (e.key === "Escape") {
                                setCustomPosInput(null);
                                setCustomPosName("");
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
                          onClick={() => setCustomPosInput(dept.id)}
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
            )}
          </div>
        ))}

        {/* Add custom department */}
        {showDeptInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customDeptName}
              onChange={(e) => setCustomDeptName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomDepartment();
                if (e.key === "Escape") {
                  setShowDeptInput(false);
                  setCustomDeptName("");
                }
              }}
              placeholder="Avdelingsnavn"
              className="border-input bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 focus-visible:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={addCustomDepartment}
              className="rounded-lg bg-[var(--brand-orange)]/10 px-3 py-2 text-sm text-[var(--brand-orange)] transition-colors hover:bg-[var(--brand-orange)]/20"
            >
              Legg til
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDeptInput(false);
                setCustomDeptName("");
              }}
              className="text-muted-foreground hover:text-foreground p-1.5 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeptInput(true)}
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
