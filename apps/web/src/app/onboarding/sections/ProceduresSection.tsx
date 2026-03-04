"use client";

import { useState } from "react";
import { ClipboardCheck, Plus, X } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";

export function ProceduresSection() {
  const { procedures, toggleProcedure, addCustomProcedure, completeSection, business } =
    useOnboarding();

  const [showInput, setShowInput] = useState(false);
  const [customName, setCustomName] = useState("");

  function handleAdd() {
    const trimmed = customName.trim();
    if (!trimmed) return;
    addCustomProcedure(trimmed);
    setCustomName("");
    setShowInput(false);
  }

  const selectedCount = procedures.filter((p) => p.selected).length;
  const industryLabel = business.industry || "din bransje";

  return (
    <SectionReveal>
      <RevealItem>
        <h2 className="font-heading text-6xl leading-[1.1] tracking-tight text-white">
          Prosedyrer
        </h2>
      </RevealItem>

      <RevealItem>
        <p className="mt-4 text-xl leading-relaxed text-white/50">
          Basert p&aring; {industryLabel} anbefaler vi disse prosedyrene. Du kan tilpasse dem senere
          i dashboardet.
        </p>
      </RevealItem>

      <RevealItem>
        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.07] p-8 shadow-lg shadow-black/20">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <ClipboardCheck className="size-4" />
            <span>
              {selectedCount} av {procedures.length} valgt
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {procedures.map((proc) => (
              <button
                key={proc.id}
                type="button"
                onClick={() => toggleProcedure(proc.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                  proc.selected
                    ? "border-white/[0.12] bg-white/15 text-white"
                    : "border-white/[0.03] bg-white/5 text-white/40"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex size-5 items-center justify-center rounded-md border text-xs ${
                      proc.selected
                        ? "border-white/20 bg-white/20 text-white"
                        : "border-white/10 text-transparent"
                    }`}
                  >
                    &#10003;
                  </span>
                  {proc.name}
                  {proc.isCustom && (
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs text-white/50">
                      Egendefinert
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {showInput ? (
            <div className="mt-4 flex items-center gap-3">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setShowInput(false);
                    setCustomName("");
                  }
                }}
                placeholder="Prosedyrenavn"
                className="flex-1 rounded-xl border border-white/[0.06] bg-white/5 px-4 py-3 text-white transition-colors outline-none placeholder:text-white/30 focus:border-white/20"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAdd}
                className="rounded-xl bg-white/10 px-4 py-3 text-white transition-colors hover:bg-white/15"
              >
                Legg til
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInput(false);
                  setCustomName("");
                }}
                className="p-2 text-white/40 transition-colors hover:text-white/60"
              >
                <X className="size-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="mt-4 flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/60"
            >
              <Plus className="size-4" />
              Legg til egen prosedyre
            </button>
          )}

          <button
            type="button"
            onClick={() => completeSection("procedures")}
            className="mt-6 w-full cursor-pointer rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
          >
            Bekreft prosedyrer
          </button>
        </div>
      </RevealItem>
    </SectionReveal>
  );
}
