"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";

export function DepartmentsSection() {
  const { departments, toggleDepartment, addCustomDepartment, completeSection } = useOnboarding();
  const [showInput, setShowInput] = useState(false);
  const [customName, setCustomName] = useState("");

  function handleAdd() {
    const trimmed = customName.trim();
    if (!trimmed) return;
    addCustomDepartment(trimmed);
    setCustomName("");
    setShowInput(false);
  }

  return (
    <SectionReveal>
      <RevealItem>
        <h2 className="font-[family-name:var(--font-display)] text-5xl text-white">Avdelinger</h2>
      </RevealItem>

      <RevealItem>
        <p className="mt-4 text-lg text-white/60">
          Basert p&aring; bransjen din foresl&aring;r vi disse avdelingene. Fjern de som ikke
          passer.
        </p>
      </RevealItem>

      <RevealItem>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <div className="flex flex-wrap gap-3">
            {departments.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => toggleDepartment(dept.id)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 transition-all ${
                  dept.selected
                    ? "border-white/20 bg-white/15 text-white"
                    : "border-white/5 bg-white/5 text-white/40"
                }`}
              >
                <span>{dept.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    dept.selected ? "bg-white/10 text-white/70" : "bg-white/5 text-white/30"
                  }`}
                >
                  {dept.positions.length} stillinger
                </span>
              </button>
            ))}

            {!showInput && (
              <button
                type="button"
                onClick={() => setShowInput(true)}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-white/40 transition-all hover:text-white/60"
              >
                <Plus className="h-4 w-4" />
                <span>Legg til avdeling</span>
              </button>
            )}
          </div>

          {showInput && (
            <div className="mt-4 flex items-center gap-3">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                placeholder="Avdelingsnavn"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-colors outline-none placeholder:text-white/30 focus:border-white/20"
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
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => completeSection("departments")}
            className="mt-6 w-full cursor-pointer rounded-xl bg-white py-3 font-semibold text-black transition-colors hover:bg-white/90"
          >
            Bekreft avdelinger
          </button>
        </div>
      </RevealItem>
    </SectionReveal>
  );
}
