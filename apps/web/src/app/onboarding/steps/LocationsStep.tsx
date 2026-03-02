"use client";

import { useState } from "react";
import { Building2, ArrowRight } from "lucide-react";
import { useWizard } from "../WizardContext";
import { LocationDrawer } from "../drawers/LocationDrawer";
import type { CoreLocation } from "../types";

export function LocationsStep() {
  const wizard = useWizard();
  const [isLocationDrawerOpen, setIsLocationDrawerOpen] = useState(false);
  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Setup Locations
        </h1>
        <p className="text-lg text-zinc-400">Define where your business operates physically.</p>
      </div>

      <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-red-500 to-rose-500 opacity-50"></div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-500">
                <Building2 size={20} />
              </div>
              <div>
                <div className="font-bold text-white">Main Office / Headquarters</div>
                <div className="text-sm text-zinc-500">
                  {wizard.workspaceData.address || "Add address..."}
                </div>
              </div>
            </div>
          </div>
          {wizard.workspaceData.locations.map((loc: CoreLocation, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-500/20 text-zinc-400">
                  <Building2 size={20} />
                </div>
                <div>
                  <div className="font-bold text-white">{loc.name}</div>
                  <div className="text-sm text-zinc-500">{loc.description || "No description"}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingLocationIndex(idx);
                  setIsLocationDrawerOpen(true);
                }}
                className="text-sm text-zinc-400 transition-colors hover:text-white"
              >
                Edit
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            const newLocs = [
              ...wizard.workspaceData.locations,
              { name: "New Location", description: "" },
            ];
            wizard.updateData({ locations: newLocs });
            setEditingLocationIndex(newLocs.length - 1);
            setIsLocationDrawerOpen(true);
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 py-4 text-zinc-400 transition-colors hover:border-white/30 hover:text-white"
        >
          + Add another Location
        </button>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:mt-10 sm:flex-row sm:justify-between">
        <button
          onClick={() => wizard.goTo("teams")}
          className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
        >
          Back
        </button>
        <button
          onClick={() => wizard.goTo("procedures")}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-red-500/25 transition-transform hover:from-red-400 hover:to-rose-500 active:scale-95"
        >
          Setup Procedures <ArrowRight size={18} />
        </button>
      </div>

      {isLocationDrawerOpen &&
        editingLocationIndex !== null &&
        wizard.workspaceData.locations[editingLocationIndex] && (
          <LocationDrawer
            isOpen={isLocationDrawerOpen}
            onClose={() => setIsLocationDrawerOpen(false)}
            location={wizard.workspaceData.locations[editingLocationIndex]!}
            onUpdate={(updated) => {
              const newLocs = [...wizard.workspaceData.locations];
              newLocs[editingLocationIndex] = updated;
              wizard.updateData({ locations: newLocs });
            }}
            onRemove={() => {
              const newLocs = [...wizard.workspaceData.locations];
              newLocs.splice(editingLocationIndex, 1);
              wizard.updateData({ locations: newLocs });
              setIsLocationDrawerOpen(false);
            }}
          />
        )}
    </div>
  );
}
