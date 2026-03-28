"use client";

/**
 * ConfirmProfessions — Step 3 of onboarding confirmation wizard.
 *
 * Shows professions (Fag) as compact group headings with positions as
 * selectable ghost cards underneath. Pre-selected positions are on by default.
 * Users confirm and adjust before finalizing.
 *
 * Design: Compact grouped layout per council recommendation. One "add" button
 * at the bottom. Pre-selected common positions. ARIA groups per profession.
 */

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";

export function ConfirmProfessions({
  state,
  updateState,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");
  const [newPositionProfession, setNewPositionProfession] = useState("");

  const professions = state.professions;
  const totalPositions = professions.reduce((sum, p) => sum + p.positions.length, 0);
  const selectedCount = professions.reduce(
    (sum, p) => sum + p.positions.filter((pos) => pos.selected).length,
    0,
  );

  function togglePosition(professionId: string, positionId: string) {
    updateState({
      professions: professions.map((p) =>
        p.id === professionId
          ? {
              ...p,
              positions: p.positions.map((pos) =>
                pos.id === positionId ? { ...pos, selected: !pos.selected } : pos,
              ),
            }
          : p,
      ),
    });
  }

  function addPosition() {
    const trimmed = newPositionName.trim();
    if (!trimmed || !newPositionProfession) return;

    updateState({
      professions: professions.map((p) =>
        p.id === newPositionProfession
          ? {
              ...p,
              positions: [
                ...p.positions,
                {
                  id: `pos-custom-${Date.now()}`,
                  name: trimmed,
                  slug: trimmed.toLowerCase().replace(/\s+/g, "-"),
                  isLeader: false,
                  selected: true,
                },
              ],
            }
          : p,
      ),
    });
    setNewPositionName("");
    setNewPositionProfession("");
    setShowAddInput(false);
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">
          {t("confirm.professions_title", { defaultValue: "Fag og posisjoner" })}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("confirm.professions_description", {
            defaultValue: "Bekreft hvilke posisjoner dere trenger, gruppert etter fagområde.",
          })}
        </p>
        <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
          <Sparkles className="h-3 w-3" />
          {selectedCount} valgt av {totalPositions} forslag
        </p>
      </div>

      {/* Profession groups */}
      <div className="space-y-6">
        {professions.map((profession) => (
          <div key={profession.id} role="group" aria-label={profession.name}>
            {/* Fag heading — compact label */}
            <span className="text-muted-foreground mb-2 block text-xs font-medium tracking-wider uppercase">
              {profession.name}
            </span>

            {/* Position ghost cards */}
            <div className="space-y-2">
              {profession.positions.map((position) => (
                <button
                  key={position.id}
                  type="button"
                  aria-pressed={position.selected}
                  onClick={() => togglePosition(profession.id, position.id)}
                  className={[
                    "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-200",
                    position.selected
                      ? "text-foreground border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5"
                      : "border-border text-muted-foreground hover:text-foreground bg-card/50 border-dashed hover:border-[var(--brand-orange)]/30 hover:bg-[var(--brand-orange)]/5",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={[
                        "flex size-5 shrink-0 items-center justify-center rounded border text-xs transition-all duration-200",
                        position.selected
                          ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]"
                          : "border-border bg-card text-transparent",
                      ].join(" ")}
                    >
                      &#10003;
                    </span>
                    <span className="text-sm font-medium">{position.name}</span>
                  </span>

                  {!position.selected && (
                    <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
                      Forslag
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add custom position */}
      {showAddInput ? (
        <div className="border-border bg-card space-y-3 rounded-lg border p-4">
          <select
            value={newPositionProfession}
            onChange={(e) => setNewPositionProfession(e.target.value)}
            className="border-border bg-background text-foreground focus-visible:ring-brand-orange/40 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">Velg fagområde</option>
            {professions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newPositionName}
            onChange={(e) => setNewPositionName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPosition()}
            placeholder="Posisjonsnavn"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-brand-orange/40 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addPosition}
              className="bg-brand-orange/10 text-foreground hover:bg-brand-orange/20 flex-1 rounded-md py-2 text-sm transition-colors"
            >
              Legg til
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddInput(false);
                setNewPositionName("");
                setNewPositionProfession("");
              }}
              className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddInput(true)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 text-xs transition-colors"
        >
          <Plus className="size-3.5" />
          Legg til egen posisjon
        </button>
      )}
    </div>
  );
}
