"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useWizard } from "../WizardContext";
import { TeamDrawer } from "../drawers/TeamDrawer";
import type { CoreDepartment, CoreTeam } from "../types";

export function TeamsStep() {
  const wizard = useWizard();
  const [isTeamDrawerOpen, setIsTeamDrawerOpen] = useState(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState<{
    deptIdx: number;
    teamIdx: number;
  } | null>(null);

  const currentTeam = (() => {
    if (!editingTeamIndex) return null;
    if (editingTeamIndex.deptIdx === -1) {
      return wizard.workspaceData.multiDepartmentTeams?.[editingTeamIndex.teamIdx];
    }
    return wizard.workspaceData.departments[editingTeamIndex.deptIdx]?.teams?.[
      editingTeamIndex.teamIdx
    ];
  })();

  const currentDeptName =
    editingTeamIndex && editingTeamIndex.deptIdx !== -1
      ? wizard.workspaceData.departments[editingTeamIndex.deptIdx]?.name
      : undefined;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Define Teams
        </h1>
        <p className="mx-auto max-w-4xl text-lg text-zinc-400">
          If Departments are the &quot;areas,&quot; Teams are the &quot;people.&quot; For example,
          the Kitchen department might have &quot;Chefs&quot; and &quot;Dishwashers&quot; teams.
        </p>
      </div>

      <div className="group relative mb-6 overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 opacity-50"></div>

        <h3 className="mb-4 text-xl font-bold text-white">Teams Setup</h3>

        {wizard.workspaceData.departments.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-black/40 py-8 text-center">
            <p className="text-zinc-500">You haven&apos;t defined any departments yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {wizard.workspaceData.departments.map((dept: CoreDepartment, deptIdx: number) => {
              if (dept.isSeasonActive === false) return null;
              return (
                <div key={deptIdx} className="rounded-xl border border-white/10 bg-black/40 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="flex items-center gap-2 font-bold text-white">
                      <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                      {dept.name}
                    </h4>
                    <button
                      onClick={() => {
                        const newDepts = [...wizard.workspaceData.departments];
                        const currentTeams = newDepts[deptIdx]!.teams || [];

                        let newTeamName = "New Team";
                        if (
                          dept.name === "Housekeeping" &&
                          wizard.workspaceData.industry?.toLowerCase().includes("hotell")
                        ) {
                          newTeamName = "Room Cleaners";
                        } else if (dept.name === "Kitchen") {
                          newTeamName = "Chefs";
                        }

                        newDepts[deptIdx]!.teams = [
                          ...currentTeams,
                          { name: newTeamName, description: "" },
                        ];
                        wizard.updateData({ departments: newDepts });
                        setEditingTeamIndex({
                          deptIdx,
                          teamIdx: currentTeams.length,
                        });
                        setIsTeamDrawerOpen(true);
                      }}
                      className="rounded-md bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                    >
                      + Add Team
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {dept.teams && dept.teams.length > 0 ? (
                      dept.teams.map((team: CoreTeam, teamIdx: number) => (
                        <div
                          key={teamIdx}
                          onClick={() => {
                            setEditingTeamIndex({ deptIdx, teamIdx });
                            setIsTeamDrawerOpen(true);
                          }}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                          {team.name}
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-500">
                        No teams added
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 border-t border-white/10 pt-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-bold text-white">
                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                Cross-Department Teams
              </h4>
              <p className="mt-1 max-w-xl text-xs text-zinc-400">
                Teams that operate across multiple departments (e.g., Management). Note: these
                cannot be the primary team for an employee.
              </p>
            </div>
            <button
              onClick={() => {
                const newTeams = [...(wizard.workspaceData.multiDepartmentTeams || [])];
                newTeams.push({
                  name: "New Cross-Department Team",
                  description: "",
                  isMultiDepartment: true,
                });
                wizard.updateData({ multiDepartmentTeams: newTeams });
                setEditingTeamIndex({
                  deptIdx: -1,
                  teamIdx: newTeams.length - 1,
                });
                setIsTeamDrawerOpen(true);
              }}
              className="shrink-0 rounded-md bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/20"
            >
              + Add Team
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {wizard.workspaceData.multiDepartmentTeams &&
            wizard.workspaceData.multiDepartmentTeams.length > 0 ? (
              wizard.workspaceData.multiDepartmentTeams.map((team: CoreTeam, teamIdx: number) => (
                <div
                  key={teamIdx}
                  onClick={() => {
                    setEditingTeamIndex({ deptIdx: -1, teamIdx });
                    setIsTeamDrawerOpen(true);
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                  {team.name}
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-500">
                No cross-department teams added
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 flex justify-between">
        <button
          onClick={() => wizard.goTo("departments")}
          className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
        >
          Back
        </button>
        <button
          onClick={() => wizard.goTo("locations")}
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 font-bold text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-transform hover:bg-zinc-200 active:scale-95"
        >
          Verify Locations <ArrowRight size={18} />
        </button>
      </div>

      {isTeamDrawerOpen && editingTeamIndex !== null && currentTeam && (
        <TeamDrawer
          isOpen={isTeamDrawerOpen}
          onClose={() => setIsTeamDrawerOpen(false)}
          team={currentTeam}
          isMultiDepartment={editingTeamIndex.deptIdx === -1}
          departmentName={currentDeptName}
          onUpdate={(updated) => {
            if (editingTeamIndex.deptIdx === -1) {
              const newTeams = [...(wizard.workspaceData.multiDepartmentTeams || [])];
              newTeams[editingTeamIndex.teamIdx] = updated;
              wizard.updateData({ multiDepartmentTeams: newTeams });
            } else {
              const newDepts = [...wizard.workspaceData.departments];
              newDepts[editingTeamIndex.deptIdx]!.teams![editingTeamIndex.teamIdx] = updated;
              wizard.updateData({ departments: newDepts });
            }
          }}
          onRemove={() => {
            if (editingTeamIndex.deptIdx === -1) {
              const newTeams = [...(wizard.workspaceData.multiDepartmentTeams || [])];
              newTeams.splice(editingTeamIndex.teamIdx, 1);
              wizard.updateData({ multiDepartmentTeams: newTeams });
            } else {
              const newDepts = [...wizard.workspaceData.departments];
              newDepts[editingTeamIndex.deptIdx]!.teams?.splice(editingTeamIndex.teamIdx, 1);
              wizard.updateData({ departments: newDepts });
            }
            setIsTeamDrawerOpen(false);
          }}
        />
      )}
    </div>
  );
}
