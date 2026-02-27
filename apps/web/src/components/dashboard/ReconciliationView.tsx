"use client";

import React, { useState } from "react";
import {
    Calendar, Clock, AlertTriangle, CheckCircle2,
    ChevronRight, ArrowLeft, Building2, Receipt, CheckSquare, FileWarning, Search, ThumbsUp
} from "lucide-react";
import { motion } from "framer-motion";

// MOCK DATA based on PRD-03
type SessionStatus = 'OPEN' | 'NEEDS_INPUT' | 'READY_FOR_ADMIN' | 'APPROVED' | 'LOCKED';

interface DailySession {
    id: string;
    department: string;
    date: string;
    status: SessionStatus;
    totalShifts: number;
    hoursCalculated: number;
    revenue: number | null;
    revenueExpected: number;
    deviations: number;
    tasksCompleted: number;
    tasksTotal: number;
}

const MOCK_SESSIONS: DailySession[] = [
    { id: "S-101", department: "Bårdshaug Vegkro", date: "2026-02-26", status: "READY_FOR_ADMIN", totalShifts: 8, hoursCalculated: 62.5, revenue: 45200, revenueExpected: 42000, deviations: 2, tasksCompleted: 14, tasksTotal: 14 },
    { id: "S-102", department: "Trondheim City", date: "2026-02-26", status: "NEEDS_INPUT", totalShifts: 5, hoursCalculated: 38, revenue: null, revenueExpected: 55000, deviations: 1, tasksCompleted: 10, tasksTotal: 12 },
    { id: "S-103", department: "Bårdshaug Vegkro", date: "2026-02-25", status: "APPROVED", totalShifts: 7, hoursCalculated: 56, revenue: 39500, revenueExpected: 40000, deviations: 0, tasksCompleted: 14, tasksTotal: 14 },
    { id: "S-104", department: "Oslo S (Kiosk)", date: "2026-02-26", status: "OPEN", totalShifts: 3, hoursCalculated: 24, revenue: null, revenueExpected: 22000, deviations: 0, tasksCompleted: 6, tasksTotal: 10 },
];

const MOCK_SHIFTS = [
    { id: "SH-1", name: "Anna Olsen", role: "Skiftleder", scheduled: "08:00 - 16:00", actual: "07:54 - 16:15", hours: 8.25, breaks: "30 min", status: "ok" },
    { id: "SH-2", name: "Ola Nordmann", role: "Servitør", scheduled: "10:00 - 18:00", actual: "10:15 - 18:00", hours: 7.75, breaks: "30 min", status: "late_checkin" },
    { id: "SH-3", name: "Kari Svendsen", role: "Kokk", scheduled: "14:00 - 22:00", actual: "13:50 - 23:15", hours: 9.41, breaks: "0 min", status: "overtime_no_break" },
];

export function ReconciliationView({ isDark }: { isDark: boolean }) {
    const [selectedSession, setSelectedSession] = useState<DailySession | null>(null);
    const [activeTab, setActiveTab] = useState<'vakter' | 'omsetning' | 'avvik' | 'oppgaver'>('vakter');

    const getStatusStyles = (status: SessionStatus) => {
        switch (status) {
            case 'APPROVED': return isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200';
            case 'READY_FOR_ADMIN': return isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200';
            case 'NEEDS_INPUT': return isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-600 border-orange-200';
            case 'OPEN': return isDark ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' : 'bg-zinc-100 text-zinc-600 border-zinc-200';
            default: return isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-zinc-100 text-zinc-500 border-zinc-200';
        }
    };

    const getStatusLabel = (status: SessionStatus) => {
        switch (status) {
            case 'APPROVED': return 'Godkjent';
            case 'READY_FOR_ADMIN': return 'Klar for godkjenning';
            case 'NEEDS_INPUT': return 'Mangler input (Ansatt)';
            case 'OPEN': return 'Pågår';
            default: return status;
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar pr-2 pb-6">
            {!selectedSession ? (
                // LIST VIEW
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 pt-2">
                        <div>
                            <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Daglig Avstemming</h1>
                            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Admin dashboard for sign-off på timer, omsetning og avvik (PRD-03).</p>
                        </div>
                        <div className="flex gap-2">
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                                <Search className={`w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                                <input type="text" placeholder="Søk avdeling/dato..." className={`bg-transparent text-sm focus:outline-none w-32 md:w-48 ${isDark ? 'text-zinc-200 placeholder:text-zinc-600' : 'text-zinc-800 placeholder:text-zinc-400'}`} />
                            </div>
                        </div>
                    </div>

                    <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                        <div className={`grid grid-cols-12 gap-4 px-6 py-4 border-b text-xs font-bold uppercase tracking-wider ${isDark ? 'border-zinc-800 text-zinc-500 bg-zinc-900/50' : 'border-zinc-200 text-zinc-500 bg-zinc-50'}`}>
                            <div className="col-span-3">Dato / Avdeling</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Timer</div>
                            <div className="col-span-2">Avvik / Oppgaver</div>
                            <div className="col-span-2">Omsetning</div>
                            <div className="col-span-1 text-right">Handling</div>
                        </div>
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {MOCK_SESSIONS.map((session) => (
                                <div key={session.id}
                                    className={`grid grid-cols-12 gap-4 px-6 py-5 items-center transition-colors cursor-pointer group ${isDark ? 'hover:bg-zinc-900/50' : 'hover:bg-zinc-50'}`}
                                    onClick={() => setSelectedSession(session)}
                                >
                                    <div className="col-span-3 flex flex-col gap-1">
                                        <div className={`font-bold text-sm ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>{session.date}</div>
                                        <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                                            <Building2 className="w-3.5 h-3.5" />
                                            {session.department}
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${getStatusStyles(session.status)}`}>
                                            {getStatusLabel(session.status)}
                                        </span>
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-0.5">
                                        <div className={`font-bold text-sm ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>{session.hoursCalculated} t</div>
                                        <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{session.totalShifts} vakter</div>
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            {session.deviations > 0 ? (
                                                <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                                                    <AlertTriangle className="w-3 h-3" /> {session.deviations}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                    <CheckCircle2 className="w-3 h-3" /> 0
                                                </span>
                                            )}
                                        </div>
                                        <div className={`text-[11px] ${session.tasksCompleted < session.tasksTotal ? 'text-orange-500 font-medium' : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>
                                            Oppgaver: {session.tasksCompleted}/{session.tasksTotal}
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        {session.revenue ? (
                                            <div className={`font-bold text-sm ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>kr {session.revenue.toLocaleString('no')}</div>
                                        ) : (
                                            <div className="text-xs font-medium text-orange-500 flex items-center gap-1">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Mangler Input
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        <button className={`p-2 rounded-lg transition-colors ${isDark ? 'text-zinc-400 group-hover:text-white group-hover:bg-zinc-800' : 'text-zinc-400 group-hover:text-zinc-900 group-hover:bg-zinc-200'}`}>
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                // DETAIL VIEW (Avstemmingsvindu)
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-full gap-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <button onClick={() => setSelectedSession(null)} className={`mt-1 p-2 rounded-xl border transition-colors ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}>
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{selectedSession.department}</h1>
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${getStatusStyles(selectedSession.status)}`}>
                                        {getStatusLabel(selectedSession.status)}
                                    </span>
                                </div>
                                <div className={`flex items-center gap-4 text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {selectedSession.date}</span>
                                    <span>Session ID: {selectedSession.id}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}>
                                Se komplett logg
                            </button>
                            <button className="px-5 py-2 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm flex items-center gap-2 transition-colors">
                                <ThumbsUp className="w-4 h-4" /> Godkjenn Dag
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className={`flex-1 rounded-3xl border shadow-sm overflow-hidden flex flex-col ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                        {/* Tabs */}
                        <div className={`flex items-center p-2 border-b ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                            <TabBtn active={activeTab === 'vakter'} onClick={() => setActiveTab('vakter')} icon={<Clock className="w-4 h-4" />} label="Vakter & Timer" isDark={isDark} />
                            <TabBtn active={activeTab === 'omsetning'} onClick={() => setActiveTab('omsetning')} icon={<Receipt className="w-4 h-4" />} label="Omsetning" isDark={isDark} />
                            <TabBtn active={activeTab === 'avvik'} onClick={() => setActiveTab('avvik')} icon={<FileWarning className="w-4 h-4" />} label="Avvik & Hendelser" isDark={isDark} badge={selectedSession.deviations} />
                            <TabBtn active={activeTab === 'oppgaver'} onClick={() => setActiveTab('oppgaver')} icon={<CheckSquare className="w-4 h-4" />} label="Oppgaver" isDark={isDark} />
                        </div>

                        {/* Tab Content */}
                        <div className="p-6 overflow-y-auto">
                            {activeTab === 'vakter' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className={`text-lg font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>Skiftavstemming</h3>
                                        <div className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Beregnet total: <strong className={isDark ? 'text-white' : 'text-zinc-900'}>{selectedSession.hoursCalculated} timer</strong></div>
                                    </div>

                                    <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-zinc-200 bg-zinc-50'}`}>
                                        <table className="w-full text-left text-sm">
                                            <thead className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'bg-zinc-900/50 text-zinc-500' : 'bg-zinc-100 text-zinc-500'}`}>
                                                <tr>
                                                    <th className="px-4 py-3">Ansatt</th>
                                                    <th className="px-4 py-3">Planlagt</th>
                                                    <th className="px-4 py-3">Faktisk Punch</th>
                                                    <th className="px-4 py-3 border-r dark:border-zinc-800">Pause</th>
                                                    <th className="px-4 py-3 border-x dark:border-zinc-800 bg-orange-500/5">Beregnet</th>
                                                    <th className="px-4 py-3 text-right">Handling</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                                {MOCK_SHIFTS.map(shift => (
                                                    <tr key={shift.id} className={`${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'} ${shift.status !== 'ok' ? (isDark ? 'bg-red-500/5' : 'bg-red-50') : ''}`}>
                                                        <td className="px-4 py-4">
                                                            <div className={`font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>{shift.name}</div>
                                                            <div className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{shift.role}</div>
                                                        </td>
                                                        <td className={`px-4 py-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{shift.scheduled}</td>
                                                        <td className="px-4 py-4">
                                                            <div className={`font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>{shift.actual}</div>
                                                            {shift.status === 'late_checkin' && <span className="text-[10px] text-red-500 font-bold block mt-0.5 whitespace-nowrap">Sent: 15 min</span>}
                                                            {shift.status === 'overtime_no_break' && <span className="text-[10px] text-red-500 font-bold block mt-0.5 whitespace-nowrap">Overtid + Ingen pause</span>}
                                                        </td>
                                                        <td className={`px-4 py-4 border-r dark:border-zinc-800 ${shift.breaks === "0 min" ? 'text-red-500 font-bold' : (isDark ? 'text-zinc-400' : 'text-zinc-600')}`}>{shift.breaks}</td>
                                                        <td className="px-4 py-4 border-x dark:border-zinc-800 bg-orange-500/5">
                                                            <div className="font-bold text-orange-500">{shift.hours} t</div>
                                                        </td>
                                                        <td className="px-4 py-4 text-right">
                                                            {shift.status === 'ok' ? (
                                                                <span className="text-xs font-bold text-emerald-500 flex items-center justify-end gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> OK</span>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-white hover:bg-zinc-700 transition-colors">Behandle</button>
                                                                    <button className="px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/10 transition-colors">AI Handoff</button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'omsetning' && (
                                <div className="max-w-xl">
                                    <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>Dagsomsetning</h3>
                                    <div className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                                        <div className="space-y-4">
                                            <div>
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Registrert Omsetning (NOK)</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">kr</span>
                                                    <input
                                                        type="number"
                                                        defaultValue={selectedSession.revenue || ""}
                                                        placeholder="Skriv inn beløp..."
                                                        className={`w-full text-lg pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-colors ${isDark ? 'bg-[#0c0c0e] border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-sm p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
                                                <div className="font-semibold">Forventet via historikk / budsjett:</div>
                                                <div className="font-black">kr {selectedSession.revenueExpected.toLocaleString('no')}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'avvik' && (
                                <div>
                                    <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>Håndter Avvik <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{selectedSession.deviations} ubehandlet</span></h3>
                                    <p className={`text-sm mb-6 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Gå gjennom loggførte avvik og hendelser før dagen kan godkjennes.</p>

                                    {/* Mock deviation items */}
                                    <div className="space-y-3">
                                        <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded">System-Avvik</span>
                                                    <span className={`text-sm font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>Kari Svendsen mangler pause</span>
                                                </div>
                                                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Vakt fra 13:50 til 23:15 loggført med 0 minutter pause (Policy krever min. 30 min).</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button className="px-4 py-2 rounded-lg text-sm font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">Trekk lovpålagt pause (30m)</button>
                                                <button className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm transition-colors">Start AI Dialog</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'oppgaver' && (
                                <div>
                                    <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>Dagsoppgaver & Sjekklister</h3>
                                    <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Integrasjon mot Operations Hub for å se hva som ble gjort denne dagen.</p>
                                    <div className="mt-8 p-12 border-2 border-dashed rounded-2xl text-center dark:border-zinc-800 border-zinc-200">
                                        <CheckSquare className={`w-8 h-8 mx-auto mb-3 opacity-20 ${isDark ? 'text-white' : 'text-black'}`} />
                                        <p className={`font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{selectedSession.tasksCompleted} av {selectedSession.tasksTotal} oppgaver fullført. Viser detaljert sjekkliste-gjennomføring her.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

interface TabBtnProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    isDark: boolean;
    badge?: number;
}

function TabBtn({ active, onClick, icon, label, isDark, badge }: TabBtnProps) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all relative ${active ? (isDark ? 'text-white bg-zinc-800' : 'text-zinc-900 bg-white shadow-sm border border-zinc-200/50') : (isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50')}`}
        >
            {icon} {label}
            {badge !== undefined && badge > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black">{badge}</span>
            )}
        </button>
    )
}
