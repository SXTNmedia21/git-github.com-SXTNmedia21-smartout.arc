"use client";

import React, { useState, useContext } from "react";
import { Search, Filter, MoreHorizontal, CheckCircle2, AlertCircle, Clock, SearchX, Mail, Plus, Link, Send, AlertTriangle } from "lucide-react";
import { EmployeeProfileCard } from "./employee-profile-card";
import { InviteMemberDialog } from "./invite-member-dialog";
import { DashboardContext } from "@/app/dashboard/layout";

import type { Employee } from "./types";

const mockEmployees: Employee[] = [
    { id: "1", name: "Anna Olsen", email: "anna@smartout.io", phone: "+47 912 34 567", role: "Kokk", department: "Kitchen", status: "active", readinessScore: 100, lastActive: "Just now", avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d", address: "Storgata 1, 0155 Oslo", bankAccount: "1234.56.78901", personalNumber: "120190 12345", emergencyContactName: "Ola Olsen", emergencyContactPhone: "+47 999 88 777", hasContract: true, contactLog: [{ id: "cl1", type: "Shift Reminder", channel: "sms", status: "delivered", date: "Today, 06:00" }, { id: "cl2", type: "Onboarding Email", channel: "email", status: "delivered", date: "Jan 12, 14:00" }] },
    { id: "2", name: "Erik Pedersen", email: "erik@smartout.io", phone: "+47 411 22 333", role: "Sous Chef", department: "Kitchen", status: "active", readinessScore: 100, lastActive: "2 min ago", avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704e", hasContract: true },
    { id: "3", name: "Lise Markussen", email: "lise@smartout.io", phone: "+47 922 33 444", role: "Servitør", department: "Service", status: "inactive", readinessScore: 85, lastActive: "1 day ago", avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704f", hasContract: true },
    { id: "4", name: "Ole Torp", email: "ole@smartout.io", phone: "+47 433 44 555", role: "Bartender", department: "Bar", status: "active", readinessScore: 100, lastActive: "Just now", avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704g", hasContract: true },
    { id: "5", name: "Trainee Kari", email: "kari@smartout.io", phone: "+47 944 55 666", role: "Servitør", department: "Service", status: "inactive", readinessScore: 20, lastActive: "3 days ago", avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704h", hasContract: false },
    { id: "6", name: "Jon Doe", email: "jon@smartout.io", phone: "+47 455 66 777", role: "Oppvask", department: "Kitchen", status: "inactive", readinessScore: 60, lastActive: "1 week ago", avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704i", hasContract: true },
    { id: "7", name: "Sara Lee", email: "sara@smartout.io", phone: "+47 966 77 888", role: "Hovmester", department: "Service", status: "on_leave", readinessScore: 100, lastActive: "2 weeks ago", hasContract: true },
    { id: "8", name: "Jonas Bakken", email: "jonas@smartout.io", phone: "+47 477 88 999", role: "Kokk", department: "Kitchen", status: "invited", inviteStatus: "pending", inviteToken: "abc-123", readinessScore: 0, lastActive: "Never", hasContract: false, contactLog: [{ id: "cl3", type: "Invitation Email", channel: "email", status: "delivered", date: "Yesterday, 10:00" }, { id: "cl4", type: "Invitation SMS", channel: "sms", status: "delivered", date: "Yesterday, 10:02" }] },
    { id: "9", name: "Silje Ruud", email: "silje@smartout.io", phone: "+47 988 99 000", role: "Servitør", department: "Service", status: "invited", inviteStatus: "expired", inviteToken: "xyz-789", readinessScore: 0, lastActive: "Never", hasContract: false, contactLog: [{ id: "cl5", type: "Invitation Email", channel: "email", status: "delivered", date: "3 days ago, 10:00" }, { id: "cl6", type: "Invitation Reminder", channel: "email", status: "failed", date: "Yesterday, 10:00" }] },
];

export function PeopleDataTable({
    onScrollChange,
    isCompact
}: {
    onScrollChange?: (isDown: boolean) => void,
    isCompact?: boolean
}) {
    const { isDark } = useContext(DashboardContext);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDept, setSelectedDept] = useState("All");
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentScrollY = e.currentTarget.scrollTop;
        if (currentScrollY > lastScrollY && currentScrollY > 40) {
            // Scrolling down
            if (!isCompact) onScrollChange?.(true);
        } else if (currentScrollY < lastScrollY) {
            // Scrolling up
            if (isCompact) onScrollChange?.(false);
        }
        setLastScrollY(currentScrollY);
    };

    const filteredEmployees = mockEmployees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.role.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDept === "All" || emp.department === selectedDept;

        return matchesSearch && matchesDept;
    });

    return (
        <div className={`flex-1 flex flex-col min-h-0 ${isDark ? 'bg-zinc-950 border-zinc-800/50' : 'bg-white border-zinc-200'} border rounded-2xl shadow-xl overflow-hidden relative`}>

            {/* Table Header/Controls */}
            <div className={`transition-all duration-500 ease-in-out border-b ${isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50/80 border-zinc-200'} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isCompact ? 'h-0 py-0 opacity-0 overflow-hidden border-transparent mb-0' : 'p-5 opacity-100'}`}>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative group w-full sm:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search people, roles, email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full ${isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600' : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'} rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all`}
                        />
                    </div>

                    <button
                        onClick={() => setIsInviteOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:bg-orange-400 transition-colors shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Invite</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'} border rounded-lg p-1 flex`}>
                        {["All", "Kitchen", "Service", "Bar"].map(dept => (
                            <button
                                key={dept}
                                onClick={() => setSelectedDept(dept)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${selectedDept === dept
                                    ? isDark ? "bg-zinc-800 text-white shadow-sm" : "bg-zinc-100 text-zinc-900 shadow-sm"
                                    : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"
                                    }`}
                            >
                                {dept}
                            </button>
                        ))}
                    </div>
                    <button className={`p-2.5 rounded-lg border transition-all ${isDark ? 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700' : 'border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'}`}>
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-auto custom-scrollbar" onScroll={handleScroll}>
                {filteredEmployees.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-8">
                        <SearchX className="w-12 h-12 mb-4 text-zinc-700" />
                        <p className="font-medium text-zinc-400">No employees found</p>
                        <p className="text-sm mt-1">Try adjusting your search criteria</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className={`sticky top-0 ${isDark ? 'bg-zinc-950/95 border-zinc-800' : 'bg-white/95 border-zinc-200'} backdrop-blur z-10 border-b`}>
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Employee</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Role & Dept</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">Status</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">Readiness</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-zinc-800/50' : 'divide-zinc-200'}`}>
                            {filteredEmployees.map((emp) => (
                                <tr
                                    key={emp.id}
                                    onClick={() => setSelectedEmployee(emp)}
                                    className={`group ${isDark ? 'hover:bg-zinc-900/50' : 'hover:bg-zinc-50'} cursor-pointer transition-colors`}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold overflow-hidden ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-500'}`}>
                                                    {emp.avatar ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        emp.name.charAt(0)
                                                    )}
                                                </div>
                                                {emp.status === "active" && (
                                                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 z-10 ${isDark ? 'border-zinc-950' : 'border-white'}`} />
                                                )}
                                            </div>
                                            <div>
                                                <p className={`font-bold text-sm transition-colors ${isDark ? 'text-zinc-200 group-hover:text-white' : 'text-zinc-800 group-hover:text-zinc-900'}`}>{emp.name}</p>
                                                <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                                    <Mail className="w-3 h-3" /> {emp.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className={`font-semibold text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{emp.role}</p>
                                        <p className="text-xs text-zinc-500 mt-0.5">{emp.department}</p>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {emp.status === "active" ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-wider">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Clocked In
                                            </span>
                                        ) : emp.status === "inactive" ? (
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                                                <Clock className="w-3 h-3" /> Out
                                            </span>
                                        ) : emp.status === "invited" ? (
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${emp.inviteStatus === "expired" ? (isDark ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-50 text-orange-600 border border-orange-200') : (isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600')}`}>
                                                {emp.inviteStatus === "expired" ? <AlertTriangle className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                                                {emp.inviteStatus === "expired" ? "Expired" : "Invited"}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold uppercase tracking-wider">
                                                On Leave
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {emp.status !== "invited" ? (
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {emp.readinessScore === 100 ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                    ) : (emp.readinessScore ?? 0) > 50 ? (
                                                        <Clock className="w-4 h-4 text-orange-500" />
                                                    ) : (
                                                        <AlertCircle className="w-4 h-4 text-rose-500" />
                                                    )}
                                                    <span className={`text-sm font-bold ${emp.readinessScore === 100 ? "text-emerald-500" : (emp.readinessScore ?? 0) > 50 ? "text-orange-500" : "text-rose-500"}`}>
                                                        {emp.readinessScore}%
                                                    </span>
                                                </div>
                                                <div className={`w-full max-w-[100px] h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${emp.readinessScore === 100 ? "bg-emerald-500" : (emp.readinessScore ?? 0) > 50 ? "bg-orange-500" : "bg-rose-500"}`}
                                                        style={{ width: `${emp.readinessScore}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center">
                                                <span className={`text-xs font-semibold ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Awaiting signup</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {emp.status === "invited" ? (
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    title="Copy Invite Link"
                                                    className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`http://localhost:3050/invite/${emp.inviteToken}`); alert("Link copied to clipboard!"); }}
                                                >
                                                    <Link className="w-4 h-4" />
                                                </button>
                                                <button
                                                    title="Resend Invite"
                                                    className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
                                                    onClick={(e) => { e.stopPropagation(); alert("Invitation resent!"); }}
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                                <button className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`} onClick={(e) => { e.stopPropagation(); }}>
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button className={`p-2 rounded-lg transition-colors ${isDark ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`} onClick={(e) => { e.stopPropagation(); }}>
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        )}
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
        </div>
    );
}
