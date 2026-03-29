"use client";

import { useState } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useOnboarding } from "../WizardContext";
import { EASE_EXPO } from "../lib/motion";

export function ProceduresSection() {
  const { procedures, toggleProcedure, addCustomProcedure, completeSection, business } =
    useOnboarding();

  const [showInput, setShowInput] = useState(false);
  const [customName, setCustomName] = useState("");
  const [pendingDeselect, setPendingDeselect] = useState<string | null>(null);

  function handleAdd() {
    const trimmed = customName.trim();
    if (!trimmed) return;
    addCustomProcedure(trimmed);
    setCustomName("");
    setShowInput(false);
  }

  function handleToggle(id: string) {
    const proc = procedures.find((p) => p.id === id);
    if (!proc) return;
    if (proc.recommended && proc.selected) {
      setPendingDeselect(id);
      return;
    }
    toggleProcedure(id);
  }

  function confirmDeselect() {
    if (pendingDeselect) {
      toggleProcedure(pendingDeselect);
      setPendingDeselect(null);
    }
  }

  const selectedCount = procedures.filter((p) => p.selected).length;
  const industryLabel = business.industry || "din bransje";
  const pendingProc = pendingDeselect ? procedures.find((p) => p.id === pendingDeselect) : null;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div className="flex flex-col justify-center border-r border-white/[0.04] px-10 py-20 lg:w-[38%] lg:px-16">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: EASE_EXPO }}
        >
          <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase">
            Prosedyrer
          </p>
          <h2 className="font-heading mt-6 text-[clamp(3.5rem,7vw,6rem)] leading-[0.9] tracking-tight text-white">
            Dette
            <br />
            burde
            <br />
            <span className="text-white/25">dere ha.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/35">
            Basert på {industryLabel}.
            <br />
            Du kan alltid legge til flere i dashboardet.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-white/25">
            <span className="text-white/50 tabular-nums">{selectedCount}</span>
            <span>av {procedures.length} valgt</span>
          </div>
          <div className="mt-10">
            <button
              type="button"
              onClick={() => completeSection("procedures")}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
            >
              Bekreft prosedyrer →
            </button>
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col justify-start overflow-y-auto px-10 py-20 lg:w-[62%] lg:px-16">
        <div className="flex flex-col gap-2">
          {procedures.map((proc, i) => (
            <motion.button
              key={proc.id}
              type="button"
              onClick={() => handleToggle(proc.id)}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.45, ease: EASE_EXPO }}
              className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all ${
                proc.selected
                  ? "border-white/[0.12] bg-white/[0.08] text-white"
                  : "border-white/[0.03] bg-white/[0.03] text-white/35 hover:border-white/[0.08] hover:text-white/55"
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                    proc.selected
                      ? "border-white/20 bg-white/20 text-white"
                      : "border-white/10 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="text-base">{proc.name}</span>
                {proc.recommended && (
                  <span className="bg-success/[0.12] text-success rounded-md px-1.5 py-0.5 text-xs">
                    Anbefalt
                  </span>
                )}
                {proc.isCustom && (
                  <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-xs text-white/40">
                    Egendefinert
                  </span>
                )}
              </span>
            </motion.button>
          ))}

          {pendingProc && (
            <div className="border-warning/20 bg-warning/[0.08] mt-2 flex items-start gap-3 rounded-2xl border px-5 py-4">
              <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-2">
                <p className="text-warning text-sm">
                  <strong>{pendingProc.name}</strong> er anbefalt for din bransje. Sikker?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={confirmDeselect}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"
                  >
                    Ja, fjern
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeselect(null)}
                    className="rounded-lg px-3 py-1.5 text-xs text-white/40 hover:text-white/60"
                  >
                    Behold
                  </button>
                </div>
              </div>
            </div>
          )}

          {showInput ? (
            <div className="mt-2 flex items-center gap-3">
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
                className="flex-1 rounded-2xl border border-white/[0.08] bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/25 focus:border-white/20"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAdd}
                className="rounded-2xl bg-white/10 px-5 py-4 text-base text-white hover:bg-white/15"
              >
                Legg til
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInput(false);
                  setCustomName("");
                }}
                className="p-2 text-white/30 hover:text-white/60"
              >
                <X className="size-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="mt-2 flex items-center gap-2 px-2 text-sm text-white/25 transition-colors hover:text-white/50"
            >
              <Plus className="size-4" />
              Legg til egen prosedyre
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
