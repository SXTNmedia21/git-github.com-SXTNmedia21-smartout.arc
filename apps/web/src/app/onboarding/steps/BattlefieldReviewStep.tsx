"use client";

import { ArrowRight, MapPin, Building2, Users, FileText, Pencil } from "lucide-react";
import { useWizard } from "../WizardContext";

export function BattlefieldReviewStep() {
  const wizard = useWizard();

  const totalTeams = wizard.workspaceData.departments.reduce(
    (sum, dept) => sum + (dept.teams?.length ?? 0),
    0,
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-4xl duration-700">
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Battlefield Review
        </h1>
        <p className="text-lg text-zinc-400">
          Is everything looking sharp, general? Here is the final battle plan.
        </p>
        {wizard.error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {wizard.error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Identity & Brand */}
        <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-50"></div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Identity & Brand</h3>
            <button
              onClick={() => wizard.goTo("branding")}
              className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-white"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
          <div className="space-y-4 text-sm text-zinc-400">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="font-medium text-zinc-500">Name</span>
              <span className="text-white">{wizard.workspaceData.name}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="font-medium text-zinc-500">Org Num</span>
              <span className="text-white">{wizard.orgNumberInput || "Not verified"}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="font-medium text-zinc-500">Tone</span>
              <span className="text-white">{wizard.workspaceData.communicationTone}</span>
            </div>
          </div>
        </div>

        {/* Initial Season */}
        <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50"></div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Initial Season</h3>
            <button
              onClick={() => wizard.goTo("season_identity")}
              className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-white"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
          <div className="space-y-4 text-sm text-zinc-400">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="font-medium text-zinc-500">Season Name</span>
              <span className="text-white">{wizard.workspaceData.seasonName}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="font-medium text-zinc-500">Type</span>
              <span className="text-white">{wizard.workspaceData.seasonType}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="font-medium text-zinc-500">Period</span>
              <span className="text-white">
                {wizard.workspaceData.seasonStartDate && wizard.workspaceData.seasonEndDate
                  ? `${wizard.workspaceData.seasonStartDate} - ${wizard.workspaceData.seasonEndDate}`
                  : "Not set"}
              </span>
            </div>
          </div>
        </div>

        {/* Locations */}
        <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-red-500 to-rose-500 opacity-50"></div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xl font-bold text-white">
              <MapPin size={18} className="text-red-400" /> Locations
            </h3>
            <button
              onClick={() => wizard.goTo("locations")}
              className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-white"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="font-medium text-zinc-300">
              {wizard.workspaceData.locations.length} location
              {wizard.workspaceData.locations.length !== 1 ? "s" : ""}
            </div>
            {wizard.workspaceData.locations.map((loc, i) => (
              <div key={i} className="text-zinc-500">
                {loc.name}
              </div>
            ))}
          </div>
        </div>

        {/* Departments & Teams */}
        <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-orange-500 to-amber-500 opacity-50"></div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xl font-bold text-white">
              <Building2 size={18} className="text-orange-400" /> Departments
            </h3>
            <button
              onClick={() => wizard.goTo("departments")}
              className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-white"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="font-medium text-zinc-300">
              {wizard.workspaceData.departments.length} dept
              {wizard.workspaceData.departments.length !== 1 ? "s" : ""}, {totalTeams} team
              {totalTeams !== 1 ? "s" : ""}
            </div>
            {wizard.workspaceData.departments.map((dept, i) => (
              <div key={i} className="flex items-center gap-2 text-zinc-500">
                <Users size={12} />
                {dept.name}
                {dept.teams && dept.teams.length > 0 && (
                  <span className="text-zinc-600">
                    ({dept.teams.length} team
                    {dept.teams.length !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Procedures */}
        <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8 md:col-span-2">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-50"></div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xl font-bold text-white">
              <FileText size={18} className="text-purple-400" /> Procedures
            </h3>
            <button
              onClick={() => wizard.goTo("procedures")}
              className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-white"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="font-medium text-zinc-300">
              {wizard.workspaceData.procedures.length} procedure
              {wizard.workspaceData.procedures.length !== 1 ? "s" : ""}
            </div>
            <div className="flex flex-wrap gap-2">
              {wizard.workspaceData.procedures.map((proc, i) => (
                <span
                  key={i}
                  className={`rounded-lg px-2 py-1 text-xs font-medium ${
                    proc.urgency === "High"
                      ? "bg-red-500/20 text-red-400"
                      : proc.urgency === "Medium"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {proc.title}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 flex justify-center gap-6">
        <button
          onClick={() => wizard.goTo("procedures")}
          className="rounded-xl border border-white/10 px-6 py-4 font-medium text-white transition-colors hover:bg-white/5"
        >
          Wait, go back
        </button>
        <button
          onClick={wizard.finalize}
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-10 py-4 font-bold text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-transform hover:bg-zinc-200 active:scale-95"
        >
          Activate Workspace <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
