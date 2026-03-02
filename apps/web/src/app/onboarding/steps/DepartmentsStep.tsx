"use client";

import { useState } from "react";
import { Building2, CheckCircle2, ArrowRight, Plus } from "lucide-react";
import { useWizard } from "../WizardContext";
import { DepartmentDrawer } from "../drawers/DepartmentDrawer";
import type { CoreDepartment } from "../types";

export function DepartmentsStep() {
  const wizard = useWizard();
  const [isDepartmentDrawerOpen, setIsDepartmentDrawerOpen] = useState(false);
  const [editingDepartmentIndex, setEditingDepartmentIndex] = useState<number | null>(null);

  const addDepartment = (name: string) => {
    const newDepts = [
      ...wizard.workspaceData.departments,
      { name, description: "", isSeasonActive: true, teams: [] },
    ];
    wizard.updateData({ departments: newDepts });
  };

  const addCustomDepartment = () => {
    const newDepts = [
      ...wizard.workspaceData.departments,
      { name: "New Department", description: "", teams: [], isSeasonActive: true },
    ];
    wizard.updateData({ departments: newDepts });
    setEditingDepartmentIndex(newDepts.length - 1);
    setIsDepartmentDrawerOpen(true);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Define Departments
        </h1>
        <p className="mx-auto max-w-4xl text-lg text-zinc-400">
          What is a department? It&apos;s a dedicated area with its own shift plan and procedures.
          Within a Season, departments help you organize and schedule staff accurately.
        </p>
      </div>

      <div className="group relative mb-6 overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-orange-500 to-amber-500 opacity-50"></div>

        <h3 className="mb-4 text-xl font-bold text-white">
          Active Departments ({wizard.workspaceData.departments.length})
        </h3>

        {wizard.workspaceData.departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black/20 py-12">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
              <Building2 className="text-zinc-500" size={24} />
            </div>
            <p className="font-medium text-zinc-400">No departments installed yet.</p>
            <p className="mt-1 mb-4 text-sm text-zinc-500">
              Click a suggestion below or create a custom one.
            </p>
            <button
              onClick={addCustomDepartment}
              className="rounded-lg border border-orange-500/30 bg-orange-500/20 px-4 py-2 font-medium text-orange-400 transition-colors hover:bg-orange-500/30"
            >
              + Create Custom Department
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {wizard.workspaceData.departments.map((dept: CoreDepartment, idx: number) => {
              const isActive = dept.isSeasonActive !== false;
              return (
                <div
                  key={idx}
                  className={`flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center ${isActive ? "border-orange-500/30 bg-orange-500/10" : "border-white/10 bg-black/40 opacity-70"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-md ${isActive ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-zinc-500"}`}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <span className={`font-bold ${isActive ? "text-white" : "text-zinc-400"}`}>
                        {dept.name}
                      </span>
                      {!isActive && (
                        <div className="mt-0.5 text-xs text-zinc-500">
                          Not used in {wizard.workspaceData.seasonName}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-11 flex items-center gap-3 sm:ml-0">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => {
                          const newDepts = [...wizard.workspaceData.departments];
                          newDepts[idx]!.isSeasonActive = e.target.checked;
                          wizard.updateData({ departments: newDepts });
                        }}
                        className="h-4 w-4 accent-orange-500"
                      />
                      <span className="text-sm font-medium text-zinc-400">Use in Season</span>
                    </label>
                    <div className="hidden h-6 w-px bg-white/10 sm:block"></div>
                    <button
                      onClick={() => {
                        const newDepts = [...wizard.workspaceData.departments];
                        newDepts.splice(idx, 1);
                        wizard.updateData({ departments: newDepts });
                      }}
                      className="text-sm text-zinc-500 transition-colors hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              onClick={addCustomDepartment}
              className="flex h-full min-h-[72px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/40 text-zinc-400 transition-colors hover:border-white/40 hover:bg-white/5"
            >
              <span className="text-sm font-medium">+ Add Custom</span>
            </button>
          </div>
        )}
      </div>

      {/* Suggestions Block */}
      <div className="mb-10">
        <h4 className="mb-3 ml-2 text-sm font-bold tracking-wider text-zinc-500 uppercase">
          Recommended for your industry
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {["Kitchen", "Front of House", "Management", "Bar", "Housekeeping", "Events"].map(
            (dept) => {
              const isInstalled = wizard.workspaceData.departments.some(
                (d: CoreDepartment) => d.name === dept,
              );
              if (isInstalled) return null;

              return (
                <div
                  key={dept}
                  onClick={() => addDepartment(dept)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-4 transition-all outline-none hover:border-orange-500/50 hover:bg-orange-500/5"
                >
                  <Plus className="shrink-0 text-orange-500 opacity-70" size={18} />
                  <span className="font-medium text-zinc-300">{dept}</span>
                </div>
              );
            },
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:mt-10 sm:flex-row sm:justify-between">
        <button
          onClick={() => wizard.goTo("season_identity")}
          className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
        >
          Back
        </button>
        <button
          onClick={() => wizard.goTo("teams")}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-orange-500/25 transition-transform hover:from-orange-400 hover:to-amber-500 active:scale-95"
        >
          Setup Teams <ArrowRight size={18} />
        </button>
      </div>

      {isDepartmentDrawerOpen &&
        editingDepartmentIndex !== null &&
        wizard.workspaceData.departments[editingDepartmentIndex] && (
          <DepartmentDrawer
            isOpen={isDepartmentDrawerOpen}
            onClose={() => setIsDepartmentDrawerOpen(false)}
            department={wizard.workspaceData.departments[editingDepartmentIndex]!}
            onUpdate={(updated) => {
              const newDepts = [...wizard.workspaceData.departments];
              newDepts[editingDepartmentIndex] = updated;
              wizard.updateData({ departments: newDepts });
            }}
          />
        )}
    </div>
  );
}
