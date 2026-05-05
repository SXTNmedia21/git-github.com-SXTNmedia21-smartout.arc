"use client";

import React, { useState, useContext, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { handleGatedResult } from "@/lib/gated-result";
// Lazy-load heavy modal/drawer components — each is 800-900 LOC and only
// rendered on explicit user action (row click / contract button). Keeping them
// out of the initial JS parse budget saves ~60-80 KB on first load.
const EmployeeProfileCard = dynamic(
  () => import("./employee-profile-card").then((m) => ({ default: m.EmployeeProfileCard })),
  { ssr: false },
);
const ContractSendDrawer = dynamic(
  () =>
    import("../../contracts/_components/contract-send-drawer").then((m) => ({
      default: m.ContractSendDrawer,
    })),
  { ssr: false },
);
import { InviteMemberDialog } from "./invite-member-dialog";
import { PeopleRowActions } from "./people-row-actions";
import type { ConfirmAction } from "./people-row-actions";
import { ConfirmationDialog } from "@/components/platform-admin/confirmation-dialog";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  updateProfileRole,
  updateProfileDepartment,
  deactivateProfile,
  resetUserPassword,
  cancelInvitation,
  resendInvitation,
  reactivateProfile,
  bulkUpdateProfiles,
  sendLoginCode,
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
  const router = useRouter();
  const { workspaceData } = useContext(DashboardContext);
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
  const [contractProfileId, setContractProfileId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [advancedFilters, setAdvancedFilters] = useState({
    statuses: [] as string[],
    roles: [] as string[],
    readinessMin: 0,
    readinessMax: 100,
    hasContract: null as boolean | null,
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.statuses.length > 0) count++;
    if (advancedFilters.roles.length > 0) count++;
    if (advancedFilters.readinessMin > 0 || advancedFilters.readinessMax < 100) count++;
    if (advancedFilters.hasContract !== null) count++;
    return count;
  }, [advancedFilters]);

  function toggleFilterValue(key: "statuses" | "roles", value: string) {
    setAdvancedFilters((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }

  function setReadinessRange(min: number, max: number) {
    setAdvancedFilters((prev) => {
      if (prev.readinessMin === min && prev.readinessMax === max) {
        return { ...prev, readinessMin: 0, readinessMax: 100 };
      }
      return { ...prev, readinessMin: min, readinessMax: max };
    });
  }

  function clearAdvancedFilters() {
    setAdvancedFilters({
      statuses: [],
      roles: [],
      readinessMin: 0,
      readinessMax: 100,
      hasContract: null,
    });
  }

  function handleExport() {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Role",
      "Department",
      "Status",
      "Readiness %",
      "Contract",
    ];
    const rows = filteredEmployees.map((emp) => [
      emp.name,
      emp.email,
      emp.phone ?? "",
      emp.role,
      emp.department,
      emp.status,
      emp.readinessScore !== undefined ? `${emp.readinessScore}` : "N/A",
      emp.hasContract ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRoleChange(profileId: string, newRole: string) {
    const result = await updateProfileRole(
      profileId,
      workspaceId,
      newRole as Enums<"profile_role">,
    );
    handleGatedResult(result, {
      appliedMessage: `Rolle oppdatert til ${newRole}`,
      proposedMessage: "Rolleendring sendt til godkjenning",
      deniedMessage: () => "Kunne ikke oppdatere rolle",
      onApplied: onRefresh,
      onProposed: onRefresh,
    });
  }

  async function handleDepartmentChange(profileId: string, departmentId: string) {
    const result = await updateProfileDepartment(profileId, workspaceId, departmentId);
    handleGatedResult(result, {
      appliedMessage: "Avdeling oppdatert",
      proposedMessage: "Avdelingsendring sendt til godkjenning",
      deniedMessage: () => "Kunne ikke oppdatere avdeling",
      onApplied: onRefresh,
      onProposed: onRefresh,
    });
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
            const result = await deactivateProfile(action.profileId, workspaceId);
            handleGatedResult(result, {
              appliedMessage: `${action.name} er deaktivert`,
              proposedMessage: "Deaktivering sendt til godkjenning",
              deniedMessage: () => "Kunne ikke deaktivere ansatt",
              onApplied: onRefresh,
              onProposed: onRefresh,
            });
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
      case "reactivate":
        setConfirmDialog({
          open: true,
          title: "Reactivate employee",
          description: `This will restore full access for ${action.name}. Continue?`,
          confirmLabel: "Reactivate",
          variant: "default",
          onConfirm: async () => {
            const result = await reactivateProfile(action.profileId, workspaceId);
            handleGatedResult(result, {
              appliedMessage: `${action.name} er reaktivert`,
              proposedMessage: "Reaktivering sendt til godkjenning",
              deniedMessage: () => "Kunne ikke reaktivere ansatt",
              onApplied: onRefresh,
              onProposed: onRefresh,
            });
            setConfirmDialog((prev) => ({ ...prev, open: false }));
          },
        });
        break;
    }
  }

  async function handleResendInvite(invitationId: string, email: string) {
    if (!workspaceId) return;
    try {
      await resendInvitation(workspaceId, invitationId);
      toast.success(`Invitation resent to ${email}`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend invitation");
    }
  }

  async function handleSendLoginCode(profileId: string, channel: "email" | "sms") {
    if (!workspaceId) return;
    try {
      await sendLoginCode(profileId, workspaceId, channel);
      const label = channel === "sms" ? "SMS" : "e-post";
      toast.success(`Innloggingskode sendt via ${label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke sende innloggingskode");
    }
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
    const seen = new Set<string>(["All"]);
    const values = ["All"];

    for (const department of departments) {
      const name = department.name.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      values.push(name);
    }

    return values;
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
          (emp.name || "").toLowerCase().includes(term) ||
          (emp.email || "").toLowerCase().includes(term) ||
          (emp.role || "").toLowerCase().includes(term),
      );
    }

    // Department filter
    if (selectedDept !== "All") {
      result = result.filter((emp) => emp.department === selectedDept);
    }

    // Advanced filters
    if (advancedFilters.statuses.length > 0) {
      result = result.filter((emp) => advancedFilters.statuses.includes(emp.status));
    }
    if (advancedFilters.roles.length > 0) {
      result = result.filter((emp) => advancedFilters.roles.includes(emp.role.toLowerCase()));
    }
    if (advancedFilters.readinessMin > 0 || advancedFilters.readinessMax < 100) {
      result = result.filter((emp) => {
        const score = emp.readinessScore ?? 0;
        return score >= advancedFilters.readinessMin && score <= advancedFilters.readinessMax;
      });
    }
    if (advancedFilters.hasContract !== null) {
      result = result.filter((emp) =>
        advancedFilters.hasContract ? emp.hasContract : !emp.hasContract,
      );
    }

    // Readiness sort
    if (activeFilter === "readiness") {
      result = [...result].sort((a, b) => (a.readinessScore ?? 0) - (b.readinessScore ?? 0));
    }

    return result;
  }, [employees, activeFilter, searchTerm, selectedDept, advancedFilters]);

  const selectableEmployees = filteredEmployees.filter(
    (e) => e.status !== "invited" && e.profileId,
  );
  const allSelected =
    selectableEmployees.length > 0 && selectableEmployees.every((e) => selectedIds.has(e.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableEmployees.map((e) => e.id)));
    }
  }

  return (
    <div className="border-border/50 bg-background relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-xl">
      {/* Table Header/Controls */}
      <div className="border-border bg-muted/40 flex flex-col items-start justify-between gap-4 border-b p-5 sm:flex-row sm:items-center">
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="group relative w-full sm:w-72">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transition-colors group-focus-within:text-orange-500" />
            <input
              type="text"
              placeholder="Search people, roles, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg py-2 pr-4 pl-9 text-sm transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none"
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
          <div className="border-border bg-background flex rounded-lg border p-1">
            {deptNames.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  selectedDept === dept
                    ? "bg-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="border-border bg-background text-muted-foreground hover:border-border hover:text-foreground rounded-lg border p-2.5 transition-all"
          >
            <Download className="h-4 w-4" />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="border-border bg-background text-muted-foreground hover:border-border hover:text-foreground relative rounded-lg border p-2.5 transition-all">
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4">
              <div className="space-y-4">
                {/* Status filter */}
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                    Status
                  </p>
                  <div className="space-y-1.5">
                    {(["active", "trainee", "inactive", "offboarding", "invited"] as const).map(
                      (s) => (
                        <label key={s} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={advancedFilters.statuses.includes(s)}
                            onCheckedChange={() => toggleFilterValue("statuses", s)}
                          />
                          <span className="capitalize">{s}</span>
                        </label>
                      ),
                    )}
                  </div>
                </div>

                {/* Role filter */}
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                    Role
                  </p>
                  <div className="space-y-1.5">
                    {(["owner", "admin", "manager", "employee"] as const).map((r) => (
                      <label key={r} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={advancedFilters.roles.includes(r)}
                          onCheckedChange={() => toggleFilterValue("roles", r)}
                        />
                        <span className="capitalize">{r}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Readiness range */}
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                    Readiness
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        [0, 25],
                        [25, 50],
                        [50, 75],
                        [75, 100],
                      ] as const
                    ).map(([min, max]) => (
                      <button
                        key={`${min}-${max}`}
                        onClick={() => setReadinessRange(min, max)}
                        className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                          advancedFilters.readinessMin === min &&
                          advancedFilters.readinessMax === max
                            ? "border-orange-500/50 bg-orange-500/10 text-orange-500"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {min}–{max}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contract toggle */}
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                    Contract
                  </p>
                  <div className="flex gap-1.5">
                    {(
                      [
                        { label: "All", value: null },
                        { label: "Has", value: true },
                        { label: "No", value: false },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() =>
                          setAdvancedFilters((prev) => ({
                            ...prev,
                            hasContract: opt.value,
                          }))
                        }
                        className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                          advancedFilters.hasContract === opt.value
                            ? "border-orange-500/50 bg-orange-500/10 text-orange-500"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear filters */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAdvancedFilters}
                    className="border-border text-muted-foreground hover:bg-accent w-full rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="border-border flex items-center gap-3 border-b bg-orange-500/5 px-5 py-3">
          <span className="text-sm font-semibold text-orange-500">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            {/* Assign Department */}
            <select
              onChange={async (e) => {
                const value = e.target.value;
                if (!value) return;
                const profileIds = Array.from(selectedIds)
                  .map((id) => employees.find((emp) => emp.id === id)?.profileId)
                  .filter((pid): pid is string => !!pid);
                const result = await bulkUpdateProfiles(profileIds, workspaceId, {
                  department_id: value,
                });
                const proposalCount = result.ok ? result.proposalIds.length : 0;
                handleGatedResult(result, {
                  appliedMessage: `Oppdaterte avdeling for ${profileIds.length} ansatte`,
                  proposedMessage: `${proposalCount} avdelingsendring(er) sendt til godkjenning`,
                  deniedMessage: () => "Kunne ikke oppdatere avdelinger",
                  onApplied: () => {
                    setSelectedIds(new Set());
                    onRefresh();
                  },
                  onProposed: () => {
                    setSelectedIds(new Set());
                    onRefresh();
                  },
                });
                e.target.value = "";
              }}
              className="border-border bg-card text-foreground rounded-lg border px-2 py-1.5 text-xs"
            >
              <option value="">Assign Dept...</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {d.name}
                </option>
              ))}
            </select>
            {/* Change Role */}
            <select
              onChange={async (e) => {
                const value = e.target.value;
                if (!value) return;
                const profileIds = Array.from(selectedIds)
                  .map((id) => employees.find((emp) => emp.id === id)?.profileId)
                  .filter((pid): pid is string => !!pid);
                const result = await bulkUpdateProfiles(profileIds, workspaceId, { role: value });
                const proposalCount = result.ok ? result.proposalIds.length : 0;
                handleGatedResult(result, {
                  appliedMessage: `Oppdaterte rolle for ${profileIds.length} ansatte`,
                  proposedMessage: `${proposalCount} rolleendring(er) sendt til godkjenning`,
                  deniedMessage: () => "Kunne ikke oppdatere roller",
                  onApplied: () => {
                    setSelectedIds(new Set());
                    onRefresh();
                  },
                  onProposed: () => {
                    setSelectedIds(new Set());
                    onRefresh();
                  },
                });
                e.target.value = "";
              }}
              className="border-border bg-card text-foreground rounded-lg border px-2 py-1.5 text-xs"
            >
              <option value="">Change Role...</option>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            {/* Change Status */}
            <select
              onChange={async (e) => {
                const value = e.target.value;
                if (!value) return;
                const profileIds = Array.from(selectedIds)
                  .map((id) => employees.find((emp) => emp.id === id)?.profileId)
                  .filter((pid): pid is string => !!pid);
                const isActive = value === "active" || value === "trainee";
                const result = await bulkUpdateProfiles(profileIds, workspaceId, {
                  status: value,
                  is_active: isActive,
                });
                const proposalCount = result.ok ? result.proposalIds.length : 0;
                handleGatedResult(result, {
                  appliedMessage: `Oppdaterte status for ${profileIds.length} ansatte`,
                  proposedMessage: `${proposalCount} statusendring(er) sendt til godkjenning`,
                  deniedMessage: () => "Kunne ikke oppdatere statuser",
                  onApplied: () => {
                    setSelectedIds(new Set());
                    onRefresh();
                  },
                  onProposed: () => {
                    setSelectedIds(new Set());
                    onRefresh();
                  },
                });
                e.target.value = "";
              }}
              className="border-border bg-card text-foreground rounded-lg border px-2 py-1.5 text-xs"
            >
              <option value="">Change Status...</option>
              <option value="active">Active</option>
              <option value="trainee">Trainee</option>
              <option value="inactive">Inactive</option>
              <option value="offboarding">Offboarding</option>
            </select>
            {/* Clear */}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="border-border bg-card text-muted-foreground hover:text-foreground rounded-lg border px-2 py-1.5 text-xs font-semibold"
            >
              Clear
            </button>
            {/* Bulk Deactivate */}
            <button
              onClick={() => {
                const profileIds = Array.from(selectedIds)
                  .map((id) => employees.find((emp) => emp.id === id)?.profileId)
                  .filter((pid): pid is string => !!pid);
                setConfirmDialog({
                  open: true,
                  title: "Deactivate selected employees",
                  description: `Are you sure you want to deactivate ${profileIds.length} employees? They will be moved to offboarding status.`,
                  confirmLabel: "Deactivate All",
                  variant: "destructive",
                  onConfirm: async () => {
                    const result = await bulkUpdateProfiles(profileIds, workspaceId, {
                      status: "offboarding",
                      is_active: false,
                    });
                    const proposalCount = result.ok ? result.proposalIds.length : 0;
                    handleGatedResult(result, {
                      appliedMessage: `Deaktiverte ${profileIds.length} ansatte`,
                      proposedMessage: `${proposalCount} deaktivering(er) sendt til godkjenning`,
                      deniedMessage: () => "Kunne ikke deaktivere ansatte",
                      onApplied: () => {
                        setSelectedIds(new Set());
                        onRefresh();
                      },
                      onProposed: () => {
                        setSelectedIds(new Set());
                        onRefresh();
                      },
                    });
                    setConfirmDialog((prev) => ({ ...prev, open: false }));
                  },
                });
              }}
              className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg border px-2 py-1.5 text-xs font-semibold"
            >
              Deactivate Selected
            </button>
          </div>
        </div>
      )}

      {/* Table Body */}
      <div className="flex-1 overflow-auto" onScroll={handleScroll}>
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <p className="text-muted-foreground mt-3 text-sm">Loading people...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-8">
            <SearchX className="text-muted-foreground mb-4 h-12 w-12" />
            <p className="text-muted-foreground font-medium">No employees found</p>
            <p className="mt-1 text-sm">Try adjusting your search criteria</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
              <tr>
                <th className="w-12 px-3 py-4">
                  <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                </th>
                <th className="text-muted-foreground px-6 py-4 text-xs font-bold tracking-widest uppercase">
                  Employee
                </th>
                <th className="text-muted-foreground px-6 py-4 text-xs font-bold tracking-widest uppercase">
                  Role & Dept
                </th>
                <th className="text-muted-foreground px-6 py-4 text-center text-xs font-bold tracking-widest uppercase">
                  Status
                </th>
                <th className="text-muted-foreground px-6 py-4 text-center text-xs font-bold tracking-widest uppercase">
                  Readiness
                </th>
                <th className="text-muted-foreground px-6 py-4 text-right text-xs font-bold tracking-widest uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filteredEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  onClick={() =>
                    emp.profileId
                      ? router.push(`/dashboard/people/${emp.profileId}`)
                      : setSelectedEmployee(emp)
                  }
                  className="group hover:bg-accent cursor-pointer transition-colors"
                >
                  <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                    {emp.status !== "invited" && emp.profileId && (
                      <Checkbox
                        checked={selectedIds.has(emp.id)}
                        onCheckedChange={() => toggleSelect(emp.id)}
                      />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="border-border bg-secondary text-muted-foreground flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border font-bold">
                          {emp.avatar ? (
                            // eslint-disable-next-line -- suppress no-img-element: dynamic user avatar with unknown dimensions; next/image requires explicit width/height
                            <img
                              src={emp.avatar}
                              alt={emp.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (emp.name || "?").charAt(0)
                          )}
                        </div>
                        {emp.status === "active" && (
                          <div className="border-background absolute right-0 bottom-0 z-10 h-2.5 w-2.5 rounded-full border-2 bg-emerald-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-foreground group-hover:text-foreground text-sm font-bold transition-colors">
                          {emp.name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                          <Mail className="h-3 w-3" /> {emp.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-foreground text-sm font-semibold">{emp.role}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{emp.department}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={emp.status} inviteStatus={emp.inviteStatus} />
                  </td>
                  <td className="px-6 py-4">
                    {emp.status !== "invited" && emp.readinessScore !== undefined ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="mb-1 flex items-center gap-2">
                          {emp.readinessScore === 100 ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : emp.readinessScore > 50 ? (
                            <Clock className="h-4 w-4 text-orange-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-rose-500" />
                          )}
                          <span
                            className={`text-sm font-bold ${emp.readinessScore === 100 ? "text-emerald-500" : emp.readinessScore > 50 ? "text-orange-500" : "text-rose-500"}`}
                          >
                            {emp.readinessScore}%
                          </span>
                        </div>
                        <div className="bg-secondary h-1.5 w-full max-w-[100px] overflow-hidden rounded-full">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${emp.readinessScore === 100 ? "bg-emerald-500" : emp.readinessScore > 50 ? "bg-orange-500" : "bg-rose-500"}`}
                            style={{ width: `${emp.readinessScore}%` }}
                          />
                        </div>
                      </div>
                    ) : emp.status !== "invited" ? (
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-muted-foreground text-xs font-semibold">—</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-muted-foreground text-xs font-semibold">
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
                      onSendContract={setContractProfileId}
                      onSendLoginCode={handleSendLoginCode}
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
        departments={departments}
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        onRefresh={onRefresh}
        onSendContract={setContractProfileId}
      />

      {/* Invite Modal */}
      <InviteMemberDialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        departments={departments}
        onRefresh={onRefresh}
      />

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

      {/* Contract send drawer — opened from row action menu */}
      <ContractSendDrawer
        profileId={contractProfileId ?? ""}
        workspaceId={workspaceData?.workspace_id ?? ""}
        open={!!contractProfileId}
        onOpenChange={(open) => {
          if (!open) setContractProfileId(null);
        }}
        onSuccess={() => {
          setContractProfileId(null);
          onRefresh();
        }}
      />
    </div>
  );
}

function StatusBadge({
  status,
  inviteStatus,
}: {
  status: Employee["status"];
  inviteStatus?: "pending" | "expired";
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
        <span className="bg-secondary text-muted-foreground inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase">
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
              ? "border border-orange-500/20 bg-orange-500/10 text-orange-400"
              : "bg-secondary text-muted-foreground"
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
