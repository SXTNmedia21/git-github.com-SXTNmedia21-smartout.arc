"use client";

import { ArrowRight } from "lucide-react";
import { useWizard } from "../WizardContext";

export function SeasonIdentityStep() {
  const wizard = useWizard();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Name Your First Season
        </h1>
        <p className="text-lg text-zinc-400">
          Define the timeframe and identity for your initial setup.
        </p>
      </div>

      <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50"></div>
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
              Season Name
            </label>
            <input
              value={wizard.workspaceData.seasonName}
              onChange={(e) => wizard.updateData({ seasonName: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-emerald-500"
              placeholder="e.g. Core Operations or Summer 2024"
            />
            <p className="mt-2 text-xs text-zinc-500">
              Used internally and for your staff to identify the current active configuration.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Start Date (Optional)
              </label>
              <input
                type="date"
                value={wizard.workspaceData.seasonStartDate}
                onChange={(e) => wizard.updateData({ seasonStartDate: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white [color-scheme:dark] transition-colors outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={wizard.workspaceData.seasonEndDate}
                onChange={(e) => wizard.updateData({ seasonEndDate: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white [color-scheme:dark] transition-colors outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
              Season Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => wizard.updateData({ seasonType: "Permanent" })}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${wizard.workspaceData.seasonType === "Permanent" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-black/50 text-zinc-400 hover:border-white/30"}`}
              >
                <div className="mb-1 font-bold">Permanent Season</div>
                <div className="text-xs opacity-70">
                  A continuous baseline configuration. You can always archive it or spin up a new
                  season later.
                </div>
              </button>
              <button
                type="button"
                onClick={() => wizard.updateData({ seasonType: "Temporal" })}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${wizard.workspaceData.seasonType === "Temporal" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-black/50 text-zinc-400 hover:border-white/30"}`}
              >
                <div className="mb-1 font-bold">Temporal Season</div>
                <div className="text-xs opacity-70">
                  Strict temporal bounds (e.g. Summer 2024). Perfect for pop-ups or high-season
                  changes.
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 flex justify-between">
        <button
          onClick={() => wizard.goTo("season_education")}
          className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
        >
          Back
        </button>
        <button
          onClick={() => wizard.goTo("departments")}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-emerald-500/25 transition-transform hover:from-emerald-400 hover:to-teal-500 active:scale-95"
        >
          Setup Departments <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
