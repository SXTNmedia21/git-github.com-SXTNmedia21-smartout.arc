"use client";

import {
  X,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
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
} from "lucide-react";
import { useState, useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { Employee } from "./types";

interface EmployeeProfileCardProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EmployeeProfileCard({ employee, isOpen, onClose }: EmployeeProfileCardProps) {
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<"overview" | "competence" | "hr" | "settings">(
    "overview",
  );

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
                <h3 className="mb-3 flex items-center justify-between text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  <span>Assigned Protocols</span>
                  <span className="font-medium text-zinc-600">3/4 Completed</span>
                </h3>

                <div className="space-y-2">
                  <div className="group flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-700">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-200 transition-colors group-hover:text-white">
                          HACCP Temperature Rules
                        </p>
                        <p className="mt-0.5 text-[10px] tracking-wider text-zinc-500 uppercase">
                          Completed Jan 12
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-400" />
                  </div>

                  <div className="group flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-700">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-200 transition-colors group-hover:text-white">
                          Kitchen Hygiene Standards
                        </p>
                        <p className="mt-0.5 text-[10px] tracking-wider text-zinc-500 uppercase">
                          Completed Jan 10
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-400" />
                  </div>

                  {(employee.readinessScore ?? 0) < 100 && employee.status !== "invited" && (
                    <div className="group flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-700">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-200 transition-colors group-hover:text-white">
                            Allergen Safety v2
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1 w-16 overflow-hidden rounded-full bg-zinc-800">
                              <div className="h-full w-[60%] rounded-full bg-orange-500" />
                            </div>
                            <span className="text-[10px] font-semibold tracking-wider text-orange-500 uppercase">
                              60%
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-400" />
                    </div>
                  )}
                </div>
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

              {/* Full Info List */}
              <div>
                <h3 className="mb-3 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  Personal Information
                </h3>
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
                    className="w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                    defaultValue={employee.department}
                  >
                    <option>Kitchen</option>
                    <option>Service</option>
                    <option>Bar</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                    System Role
                  </label>
                  <select
                    className="w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                    defaultValue={employee.role === "Manager" ? "Manager" : "Employee"}
                  >
                    <option>Employee</option>
                    <option>Manager</option>
                    <option>Admin</option>
                  </select>
                  <p className="pt-1 text-xs text-zinc-500">
                    Defines what this user can see and do in the system, like signing off sessions.
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-zinc-800/50 pt-4">
                <button className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white">
                  Reset Password
                </button>
                <button className="w-full rounded-lg border border-rose-500/20 bg-rose-500/10 py-2.5 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/20 hover:text-rose-400">
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
