"use client";

import {
  X,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Phone,
  Mail,
  Home,
  CreditCard,
  ShieldAlert,
  FileSignature,
  MessageSquare,
  History,
  Wallet,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useContext } from "react";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { Employee, Department } from "./types";

interface EmployeeProfileCardProps {
  employee: Employee | null;
  departments: Department[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function EmployeeProfileCard({
  employee,
  departments,
  isOpen,
  onClose,
  onRefresh,
}: EmployeeProfileCardProps) {
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<"overview" | "competence" | "hr" | "settings">(
    "overview",
  );
  const [editRole, setEditRole] = useState(employee?.role ?? "");
  const [editDeptId, setEditDeptId] = useState(employee?.departmentId ?? "");
  const [editStatus, setEditStatus] = useState(employee?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [editingHr, setEditingHr] = useState(false);
  const [hrAddress, setHrAddress] = useState("");
  const [hrPersonalNumber, setHrPersonalNumber] = useState("");
  const [hrBankAccount, setHrBankAccount] = useState("");
  const [hrEmergencyName, setHrEmergencyName] = useState("");
  const [hrEmergencyPhone, setHrEmergencyPhone] = useState("");
  const [protocols, setProtocols] = useState<
    Array<{
      assignment_id: string;
      status: string;
      protocol: { name: string } | null;
    }>
  >([]);
  const [loadingProtocols, setLoadingProtocols] = useState(false);
  const [teams, setTeams] = useState<Array<{ team_id: string; name: string; team_type: string }>>(
    [],
  );

  async function fetchProtocols() {
    if (!employee?.profileId) return;
    setLoadingProtocols(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("protocol_assignment")
      .select("assignment_id, status, protocol:protocol_id(name)")
      .eq("profile_id", employee.profileId);
    setProtocols(
      (data ?? []).map((d) => ({
        assignment_id: d.assignment_id,
        status: d.status,
        protocol: d.protocol as { name: string } | null,
      })),
    );
    setLoadingProtocols(false);
  }

  async function fetchTeams() {
    if (!employee?.profileId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("team_member")
      .select("team:team_id(team_id, name, team_type)")
      .eq("profile_id", employee.profileId);
    setTeams(
      (data ?? [])
        .map((d) => d.team as { team_id: string; name: string; team_type: string } | null)
        .filter(Boolean) as Array<{ team_id: string; name: string; team_type: string }>,
    );
  }

  useEffect(() => {
    if (employee) {
      setEditRole(employee.role.toLowerCase());
      setEditDeptId(employee.departmentId ?? "");
      setEditStatus(employee.status);
      setHrAddress(employee.address ?? "");
      setHrPersonalNumber(employee.personalNumber ?? "");
      setHrBankAccount(employee.bankAccount ?? "");
      setHrEmergencyName(employee.emergencyContactName ?? "");
      setHrEmergencyPhone(employee.emergencyContactPhone ?? "");
      setEditingHr(false);
      setActiveTab("overview");
      fetchProtocols();
      fetchTeams();
    }
  }, [employee]);

  async function handleSettingsSave() {
    if (!employee?.profileId) return;
    setSaving(true);
    const supabase = createClient();

    const updates: Record<string, unknown> = {};
    if (editRole !== employee.role.toLowerCase()) updates.role = editRole;
    if (editDeptId !== (employee.departmentId ?? "")) updates.department_id = editDeptId || null;
    if (editStatus !== employee.status) {
      updates.status = editStatus;
      if (editStatus === "offboarding" || editStatus === "inactive") updates.is_active = false;
      else updates.is_active = true;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("profile")
        .update(updates)
        .eq("profile_id", employee.profileId);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Profile updated");
        onRefresh();
      }
    }
    setSaving(false);
  }

  async function handleHrSave() {
    if (!employee?.profileId) return;
    setSaving(true);
    const supabase = createClient();

    const addressParts = hrAddress.split(",").map((s) => s.trim());
    const { error } = await supabase
      .from("profile")
      .update({
        address_line_1: addressParts[0] || null,
        postal_code: addressParts[1] || null,
        city: addressParts[2] || null,
        personal_number: hrPersonalNumber || null,
        bank_account: hrBankAccount || null,
      })
      .eq("profile_id", employee.profileId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Personal info updated");
      setEditingHr(false);
      onRefresh();
    }
    setSaving(false);
  }

  if (!isOpen || !employee) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 ${isDark ? "bg-zinc-950/60" : "bg-zinc-800/20"} animate-in fade-in backdrop-blur-sm transition-opacity duration-300`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-2 right-2 z-50 w-full max-w-md ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-white"} animate-in slide-in-from-right-8 flex transform flex-col overflow-hidden rounded-2xl border shadow-2xl transition-transform duration-300`}
      >
        {/* Header */}
        <div
          className={`relative h-32 border-b bg-gradient-to-br ${isDark ? "border-zinc-800/50 from-zinc-800 to-zinc-900" : "border-zinc-200 from-zinc-100 to-zinc-200"}`}
        >
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 rounded-full p-2 backdrop-blur-md transition-colors ${isDark ? "bg-black/20 text-white/70 hover:bg-black/40 hover:text-white" : "border border-zinc-200/50 bg-white/50 text-zinc-600 shadow-sm hover:bg-white/80 hover:text-zinc-900"}`}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="absolute -bottom-10 left-6 flex items-end gap-4">
            <div
              className={`relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 text-2xl font-bold shadow-xl ${isDark ? "border-[#0a0a0c] bg-zinc-800 text-zinc-300" : "border-white bg-zinc-100 text-zinc-600"}`}
            >
              {employee.avatar ? (
                // eslint-disable-next-line -- suppress no-img-element: dynamic user avatar with unknown dimensions; next/image requires explicit width/height
                <img
                  src={employee.avatar}
                  alt={employee.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="relative z-10">{employee.name.charAt(0)}</span>
              )}
              {employee.status === "active" && (
                <div
                  className={`absolute right-1 bottom-1 z-20 h-3 w-3 rounded-full border-2 bg-emerald-500 ${isDark ? "border-[#0a0a0c]" : "border-white"}`}
                />
              )}
            </div>

            <div className="mb-2">
              <h2
                className={`text-xl leading-tight font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
              >
                {employee.name}
              </h2>
              <p className="text-sm font-medium text-orange-400">{employee.role}</p>
            </div>
          </div>
        </div>

        {/* Top-level Metrics */}
        <div className="px-6 pt-14 pb-4">
          <div className="grid grid-cols-3 gap-3">
            <div
              className={`${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"} flex flex-col items-center justify-center rounded-xl border p-3 text-center`}
            >
              <span className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                Readiness
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-lg font-bold ${(employee.readinessScore ?? 0) === 100 ? "text-emerald-400" : (employee.readinessScore ?? 0) > 70 ? "text-orange-400" : "text-rose-400"}`}
                >
                  {employee.readinessScore ?? 0}%
                </span>
              </div>
            </div>
            <div
              className={`${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"} flex flex-col items-center justify-center rounded-xl border p-3 text-center`}
            >
              <span className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                Hours
              </span>
              <span className={`text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
                142<span className="ml-0.5 text-xs font-normal text-zinc-500">h</span>
              </span>
            </div>
            <div
              className={`${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"} flex flex-col items-center justify-center rounded-xl border p-3 text-center`}
            >
              <span className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                Dept
              </span>
              <span
                className={`w-full truncate px-1 text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
              >
                {employee.department}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className={`no-scrollbar overflow-x-auto border-b px-6 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
        >
          <div className="flex min-w-max gap-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`relative pb-3 text-sm font-semibold transition-colors ${activeTab === "overview" ? (isDark ? "text-white" : "text-zinc-900") : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              Overview
              {activeTab === "overview" && (
                <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-orange-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("competence")}
              className={`relative flex items-center gap-1.5 pb-3 text-sm font-semibold transition-colors ${activeTab === "competence" ? (isDark ? "text-white" : "text-zinc-900") : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              Competence
              {(employee.readinessScore ?? 0) < 100 && employee.status !== "invited" && (
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              )}
              {activeTab === "competence" && (
                <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-orange-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("hr")}
              className={`relative pb-3 text-sm font-semibold transition-colors ${activeTab === "hr" ? (isDark ? "text-white" : "text-zinc-900") : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              HR & Logs
              {activeTab === "hr" && (
                <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-orange-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`relative pb-3 text-sm font-semibold transition-colors ${activeTab === "settings" ? (isDark ? "text-white" : "text-zinc-900") : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              Settings
              {activeTab === "settings" && (
                <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-orange-500" />
              )}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <div className="animate-in fade-in zoom-in-95 space-y-6 duration-200">
              <div className="space-y-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-4">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-zinc-500" />
                  <a
                    href={`mailto:${employee.email}`}
                    className="text-zinc-300 transition-colors hover:text-white"
                  >
                    {employee.email}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-zinc-500" />
                  <span className="text-zinc-300">+47 912 34 567</span>
                </div>
              </div>

              {teams.length > 0 && (
                <div>
                  <h3
                    className={`mb-3 text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    Teams
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {teams.map((t) => (
                      <span
                        key={t.team_id}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                          isDark
                            ? "border-zinc-800 bg-zinc-900 text-zinc-300"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700"
                        }`}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-3 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  Recent Activity
                </h3>
                <div className="relative flex flex-col space-y-3 before:absolute before:inset-y-2 before:left-3 before:w-px before:bg-zinc-800">
                  <div className="relative flex gap-4">
                    <div className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                      <Clock className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-300">
                        Clocked in for <span className="font-medium text-white">Opening Shift</span>
                      </p>
                      <span className="text-xs text-zinc-500">Today, 07:58</span>
                    </div>
                  </div>
                  <div className="relative flex gap-4">
                    <div className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-500">
                      <CheckCircle2 className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-300">
                        Completed{" "}
                        <span className="font-medium text-white">Temperature Check Routine</span>
                      </p>
                      <span className="text-xs text-zinc-500">Today, 11:30</span>
                    </div>
                  </div>
                  <div className="relative flex gap-4">
                    <div className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400">
                      <FileText className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-300">
                        Signed <span className="font-medium text-white">Fire Safety Protocol</span>
                      </p>
                      <span className="text-xs text-zinc-500">Yesterday, 14:12</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "competence" && (
            <div className="animate-in fade-in zoom-in-95 space-y-6 duration-200">
              {(employee.readinessScore ?? 0) < 100 && employee.status !== "invited" && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                  <div>
                    <h4 className="mb-1 text-sm font-bold text-rose-400">Missing Requirements</h4>
                    <p className="mb-3 text-xs leading-relaxed text-rose-500/80">
                      Employee has pending protocols required for {employee.department}. They cannot
                      perform all duties until finished.
                    </p>
                    <button className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-600">
                      Send Reminder
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h3
                  className={`mb-3 flex items-center justify-between text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  <span>Assigned Protocols</span>
                  {protocols.length > 0 && (
                    <span className="font-medium text-zinc-600">
                      {protocols.filter((p) => p.status === "completed").length}/{protocols.length}{" "}
                      Completed
                    </span>
                  )}
                </h3>

                {loadingProtocols ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                  </div>
                ) : protocols.length === 0 ? (
                  <p
                    className={`py-4 text-center text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    No protocols assigned
                  </p>
                ) : (
                  <div className="space-y-2">
                    {protocols.map((p) => (
                      <div
                        key={p.assignment_id}
                        className={`group flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                          isDark
                            ? "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                            : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {p.status === "completed" ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          ) : p.status === "expired" ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                              <AlertCircle className="h-4 w-4" />
                            </div>
                          ) : (
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full ${isDark ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400"}`}
                            >
                              <Clock className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <p
                              className={`text-sm font-bold transition-colors ${isDark ? "text-zinc-200 group-hover:text-white" : "text-zinc-700 group-hover:text-zinc-900"}`}
                            >
                              {p.protocol?.name ?? "Unknown Protocol"}
                            </p>
                            {p.status === "completed" && (
                              <p className="mt-0.5 text-[10px] tracking-wider text-emerald-500 uppercase">
                                Completed
                              </p>
                            )}
                            {p.status === "pending" && (
                              <p
                                className={`mt-0.5 text-[10px] tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                              >
                                Pending
                              </p>
                            )}
                            {p.status === "expired" && (
                              <p className="mt-0.5 text-[10px] tracking-wider text-rose-500 uppercase">
                                Expired
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 transition-colors ${isDark ? "text-zinc-600 group-hover:text-zinc-400" : "text-zinc-400 group-hover:text-zinc-600"}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "hr" && (
            <div className="animate-in fade-in zoom-in-95 space-y-6 duration-200">
              {/* Contract Status */}
              <div>
                <h3 className="mb-3 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  Employment Contract
                </h3>
                <div
                  className={`flex items-center justify-between rounded-xl border p-4 ${employee.hasContract ? (isDark ? "border-emerald-500/20 bg-emerald-500/10" : "border-emerald-200 bg-emerald-50") : isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${employee.hasContract ? "bg-emerald-500/20 text-emerald-500" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      <FileSignature className="h-4 w-4" />
                    </div>
                    <div>
                      <p
                        className={`text-sm font-bold ${employee.hasContract ? (isDark ? "text-emerald-400" : "text-emerald-600") : isDark ? "text-zinc-300" : "text-zinc-700"}`}
                      >
                        {employee.hasContract ? "Active Contract" : "No Contract Found"}
                      </p>
                      <p className="mt-0.5 text-[10px] tracking-wider text-zinc-500 uppercase">
                        {employee.hasContract ? "Signed & Valid" : "Action required"}
                      </p>
                    </div>
                  </div>
                  {!employee.hasContract && (
                    <button
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
                    >
                      Create
                    </button>
                  )}
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">
                    Personal Information
                  </h3>
                  {!editingHr && (
                    <button
                      onClick={() => setEditingHr(true)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        isDark
                          ? "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      }`}
                    >
                      Edit
                    </button>
                  )}
                </div>

                {!editingHr ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                        <Home className="h-3 w-3" /> Address
                      </span>
                      <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-800"}`}>
                        {employee.address || "Not provided"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                        <CreditCard className="h-3 w-3" /> Personal Number (SSN)
                      </span>
                      <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-800"}`}>
                        {employee.personalNumber || "Not provided"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                        <Wallet className="h-3 w-3" /> Bank Account
                      </span>
                      <span
                        className={`font-mono text-sm ${isDark ? "text-zinc-300" : "text-zinc-800"}`}
                      >
                        {employee.bankAccount || "Not provided"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-col gap-1 rounded-lg border border-rose-500/10 bg-rose-500/5 p-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-500/80">
                        <ShieldAlert className="h-3 w-3 text-rose-500" /> Emergency Contact
                      </span>
                      <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-800"}`}>
                        {employee.emergencyContactName || "Not provided"} •{" "}
                        {employee.emergencyContactPhone || ""}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const hrInputClass = `w-full rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
                        isDark
                          ? "border-zinc-800 bg-zinc-900 text-white placeholder:text-zinc-600"
                          : "border-zinc-200 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400"
                      }`;
                      return (
                        <>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                              <Home className="h-3 w-3" /> Address
                            </label>
                            <input
                              type="text"
                              value={hrAddress}
                              onChange={(e) => setHrAddress(e.target.value)}
                              placeholder="Street, Postal code, City"
                              className={hrInputClass}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                              <CreditCard className="h-3 w-3" /> Personal Number (SSN)
                            </label>
                            <input
                              type="text"
                              value={hrPersonalNumber}
                              onChange={(e) => setHrPersonalNumber(e.target.value)}
                              placeholder="12345678901"
                              className={hrInputClass}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                              <Wallet className="h-3 w-3" /> Bank Account
                            </label>
                            <input
                              type="text"
                              value={hrBankAccount}
                              onChange={(e) => setHrBankAccount(e.target.value)}
                              placeholder="1234.56.78901"
                              className={hrInputClass}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                              <ShieldAlert className="h-3 w-3" /> Emergency Contact Name
                            </label>
                            <input
                              type="text"
                              value={hrEmergencyName}
                              onChange={(e) => setHrEmergencyName(e.target.value)}
                              placeholder="Full name"
                              className={hrInputClass}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                              <Phone className="h-3 w-3" /> Emergency Contact Phone
                            </label>
                            <input
                              type="text"
                              value={hrEmergencyPhone}
                              onChange={(e) => setHrEmergencyPhone(e.target.value)}
                              placeholder="+47 123 45 678"
                              className={hrInputClass}
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleHrSave}
                              disabled={saving}
                              className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => {
                                setHrAddress(employee.address ?? "");
                                setHrPersonalNumber(employee.personalNumber ?? "");
                                setHrBankAccount(employee.bankAccount ?? "");
                                setHrEmergencyName(employee.emergencyContactName ?? "");
                                setHrEmergencyPhone(employee.emergencyContactPhone ?? "");
                                setEditingHr(false);
                              }}
                              disabled={saving}
                              className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${
                                isDark
                                  ? "border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                              }`}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Communication Log */}
              <div>
                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  <History className="h-4 w-4" /> Communication Log
                </h3>
                {!employee.contactLog || employee.contactLog.length === 0 ? (
                  <p className="text-sm text-zinc-500">No communications found for this user.</p>
                ) : (
                  <div className="relative flex flex-col space-y-3 before:absolute before:inset-y-2 before:left-[11px] before:w-px before:bg-zinc-800">
                    {employee.contactLog.map((log) => (
                      <div key={log.id} className="relative flex gap-4">
                        <div
                          className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                            log.status === "delivered"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                              : log.status === "failed"
                                ? "border-rose-500/20 bg-rose-500/10 text-rose-500"
                                : "border-orange-500/20 bg-orange-500/10 text-orange-500"
                          }`}
                        >
                          {log.channel === "email" ? (
                            <Mail className="h-3 w-3" />
                          ) : (
                            <MessageSquare className="h-3 w-3" />
                          )}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-zinc-300">{log.type}</p>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                                log.status === "delivered"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : log.status === "failed"
                                    ? "bg-rose-500/20 text-rose-400"
                                    : "bg-orange-500/20 text-orange-400"
                              }`}
                            >
                              {log.status}
                            </span>
                          </div>
                          <span className="text-xs text-zinc-500">
                            {log.date} via {log.channel.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="animate-in fade-in zoom-in-95 space-y-6 duration-200">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                    Primary Department
                  </label>
                  <select
                    value={editDeptId}
                    onChange={(e) => setEditDeptId(e.target.value)}
                    className={`w-full appearance-none rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
                      isDark
                        ? "border-zinc-800 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-900"
                    }`}
                  >
                    <option value="">No department</option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                    System Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className={`w-full appearance-none rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
                      isDark
                        ? "border-zinc-800 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-900"
                    }`}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                  <p className="pt-1 text-xs text-zinc-500">
                    Defines what this user can see and do in the system, like signing off sessions.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as typeof editStatus)}
                    className={`w-full appearance-none rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
                      isDark
                        ? "border-zinc-800 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-900"
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="trainee">Trainee</option>
                    <option value="inactive">Inactive</option>
                    <option value="offboarding">Offboarding</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleSettingsSave}
                disabled={saving}
                className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${
                  isDark
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "bg-orange-500 text-white hover:bg-orange-600"
                }`}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <div
                className={`space-y-3 border-t pt-4 ${isDark ? "border-zinc-800/50" : "border-zinc-200"}`}
              >
                <button
                  className={`w-full rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    isDark
                      ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  Reset Password
                </button>
                <button
                  className={`w-full rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    isDark
                      ? "border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:text-rose-400"
                      : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                  }`}
                >
                  Deactivate Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
