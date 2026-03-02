"use client";

import { useEffect, useRef } from "react";

import type { CoreDepartment } from "../types";

interface DepartmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  department: CoreDepartment;
  onUpdate: (updated: CoreDepartment) => void;
}

export function DepartmentDrawer({ isOpen, onClose, department, onUpdate }: DepartmentDrawerProps) {
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    firstInputRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal={true}
      aria-label="Edit Department"
      className="animate-in fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm duration-300"
    >
      <div className="animate-in slide-in-from-right h-full w-full overflow-y-auto border-l border-white/10 bg-[#111] shadow-2xl duration-300 sm:max-w-md">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Edit Department</h2>
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
                Internal Name
              </label>
              <input
                ref={firstInputRef}
                value={department.name}
                onChange={(e) => onUpdate({ ...department, name: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-orange-500"
                placeholder="e.g. Front of House"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Description
              </label>
              <textarea
                value={department.description || ""}
                onChange={(e) => onUpdate({ ...department, description: e.target.value })}
                className="min-h-[100px] w-full resize-y rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-orange-500"
                placeholder="Internal description for this department..."
              />
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg bg-orange-500 px-6 py-2.5 font-bold text-white transition-colors hover:bg-orange-400"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
