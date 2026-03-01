import { useState } from "react";
import {
  Network,
  Plus,
  MoreVertical,
  FileText,
  Users,
  Building2,
  UserCircle,
  Pencil,
} from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TeamRow, DepartmentRow, CountMap } from "./types";
import { COLOR_PRESETS, toSlug } from "./types";
import { TEAM_TYPE_CONFIG } from "./constants";
import { EditTeamDialog } from "./EditTeamDialog";

type TeamsTabProps = {
  teams: TeamRow[];
  departments: DepartmentRow[];
  memberCounts: CountMap;
  policyCounts: CountMap;
  isDark: boolean;
  workspaceId: string;
  onRefresh: () => Promise<void>;
  loading: boolean;
};

export function TeamsTab({
  teams,
  departments,
  memberCounts,
  policyCounts,
  isDark,
  workspaceId,
  onRefresh,
  loading,
}: TeamsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamType, setTeamType] = useState("operational");
  const [departmentId, setDepartmentId] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit team state
  const [editTeam, setEditTeam] = useState<TeamRow | null>(null);

  const deptMap = new Map(departments.map((d) => [d.department_id, d.name]));

  const cardBase = `rounded-2xl border p-5 transition-all ${
    isDark
      ? "border-zinc-800/50 bg-zinc-950 hover:border-zinc-700/50"
      : "border-zinc-200 bg-white hover:border-zinc-300"
  }`;

  const inputClass = `w-full rounded-lg border px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-1 ${
    isDark
      ? "border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-orange-500/50"
      : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500/50 focus:ring-orange-500/50"
  }`;

  const labelClass = `mb-1.5 block text-xs font-semibold tracking-wider uppercase ${
    isDark ? "text-zinc-400" : "text-zinc-500"
  }`;

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Team name is required");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase.from("team").insert({
      name: name.trim(),
      slug: toSlug(name),
      description: description.trim() || null,
      team_type: teamType,
      department_id: departmentId || null,
      color: selectedColor,
      workspace_id: workspaceId,
      is_active: true,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Team "${name.trim()}" created`);
      setDialogOpen(false);
      resetForm();
      await onRefresh();
    }
    setSaving(false);
  }

  async function toggleActive(team: TeamRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from("team")
      .update({ is_active: !team.is_active })
      .eq("team_id", team.team_id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(team.is_active ? `"${team.name}" deactivated` : `"${team.name}" reactivated`);
      await onRefresh();
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setTeamType("operational");
    setDepartmentId("");
    setSelectedColor(null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div
            className={`h-6 w-48 animate-pulse rounded ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
          />
          <div
            className={`h-9 w-36 animate-pulse rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${cardBase} animate-pulse`}>
              <div className={`mb-3 h-4 w-32 rounded ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`} />
              <div
                className={`mb-2 h-3 w-48 rounded ${isDark ? "bg-zinc-800/60" : "bg-zinc-200/60"}`}
              />
              <div className={`h-3 w-24 rounded ${isDark ? "bg-zinc-800/40" : "bg-zinc-200/40"}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>Teams</h2>
          <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Dynamic groups. Can be seasonal, cross-department, or permanent.
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          <Plus className="h-4 w-4" />
          Add Team
        </button>
      </div>

      {/* Card Grid */}
      {teams.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 ${
            isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"
          }`}
        >
          <div
            className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isDark ? "bg-zinc-800/50" : "bg-zinc-100"}`}
          >
            <Network className={`h-7 w-7 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
          </div>
          <h3 className={`mb-1 text-base font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            No teams yet
          </h3>
          <p
            className={`mb-4 max-w-sm text-center text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            Teams group employees for scheduling, task assignment, and governance scoping.
          </p>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            <Plus className="h-4 w-4" />
            Add your first team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => {
            const members = memberCounts[team.team_id] ?? 0;
            const policies = policyCounts[team.team_id] ?? 0;
            const teamFallback = TEAM_TYPE_CONFIG["custom"]!;
            const typeConfig = TEAM_TYPE_CONFIG[team.team_type] ?? teamFallback;
            const deptName = team.department_id ? deptMap.get(team.department_id) : null;

            return (
              <div key={team.team_id} className={`group relative ${cardBase}`}>
                {/* Color accent bar */}
                {team.color && (
                  <div
                    className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                    style={{ backgroundColor: team.color }}
                  />
                )}

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {team.color && (
                      <div
                        className="h-3 w-3 rounded-full ring-2 ring-offset-1"
                        style={{
                          backgroundColor: team.color,
                          ["--tw-ring-color" as string]: team.color,
                          ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff",
                        }}
                      />
                    )}
                    <div>
                      <h3
                        className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
                      >
                        {team.name}
                      </h3>
                      <span
                        className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${typeConfig.border} ${typeConfig.bg} ${typeConfig.text}`}
                      >
                        {typeConfig.label}
                      </span>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`rounded-md p-1 opacity-0 transition-all group-hover:opacity-100 ${
                          isDark
                            ? "text-zinc-500 hover:bg-zinc-800"
                            : "text-zinc-400 hover:bg-zinc-100"
                        }`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className={isDark ? "border-zinc-800 bg-zinc-900" : ""}
                    >
                      <DropdownMenuItem onClick={() => setEditTeam(team)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className={isDark ? "bg-zinc-800" : ""} />
                      <DropdownMenuItem onClick={() => toggleActive(team)}>
                        {team.is_active ? "Deactivate" : "Reactivate"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {team.description && (
                  <p
                    className={`mt-2 line-clamp-2 text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    {team.description}
                  </p>
                )}

                {deptName && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Building2
                      className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                    />
                    <span
                      className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      {deptName}
                    </span>
                  </div>
                )}

                {team.leader_profile_id && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <UserCircle
                      className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                    />
                    <span
                      className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      Leader assigned
                    </span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Users className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                    <span
                      className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      {members} {members === 1 ? "member" : "members"}
                    </span>
                  </div>

                  {policies > 0 && (
                    <div className="flex items-center gap-1.5">
                      <FileText
                        className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                      />
                      <span
                        className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        {policies} {policies === 1 ? "policy" : "policies"}
                      </span>
                    </div>
                  )}

                  {team.season_id && (
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                        isDark
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                          : "border-amber-200 bg-amber-50 text-amber-600"
                      }`}
                    >
                      Seasonal
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${team.is_active ? "bg-emerald-500" : "bg-zinc-500"}`}
                    />
                    <span
                      className={`text-[10px] font-bold tracking-wider uppercase ${
                        team.is_active
                          ? isDark
                            ? "text-emerald-400"
                            : "text-emerald-600"
                          : isDark
                            ? "text-zinc-500"
                            : "text-zinc-400"
                      }`}
                    >
                      {team.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[10px] ${isDark ? "text-zinc-700" : "text-zinc-300"}`}
                  >
                    {team.slug}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent
          className={
            isDark
              ? "border-zinc-800 bg-zinc-950 text-white"
              : "border-zinc-200 bg-white text-zinc-900"
          }
        >
          <DialogHeader>
            <DialogTitle>Add Team</DialogTitle>
            <DialogDescription className={isDark ? "text-zinc-400" : "text-zinc-500"}>
              Create a new team for scheduling and governance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Morning Shift, A-Team"
                className={inputClass}
                autoFocus
              />
            </div>

            <div>
              <label className={labelClass}>Team Type *</label>
              <select
                value={teamType}
                onChange={(e) => setTeamType(e.target.value)}
                className={`${inputClass} appearance-none`}
              >
                {Object.entries(TEAM_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Department (optional)</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={`${inputClass} appearance-none`}
              >
                <option value="">No department (cross-cutting)</option>
                {departments
                  .filter((d) => d.is_active)
                  .map((d) => (
                    <option key={d.department_id} value={d.department_id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this team responsible for?"
                rows={2}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Color</label>
              <div className="flex gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                    className={`h-7 w-7 rounded-full transition-all ${
                      selectedColor === color
                        ? "ring-2 ring-white ring-offset-2"
                        : "hover:scale-110"
                    }`}
                    style={{
                      backgroundColor: color,
                      ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                isDark
                  ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      {editTeam && (
        <EditTeamDialog
          team={editTeam}
          departments={departments}
          isDark={isDark}
          open={!!editTeam}
          onOpenChange={(open) => {
            if (!open) setEditTeam(null);
          }}
          onSave={onRefresh}
        />
      )}
    </div>
  );
}
