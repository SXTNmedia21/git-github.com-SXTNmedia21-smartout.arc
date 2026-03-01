"use client";

import type { CoreLocation } from "../types";

interface LocationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  location: CoreLocation;
  onUpdate: (updated: CoreLocation) => void;
  onRemove: () => void;
}

export function LocationDrawer({
  isOpen,
  onClose,
  location,
  onUpdate,
  onRemove,
}: LocationDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm duration-300">
      <div className="animate-in slide-in-from-right h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-[#111] shadow-2xl duration-300 sm:max-w-md">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Edit Location</h2>
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
                Location Name
              </label>
              <input
                value={location.name}
                onChange={(e) => onUpdate({ ...location, name: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-red-500"
                placeholder="e.g. Downtown Branch"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Description / Address
              </label>
              <textarea
                value={location.description || ""}
                onChange={(e) => onUpdate({ ...location, description: e.target.value })}
                className="min-h-[100px] w-full resize-y rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-red-500"
                placeholder="Location details..."
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
              className="rounded-lg bg-red-500 px-6 py-2.5 font-bold text-white transition-colors hover:bg-red-400"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
