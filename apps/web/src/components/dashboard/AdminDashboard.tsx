"use client";

import React, { useContext, useState } from "react";
import { DashboardContext } from "@/app/dashboard/layout";
import {
    Calendar,
    TrendingUp,
    Percent,
    Clock,
    AlertCircle,
    CheckCircle2,
    ArrowUpRight,
    ArrowDownRight,
    ShieldCheck,
    Users,
    Activity,
    Target,
    Briefcase,
    Building2,
    MapPin,
    Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReconciliationView } from "./ReconciliationView";
import { ActivityView } from "./ActivityView";

interface AdminDashboardProps {
    isDark: boolean;
}

export default function AdminDashboard({ isDark }: AdminDashboardProps) {
    const { adminView } = useContext(DashboardContext);

    return (
        <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-hidden">
            {adminView === "tactical" ? (
                <TacticalView isDark={isDark} />
            ) : adminView === "strategic" ? (
                <StrategicView isDark={isDark} />
            ) : adminView === "reconciliation" ? (
                <ReconciliationView isDark={isDark} />
            ) : (
                <ActivityView isDark={isDark} />
            )}

        </div>
    );
}

// ==========================================
// TACTICAL VIEW (Nivå 2: Daglig leder)
// ==========================================
function TacticalView({ isDark }: { isDark: boolean }) {
    return (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto custom-scrollbar pr-2 pb-2">

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
                {/* Payroll Cost */}
                <div className={`border rounded-2xl p-5 relative overflow-hidden group ${isDark ? 'bg-zinc-950 border-zinc-800/50' : 'bg-white border-zinc-200'}`}>
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className={`p-2 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <h3 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Weekly Payroll</h3>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className={`text-3xl font-bold leading-none ${isDark ? 'text-white' : 'text-zinc-900'}`}>142k NOK</span>
                        <span className={`text-sm font-medium mb-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>vs 145k budget</span>
                    </div>
                </div>

                {/* Payroll % */}
                <div className={`border rounded-2xl p-5 relative overflow-hidden group ${isDark ? 'bg-zinc-950 border-zinc-800/50' : 'bg-white border-zinc-200'}`}>
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className={`p-2 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                            <Percent className="w-4 h-4" />
                        </div>
                        <h3 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Cost of Sales %</h3>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className={`text-3xl font-bold leading-none ${isDark ? 'text-white' : 'text-zinc-900'}`}>28.3%</span>
                        <span className="text-sm font-medium text-emerald-500 mb-0.5">target &lt;30%</span>
                    </div>
                </div>

                {/* Absence Rate */}
                <div className={`border rounded-2xl p-5 relative overflow-hidden group hover:border-orange-500/30 transition-colors cursor-pointer ${isDark ? 'bg-zinc-950 border-zinc-800/50' : 'bg-white border-zinc-200'}`}>
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-colors" />
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className={`p-2 rounded-lg border ${isDark ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
                            <AlertCircle className="w-4 h-4" />
                        </div>
                        <h3 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Absence (MTD)</h3>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className={`text-3xl font-bold leading-none ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>4.2%</span>
                        <span className={`text-sm font-medium mb-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>up 0.8%</span>
                    </div>
                </div>

                {/* Overtime */}
                <div className={`border rounded-2xl p-5 relative overflow-hidden group ${isDark ? 'bg-zinc-950 border-zinc-800/50' : 'bg-white border-zinc-200'}`}>
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className={`p-2 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                            <Clock className="w-4 h-4" />
                        </div>
                        <h3 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Overtime Hrs</h3>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className={`text-3xl font-bold leading-none ${isDark ? 'text-white' : 'text-zinc-900'}`}>23h</span>
                        <span className="text-sm font-medium text-emerald-500 mb-0.5">down 5h</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0">

                {/* Main Weekly Schedule Overview */}
                <div className={`lg:col-span-2 flex flex-col p-4 rounded-2xl border shadow-sm min-h-0 ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className={`text-xl font-extrabold ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>Staffing Coverage (Week 9)</h2>
                        <button className={`text-sm font-semibold px-3 py-1.5 rounded-lg border transition-colors ${isDark ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-300' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}>
                            View Schedule Details
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col justify-around min-h-0">
                        {[
                            { day: 'Mon', status: 'OK', fill: '100%', color: isDark ? 'bg-emerald-500/80' : 'bg-emerald-500' },
                            { day: 'Tue', status: 'OK', fill: '100%', color: isDark ? 'bg-emerald-500/80' : 'bg-emerald-500' },
                            { day: 'Wed', status: 'Alert', fill: '85%', color: isDark ? 'bg-orange-500/80' : 'bg-orange-500', note: '1 Short (Evening)' },
                            { day: 'Thu', status: 'OK', fill: '100%', color: isDark ? 'bg-emerald-500/80' : 'bg-emerald-500' },
                            { day: 'Fri', status: 'OK', fill: '100%', color: isDark ? 'bg-emerald-500/80' : 'bg-emerald-500' },
                            { day: 'Sat', status: 'Alert', fill: '90%', color: isDark ? 'bg-orange-500/80' : 'bg-orange-500', note: 'High volume expected' },
                            { day: 'Sun', status: 'Alert', fill: '70%', color: isDark ? 'bg-red-500/80' : 'bg-red-500', note: '2 Open Shifts' },
                        ].map((d, i) => (
                            <div key={i} className="flex items-center gap-4 group">
                                <span className={`w-10 text-sm font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{d.day}</span>
                                <div className={`flex-1 h-6 rounded-lg overflow-hidden relative ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}>
                                    <div className={`h-full ${d.color} transition-all duration-1000 ease-out`} style={{ width: d.fill }} />
                                </div>
                                <div className="w-32 flex items-center justify-end gap-2">
                                    {d.note && <span className={`text-xs font-semibold ${d.status === 'Alert' ? (isDark ? 'text-orange-400' : 'text-orange-500') : (isDark ? 'text-zinc-400' : 'text-zinc-500')}`}>{d.note}</span>}
                                    {d.status === 'OK'
                                        ? <CheckCircle2 className={`w-4 h-4 ${isDark ? 'text-emerald-500' : 'text-emerald-500'}`} />
                                        : <AlertCircle className={`w-4 h-4 ${isDark ? 'text-orange-500' : 'text-orange-500'}`} />
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar Widgets */}
                <div className="flex flex-col gap-3 h-full min-h-0">
                    {/* Team Health / Compliance */}
                    <div className={`flex flex-col flex-1 p-4 rounded-2xl border shadow-sm min-h-0 overflow-hidden ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                        <h3 className={`text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            <ShieldCheck className="w-4 h-4 text-orange-500" />
                            Training & Compliance
                        </h3>
                        <div className="flex-1 flex flex-col justify-around min-h-0 gap-3 overflow-hidden">
                            <div className={`p-3 rounded-lg border ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex items-start gap-3">
                                    <AlertCircle className={`w-4 h-4 mt-0.5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                                    <div>
                                        <h4 className={`text-sm font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>Allergen Certificate Expiring</h4>
                                        <p className={`text-xs mt-1 ${isDark ? 'text-red-300/70' : 'text-red-600/80'}`}>2 staff members (Kari, Ole) have certificates expiring in <b className="font-extrabold">3 days</b>.</p>
                                        <button className={`mt-2 text-xs font-bold px-2.5 py-1 rounded bg-red-500/20 text-red-700 hover:bg-red-500/30 transition-colors ${isDark ? 'text-red-300 bg-red-500/20 hover:bg-red-500/40' : ''}`}>Notify Staff</button>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-3 rounded-lg border flex justify-between items-center ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                                <div>
                                    <h4 className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Avg. Onboarding Time</h4>
                                    <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Time to &quot;Job Ready&quot;</p>
                                </div>
                                <div className="text-right">
                                    <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>6.2d</div>
                                    <div className="text-[10px] font-bold text-emerald-500">Target &lt; 7d</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Upcoming Events */}
                    <div className={`flex flex-col flex-1 p-4 rounded-2xl border shadow-sm min-h-0 overflow-hidden ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                        <h3 className={`text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            <Calendar className="w-4 h-4 text-blue-500" />
                            Upcoming Events (Impact)
                        </h3>
                        <div className="flex-1 flex flex-col justify-around min-h-0 gap-4 overflow-hidden">
                            <div className="relative pl-4 border-l-2 border-orange-500">
                                <div className={`absolute w-2 h-2 rounded-full bg-orange-500 -left-[5px] top-1.5`} />
                                <p className={`text-xs font-bold uppercase ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>Fri, Feb 28</p>
                                <h4 className={`text-sm font-bold mt-0.5 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>Private Banquet (40 pax)</h4>
                                <p className={`text-xs mt-1 font-medium bg-orange-500/10 text-orange-600 inline-block px-2 py-0.5 rounded border ${isDark ? 'text-orange-400 border-orange-500/20' : 'border-orange-200'}`}>Requires +3 Service Staff</p>
                            </div>

                            <div className="relative pl-4 border-l-2 border-zinc-300 dark:border-zinc-700">
                                <div className={`absolute w-2 h-2 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'} -left-[5px] top-1.5`} />
                                <p className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Sat, Mar 1</p>
                                <h4 className={`text-sm font-bold mt-0.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Local Football Match</h4>
                                <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Expected +20% walk-in volume</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==========================================
// STRATEGIC VIEW (Nivå 3: Eier / HR)
// ==========================================

const LOCATIONS = [
    { id: 'all', name: 'All Locations' },
    { id: 'baardshaug', name: 'Bårdshaug Vegkro' },
    { id: 'trondheim', name: 'Trondheim City' },
    { id: 'oslo', name: 'Oslo S (Kiosk)' },
];

const defaultMetrics = {
    all: { payroll: 29.0, turn: 14.0, abs: 3.9, onboarding: 6.2, compliance: 92, task: 88, pipeline: 142, hires: 12, resig: 4, tenure: 8.4 },
    baardshaug: { payroll: 29.2, turn: 12.0, abs: 3.1, onboarding: 5.8, compliance: 95, task: 91, pipeline: 65, hires: 4, resig: 1, tenure: 11.2 },
    trondheim: { payroll: 31.5, turn: 22.0, abs: 5.8, onboarding: 7.5, compliance: 85, task: 82, pipeline: 45, hires: 6, resig: 3, tenure: 4.5 },
    oslo: { payroll: 27.1, turn: 8.0, abs: 2.9, onboarding: 4.5, compliance: 98, task: 94, pipeline: 32, hires: 2, resig: 0, tenure: 9.1 },
};

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

function StrategicView({ isDark }: { isDark: boolean }) {
    const [selectedLocId, setSelectedLocId] = useState('all');
    // Targets state for calculation logic
    const [targets, setTargets] = useState({
        payrollTarget: 30,
        turnoverTarget: 15,
        absenceTarget: 4,
        onboardingTarget: 7,
        taskTarget: 90,
        complianceTarget: 100
    });
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // We would normally compute these based on targets, for demonstration we will just grab from static data
    const data = defaultMetrics[selectedLocId as keyof typeof defaultMetrics];

    return (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar pr-2 pb-6">

            {/* Header & Department/Location Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 pt-2">
                <div>
                    <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Strategic Insights</h1>
                    <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Monitor workforce KPIs and organizational health.</p>
                </div>

                {/* Modern Pill Selector */}
                <div className={`flex items-center p-1 rounded-xl border ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                    {LOCATIONS.map(loc => {
                        const isSelected = selectedLocId === loc.id;
                        return (
                            <button
                                key={loc.id}
                                onClick={() => setSelectedLocId(loc.id)}
                                className={`relative px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isSelected ? (isDark ? 'text-white' : 'text-zinc-900') : (isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700')}`}
                            >
                                {isSelected && (
                                    <motion.div
                                        layoutId="loc-pill"
                                        className={`absolute inset-0 rounded-lg shadow-sm ${isDark ? 'bg-zinc-800/80 border border-zinc-700/50' : 'bg-zinc-100 border border-zinc-200/50'}`}
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    {loc.id === 'all' ? <Building2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                    {loc.name}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* SmartOut KPI Grid */}
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                    key={selectedLocId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                    <KPICard
                        isDark={isDark} title="Cost of Sales %" value={`${data.payroll}%`}
                        target={`< ${targets.payrollTarget}%`} status={data.payroll > targets.payrollTarget ? 'bad' : 'good'}
                        icon={<Percent className="w-5 h-5" />} color="emerald"
                        explanation="Calculated by dividing total payroll costs by total revenue over the selected period (rolling 30 days). Adjust the target to trigger earlier warnings."
                    />

                    <KPICard
                        isDark={isDark} title="90-Day Turnover" value={`${data.turn}%`}
                        target={`< ${targets.turnoverTarget}%`} status={data.turn > targets.turnoverTarget ? 'bad' : 'good'}
                        icon={<Users className="w-5 h-5" />} color="blue"
                        explanation="Calculated by taking the number of separated employees divided by the average number of employees over 90 days. Measured against your target."
                    />

                    <KPICard
                        isDark={isDark} title="Absence Rate" value={`${data.abs}%`}
                        target={`< ${targets.absenceTarget}%`} status={data.abs > targets.absenceTarget ? 'bad' : 'good'}
                        icon={<Activity className="w-5 h-5" />} color="orange"
                        explanation="Total recorded absence hours divided by total expected working hours for the month-to-date. Used to detect early signs of team fatigue."
                    />

                    <KPICard
                        isDark={isDark} title="Time to Job-Ready" value={`${data.onboarding}d`}
                        target={`< ${targets.onboardingTarget}d`} status={data.onboarding > targets.onboardingTarget ? 'bad' : 'good'}
                        icon={<Target className="w-5 h-5" />} color="purple"
                        explanation="The average number of days between an employee's first shift and the completion of all required onboarding paths including compliance checks."
                    />

                    <KPICard
                        isDark={isDark} title="Task Completion" value={`${data.task}%`}
                        target={`> ${targets.taskTarget}%`} status={data.task < targets.taskTarget ? 'bad' : 'good'}
                        icon={<CheckCircle2 className="w-5 h-5" />} color="indigo"
                        explanation="Percentage of assigned workplace tasks (opening, closing, maintenance) completed across all shifts matching the location filter."
                    />

                    <KPICard
                        isDark={isDark} title="Compliance Health" value={`${data.compliance}%`}
                        target={`${targets.complianceTarget}%`} status={data.compliance < targets.complianceTarget ? 'bad' : 'good'}
                        icon={<ShieldCheck className="w-5 h-5" />} color="stone"
                        explanation="Percentage of active staff with fully up-to-date certifications (e.g. food safety, allergen training). Always aim for 100% compliance."
                    />
                </motion.div>
            </AnimatePresence>

            {/* Main Insights Row */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                {/* Modern Turnover Trend SVG Graph */}
                <div className={`lg:col-span-2 flex flex-col p-6 rounded-3xl border shadow-sm min-h-[320px] relative overflow-hidden ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div>
                            <h2 className={`text-xl font-extrabold ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>Turnover Trend & Forecast</h2>
                            <p className={`text-sm mt-1 max-w-xl ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Rolling 6-month historical data vs industry benchmark target.</p>
                        </div>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className={`p-2 rounded-xl border flex items-center gap-2 transition-colors ${isDark ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-zinc-700'}`}
                        >
                            <Settings className="w-4 h-4" />
                            <span className="text-xs font-bold hidden md:inline">Configure Goals</span>
                        </button>
                    </div>

                    <div className="flex-1 w-full mt-4 relative z-10 h-[200px]">
                        <TurnoverChart isDark={isDark} location={selectedLocId} targetLineValue={targets.turnoverTarget} />
                    </div>
                </div>

                {/* Workforce Pipeline */}
                <div className={`flex flex-col p-6 rounded-3xl border shadow-sm min-h-0 overflow-hidden relative ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                    <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-purple-500/5 rounded-full blur-[60px] pointer-events-none" />

                    <h2 className={`text-lg font-extrabold mb-5 ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>Workforce Pipeline</h2>

                    <div className="space-y-6 flex-1 flex flex-col justify-center relative z-10">
                        <PipelineRow
                            isDark={isDark} icon={<Users className="w-5 h-5" />} title="Active Staff"
                            value={data.pipeline} subtitle="Currently Employed"
                        />
                        <div className={`h-px w-full ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                        <PipelineRow
                            isDark={isDark} icon={<ArrowUpRight className="w-5 h-5 text-emerald-500" />} title="New Hires (30d)"
                            value={`+${data.hires}`} subtitle="Onboarded" highlight
                        />
                        <div className={`h-px w-full ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                        <PipelineRow
                            isDark={isDark} icon={<ArrowDownRight className="w-5 h-5 text-red-500" />} title="Resignations (30d)"
                            value={`-${data.resig}`} subtitle="Departures" alert={data.resig > 2}
                        />
                        <div className={`h-px w-full ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                        <PipelineRow
                            isDark={isDark} icon={<Briefcase className="w-5 h-5" />} title="Avg. Tenure"
                            value={`${data.tenure} mo`} subtitle="Retention Length"
                        />
                    </div>
                </div>
            </div>

            {/* Target Configuration Modal */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className={`${isDark ? 'bg-[#0c0c0e] border-zinc-800 text-white' : 'bg-white text-zinc-900'} max-w-2xl`}>
                    <DialogHeader>
                        <DialogTitle className="text-xl">Configure Workspace KPIs</DialogTitle>
                        <DialogDescription className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            Modify threshold targets used across all reporting logic in SmartOut. Thresholds are used to highlight alerts and assess overall health.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Cost of Sales Target (%)</label>
                                <input
                                    type="number"
                                    value={targets.payrollTarget}
                                    onChange={(e) => setTargets({ ...targets, payrollTarget: Number(e.target.value) })}
                                    className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}
                                />
                                <span className="text-[10px] text-zinc-500">Benchmark: &lt; 30%</span>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Turnover Target (%)</label>
                                <input
                                    type="number"
                                    value={targets.turnoverTarget}
                                    onChange={(e) => setTargets({ ...targets, turnoverTarget: Number(e.target.value) })}
                                    className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}
                                />
                                <span className="text-[10px] text-zinc-500">Benchmark: &lt; 15%</span>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Absence Threshold (%)</label>
                                <input
                                    type="number"
                                    value={targets.absenceTarget}
                                    onChange={(e) => setTargets({ ...targets, absenceTarget: Number(e.target.value) })}
                                    className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}
                                />
                                <span className="text-[10px] text-zinc-500">Benchmark: &lt; 4%</span>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Time to Job-Ready Target (Days)</label>
                                <input
                                    type="number"
                                    value={targets.onboardingTarget}
                                    onChange={(e) => setTargets({ ...targets, onboardingTarget: Number(e.target.value) })}
                                    className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}
                                />
                                <span className="text-[10px] text-zinc-500">Benchmark: &lt; 7 Days</span>
                            </div>
                        </div>
                        <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                <b>Note on Calculations:</b> SmartOut derives these KPIs uniquely. &quot;Cost of Sales&quot; takes payroll directly out of Live Shift timings multiplied by hourly rates, and contrasts it with integrated POS revenue over that same period.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// === Subcomponents ===

interface KPICardProps {
    isDark: boolean;
    title: string;
    value: string;
    explanation?: string;
    target: string;
    status: 'good' | 'bad';
    icon: React.ReactNode;
    color: string;
}

function KPICard({ isDark, title, value, explanation, target, status, icon, color }: KPICardProps) {
    const isBad = status === 'bad';
    // State to toggle seeing the data definition explanation (flip effect)
    const [showExplanation, setShowExplanation] = useState(false);

    return (
        <div
            onMouseEnter={() => setShowExplanation(true)}
            onMouseLeave={() => setShowExplanation(false)}
            className={`p-5 rounded-2xl border transition-all hover:shadow-md relative overflow-hidden group min-h-[140px] cursor-help ${isDark ? 'bg-[#0c0c0e] border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200'}`}
        >
            <AnimatePresence mode="wait">
                {!showExplanation ? (
                    <motion.div
                        key="front"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className="h-full flex flex-col"
                    >
                        <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-40 bg-${color}-500`} />
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-zinc-50 border-zinc-200 text-zinc-600'}`}>
                                {icon}
                            </div>
                            {isBad ? (
                                <div className={`px-2 py-1 flex items-center gap-1 rounded shadow-sm text-[10px] font-bold uppercase tracking-widest ${isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                    <AlertCircle className="w-3 h-3" /> Action
                                </div>
                            ) : (
                                <div className={`px-2 py-1 flex items-center gap-1 rounded shadow-sm text-[10px] font-bold uppercase tracking-widest ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                                    <CheckCircle2 className="w-3 h-3" /> OK
                                </div>
                            )}
                        </div>
                        <div className="relative z-10 flex-1 flex flex-col justify-end">
                            <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{title}</h3>
                            <div className="flex items-end gap-3">
                                <span className={`text-3xl font-black leading-none ${isDark ? 'text-white' : 'text-zinc-900'} ${isBad ? (isDark ? '!text-red-400' : '!text-red-600') : ''}`}>{value}</span>
                                <span className={`text-xs font-semibold mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>target {target}</span>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="back"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className={`h-full flex flex-col justify-center relative z-10 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}
                    >
                        <h3 className="text-sm font-bold mb-2 break-words text-emerald-500">How is this calculated?</h3>
                        <p className="text-xs leading-relaxed opacity-90">{explanation || "Calculation standard set by AI Council documentation."}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TurnoverChart({ isDark, location, targetLineValue }: { isDark: boolean, location: string, targetLineValue: number }) {
    const chartData = {
        all: [14, 15, 12, 16, 13, 11],
        baardshaug: [12, 11, 10, 14, 11, 9],
        trondheim: [20, 22, 19, 25, 23, 18],
        oslo: [9, 8, 7, 10, 8, 6],
    }[location as "all" | "baardshaug" | "trondheim" | "oslo"]!;

    const maxVal = Math.max(...chartData, 30);
    const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];

    // Define vertical position for variable target line
    const targetPct = 100 - ((targetLineValue / maxVal) * 100);

    return (
        <div className="w-full h-full flex items-end justify-between gap-2 md:gap-4 relative pb-6 pt-4">
            {/* Programmable Target Line */}
            <AnimatePresence>
                <div
                    className="absolute left-0 w-full border-t border-dashed border-zinc-400/30 dark:border-zinc-600/30 pointer-events-none z-0 transition-all duration-500 ease-out"
                    style={{ top: `${Math.max(0, Math.min(100, targetPct))}%` }}
                >
                    <span className={`absolute -top-3 right-0 text-[10px] font-bold pb-1 bg-white dark:bg-[#0c0c0e] px-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Target {targetLineValue}%</span>
                </div>
            </AnimatePresence>

            {chartData.map((val, idx) => {
                const heightPct = (val / maxVal) * 100;
                const isOverTarget = val > targetLineValue;

                return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                        {/* Tooltip on hover */}
                        <div className={`absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded text-xs font-bold shadow-lg pointer-events-none z-20 ${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-800 text-white'}`}>
                            {val}%
                        </div>

                        <motion.div
                            key={`${location}-${idx}`} // force re-animate on location change
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPct}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1, type: "spring", bounce: 0.3 }}
                            className={`w-full max-w-[40px] rounded-t-lg relative overflow-hidden transition-colors z-10 ${isOverTarget ? (isDark ? 'bg-red-500/80 hover:bg-red-400' : 'bg-red-500 hover:bg-red-600') : (isDark ? 'bg-blue-500/80 hover:bg-blue-400' : 'bg-blue-500 hover:bg-blue-600')}`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                        </motion.div>
                        <span className={`absolute -bottom-6 text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{months[idx]}</span>
                    </div>
                )
            })}
        </div>
    )
}

interface PipelineRowProps {
    isDark: boolean;
    icon: React.ReactNode;
    title: string;
    value: React.ReactNode;
    subtitle: string;
    highlight?: boolean;
    alert?: boolean;
}

function PipelineRow({ isDark, icon, title, value, subtitle, highlight, alert }: PipelineRowProps) {
    return (
        <div className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border transition-colors ${alert ? (isDark ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-red-50 border-red-200 text-red-600') : highlight ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-emerald-50 border-emerald-200 text-emerald-600') : (isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400 group-hover:bg-zinc-800' : 'bg-zinc-50 border-zinc-200 text-zinc-500 group-hover:bg-zinc-100')}`}>
                    {icon}
                </div>
                <div>
                    <h4 className={`text-sm font-bold transition-colors ${isDark ? 'text-zinc-300 group-hover:text-white' : 'text-zinc-700 group-hover:text-black'}`}>{title}</h4>
                    <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{subtitle}</p>
                </div>
            </div>
            <div className={`text-xl font-black ${alert ? (isDark ? 'text-red-400' : 'text-red-500') : highlight ? (isDark ? 'text-emerald-400' : 'text-emerald-500') : (isDark ? 'text-white' : 'text-zinc-900')}`}>
                {value}
            </div>
        </div>
    )
}




