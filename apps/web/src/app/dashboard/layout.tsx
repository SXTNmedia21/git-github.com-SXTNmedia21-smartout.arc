"use client";

import { useState, createContext } from "react";

export type AdminViewType = "tactical" | "strategic" | "reconciliation" | "activity";
export type ScheduleLayoutMode = 'daily' | 'weekly' | 'monthly' | 'list';
export type ScheduleViewMode = 'ansatt' | 'jobb' | 'team';

export const DashboardContext = createContext({
    isAdminMode: true,
    setIsAdminMode: (_val: boolean) => { void _val; },
    isDark: true,
    setIsDark: (_val: boolean) => { void _val; },
    adminView: "tactical" as AdminViewType,
    setAdminView: (_val: AdminViewType) => { void _val; },
    scheduleLayout: "daily" as ScheduleLayoutMode,
    setScheduleLayout: (_val: ScheduleLayoutMode) => { void _val; },
    scheduleView: "ansatt" as ScheduleViewMode,
    setScheduleView: (_val: ScheduleViewMode) => { void _val; },
    activeLocation: "Alle Lokasjoner",
    setActiveLocation: (_val: string) => { void _val; },
    workspaceData: null as { workspace_id: string; company_id: string; name: string } | null
});
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Users,
    Calendar,
    ChevronRight,
    ChevronLeft,
    LayoutDashboard,
    Search,
    Settings,
    Activity,
    TrendingUp,
    Sun,
    Moon,
    Gamepad2,
    MessageSquare,
    Bot,
    HelpCircle,
    Building2,
    GraduationCap,
    Banknote,
    FileText,
    CalendarDays,
    ShieldCheck,
    Mic,
    Briefcase,
    Network,
    MapPin,
    ChevronDown
} from "lucide-react";
import VoiceAssistant from "@/components/voice-assistant";
import { AnimatePresence, motion } from "framer-motion";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isDark, setIsDark] = useState(true);
    const [isAdminMode, setIsAdminMode] = useState(true);
    const [adminView, setAdminView] = useState<AdminViewType>("tactical");
    const [scheduleLayout, setScheduleLayout] = useState<ScheduleLayoutMode>("daily");
    const [scheduleView, setScheduleView] = useState<ScheduleViewMode>("ansatt");
    const [activeLocation, setActiveLocation] = useState("Alle Lokasjoner");
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const pathname = usePathname();

    const isDashboardPage = pathname === "/dashboard";

    // Helper to determine if a link is active
    const isActive = (path: string) => {
        // Exact match for dashboard root, otherwise starts with
        if (path === "/dashboard") {
            return pathname === "/dashboard";
        }
        return pathname.startsWith(path);
    };

    return (
        <div
            className={`h-screen font-sans selection:bg-orange-500/30 flex flex-col overflow-hidden transition-colors duration-300 ${isDark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
                } print:h-auto print:overflow-visible print:block`}
        >
            {/* TOP CONTEXT BAR */}
            <header
                className={`h-14 flex items-center justify-between px-6 z-30 relative transition-colors duration-300 ${isDark
                    ? "bg-[#0a0a0c] border-b border-zinc-800"
                    : "bg-zinc-900 text-white shadow-md"
                    } print:hidden`}
            >
                <div className="flex items-center gap-6">
                    <div
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${isDark ? "bg-zinc-900 hover:bg-zinc-800" : "bg-zinc-800 hover:bg-zinc-700"
                            }`}
                    >
                        <Building2 className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-bold text-white">Bårdshaug Vegkro</span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-400 rotate-90" />
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-400">Season:</span>
                        <span className="font-semibold text-white">Vinter 2026</span>
                        <div className="flex items-center gap-1.5 ml-2 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                Active
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsDark(!isDark)}
                        className={`p-1.5 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white`}
                    >
                        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>

                    {/* Header Voice Assistant */}
                    <div className="relative">
                        <button
                            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                            className={`p-1.5 rounded-md transition-colors ${isAssistantOpen ? "bg-orange-500/20 text-orange-400" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                        >
                            <Mic className="w-4 h-4" />
                        </button>

                        <AnimatePresence>
                            {isAssistantOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                    className="absolute top-full right-0 mt-4 origin-top-right z-50 pointer-events-auto shadow-2xl"
                                >
                                    <VoiceAssistant autoStart onClose={() => setIsAssistantOpen(false)} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-3 cursor-pointer group">
                        <div className="text-right">
                            <p className="text-sm font-semibold text-white leading-tight">
                                Anna Olsen
                            </p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                Admin
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                            <span className="text-xs font-bold text-zinc-300">AO</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-500 rotate-90 group-hover:text-white transition-colors" />
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                {/* LEFT SIDEBAR NAVIGATION */}
                <aside
                    className={`w-64 border-r flex flex-col z-20 transition-colors duration-300 ${isDark
                        ? "border-zinc-800 bg-[#0c0c0e]"
                        : "border-zinc-200 bg-white shadow-sm"
                        } print:hidden`}
                >
                    <nav className="flex-1 px-4 py-8 overflow-y-auto hide-scrollbar space-y-1 relative">
                        {isAdminMode ? (
                            <>
                                <div
                                    className={`text-[10px] font-bold uppercase tracking-widest mb-3 px-3 mt-2 ${isDark ? "text-zinc-500" : "text-zinc-400"
                                        }`}
                                >
                                    Management
                                </div>
                                <NavItem
                                    href="/dashboard"
                                    icon={LayoutDashboard}
                                    label="Dashboard"
                                    isDark={isDark}
                                    active={isActive("/dashboard")}
                                />
                                <NavItem
                                    href="/dashboard/people"
                                    icon={Users}
                                    label="People"
                                    isDark={isDark}
                                    badge="2 Req"
                                    active={isActive("/dashboard/people")}
                                />
                                <NavItem
                                    href="/dashboard/schedule"
                                    icon={CalendarDays}
                                    label="Schedule"
                                    isDark={isDark}
                                    active={isActive("/dashboard/schedule")}
                                />

                                <div
                                    className={`text-[10px] font-bold uppercase tracking-widest mb-3 px-3 mt-6 ${isDark ? "text-zinc-500" : "text-zinc-400"
                                        }`}
                                >
                                    Operations
                                </div>
                                <NavItem
                                    href="/dashboard/operations"
                                    icon={Activity}
                                    label="Live Operations"
                                    isDark={isDark}
                                    active={isActive("/dashboard/operations")}
                                />
                                <NavItem
                                    href="/dashboard/reports"
                                    icon={TrendingUp}
                                    label="Reports"
                                    isDark={isDark}
                                    active={isActive("/dashboard/reports")}
                                />

                                <div
                                    className={`text-[10px] font-bold uppercase tracking-widest mb-3 px-3 mt-6 ${isDark ? "text-zinc-500" : "text-zinc-400"
                                        }`}
                                >
                                    Administration
                                </div>
                                <NavItem
                                    href="/dashboard/governance"
                                    icon={ShieldCheck}
                                    label="Governance"
                                    isDark={isDark}
                                    active={isActive("/dashboard/governance")}
                                />
                                <NavItem
                                    href="/dashboard/season"
                                    icon={Gamepad2}
                                    label="Season"
                                    isDark={isDark}
                                    active={isActive("/dashboard/season")}
                                />
                                <NavItem
                                    href="/dashboard/organization"
                                    icon={Building2}
                                    label="Organization"
                                    isDark={isDark}
                                    active={isActive("/dashboard/organization")}
                                />
                            </>
                        ) : (
                            <>
                                <div
                                    className={`text-[10px] font-bold uppercase tracking-widest mb-3 px-3 mt-2 ${isDark ? "text-zinc-500" : "text-zinc-400"
                                        }`}
                                >
                                    My Workspace
                                </div>
                                <NavItem
                                    href="/dashboard"
                                    icon={LayoutDashboard}
                                    label="Dashboard"
                                    isDark={isDark}
                                    active={isActive("/dashboard")}
                                />
                                <NavItem
                                    href="/dashboard/my-schedule"
                                    icon={Calendar}
                                    label="My Schedule"
                                    isDark={isDark}
                                    active={isActive("/dashboard/my-schedule")}
                                />
                                <NavItem
                                    href="/dashboard/my-training"
                                    icon={GraduationCap}
                                    label="My Training"
                                    isDark={isDark}
                                    badge="1 Due"
                                    active={isActive("/dashboard/my-training")}
                                />
                                <NavItem
                                    href="/dashboard/my-cv"
                                    icon={FileText}
                                    label="My CV & Profile"
                                    isDark={isDark}
                                    active={isActive("/dashboard/my-cv")}
                                />
                                <NavItem
                                    href="/dashboard/my-salary"
                                    icon={Banknote}
                                    label="My Salary"
                                    isDark={isDark}
                                    active={isActive("/dashboard/my-salary")}
                                />
                            </>
                        )}

                        <div
                            className={`text-[10px] font-bold uppercase tracking-widest mb-3 px-3 mt-6 ${isDark ? "text-zinc-500" : "text-zinc-400"
                                }`}
                        >
                            Communication
                        </div>
                        <NavItem
                            href="/dashboard/chat"
                            icon={MessageSquare}
                            label="Chat"
                            isDark={isDark}
                            badge="3"
                            active={isActive("/dashboard/chat")}
                        />
                        <NavItem
                            href="/dashboard/ai"
                            icon={Bot}
                            label="Mr. Botsson"
                            isDark={isDark}
                            ai
                            active={isActive("/dashboard/ai")}
                        />
                        <NavItem
                            href="/dashboard/onboarding-assistant"
                            icon={Bot}
                            label="Onboarding Copilot"
                            isDark={isDark}
                            ai
                            active={isActive("/dashboard/onboarding-assistant")}
                        />

                        <div className="mt-8 pt-4 space-y-1">
                            <NavItem
                                href="/dashboard/settings"
                                icon={Settings}
                                label="Settings"
                                isDark={isDark}
                                active={isActive("/dashboard/settings")}
                            />
                            <NavItem
                                href="/dashboard/help"
                                icon={HelpCircle}
                                label="Help"
                                isDark={isDark}
                                active={isActive("/dashboard/help")}
                            />
                        </div>
                    </nav>

                    <div
                        className={`p-4 border-t ${isDark
                            ? "border-zinc-800 bg-[#0a0a0c]"
                            : "border-zinc-200 bg-zinc-50/50"
                            }`}
                    >
                        <button
                            onClick={() => setIsAdminMode(!isAdminMode)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${isAdminMode
                                ? isDark
                                    ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                    : "bg-orange-50 text-orange-600 border-orange-200"
                                : isDark
                                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                                    : "bg-white text-zinc-700 border-zinc-200 shadow-sm"
                                }`}
                        >
                            <span>{isAdminMode ? "Admin Mode" : "Employee Mode"}</span>
                            <div
                                className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${isAdminMode ? "bg-orange-500" : "bg-zinc-400"
                                    }`}
                            >
                                <div
                                    className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${isAdminMode ? "translate-x-4" : "translate-x-0"
                                        }`}
                                />
                            </div>
                        </button>
                    </div>
                </aside>

                {/* MAIN CONTENT AREA */}
                <main
                    className={`flex-1 flex flex-col relative h-full overflow-hidden transition-colors duration-300 ${isDark ? "bg-zinc-950" : "bg-zinc-50"
                        } print:h-auto print:overflow-visible print:bg-white print:block`}
                >
                    {/* ACTION BAR */}
                    <div
                        className={`h-16 border-b flex items-center justify-between px-6 md:px-8 z-10 sticky top-0 transition-colors duration-300 flex-shrink-0 ${isDark
                            ? "border-zinc-900 bg-zinc-950/90"
                            : "border-zinc-200 bg-white/90 shadow-sm backdrop-blur-md"
                            } print:hidden`}
                    >
                        <div
                            className={`flex items-center gap-2.5 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"
                                }`}
                        >
                            <span
                                className={`cursor-pointer transition-colors ${isDark ? "hover:text-zinc-200" : "hover:text-zinc-900"
                                    }`}
                            >
                                {isAdminMode ? "Operations" : "Workspace"}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span
                                className={`font-semibold px-2.5 py-1 rounded-md border shadow-sm capitalize ${isDark
                                    ? "text-zinc-100 bg-zinc-900 border-zinc-800"
                                    : "text-zinc-900 bg-white border-zinc-200"
                                    }`}
                            >
                                {pathname.split("/").pop() || "Dashboard"}
                            </span>
                        </div>

                        <div className="flex items-center gap-5">
                            {/* Schedule page specific controls */}
                            {pathname === "/dashboard/schedule" && isAdminMode && (
                                <>
                                    {/* LOCATION SELECTOR */}
                                    <div className="flex items-center gap-3 mr-4 border-r border-zinc-800/50 pr-6">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 shadow-inner">
                                            <MapPin className="w-4 h-4 text-orange-400" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5 leading-none">Lokasjon</span>
                                            <button className="flex items-center gap-1.5 text-xs font-bold text-white hover:text-orange-400 transition-colors group">
                                                {activeLocation}
                                                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-orange-400 transition-colors" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* VIEW TOGGLES */}
                                    <div className={`hidden xl:flex p-1 rounded-xl shadow-sm border ${isDark ? 'bg-[#0a0a0c] border-zinc-800' : 'bg-zinc-100 border-zinc-200'} mr-2`}>
                                        <button onClick={() => setScheduleView('ansatt')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scheduleView === 'ansatt' ? isDark ? 'bg-zinc-800 text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm' : isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
                                            <Users className={`w-3.5 h-3.5 ${scheduleView === 'ansatt' ? 'text-orange-500' : ''}`} />Ansatt
                                        </button>
                                        <button onClick={() => setScheduleView('jobb')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scheduleView === 'jobb' ? isDark ? 'bg-zinc-800 text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm' : isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
                                            <Briefcase className={`w-3.5 h-3.5 ${scheduleView === 'jobb' ? 'text-orange-500' : ''}`} />Jobb
                                        </button>
                                        <button onClick={() => setScheduleView('team')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scheduleView === 'team' ? isDark ? 'bg-zinc-800 text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm' : isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
                                            <Network className={`w-3.5 h-3.5 ${scheduleView === 'team' ? 'text-orange-500' : ''}`} />Team
                                        </button>
                                    </div>

                                    {/* LAYOUT TOGGLE */}
                                    <div className={`hidden md:flex p-1 rounded-xl shadow-sm border ${isDark ? 'bg-[#0a0a0c] border-zinc-800' : 'bg-zinc-100 border-zinc-200'} mr-2`}>
                                        <button
                                            onClick={() => setScheduleLayout('daily')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scheduleLayout === 'daily' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]' : isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                                        >
                                            Dag-til-dag
                                        </button>
                                        <button
                                            onClick={() => setScheduleLayout('weekly')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scheduleLayout === 'weekly' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]' : isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                                        >
                                            Rullerende (1-10)
                                        </button>
                                        <button
                                            onClick={() => setScheduleLayout('monthly')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scheduleLayout === 'monthly' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]' : isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                                        >
                                            Måned
                                        </button>
                                        <button
                                            onClick={() => setScheduleLayout('list')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scheduleLayout === 'list' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]' : isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                                        >
                                            Vaktliste
                                        </button>
                                    </div>

                                    {/* DATE NAVIGATION */}
                                    <div className={`flex items-center gap-2 rounded-xl border p-1 pr-3 ${isDark ? 'bg-[#0a0a0c] border-zinc-800' : 'bg-zinc-100 border-zinc-200'} mr-2`}>
                                        <button className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200'}`}><ChevronLeft className="w-3.5 h-3.5" /></button>
                                        <span className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                            {scheduleLayout === 'daily' ? 'Uke 52, 2026' : scheduleLayout === 'weekly' ? 'Aktiv syklus' : 'Desember 2026'}
                                        </span>
                                        <button className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200'}`}><ChevronRight className="w-3.5 h-3.5" /></button>
                                    </div>

                                    <button className="bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white text-[13px] font-bold px-4 py-1.5 rounded-lg shadow-sm transition-all hidden sm:block mr-2">
                                        Publiser (4)
                                    </button>
                                </>
                            )}

                            {/* Tactical/Strategic Switcher (Only on Dashboard) */}
                            {isDashboardPage && isAdminMode && (
                                <div className={`hidden md:flex p-1 rounded-xl shadow-sm border ${isDark ? 'bg-[#0a0a0c] border-zinc-800' : 'bg-zinc-100 border-zinc-200'} mr-2`}>
                                    <button
                                        onClick={() => setAdminView("tactical")}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${adminView === "tactical"
                                            ? isDark
                                                ? 'bg-zinc-800 text-white shadow-sm'
                                                : 'bg-white text-zinc-900 shadow-sm'
                                            : isDark
                                                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'
                                            }`}
                                    >
                                        Tactical
                                    </button>
                                    <button
                                        onClick={() => setAdminView("strategic")}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${adminView === "strategic"
                                            ? isDark
                                                ? 'bg-zinc-800 text-white shadow-sm'
                                                : 'bg-white text-zinc-900 shadow-sm'
                                            : isDark
                                                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'
                                            }`}
                                    >
                                        Strategic
                                    </button>
                                    <button
                                        onClick={() => setAdminView("reconciliation")}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${adminView === "reconciliation"
                                            ? isDark
                                                ? 'bg-zinc-800 text-white shadow-sm'
                                                : 'bg-white text-zinc-900 shadow-sm'
                                            : isDark
                                                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'
                                            }`}
                                    >
                                        Avstemming
                                    </button>
                                    <button
                                        onClick={() => setAdminView("activity")}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${adminView === "activity"
                                            ? isDark
                                                ? 'bg-zinc-800 text-white shadow-sm'
                                                : 'bg-white text-zinc-900 shadow-sm'
                                            : isDark
                                                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'
                                            }`}
                                    >
                                        Aktivitet
                                    </button>
                                </div>
                            )}

                            {/* Standard Search Bar, hidden on schedule page where we want more room */}
                            {pathname !== "/dashboard/schedule" && (
                                <div className="relative group">
                                    <Search
                                        className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isDark
                                            ? "text-zinc-500 group-focus-within:text-orange-500"
                                            : "text-zinc-400 group-focus-within:text-orange-600"
                                            }`}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Search operations..."
                                        className={`border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 w-64 transition-all shadow-sm ${isDark
                                            ? "bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/50 focus:ring-orange-500/50 hover:bg-zinc-800/80"
                                            : "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500/50 focus:ring-orange-500/50 hover:bg-zinc-50"
                                            }`}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <DashboardContext.Provider value={{
                        isAdminMode, setIsAdminMode,
                        isDark, setIsDark,
                        adminView, setAdminView,
                        scheduleLayout, setScheduleLayout,
                        scheduleView, setScheduleView,
                        activeLocation, setActiveLocation,
                        workspaceData: {
                            workspace_id: "wksp_123",
                            company_id: "comp_123",
                            name: "Bårdshaug Vegkro"
                        }
                    }}>
                        <div className="flex-1 overflow-hidden p-6 md:p-8 flex flex-col min-h-0 print:p-0 print:overflow-visible print:block print:h-auto">
                            {children}
                        </div>
                    </DashboardContext.Provider>
                </main>
            </div>

            {/* Floating Voice Assistant removed and moved to header */}
        </div>
    );
}

interface NavItemProps {
    icon: React.ElementType;
    label: string;
    href: string;
    active?: boolean;
    badge?: string;
    isDark?: boolean;
    ai?: boolean;
}

function NavItem({
    icon: Icon,
    label,
    href,
    active,
    badge,
    isDark,
    ai,
}: NavItemProps) {
    return (
        <Link
            href={href}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${active
                ? isDark
                    ? "bg-zinc-800/80 text-white font-semibold border border-zinc-700/50"
                    : "bg-zinc-100 text-zinc-900 font-bold border border-zinc-200/50"
                : isDark
                    ? "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50 border border-transparent"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border border-transparent"
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon
                    className={`w-[18px] h-[18px] transition-colors ${ai
                        ? "text-indigo-500 group-hover:text-indigo-400"
                        : active
                            ? isDark
                                ? "text-zinc-200"
                                : "text-zinc-800"
                            : isDark
                                ? "text-zinc-500 group-hover:text-zinc-400"
                                : "text-zinc-400 group-hover:text-zinc-600"
                        }`}
                />
                <span
                    className={`text-[13px] tracking-wide ${active ? "font-bold" : "font-medium"
                        }`}
                >
                    {label}
                </span>
            </div>
            {active && !badge && (
                <div
                    className={`w-1.5 h-1.5 rounded-full ${isDark
                        ? "bg-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.8)]"
                        : "bg-orange-500 shadow-sm"
                        }`}
                />
            )}
            {badge && (
                <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded border ${isDark
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        : "bg-orange-50 text-orange-600 border-orange-200"
                        }`}
                >
                    {badge}
                </span>
            )}
        </Link>
    );
}
