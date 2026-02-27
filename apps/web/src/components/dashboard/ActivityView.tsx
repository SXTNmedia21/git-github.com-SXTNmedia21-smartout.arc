"use client";

import React, { useState } from "react";
import {
    Activity, Users, MapPin, Building2, Network, ChevronDown, Filter, Layers,
    ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Helper to generate mock heatmap data
// Generates an array of rows, each with 30 days of data (0-100 values)
const generateHeatmapData = (labels: string[]) => {
    return labels.map(label => ({
        id: label.toLowerCase().replace(/\\s+/g, '-'),
        label,
        data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 100))
    }));
};

const LOCATIONS = generateHeatmapData(["Bårdshaug Vegkro", "Trondheim City", "Oslo S Kiosk", "Lillehammer Diner", "Stavanger FNB"]);
const DEPARTMENTS = generateHeatmapData(["Kjøkken", "Servering", "Oppvask", "Renhold", "Lager", "Sikkerhet"]);
const TEAMS = generateHeatmapData(["Morgenfuglene", "Kveldsgjengen", "Helgeteamet", "Sommervikarer", "VIP Catering"]);
const EMPLOYEES = generateHeatmapData([
    "Anna Olsen", "Ola Nordmann", "Kari Svendsen", "Jens Hansen", "Bente Johansen",
    "Svein Eide", "Linda Bakken", "Per Lie", "Marianne Berg", "Knut Lunde"
]);

export function ActivityView({ isDark }: { isDark: boolean }) {
    const [activeTab, setActiveTab] = useState<'locations' | 'departments' | 'teams' | 'employees'>('locations');
    const [timeframe] = useState('Siste 30 dager');

    // Select active dataset based on tab
    let activeData = LOCATIONS;
    if (activeTab === 'departments') activeData = DEPARTMENTS;
    if (activeTab === 'teams') activeData = TEAMS;
    if (activeTab === 'employees') activeData = EMPLOYEES;

    // Determine color intensity based on value (0-100)
    const getIntensityClass = (val: number, isDark: boolean) => {
        if (val === 0) return isDark ? 'bg-zinc-800/30' : 'bg-zinc-100';
        if (val < 20) return isDark ? 'bg-indigo-500/10' : 'bg-indigo-100';
        if (val < 40) return isDark ? 'bg-indigo-500/30' : 'bg-indigo-200';
        if (val < 60) return isDark ? 'bg-indigo-500/50' : 'bg-indigo-300';
        if (val < 80) return isDark ? 'bg-indigo-500/80' : 'bg-indigo-400';
        return 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'; // High intensity
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar pr-2 pb-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 pt-2">
                <div>
                    <h1 className={`text-2xl font-black tracking-tight flex items-center gap-3 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        <div className={`p-2 rounded-xl ${isDark ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'bg-indigo-100 text-indigo-600'}`}>
                            <Activity className="w-5 h-5" />
                        </div>
                        Aktivitets & Heatmap Dashboard
                    </h1>
                    <p className={`text-sm mt-1 max-w-2xl ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Visualiser tverrgående aktivitet, belastning og intensitet (vakter, oppgaver, omsetning) på tvers av hele bedriften. Jo sterkere farge, jo høyere aktivitet.
                    </p>
                </div>

                <div className="flex gap-2 relative z-20">
                    <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}>
                        <Filter className="w-4 h-4" /> Filter
                    </button>
                    <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}>
                        {timeframe} <ChevronDown className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    isDark={isDark} title="Total AktivitetScore" value="94.2k"
                    trend="+12.5%" isPositive={true} subtitle="Vs forrige måned"
                />
                <StatCard
                    isDark={isDark} title="Høyeste Intensitet" value="Fredager"
                    trend="Kveldsgjengen" isPositive={true} subtitle="Mest aktiv part"
                />
                <StatCard
                    isDark={isDark} title="Laveste Intensitet" value="Søndag M."
                    trend="-5.2%" isPositive={false} subtitle="Under budsjettgrense"
                />
                <StatCard
                    isDark={isDark} title="Brukere Involvert" value="1,240"
                    trend="+43" isPositive={true} subtitle="Nye aktive denne uken"
                />
            </div>

            {/* Tabs for Heatmap Categories */}
            <div className="mt-4">
                <div className={`inline-flex p-1.5 rounded-2xl border shadow-sm ${isDark ? 'bg-[#0a0a0c] border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                    <TabBtn active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} icon={<MapPin className="w-4 h-4" />} label="Lokasjoner" isDark={isDark} />
                    <TabBtn active={activeTab === 'departments'} onClick={() => setActiveTab('departments')} icon={<Building2 className="w-4 h-4" />} label="Avdelinger" isDark={isDark} />
                    <TabBtn active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} icon={<Network className="w-4 h-4" />} label="Team" isDark={isDark} />
                    <TabBtn active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} icon={<Users className="w-4 h-4" />} label="Brukere" isDark={isDark} />
                </div>
            </div>

            {/* The Heatmap Visualizer */}
            <div className={`flex-1 rounded-3xl border shadow-sm overflow-hidden flex flex-col ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                {/* Heatmap Legend */}
                <div className={`p-4 border-b flex items-center justify-between flex-wrap gap-4 ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                        <Layers className="w-5 h-5 opacity-50" />
                        {activeTab === 'locations' ? 'Lokasjons-Intensitet' :
                            activeTab === 'departments' ? 'Avdelings-Intensitet' :
                                activeTab === 'teams' ? 'Team-Intensitet' : 'Bruker-Intensitet'}
                    </h3>

                    <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>Rolig</span>
                        <div className="flex gap-1 mx-2">
                            <div className={`w-4 h-4 rounded-sm ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-100'}`}></div>
                            <div className={`w-4 h-4 rounded-sm ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-100'}`}></div>
                            <div className={`w-4 h-4 rounded-sm ${isDark ? 'bg-indigo-500/30' : 'bg-indigo-200'}`}></div>
                            <div className={`w-4 h-4 rounded-sm ${isDark ? 'bg-indigo-500/50' : 'bg-indigo-300'}`}></div>
                            <div className={`w-4 h-4 rounded-sm ${isDark ? 'bg-indigo-500/80' : 'bg-indigo-400'}`}></div>
                            <div className={`w-4 h-4 rounded-sm bg-indigo-500`}></div>
                        </div>
                        <span className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>Pulsende / Høy</span>
                    </div>
                </div>

                {/* Heatmap Grid container */}
                <div className="flex-1 p-6 overflow-auto">
                    <div className="min-w-[800px]">

                        {/* Days Header */}
                        <div className="flex mb-2">
                            <div className="w-48 flex-shrink-0"></div> {/* Spacer for row labels */}
                            <div className="flex-1 flex justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                <span>1.</span>
                                <span>5.</span>
                                <span>10.</span>
                                <span>15.</span>
                                <span>20.</span>
                                <span>25.</span>
                                <span>30.</span>
                            </div>
                        </div>

                        {/* Rows */}
                        <AnimatePresence mode="popLayout" initial={false}>
                            {activeData.map((row) => (
                                <motion.div
                                    key={row.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3 }}
                                    className="flex items-center group mb-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 p-1 -ml-1 rounded-lg transition-colors cursor-crosshair"
                                >
                                    {/* Label */}
                                    <div className={`w-48 flex-shrink-0 text-sm font-semibold truncate pr-4 ${isDark ? 'text-zinc-300 group-hover:text-white' : 'text-zinc-700 group-hover:text-black'}`}>
                                        {row.label}
                                    </div>

                                    {/* Cells (30 days) */}
                                    <div className="flex-1 flex gap-1 h-5">
                                        {row.data.map((val, cellIdx) => (
                                            <div
                                                key={cellIdx}
                                                title={`${row.label} - Dag ${cellIdx + 1}: Score ${val}`}
                                                className={`flex-1 rounded-[3px] transition-all duration-300 hover:scale-[1.15] hover:z-10 relative cursor-pointer ${getIntensityClass(val, isDark)}`}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

        </div>
    );
}

// Subcomponents

interface StatCardProps {
    isDark: boolean;
    title: string;
    value: string;
    trend: string;
    isPositive: boolean;
    subtitle: string;
}

function StatCard({ isDark, title, value, trend, isPositive, subtitle }: StatCardProps) {
    return (
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden ${isDark ? 'bg-[#0a0a0c] border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{title}</span>
                <span className={`flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded ${isPositive ? (isDark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-600 bg-emerald-50') : (isDark ? 'text-red-400 bg-red-500/10' : 'text-red-600 bg-red-50')}`}>
                    {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trend}
                </span>
            </div>
            <div className="relative z-10">
                <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{value}</div>
                <div className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{subtitle}</div>
            </div>
        </div>
    );
}

interface TabBtnProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    isDark: boolean;
}

function TabBtn({ active, onClick, icon, label, isDark }: TabBtnProps) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${active ? (isDark ? 'text-white bg-zinc-800 shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-zinc-700' : 'text-zinc-900 bg-white shadow-sm border border-zinc-200/50') : (isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50 border border-transparent')}`}
        >
            {icon} {label}
        </button>
    )
}
