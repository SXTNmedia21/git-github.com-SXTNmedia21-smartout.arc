"use client";

import { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Pencil,
  Briefcase,
  Network,
  FileText,
  Plus,
  MoreVertical,
  ArrowRightLeft,
  UserCircle,
} from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { EntityDetailLayout } from "../../_components/EntityDetailLayout";
import { EditDepartmentDialog } from "../../_components/EditDepartmentDialog";
import { CreatePositionDialog } from "../../_components/CreatePositionDialog";
import { EditPositionDialog } from "../../_components/EditPositionDialog";
import { MovePositionDialog } from "../../_components/MovePositionDialog";
import { ICON_COMPONENTS } from "../../_components/constants";
import type { DepartmentRow, PositionRow, ProfileRow, TeamRow } from "../../_components/types";
import { DepartmentHoursTab } from "./_components/DepartmentHoursTab";

export default function DepartmentDetailPage() {
  const params = useParams<{ id: string }>();
  const { isDark, workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";

  const [department, setDepartment] = useState<DepartmentRow | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [policyCount, setPolicyCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [editDept, setEditDept] = useState(false);
  const [createPosOpen, setCreatePosOpen] = useState(false);
  const [editPosition, setEditPosition] = useState<PositionRow | null>(null);
  const [movePosition, setMovePosition] = useState<PositionRow | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);

  const fetchData = useCallback(async () => {
    if (!workspaceId || !params.id) return;
    setLoading(true);
    const supabase = createClient();

    const [deptRes, positionsRes, teamsRes, profilesRes, policiesRes, deptsRes] = await Promise.all(
      [
        supabase
          .from("department")
          .select("*")
          .eq("department_id", params.id)
          .eq("workspace_id", workspaceId)
          .single(),
        supabase
          .from("position")
          .select(
            "position_id, name, slug, department_id, description, is_active, minimum_role, color, icon, sort_order",
          )
          .eq("department_id", params.id)
          .eq("workspace_id", workspaceId)
          .order("sort_order"),
        supabase
          .from("team")
          .select("*")
          .eq("department_id", params.id)
          .eq("workspace_id", workspaceId),
        supabase
          .from("profile")
          .select("profile_id, display_name, role, department_id, status, is_active")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true),
        supabase
          .from("policy")
          .select("policy_id")
          .eq("workspace_id", workspaceId)
          .eq("policy_scope", "department")
          .eq("scope_ref_id", params.id),
        supabase
          .from("department")
          .select(
            "department_id, name, slug, description, color, icon, sort_order, manager_profile_id, is_active",
          )
          .eq("workspace_id", workspaceId),
      ],
    );

    if (deptRes.data) setDepartment(deptRes.data as DepartmentRow);
    if (positionsRes.data) setPositions(positionsRes.data as PositionRow[]);
    if (teamsRes.data) setTeams(teamsRes.data as TeamRow[]);
    if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
    if (policiesRes.data) setPolicyCount(policiesRes.data.length);
    if (deptsRes.data) setDepartments(deptsRes.data as DepartmentRow[]);

    // Count members in this department
    const deptProfiles = (profilesRes.data ?? []).filter(
      (p: ProfileRow) => p.department_id === params.id,
    );
    setMemberCount(deptProfiles.length);

    setLoading(false);
  }, [workspaceId, params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const managerName = useMemo(() => {
    if (!department?.manager_profile_id) return null;
    return profiles.find((p) => p.profile_id === department.manager_profile_id)?.display_name;
  }, [department?.manager_profile_id, profiles]);

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
      await fetchData();
    }
  }

  async function toggleDeptActive() {
    if (!department) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("department")
      .update({ is_active: !department.is_active })
      .eq("department_id", department.department_id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        department.is_active
          ? `"${department.name}" deactivated`
          : `"${department.name}" reactivated`,
      );
      await fetchData();
    }
  }

  if (loading || !department) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-1">
        <div
          className={`h-8 w-48 animate-pulse rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
        />
        <div
          className={`h-12 w-72 animate-pulse rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
        />
        <div
          className={`h-10 w-96 animate-pulse rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
        />
      </div>
    );
  }

  const DeptIcon = department.icon ? ICON_COMPONENTS[department.icon] : null;
  const activePositions = positions.filter((p) => p.is_active).length;

  const cardBase = `rounded-2xl border p-5 transition-all ${
    isDark
      ? "border-zinc-800/50 bg-zinc-950 hover:border-zinc-700/50"
      : "border-zinc-200 bg-white hover:border-zinc-300"
  }`;

  return (
    <>
      <EntityDetailLayout
        breadcrumbs={[
          { label: "Organization", href: "/dashboard/organization" },
          { label: "Departments", href: "/dashboard/organization" },
          { label: department.name },
        ]}
        name={department.name}
        color={department.color}
        icon={
          DeptIcon && department.color ? (
            <DeptIcon className="h-6 w-6" style={{ color: department.color }} />
          ) : undefined
        }
        badges={
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${
                department.is_active
                  ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : isDark
                    ? "bg-zinc-800 text-zinc-500"
                    : "bg-zinc-100 text-zinc-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${department.is_active ? "bg-emerald-500" : "bg-zinc-500"}`}
              />
              {department.is_active ? "Active" : "Inactive"}
            </span>
            {managerName && (
              <span
                className={`flex items-center gap-1.5 text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
              >
                <UserCircle className="h-3.5 w-3.5" />
                {managerName}
              </span>
            )}
          </>
        }
        actions={
          <button
            onClick={() => setEditDept(true)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              isDark
                ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        }
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <div className="space-y-6">
                {/* Description */}
                {department.description && (
                  <div className={cardBase}>
                    <h3
                      className={`mb-2 text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      Description
                    </h3>
                    <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                      {department.description}
                    </p>
                  </div>
                )}

                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatCard
                    icon={<Briefcase className="h-4 w-4" />}
                    label="Positions"
                    value={activePositions}
                    isDark={isDark}
                  />
                  <StatCard
                    icon={<Network className="h-4 w-4" />}
                    label="Teams"
                    value={teams.length}
                    isDark={isDark}
                  />
                  <StatCard
                    icon={<UserCircle className="h-4 w-4" />}
                    label="Members"
                    value={memberCount}
                    isDark={isDark}
                  />
                  <StatCard
                    icon={<FileText className="h-4 w-4" />}
                    label="Policies"
                    value={policyCount}
                    isDark={isDark}
                  />
                </div>

                {/* Meta info */}
                <div className={cardBase}>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Slug
                      </span>
                      <p className={`mt-1 font-mono ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                        {department.slug}
                      </p>
                    </div>
                    {managerName && (
                      <div>
                        <span
                          className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                        >
                          Manager
                        </span>
                        <p className={`mt-1 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                          {managerName}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ),
          },
          {
            value: "positions",
            label: "Positions",
            content: (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    {positions.length} {positions.length === 1 ? "position" : "positions"} in this
                    department
                  </p>
                  <button
                    onClick={() => setCreatePosOpen(true)}
                    className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
                  >
                    <Plus className="h-4 w-4" />
                    Add Position
                  </button>
                </div>

                {positions.length === 0 ? (
                  <div
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 ${
                      isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <Briefcase
                      className={`mb-4 h-8 w-8 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                    />
                    <p
                      className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      No positions defined yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {positions.map((pos) => (
                      <div
                        key={pos.position_id}
                        className={`group flex items-center justify-between rounded-xl border p-4 transition-all ${
                          isDark
                            ? "border-zinc-800/50 bg-zinc-950 hover:border-zinc-700/50"
                            : "border-zinc-200 bg-white hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor: pos.color ?? (isDark ? "#52525b" : "#a1a1aa"),
                            }}
                          />
                          <div>
                            <span
                              className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                            >
                              {pos.name}
                            </span>
                            {pos.description && (
                              <p
                                className={`mt-0.5 text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                              >
                                {pos.description}
                              </p>
                            )}
                          </div>
                          {pos.minimum_role && (
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                isDark
                                  ? "border-zinc-700 bg-zinc-800 text-zinc-500"
                                  : "border-zinc-200 bg-zinc-100 text-zinc-400"
                              }`}
                            >
                              {pos.minimum_role}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${pos.is_active ? "bg-emerald-500" : "bg-zinc-500"}`}
                          />
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
                              <DropdownMenuItem onClick={() => setEditPosition(pos)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setMovePosition(pos)}>
                                <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                                Move to Department
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className={isDark ? "bg-zinc-800" : ""} />
                              <DropdownMenuItem onClick={() => togglePositionActive(pos)}>
                                {pos.is_active ? "Deactivate" : "Reactivate"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            value: "teams",
            label: "Teams",
            content: (
              <div className="space-y-4">
                <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  {teams.length} {teams.length === 1 ? "team" : "teams"} linked to this department
                </p>
                {teams.length === 0 ? (
                  <div
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 ${
                      isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <Network
                      className={`mb-4 h-8 w-8 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                    />
                    <p
                      className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      No teams linked to this department.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {teams.map((team) => (
                      <button
                        key={team.team_id}
                        onClick={() =>
                          (window.location.href = `/dashboard/organization/teams/${team.team_id}`)
                        }
                        className={`group text-left ${cardBase}`}
                      >
                        <div className="flex items-center gap-3">
                          {team.color && (
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                          )}
                          <span
                            className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                          >
                            {team.name}
                          </span>
                        </div>
                        {team.description && (
                          <p
                            className={`mt-1.5 line-clamp-1 text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                          >
                            {team.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            value: "policies",
            label: "Policies",
            content: (
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 ${
                  isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <FileText
                  className={`mb-4 h-10 w-10 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                />
                <h3
                  className={`mb-1 text-base font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                >
                  Policies coming soon
                </h3>
                <p
                  className={`max-w-sm text-center text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  Department-scoped policies will be managed here in a future release.
                </p>
              </div>
            ),
          },
          {
            value: "hours",
            label: "Åpningstider",
            content: (
              <DepartmentHoursTab
                departmentId={department.department_id}
                profileId={
                  profiles.find((p) => p.profile_id === department.manager_profile_id)
                    ?.profile_id ?? ""
                }
                isDark={isDark}
              />
            ),
          },
          {
            value: "settings",
            label: "Settings",
            content: (
              <div className="space-y-6">
                <div className={cardBase}>
                  <h3
                    className={`mb-4 text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                  >
                    Department Settings
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Name
                      </span>
                      <p className={`mt-1 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                        {department.name}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Slug
                      </span>
                      <p className={`mt-1 font-mono ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                        {department.slug}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Color
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        {department.color ? (
                          <>
                            <div
                              className="h-4 w-4 rounded-full"
                              style={{ backgroundColor: department.color }}
                            />
                            <span
                              className={`font-mono text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                            >
                              {department.color}
                            </span>
                          </>
                        ) : (
                          <span
                            className={`text-xs italic ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                          >
                            None
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Icon
                      </span>
                      <p className={`mt-1 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                        {department.icon ?? "None"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={() => setEditDept(true)}
                      className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Department
                    </button>
                    <button
                      onClick={toggleDeptActive}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                        isDark
                          ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {department.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Dialogs */}
      {editDept && (
        <EditDepartmentDialog
          department={department}
          profiles={profiles}
          isDark={isDark}
          open={editDept}
          onOpenChange={setEditDept}
          onSave={fetchData}
        />
      )}
      {createPosOpen && (
        <CreatePositionDialog
          departmentId={department.department_id}
          departmentName={department.name}
          workspaceId={workspaceId}
          existingCount={positions.length}
          isDark={isDark}
          open={createPosOpen}
          onOpenChange={setCreatePosOpen}
          onSave={fetchData}
        />
      )}
      {editPosition && (
        <EditPositionDialog
          position={editPosition}
          isDark={isDark}
          open={!!editPosition}
          onOpenChange={(open) => {
            if (!open) setEditPosition(null);
          }}
          onSave={fetchData}
        />
      )}
      {movePosition && (
        <MovePositionDialog
          position={movePosition}
          departments={departments}
          isDark={isDark}
          open={!!movePosition}
          onOpenChange={(open) => {
            if (!open) setMovePosition(null);
          }}
          onSave={fetchData}
        />
      )}
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  isDark,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  isDark: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>{icon}</span>
        <span
          className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          {label}
        </span>
      </div>
      <span className={`text-2xl font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
        {value}
      </span>
    </div>
  );
}
