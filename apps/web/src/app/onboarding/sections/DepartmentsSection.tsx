"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { useOnboarding } from "../WizardContext";
import { EASE_EXPO } from "../lib/motion";

export function DepartmentsSection() {
  const { departments, toggleDepartment, addCustomDepartment, completeSection, business } =
    useOnboarding();

  const [showInput, setShowInput] = useState(false);
  const [customName, setCustomName] = useState("");

  function handleAdd() {
    const trimmed = customName.trim();
    if (!trimmed) return;
    addCustomDepartment(trimmed);
    setCustomName("");
    setShowInput(false);
  }

  const selectedCount = departments.filter((d) => d.selected).length;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left: Agent voice */}
      <div className="flex flex-col justify-center border-r border-white/[0.04] px-10 py-20 lg:w-[38%] lg:px-16">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: EASE_EXPO }}
        >
          <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase">
            Avdelinger
          </p>
          <h2 className="font-heading mt-6 text-[clamp(3.5rem,7vw,6rem)] leading-[0.9] tracking-tight text-white">
            Slik ser
            <br />
            organisasjonen
            <br />
            <span className="text-white/25">din ut.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/35">
            {business.industry
              ? `Basert på ${business.industry} — dette er standardoppsettet.`
              : "Standardoppsett basert på bransjen din."}
            <br />
            Slå av avdelinger du ikke trenger.
          </p>

          <div className="mt-4 flex items-center gap-2 text-sm text-white/25">
            <span className="text-white/50 tabular-nums">{selectedCount}</span>
            <span>av {departments.length} valgt</span>
          </div>

          <div className="mt-10 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => completeSection("departments")}
              className="flex items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
            >
              Bekreft avdelinger →
            </button>
          </div>
        </motion.div>
      </div>

      {/* Right: Chips canvas — no card wrapper */}
      <div className="flex flex-col justify-center px-10 py-20 lg:w-[62%] lg:px-16">
        <div className="flex flex-wrap gap-3">
          {departments.map((dept, i) => (
            <motion.button
              key={dept.id}
              type="button"
              onClick={() => toggleDepartment(dept.id)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.5, ease: EASE_EXPO }}
              className={`flex items-center gap-2.5 rounded-2xl border px-5 py-3.5 text-base transition-all ${
                dept.selected
                  ? "border-white/15 bg-white/12 text-white"
                  : "border-white/[0.04] bg-white/[0.03] text-white/30 hover:border-white/10 hover:text-white/50"
              }`}
            >
              <span className="font-medium">{dept.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  dept.selected ? "bg-white/10 text-white/60" : "bg-white/[0.04] text-white/20"
                }`}
              >
                {dept.positions.filter((p) => p.selected).length}
              </span>
            </motion.button>
          ))}

          {/* Add custom */}
          {!showInput ? (
            <motion.button
              type="button"
              onClick={() => setShowInput(true)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: departments.length * 0.07 + 0.1, duration: 0.5 }}
              className="flex items-center gap-2 rounded-2xl border border-dashed border-white/[0.1] px-5 py-3.5 text-base text-white/30 transition-all hover:border-white/20 hover:text-white/50"
            >
              <Plus className="h-4 w-4" />
              Legg til
            </motion.button>
          ) : (
            <div className="flex items-center gap-2">
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
                placeholder="Avdelingsnavn"
                className="rounded-2xl border border-white/[0.08] bg-white/5 px-5 py-3.5 text-base text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAdd}
                className="rounded-2xl bg-white/10 px-4 py-3.5 text-base text-white transition-colors hover:bg-white/15"
              >
                Legg til
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInput(false);
                  setCustomName("");
                }}
                className="p-2 text-white/30 transition-colors hover:text-white/60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
