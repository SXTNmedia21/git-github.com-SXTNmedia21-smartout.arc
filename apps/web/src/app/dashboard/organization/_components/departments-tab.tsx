import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  MoreVertical,
  FileText,
  Briefcase,
  GripVertical,
  ChevronDown,
  AlertTriangle,
  Pencil,
  UserCircle,
  ArrowRightLeft,
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
import type { DepartmentRow, PositionRow, CountMap, ProfileRow } from "./types";
import { COLOR_PRESETS, ICON_PRESETS, toSlug } from "./types";
import { ICON_COMPONENTS } from "./constants";
import { EditDepartmentDialog } from "./EditDepartmentDialog";
import { CreatePositionDialog } from "./CreatePositionDialog";
import { EditPositionDialog } from "./EditPositionDialog";
import { MovePositionDialog } from "./MovePositionDialog";

type DepartmentsTabProps = {
  departments: DepartmentRow[];
  profiles: ProfileRow[];
  positionCounts: CountMap;
  positionsByDept: Record<string, PositionRow[]>;
  policyCounts: CountMap;
  isDark: boolean;
  workspaceId: string;
  onRefresh: () => Promise<void>;
  loading: boolean;
};

export function DepartmentsTab({
  departments,
  profiles,
  positionCounts,
  positionsByDept,
  policyCounts,
  isDark,
  workspaceId,
  onRefresh,
  loading,
}: DepartmentsTabProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Edit department state
  const [editDept, setEditDept] = useState<DepartmentRow | null>(null);

  // Position CRUD state
  const [createPosDeptId, setCreatePosDeptId] = useState<string | null>(null);
  const [editPosition, setEditPosition] = useState<PositionRow | null>(null);
  const [movePosition, setMovePosition] = useState<PositionRow | null>(null);

  const cardBase =
    "rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/70";

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50";

  const labelClass =
    "mb-1.5 block text-xs font-semibold tracking-wider uppercase text-muted-foreground";

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase.from("department").insert({
      name: name.trim(),
      slug: toSlug(name),
      description: description.trim() || null,
      color: selectedColor,
      icon: selectedIcon,
      workspace_id: workspaceId,
      is_active: true,
      sort_order: departments.length,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Department "${name.trim()}" created`);
      setDialogOpen(false);
      resetForm();
      await onRefresh();
    }
    setSaving(false);
  }

  async function toggleActive(dept: DepartmentRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from("department")
      .update({ is_active: !dept.is_active })
      .eq("department_id", dept.department_id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(dept.is_active ? `"${dept.name}" deactivated` : `"${dept.name}" reactivated`);
      await onRefresh();
    }
  }

  async function togglePositionActive(pos: PositionRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from("position")
      .update({ is_active: !pos.is_active })
      .eq("position_id", pos.position_id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(pos.is_active ? `"${pos.name}" deactivated` : `"${pos.name}" reactivated`);
      await onRefresh();
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setSelectedColor(null);
    setSelectedIcon(null);
  }

  function toggleExpanded(deptId: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  }

  // Find the department for create position dialog
  const createPosDept = createPosDeptId
    ? departments.find((d) => d.department_id === createPosDeptId)
    : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="bg-muted h-6 w-48 animate-pulse rounded" />
          <div className="bg-muted h-9 w-36 animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${cardBase} animate-pulse`}>
              <div className="bg-muted mb-3 h-4 w-32 rounded" />
              <div className="bg-muted/60 mb-2 h-3 w-48 rounded" />
              <div className="bg-muted/40 h-3 w-24 rounded" />
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
          <h2 className="text-foreground text-lg font-bold">Departments</h2>
          <p className="text-muted-foreground text-xs">
            Permanent organizational units. Never seasonal.
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          <Plus className="h-4 w-4" />
          Add Department
        </button>
      </div>

      {/* Card Grid */}
      {departments.length === 0 ? (
        <div className="border-border bg-muted flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12">
          <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <Building2 className="text-muted-foreground h-7 w-7" />
          </div>
          <h3 className="text-foreground mb-1 text-base font-bold">No departments yet</h3>
          <p className="text-muted-foreground mb-4 max-w-sm text-center text-sm">
            Departments organize your workspace into functional areas like Kitchen, Bar, or Service.
          </p>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            <Plus className="h-4 w-4" />
            Add your first department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((dept) => {
            const posCount = positionCounts[dept.department_id] ?? 0;
            const policyCount = policyCounts[dept.department_id] ?? 0;
            const isExpanded = expandedDepts.has(dept.department_id);
            const deptPositions = positionsByDept[dept.department_id] ?? [];
            const DeptIcon = dept.icon ? ICON_COMPONENTS[dept.icon] : null;
            const showWarning = dept.is_active && posCount === 0;

            return (
              <div
                key={dept.department_id}
                className={`group relative cursor-pointer ${cardBase}`}
                onClick={() =>
                  router.push(`/dashboard/organization/departments/${dept.department_id}`)
                }
              >
                {/* Color accent bar */}
                {dept.color && (
                  <div
                    className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                    style={{ backgroundColor: dept.color }}
                  />
                )}

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab opacity-0 transition-opacity group-hover:opacity-50" />
                    {DeptIcon && dept.color ? (
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${dept.color}15` }}
                      >
                        <DeptIcon className="h-4 w-4" style={{ color: dept.color }} />
                      </div>
                    ) : dept.color ? (
                      <div
                        className="h-3 w-3 rounded-full ring-2 ring-offset-1"
                        style={{
                          backgroundColor: dept.color,
                          ["--tw-ring-color" as string]: dept.color,
                          ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff",
                        }} // Nordic Split: Phase 2.5 candidate.
                      />
                    ) : null}
                    <h3 className="text-foreground text-sm font-bold">{dept.name}</h3>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:bg-accent rounded-md p-1 opacity-0 transition-all group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-border bg-card">
                      <DropdownMenuItem onClick={() => setEditDept(dept)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                      <DropdownMenuItem onClick={() => toggleActive(dept)}>
                        {dept.is_active ? "Deactivate" : "Reactivate"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {dept.description && (
                  <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                    {dept.description}
                  </p>
                )}

                {dept.manager_profile_id &&
                  (() => {
                    const manager = profiles.find((p) => p.profile_id === dept.manager_profile_id);
                    return manager ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <UserCircle className="text-muted-foreground h-3 w-3" />
                        <span className="text-muted-foreground text-xs font-medium">
                          {manager.display_name}
                        </span>
                      </div>
                    ) : null;
                  })()}

                {/* Validation warning */}
                {showWarning && (
                  <div
                    className={`mt-3 flex items-center gap-2 rounded-lg border p-2.5 ${
                      isDark ? "border-amber-500/10 bg-amber-500/5" : "border-amber-100 bg-amber-50"
                    }`}
                  >
                    <AlertTriangle
                      className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-amber-400" : "text-amber-500"}`}
                    />
                    <span className={`text-xs ${isDark ? "text-amber-300/80" : "text-amber-700"}`}>
                      No positions defined — add roles to enable scheduling
                    </span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(dept.department_id);
                    }}
                    className="flex items-center gap-1.5 transition-colors hover:opacity-80"
                  >
                    <Briefcase className="text-muted-foreground h-3 w-3" />
                    <span className="text-muted-foreground text-xs font-medium">
                      {posCount} {posCount === 1 ? "position" : "positions"}
                    </span>
                    <ChevronDown
                      className={`text-muted-foreground h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  {policyCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground text-xs font-medium">
                        {policyCount} {policyCount === 1 ? "policy" : "policies"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Position drill-down */}
                {isExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="border-border bg-muted mt-3 space-y-1.5 rounded-lg border p-3"
                  >
                    {deptPositions.length === 0 ? (
                      <p className="text-muted-foreground text-xs italic">
                        No positions yet. Add positions to define roles in this department.
                      </p>
                    ) : (
                      deptPositions.map((pos) => (
                        <div
                          key={pos.position_id}
                          className="group/pos flex items-center justify-between py-1"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: pos.color ?? (isDark ? "#52525b" : "#a1a1aa"),
                              }} // Nordic Split: Phase 2.5 candidate.
                            />
                            <span className="text-foreground text-xs font-medium">{pos.name}</span>
                            {pos.minimum_role && (
                              <span className="border-border bg-muted text-muted-foreground rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase">
                                {pos.minimum_role}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`h-1.5 w-1.5 rounded-full ${pos.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="text-muted-foreground hover:bg-accent rounded p-0.5 opacity-0 transition-all group-hover/pos:opacity-100">
                                  <MoreVertical className="h-3 w-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="border-border bg-card">
                                <DropdownMenuItem onClick={() => setEditPosition(pos)}>
                                  <Pencil className="mr-2 h-3.5 w-3.5" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setMovePosition(pos)}>
                                  <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                                  Move to Department
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-border" />
                                <DropdownMenuItem onClick={() => togglePositionActive(pos)}>
                                  {pos.is_active ? "Deactivate" : "Reactivate"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Add Position button */}
                    <button
                      onClick={() => setCreatePosDeptId(dept.department_id)}
                      className="border-border text-muted-foreground hover:border-border hover:text-accent-foreground mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-1.5 text-xs font-medium transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add Position
                    </button>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${dept.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`}
                    />
                    <span
                      className={`text-[10px] font-bold tracking-wider uppercase ${
                        dept.is_active
                          ? isDark
                            ? "text-emerald-400"
                            : "text-emerald-600" // Nordic Split: Phase 2.5 candidate.
                          : "text-muted-foreground"
                      }`}
                    >
                      {dept.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <span className="text-muted-foreground font-mono text-[10px]">{dept.slug}</span>
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
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a new permanent organizational unit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kitchen, Bar, Service"
                className={inputClass}
                autoFocus
              />
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this department handle?"
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

            <div>
              <label className={labelClass}>Icon</label>
              <div className="grid grid-cols-6 gap-2">
                {ICON_PRESETS.map((preset) => {
                  const PresetIcon = ICON_COMPONENTS[preset.key];
                  if (!PresetIcon) return null;
                  const isSelected = selectedIcon === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setSelectedIcon(isSelected ? null : preset.key)}
                      title={preset.label}
                      className={`flex h-9 w-full items-center justify-center rounded-lg border transition-all ${
                        isSelected
                          ? isDark
                            ? "border-orange-500/50 bg-orange-500/10 text-orange-400"
                            : "border-orange-300 bg-orange-50 text-orange-600" // Nordic Split: Phase 2.5 candidate.
                          : "border-border bg-muted text-muted-foreground hover:border-border hover:text-accent-foreground"
                      }`}
                    >
                      <PresetIcon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {name.trim() && (
              <div className="border-border bg-muted rounded-lg border p-3">
                <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                  Preview slug
                </span>
                <p className="text-foreground font-mono text-sm">{toSlug(name)}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              className="border-border bg-card text-foreground hover:bg-accent rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
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

      {/* Edit Department Dialog */}
      {editDept && (
        <EditDepartmentDialog
          department={editDept}
          profiles={profiles}
          isDark={isDark}
          open={!!editDept}
          onOpenChange={(open) => {
            if (!open) setEditDept(null);
          }}
          onSave={onRefresh}
        />
      )}

      {/* Create Position Dialog */}
      {createPosDept && (
        <CreatePositionDialog
          departmentId={createPosDept.department_id}
          departmentName={createPosDept.name}
          workspaceId={workspaceId}
          existingCount={(positionsByDept[createPosDept.department_id] ?? []).length}
          open={!!createPosDeptId}
          onOpenChange={(open) => {
            if (!open) setCreatePosDeptId(null);
          }}
          onSave={onRefresh}
        />
      )}

      {/* Edit Position Dialog */}
      {editPosition && (
        <EditPositionDialog
          position={editPosition}
          isDark={isDark}
          open={!!editPosition}
          onOpenChange={(open) => {
            if (!open) setEditPosition(null);
          }}
          onSave={onRefresh}
        />
      )}

      {/* Move Position Dialog */}
      {movePosition && (
        <MovePositionDialog
          position={movePosition}
          departments={departments}
          isDark={isDark}
          open={!!movePosition}
          onOpenChange={(open) => {
            if (!open) setMovePosition(null);
          }}
          onSave={onRefresh}
        />
      )}
    </div>
  );
}
