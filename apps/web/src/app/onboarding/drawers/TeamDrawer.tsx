"use client";

import type { CoreTeam } from "../types";

interface TeamDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  team: CoreTeam;
  isMultiDepartment: boolean;
  departmentName?: string;
  onUpdate: (updated: CoreTeam) => void;
  onRemove: () => void;
}

export function TeamDrawer({
  isOpen,
  onClose,
  team,
  isMultiDepartment,
  departmentName,
  onUpdate,
  onRemove,
}: TeamDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm duration-300">
      <div className="animate-in slide-in-from-right h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-[#111] shadow-2xl duration-300 sm:max-w-md">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Edit Team</h2>
              <p
                className={`mt-1 text-xs font-medium tracking-wide uppercase ${isMultiDepartment ? "text-purple-400" : "text-blue-400"}`}
              >
                {isMultiDepartment ? "Cross-Department Team" : `In ${departmentName}`}
              </p>
            </div>
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
                Team Name
              </label>
              <input
                value={team.name}
                onChange={(e) => onUpdate({ ...team, name: e.target.value })}
                className={`w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none ${isMultiDepartment ? "focus:border-purple-500" : "focus:border-blue-500"}`}
                placeholder={isMultiDepartment ? "e.g. Management" : "e.g. Chefs"}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Description
              </label>
              <textarea
                value={team.description || ""}
                onChange={(e) => onUpdate({ ...team, description: e.target.value })}
                className={`min-h-[100px] w-full resize-y rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none ${isMultiDepartment ? "focus:border-purple-500" : "focus:border-blue-500"}`}
                placeholder="Who makes up this team?"
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
              className={`${isMultiDepartment ? "bg-purple-500 hover:bg-purple-400" : "bg-blue-500 hover:bg-blue-400"} rounded-lg px-6 py-2.5 font-bold text-white transition-colors`}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
