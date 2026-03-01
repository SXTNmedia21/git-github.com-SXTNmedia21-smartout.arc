"use client";

import type { CoreProcedure, CoreDepartment } from "../types";

interface ProcedureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  procedure: CoreProcedure;
  departments: CoreDepartment[];
  onUpdate: (updated: CoreProcedure) => void;
  onRemove: () => void;
}

export function ProcedureDrawer({
  isOpen,
  onClose,
  procedure,
  departments,
  onUpdate,
  onRemove,
}: ProcedureDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm duration-300">
      <div className="animate-in slide-in-from-right h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-[#111] shadow-2xl duration-300 sm:max-w-md">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Edit Procedure</h2>
            <button
              onClick={onClose}
              className="text-2xl leading-none text-zinc-400 transition-colors hover:text-white"
            >
              &times;
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Procedure Title
              </label>
              <input
                value={procedure.title}
                onChange={(e) => onUpdate({ ...procedure, title: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
                placeholder="e.g. Opening Checklist"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Urgency Level
              </label>
              <select
                value={procedure.urgency || "Medium"}
                onChange={(e) => onUpdate({ ...procedure, urgency: e.target.value })}
                className="w-full appearance-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Assign to Department
              </label>
              <select
                value={procedure.assignedTo || ""}
                onChange={(e) => onUpdate({ ...procedure, assignedTo: e.target.value })}
                className="w-full appearance-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
              >
                <option value="">Unassigned</option>
                {departments.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Instructions
              </label>
              <textarea
                value={procedure.description || ""}
                onChange={(e) => onUpdate({ ...procedure, description: e.target.value })}
                className="min-h-[120px] w-full resize-y rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
                placeholder="Describe the steps..."
              />
            </div>
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={onRemove}
              className="px-4 py-2.5 text-zinc-400 transition-colors hover:text-red-400"
            >
              Remove
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-purple-500 px-6 py-2.5 font-bold text-white transition-colors hover:bg-purple-400"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
