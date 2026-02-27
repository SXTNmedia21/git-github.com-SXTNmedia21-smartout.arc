"use client";

import { X, FileText, CheckCircle2, Clock, AlertTriangle, ChevronRight, Phone, Mail, Home, CreditCard, ShieldAlert, FileSignature, MessageSquare, History, Wallet } from "lucide-react";
import { useState, useContext } from "react";
import { DashboardContext } from "@/app/dashboard/layout";
import type { Employee } from "./types";

interface EmployeeProfileCardProps {
    employee: Employee | null;
    isOpen: boolean;
    onClose: () => void;
}

export function EmployeeProfileCard({ employee, isOpen, onClose }: EmployeeProfileCardProps) {
    const { isDark } = useContext(DashboardContext);
    const [activeTab, setActiveTab] = useState<"overview" | "competence" | "hr" | "settings">("overview");

    if (!isOpen || !employee) return null;

    return (
        <>
            <div
                className={`fixed inset-0 z-40 ${isDark ? 'bg-zinc-950/60' : 'bg-zinc-800/20'} backdrop-blur-sm transition-opacity duration-300 animate-in fade-in`}
                onClick={onClose}
            />
            <div className={`fixed inset-y-2 right-2 z-50 w-full max-w-md ${isDark ? 'bg-[#0a0a0c] border-zinc-800' : 'bg-white border-zinc-200'} border rounded-2xl shadow-2xl transform transition-transform duration-300 animate-in slide-in-from-right-8 flex flex-col overflow-hidden`}>

                {/* Header */}
                <div className={`relative h-32 bg-gradient-to-br border-b ${isDark ? 'from-zinc-800 to-zinc-900 border-zinc-800/50' : 'from-zinc-100 to-zinc-200 border-zinc-200'}`}>
                    <button
                        onClick={onClose}
                        className={`absolute top-4 right-4 p-2 rounded-full backdrop-blur-md transition-colors ${isDark ? 'bg-black/20 hover:bg-black/40 text-white/70 hover:text-white' : 'bg-white/50 hover:bg-white/80 text-zinc-600 hover:text-zinc-900 border border-zinc-200/50 shadow-sm'}`}
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="absolute -bottom-10 left-6 flex items-end gap-4">
                        <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-bold shadow-xl overflow-hidden relative ${isDark ? 'border-[#0a0a0c] bg-zinc-800 text-zinc-300' : 'border-white bg-zinc-100 text-zinc-600'}`}>
                            {employee.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="relative z-10">{employee.name.charAt(0)}</span>
                            )}
                            {employee.status === "active" && (
                                <div className={`absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 z-20 ${isDark ? 'border-[#0a0a0c]' : 'border-white'}`} />
                            )}
                        </div>

                        <div className="mb-2">
                            <h2 className={`text-xl font-bold leading-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>{employee.name}</h2>
                            <p className="text-sm font-medium text-orange-400">{employee.role}</p>
                        </div>
                    </div>
                </div>

                {/* Top-level Metrics */}
                <div className="pt-14 px-6 pb-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className={`${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-xl p-3 flex flex-col items-center justify-center text-center`}>
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">Readiness</span>
                            <div className="flex items-center gap-1.5">
                                <span className={`text-lg font-bold ${(employee.readinessScore ?? 0) === 100 ? "text-emerald-400" : (employee.readinessScore ?? 0) > 70 ? "text-orange-400" : "text-rose-400"}`}>
                                    {employee.readinessScore ?? 0}%
                                </span>
                            </div>
                        </div>
                        <div className={`${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-xl p-3 flex flex-col items-center justify-center text-center`}>
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">Hours</span>
                            <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>142<span className="text-xs text-zinc-500 font-normal ml-0.5">h</span></span>
                        </div>
                        <div className={`${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-xl p-3 flex flex-col items-center justify-center text-center`}>
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">Dept</span>
                            <span className={`text-sm font-bold truncate w-full px-1 ${isDark ? 'text-white' : 'text-zinc-900'}`}>{employee.department}</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className={`px-6 border-b overflow-x-auto no-scrollbar ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                    <div className="flex gap-6 min-w-max">
                        <button
                            onClick={() => setActiveTab("overview")}
                            className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === "overview" ? isDark ? "text-white" : "text-zinc-900" : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
                        >
                            Overview
                            {activeTab === "overview" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 rounded-t-full" />}
                        </button>
                        <button
                            onClick={() => setActiveTab("competence")}
                            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-1.5 ${activeTab === "competence" ? isDark ? "text-white" : "text-zinc-900" : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
                        >
                            Competence
                            {(employee.readinessScore ?? 0) < 100 && employee.status !== "invited" && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                            {activeTab === "competence" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 rounded-t-full" />}
                        </button>
                        <button
                            onClick={() => setActiveTab("hr")}
                            className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === "hr" ? isDark ? "text-white" : "text-zinc-900" : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
                        >
                            HR & Logs
                            {activeTab === "hr" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 rounded-t-full" />}
                        </button>
                        <button
                            onClick={() => setActiveTab("settings")}
                            className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === "settings" ? isDark ? "text-white" : "text-zinc-900" : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
                        >
                            Settings
                            {activeTab === "settings" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 rounded-t-full" />}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {activeTab === "overview" && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">

                            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-3 text-sm">
                                    <Mail className="w-4 h-4 text-zinc-500" />
                                    <a href={`mailto:${employee.email}`} className="text-zinc-300 hover:text-white transition-colors">{employee.email}</a>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <Phone className="w-4 h-4 text-zinc-500" />
                                    <span className="text-zinc-300">+47 912 34 567</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Recent Activity</h3>
                                <div className="space-y-3 flex flex-col relative before:absolute before:inset-y-2 before:left-3 before:w-px before:bg-zinc-800">
                                    <div className="flex gap-4 relative">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 z-10">
                                            <Clock className="w-3 h-3" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-zinc-300">Clocked in for <span className="text-white font-medium">Opening Shift</span></p>
                                            <span className="text-xs text-zinc-500">Today, 07:58</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 relative">
                                        <div className="w-6 h-6 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 z-10">
                                            <CheckCircle2 className="w-3 h-3" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-zinc-300">Completed <span className="text-white font-medium">Temperature Check Routine</span></p>
                                            <span className="text-xs text-zinc-500">Today, 11:30</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 relative">
                                        <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center justify-center shrink-0 z-10">
                                            <FileText className="w-3 h-3" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-zinc-300">Signed <span className="text-white font-medium">Fire Safety Protocol</span></p>
                                            <span className="text-xs text-zinc-500">Yesterday, 14:12</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "competence" && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">

                            {(employee.readinessScore ?? 0) < 100 && employee.status !== "invited" && (
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex gap-3 items-start">
                                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-rose-400 mb-1">Missing Requirements</h4>
                                        <p className="text-xs text-rose-500/80 leading-relaxed mb-3">
                                            Employee has pending protocols required for {employee.department}. They cannot perform all duties until finished.
                                        </p>
                                        <button className="text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 px-3 py-1.5 rounded-md transition-colors shadow-sm">
                                            Send Reminder
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center justify-between">
                                    <span>Assigned Protocols</span>
                                    <span className="text-zinc-600 font-medium">3/4 Completed</span>
                                </h3>

                                <div className="space-y-2">
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between group cursor-pointer hover:border-zinc-700 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">HACCP Temperature Rules</p>
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Completed Jan 12</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                                    </div>

                                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between group cursor-pointer hover:border-zinc-700 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">Kitchen Hygiene Standards</p>
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Completed Jan 10</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                                    </div>

                                    {(employee.readinessScore ?? 0) < 100 && employee.status !== "invited" && (
                                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex items-center justify-between group cursor-pointer hover:border-zinc-700 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">Allergen Safety v2</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className="h-1 w-16 bg-zinc-800 rounded-full overflow-hidden">
                                                            <div className="h-full w-[60%] bg-orange-500 rounded-full" />
                                                        </div>
                                                        <span className="text-[10px] text-orange-500 uppercase tracking-wider font-semibold">60%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "hr" && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">

                            {/* Contract Status */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Employment Contract</h3>
                                <div className={`border rounded-xl p-4 flex items-center justify-between ${employee.hasContract ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200') : (isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200')}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${employee.hasContract ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800 text-zinc-400'}`}>
                                            <FileSignature className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold ${employee.hasContract ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-zinc-300' : 'text-zinc-700')}`}>
                                                {employee.hasContract ? "Active Contract" : "No Contract Found"}
                                            </p>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
                                                {employee.hasContract ? "Signed & Valid" : "Action required"}
                                            </p>
                                        </div>
                                    </div>
                                    {!employee.hasContract && (
                                        <button className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>
                                            Create
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Full Info List */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Personal Information</h3>
                                <div className="space-y-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-zinc-500 font-semibold flex items-center gap-1.5"><Home className="w-3 h-3" /> Address</span>
                                        <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>{employee.address || "Not provided"}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-zinc-500 font-semibold flex items-center gap-1.5"><CreditCard className="w-3 h-3" /> Personal Number (SSN)</span>
                                        <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>{employee.personalNumber || "Not provided"}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-zinc-500 font-semibold flex items-center gap-1.5"><Wallet className="w-3 h-3" /> Bank Account</span>
                                        <span className={`text-sm font-mono ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>{employee.bankAccount || "Not provided"}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 mt-2">
                                        <span className="text-xs text-rose-500/80 font-semibold flex items-center gap-1.5"><ShieldAlert className="w-3 h-3 text-rose-500" /> Emergency Contact</span>
                                        <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>{employee.emergencyContactName || "Not provided"} • {employee.emergencyContactPhone || ""}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Communication Log */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-1.5"><History className="w-4 h-4" /> Communication Log</h3>
                                {(!employee.contactLog || employee.contactLog.length === 0) ? (
                                    <p className="text-sm text-zinc-500">No communications found for this user.</p>
                                ) : (
                                    <div className="space-y-3 flex flex-col relative before:absolute before:inset-y-2 before:left-[11px] before:w-px before:bg-zinc-800">
                                        {employee.contactLog.map((log) => (
                                            <div key={log.id} className="flex gap-4 relative">
                                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 z-10 ${log.status === "delivered" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                                    log.status === "failed" ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                                                        "bg-orange-500/10 border-orange-500/20 text-orange-500"
                                                    }`}>
                                                    {log.channel === "email" ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                                                </div>
                                                <div className="flex-1 pb-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-sm text-zinc-300 font-medium">{log.type}</p>
                                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${log.status === "delivered" ? "bg-emerald-500/20 text-emerald-400" :
                                                            log.status === "failed" ? "bg-rose-500/20 text-rose-400" :
                                                                "bg-orange-500/20 text-orange-400"
                                                            }`}>
                                                            {log.status}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-zinc-500">{log.date} via {log.channel.toUpperCase()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "settings" && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Primary Department</label>
                                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 appearance-none" defaultValue={employee.department}>
                                        <option>Kitchen</option>
                                        <option>Service</option>
                                        <option>Bar</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">System Role</label>
                                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 appearance-none" defaultValue={employee.role === "Manager" ? "Manager" : "Employee"}>
                                        <option>Employee</option>
                                        <option>Manager</option>
                                        <option>Admin</option>
                                    </select>
                                    <p className="text-xs text-zinc-500 pt-1">Defines what this user can see and do in the system, like signing off sessions.</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-zinc-800/50 space-y-3">
                                <button className="w-full py-2.5 rounded-lg text-sm font-medium bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors border border-zinc-800">
                                    Reset Password
                                </button>
                                <button className="w-full py-2.5 rounded-lg text-sm font-medium bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors border border-rose-500/20">
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
