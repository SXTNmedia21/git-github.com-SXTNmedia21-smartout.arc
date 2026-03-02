"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useWizard } from "../WizardContext";
import { ProcedureDrawer } from "../drawers/ProcedureDrawer";
import type { CoreProcedure } from "../types";

export function ProceduresStep() {
  const wizard = useWizard();
  const [isProcedureDrawerOpen, setIsProcedureDrawerOpen] = useState(false);
  const [editingProcedureIndex, setEditingProcedureIndex] = useState<number | null>(null);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Define Procedures
        </h1>
        <p className="text-lg text-zinc-400">
          Set up the standard operating procedures and tasks for your departments, assigning urgency
          and priority.
        </p>
      </div>

      <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-50"></div>

        <h3 className="mb-4 text-xl font-bold text-white">Initial Tasks & Routines</h3>

        {wizard.workspaceData.departments.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-black/40 py-8 text-center">
            <p className="text-zinc-500">You must define departments before creating procedures.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {wizard.workspaceData.procedures.length > 0 ? (
              wizard.workspaceData.procedures.map((proc: CoreProcedure, idx: number) => (
                <div
                  key={idx}
                  className="relative cursor-pointer rounded-xl border border-white/10 bg-black/40 p-5 transition-colors hover:bg-black/60"
                  onClick={() => {
                    setEditingProcedureIndex(idx);
                    setIsProcedureDrawerOpen(true);
                  }}
                >
                  <div
                    className={`absolute top-4 right-4 rounded px-2 py-1 text-xs font-bold uppercase ${
                      proc.urgency === "High"
                        ? "bg-red-500/20 text-red-500"
                        : proc.urgency === "Medium"
                          ? "bg-yellow-500/20 text-yellow-500"
                          : "bg-green-500/20 text-green-500"
                    }`}
                  >
                    {proc.urgency || "Normal"} Urgency
                  </div>
                  <h4 className="mb-1 font-bold text-white">{proc.title}</h4>
                  <p className="mb-4 text-sm text-zinc-400">
                    Assigned to:{" "}
                    <span className="text-zinc-200">{proc.assignedTo || "Unassigned"}</span>
                  </p>

                  <button className="text-sm text-purple-400 transition-colors hover:text-purple-300">
                    Edit Details
                  </button>
                </div>
              ))
            ) : (
              <div className="mb-4 rounded-xl border-2 border-dashed border-white/10 py-8 text-center">
                <p className="text-zinc-500">No procedures created yet.</p>
              </div>
            )}

            <button
              onClick={() => {
                const newProcs = [
                  ...wizard.workspaceData.procedures,
                  {
                    title: "New Procedure",
                    description: "",
                    urgency: "Medium",
                    assignedTo: "",
                  },
                ];
                wizard.updateData({ procedures: newProcs });
                setEditingProcedureIndex(newProcs.length - 1);
                setIsProcedureDrawerOpen(true);
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 py-4 text-zinc-400 transition-colors hover:border-white/30 hover:text-white"
            >
              + Create Custom Procedure
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:mt-10 sm:flex-row sm:justify-between">
        <button
          onClick={() => wizard.goTo("locations")}
          className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
        >
          Back
        </button>
        <button
          onClick={() => wizard.goTo("battlefield_review")}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-purple-500/25 transition-transform hover:from-purple-400 hover:to-pink-500 active:scale-95"
        >
          Final Review <ArrowRight size={18} />
        </button>
      </div>

      {isProcedureDrawerOpen &&
        editingProcedureIndex !== null &&
        wizard.workspaceData.procedures[editingProcedureIndex] && (
          <ProcedureDrawer
            isOpen={isProcedureDrawerOpen}
            onClose={() => setIsProcedureDrawerOpen(false)}
            procedure={wizard.workspaceData.procedures[editingProcedureIndex]!}
            departments={wizard.workspaceData.departments}
            onUpdate={(updated) => {
              const newProcs = [...wizard.workspaceData.procedures];
              newProcs[editingProcedureIndex] = updated;
              wizard.updateData({ procedures: newProcs });
            }}
            onRemove={() => {
              const newProcs = [...wizard.workspaceData.procedures];
              newProcs.splice(editingProcedureIndex, 1);
              wizard.updateData({ procedures: newProcs });
              setIsProcedureDrawerOpen(false);
            }}
          />
        )}
    </div>
  );
}
