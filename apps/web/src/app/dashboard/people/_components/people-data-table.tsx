"use client";

import React, { useState, useContext, useRef, useCallback, useMemo } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  SearchX,
  Mail,
  Plus,
  AlertTriangle,
  Loader2,
  GraduationCap,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { EmployeeProfileCard } from "./employee-profile-card";
import { InviteMemberDialog } from "./invite-member-dialog";
import { PeopleRowActions } from "./people-row-actions";
import type { ConfirmAction } from "./people-row-actions";
import { ConfirmationDialog } from "@/components/platform-admin/confirmation-dialog";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  updateProfileRole,
  updateProfileDepartment,
  deactivateProfile,
  resetUserPassword,
  cancelInvitation,
} from "../_actions/people-actions";
import type { Enums } from "@smartout/supabase";

import type { Employee, Department, ProfileRole } from "./types";

type MetricFilter = "all" | "active" | "readiness" | "invites";

export function PeopleDataTable({
  employees,
  departments,
  activeFilter,
  loading,
  onScrollChange,
  isCompact,
  currentUserRole,
  onRefresh,
}: {
  employees: Employee[];
  departments: Department[];
  activeFilter: MetricFilter;
  loading: boolean;
  onScrollChange?: (isDown: boolean) => void;
  isCompact?: boolean;
  currentUserRole: ProfileRole;
  onRefresh: () => void;
}) {
  const { isDark, workspaceData } = useContext(DashboardContext);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "default" | "destructive";
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "default",
    onConfirm: () => {},
  });
  const lastScrollY = useRef(0);
  const isTransitioning = useRef(false);

  const workspaceId = workspaceData?.workspace_id ?? "";

  async function handleRoleChange(profileId: string, newRole: string) {
    try {
      await updateProfileRole(profileId, workspaceId, newRole as Enums<"profile_role">);
      toast.success(`Role updated to ${newRole}`);
      onRefresh();
    } catch {
      toast.error("Failed to update role");
    }
  }

  async function handleDepartmentChange(profileId: string, departmentId: string) {
    try {
      await updateProfileDepartment(profileId, workspaceId, departmentId);
      toast.success("Department updated");
      onRefresh();
    } catch {
      toast.error("Failed to update department");
    }
  }

  function handleConfirmAction(action: ConfirmAction) {
    switch (action.type) {
      case "deactivate":
        setConfirmDialog({
          open: true,
          title: "Deactivate employee",
          description: `Are you sure you want to deactivate ${action.name}? They will be moved to offboarding status.`,
          confirmLabel: "Deactivate",
          variant: "destructive",
          onConfirm: async () => {
            try {
              await deactivateProfile(action.profileId, workspaceId);
              toast.success(`${action.name} has been deactivated`);
              onRefresh();
            } catch {
              toast.error("Failed to deactivate employee");
            }
            setConfirmDialog((prev) => ({ ...prev, open: false }));
          },
        });
        break;
      case "cancelInvite":
        setConfirmDialog({
          open: true,
          title: "Cancel invitation",
          description: `Are you sure you want to cancel the invitation for ${action.name}?`,
          confirmLabel: "Cancel Invite",
          variant: "destructive",
          onConfirm: async () => {
            try {
              await cancelInvitation(action.invitationId);
              toast.success("Invitation cancelled");
              onRefresh();
            } catch {
              toast.error("Failed to cancel invitation");
            }
            setConfirmDialog((prev) => ({ ...prev, open: false }));
          },
        });
        break;
      case "resetPassword":
        setConfirmDialog({
          open: true,
          title: "Reset password",
          description: `Send a password reset email to ${action.name} (${action.email})?`,
          confirmLabel: "Send Reset Email",
          variant: "default",
          onConfirm: async () => {
            try {
              await resetUserPassword(action.email);
              toast.success("Password reset email sent");
            } catch {
              toast.error("Failed to send password reset email");
            }
            setConfirmDialog((prev) => ({ ...prev, open: false }));
          },
        });
        break;
    }
  }

  function handleResendInvite(email: string) {
    toast.info(`Resend invite to ${email} — not yet implemented`);
  }

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isTransitioning.current) return;

      const currentScrollY = e.currentTarget.scrollTop;
      const delta = currentScrollY - lastScrollY.current;
      lastScrollY.current = currentScrollY;

      if (delta > 0 && currentScrollY > 40 && !isCompact) {
        isTransitioning.current = true;
        onScrollChange?.(true);
        setTimeout(() => {
          isTransitioning.current = false;
        }, 500);
      } else if (delta < -5 && isCompact) {
        isTransitioning.current = true;
        onScrollChange?.(false);
        setTimeout(() => {
          isTransitioning.current = false;
        }, 500);
      }
    },
    [isCompact, onScrollChange],
  );

  const deptNames = useMemo(() => {
    return ["All", ...departments.map((d) => d.name)];
  }, [departments]);

  const filteredEmployees = useMemo(() => {
    let result = employees;

    // Metric card filter
    if (activeFilter === "active") {
      result = result.filter((emp) => emp.status === "active");
    } else if (activeFilter === "invites") {
      result = result.filter((emp) => emp.status === "invited");
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.name.toLowerCase().includes(term) ||
          emp.email.toLowerCase().includes(term) ||
          emp.role.toLowerCase().includes(term),
      );
    }

    // Department filter
    if (selectedDept !== "All") {
      result = result.filter((emp) => emp.department === selectedDept);
    }

    // Readiness sort
    if (activeFilter === "readiness") {
      result = [...result].sort((a, b) => (a.readinessScore ?? 0) - (b.readinessScore ?? 0));
    }

    return result;
  }, [employees, activeFilter, searchTerm, selectedDept]);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"} relative overflow-hidden rounded-2xl border shadow-xl`}
    >
      {/* Table Header/Controls */}
      <div
        className={`border-b ${isDark ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-200 bg-zinc-50/80"} flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center`}
      >
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="group relative w-full sm:w-72">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-orange-500" />
            <input
              type="text"
              placeholder="Search people, roles, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full ${isDark ? "border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600" : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"} rounded-lg py-2 pr-4 pl-9 text-sm transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none`}
            />
          </div>

          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-[0_0_15px_rgba(249,115,22,0.2)] transition-colors hover:bg-orange-400"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Invite</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`${isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white"} flex rounded-lg border p-1`}
          >
            {deptNames.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  selectedDept === dept
                    ? isDark
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-900 shadow-sm"
                    : isDark
                      ? "text-zinc-500 hover:text-zinc-300"
                      : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
          <button
            className={`rounded-lg border p-2.5 transition-all ${isDark ? "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white" : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"}`}
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto" onScroll={handleScroll}>
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <p className="mt-3 text-sm text-zinc-500">Loading people...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-zinc-500">
            <SearchX className="mb-4 h-12 w-12 text-zinc-700" />
            <p className="font-medium text-zinc-400">No employees found</p>
            <p className="mt-1 text-sm">Try adjusting your search criteria</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead
              className={`sticky top-0 ${isDark ? "border-zinc-800 bg-zinc-950/95" : "border-zinc-200 bg-white/95"} z-10 border-b backdrop-blur`}
            >
              <tr>
                <th className="px-6 py-4 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  Employee
                </th>
                <th className="px-6 py-4 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  Role & Dept
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  Readiness
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold tracking-widest text-zinc-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-zinc-800/50" : "divide-zinc-200"}`}>
              {filteredEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className={`group ${isDark ? "hover:bg-zinc-900/50" : "hover:bg-zinc-50"} cursor-pointer transition-colors`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div
                          className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border font-bold ${isDark ? "border-zinc-700 bg-zinc-800 text-zinc-400" : "border-zinc-200 bg-zinc-100 text-zinc-500"}`}
                        >
                          {emp.avatar ? (
                            // eslint-disable-next-line -- suppress no-img-element: dynamic user avatar with unknown dimensions; next/image requires explicit width/height
                            <img
                              src={emp.avatar}
                              alt={emp.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            emp.name.charAt(0)
                          )}
                        </div>
                        {emp.status === "active" && (
                          <div
                            className={`absolute right-0 bottom-0 z-10 h-2.5 w-2.5 rounded-full border-2 bg-emerald-500 ${isDark ? "border-zinc-950" : "border-white"}`}
                          />
                        )}
                      </div>
                      <div>
                        <p
                          className={`text-sm font-bold transition-colors ${isDark ? "text-zinc-200 group-hover:text-white" : "text-zinc-800 group-hover:text-zinc-900"}`}
                        >
                          {emp.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                          <Mail className="h-3 w-3" /> {emp.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p
                      className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                    >
                      {emp.role}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">{emp.department}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge
                      status={emp.status}
                      inviteStatus={emp.inviteStatus}
                      isDark={isDark}
                    />
                  </td>
                  <td className="px-6 py-4">
                    {emp.status !== "invited" ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="mb-1 flex items-center gap-2">
                          {emp.readinessScore === 100 ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (emp.readinessScore ?? 0) > 50 ? (
                            <Clock className="h-4 w-4 text-orange-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-rose-500" />
                          )}
                          <span
                            className={`text-sm font-bold ${emp.readinessScore === 100 ? "text-emerald-500" : (emp.readinessScore ?? 0) > 50 ? "text-orange-500" : "text-rose-500"}`}
                          >
                            {emp.readinessScore ?? 0}%
                          </span>
                        </div>
                        <div
                          className={`h-1.5 w-full max-w-[100px] overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${emp.readinessScore === 100 ? "bg-emerald-500" : (emp.readinessScore ?? 0) > 50 ? "bg-orange-500" : "bg-rose-500"}`}
                            style={{ width: `${emp.readinessScore ?? 0}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <span
                          className={`text-xs font-semibold ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                        >
                          Awaiting signup
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <PeopleRowActions
                      employee={emp}
                      departments={departments}
                      currentUserRole={currentUserRole}
                      onRoleChange={handleRoleChange}
                      onDepartmentChange={handleDepartmentChange}
                      onConfirmAction={handleConfirmAction}
                      onResendInvite={handleResendInvite}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-out Employee Profile Sheet */}
      <EmployeeProfileCard
        employee={selectedEmployee}
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
      />

      {/* Invite Modal */}
      <InviteMemberDialog isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />

      {/* Confirmation Dialog for destructive/sensitive actions */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
    </div>
  );
}

function StatusBadge({
  status,
  inviteStatus,
  isDark,
}: {
  status: Employee["status"];
  inviteStatus?: "pending" | "expired";
  isDark: boolean;
}) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Active
        </span>
      );
    case "inactive":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}
        >
          <Clock className="h-3 w-3" /> Inactive
        </span>
      );
    case "trainee":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wider text-blue-400 uppercase">
          <GraduationCap className="h-3 w-3" /> Trainee
        </span>
      );
    case "offboarding":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wider text-rose-400 uppercase">
          <LogOut className="h-3 w-3" /> Offboarding
        </span>
      );
    case "invited":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${
            inviteStatus === "expired"
              ? isDark
                ? "border border-orange-500/20 bg-orange-500/10 text-orange-400"
                : "border border-orange-200 bg-orange-50 text-orange-600"
              : isDark
                ? "bg-zinc-800 text-zinc-300"
                : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {inviteStatus === "expired" ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <Mail className="h-3 w-3" />
          )}
          {inviteStatus === "expired" ? "Expired" : "Invited"}
        </span>
      );
    default:
      return null;
  }
}
