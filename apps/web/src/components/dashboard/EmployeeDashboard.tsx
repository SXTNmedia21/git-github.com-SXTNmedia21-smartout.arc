"use client";

import {
    Calendar,
    CheckCircle2,
    Clock,
    Zap,
    Coffee,
    CalendarPlus,
    ArrowRightLeft,
    ChevronRight,
    MapPin,
    ListTodo
} from "lucide-react";

interface EmployeeDashboardProps {
    isDark: boolean;
}

export default function EmployeeDashboard({ isDark }: EmployeeDashboardProps) {
    return (
        <div className="flex-1 flex flex-col h-full z-10 w-full overflow-hidden">

            {/* Header section */}
            <div className="mb-6 flex-shrink-0">
                <h1 className={`text-3xl font-extrabold tracking-tight mb-2 flex items-center gap-3 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    My Workspace
                </h1>
                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Your upcoming shifts, tasks, and quick actions at Bårdshaug Vegkro.
                </p>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">

                {/* Left Column: Shifts */}
                <div className="lg:col-span-2 flex flex-col gap-6 h-full min-h-0">

                    {/* Today's Shift */}
                    <div className="relative group flex-shrink-0">
                        {/* Glow effect */}
                        <div className={`absolute -inset-0.5 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 ${isDark ? 'bg-gradient-to-r from-orange-500 to-indigo-500' : 'bg-gradient-to-r from-orange-400 to-indigo-400'}`} />

                        <div className={`relative p-6 rounded-2xl border shadow-lg ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-orange-500/10 border ${isDark ? 'text-orange-400 border-orange-500/20' : 'text-orange-600 border-orange-200'}`}>
                                    Today&apos;s Shift
                                </div>
                                <div className={`flex items-center gap-2 text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                    <Calendar className="w-4 h-4" />
                                    Wed, Feb 26
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className={`w-16 h-16 rounded-2xl border flex flex-col items-center justify-center ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                                    <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>15</span>
                                    <span className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Feb</span>
                                </div>

                                <div className="flex-1">
                                    <h2 className={`text-2xl font-black mb-1 ${isDark ? 'text-white' : 'text-zinc-900'}`}>Service • Evening</h2>
                                    <div className={`flex items-center gap-4 text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                        <div className="flex items-center gap-1.5 text-orange-500">
                                            <Clock className="w-4 h-4" />
                                            15:00 - 23:30 (8.5h)
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="w-4 h-4" />
                                            Main Restaurant
                                        </div>
                                    </div>
                                </div>

                                <button className={`w-32 py-3 rounded-xl font-bold text-sm shadow-md transition-all hover:scale-105 active:scale-95 ${isDark ? 'bg-white text-zinc-900 hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>
                                    Punch In
                                </button>
                            </div>

                            {/* Shift Details/Tasks Preview */}
                            <div className={`mt-6 pt-5 border-t border-dashed ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                                <h3 className={`text-xs font-bold uppercase tracking-wide mb-3 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Shift Colleagues</h3>
                                <div className="flex flex-wrap gap-2">
                                    {['Kari (Shift Lead)', 'Per', 'Jon', 'Morten (Bar)'].map((name, i) => (
                                        <div key={i} className={`flex items-center justify-center px-3 py-1.5 rounded-lg border text-xs font-semibold ${isDark ? 'bg-zinc-900/50 border-zinc-800 text-zinc-300' : 'bg-zinc-50 border-zinc-200 text-zinc-700'}`}>
                                            {name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Upcoming Schedule list */}
                    <div className={`flex-1 flex flex-col p-5 rounded-2xl border shadow-sm min-h-0 ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className={`text-lg font-extrabold ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>Upcoming Schedule</h3>
                            <button className={`text-sm font-bold flex items-center gap-1 ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}`}>
                                View Full Calendar <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col gap-3 min-h-0">
                            {[
                                { date: 'Thu, Feb 27', time: '15:00 - 23:30', role: 'Service • Evening', type: 'regular' },
                                { date: 'Fri, Feb 28', time: '17:00 - 01:00', role: 'Bar • Event', type: 'event' },
                            ].map((shift, i) => (
                                <div key={i} className={`flex-1 flex items-center p-3 rounded-xl border transition-colors group cursor-pointer ${isDark ? 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800/80 hover:border-zinc-700' : 'bg-zinc-50/50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300'}`}>
                                    <div className={`w-14 items-center flex flex-col justify-center border-r pr-3 mr-3 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                                        <span className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{shift.date.split(',')[0]}</span>
                                        <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{shift.date.split(' ')[2]}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                                            {shift.role}
                                            {shift.type === 'event' && <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded border ${isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>Event</span>}
                                        </h4>
                                        <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{shift.time}</p>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Right Column: Actions & Open Shifts */}
                <div className="flex flex-col gap-6 h-full min-h-0">

                    {/* Quick Actions Grid */}
                    <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                        <button className={`col-span-2 flex items-center justify-between p-4 rounded-xl border shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] group ${isDark ? 'bg-gradient-to-br from-indigo-900/40 to-indigo-900/10 border-indigo-500/30' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-200'} `}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-500/20' : 'bg-white shadow-sm'}`}>
                                    <CalendarPlus className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                                </div>
                                <div className="text-left">
                                    <div className={`text-sm font-bold ${isDark ? 'text-indigo-100' : 'text-indigo-900'}`}>Set Availability</div>
                                    <div className={`text-[10px] font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-600/70'}`}>For coming weeks</div>
                                </div>
                            </div>
                            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${isDark ? 'text-indigo-400' : 'text-indigo-400'}`} />
                        </button>

                        <button className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1 ${isDark ? 'bg-[#0c0c0e] border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-md'}`}>
                            <Coffee className={`w-5 h-5 ${isDark ? 'text-orange-500' : 'text-orange-500'}`} />
                            <span className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Time Off</span>
                        </button>

                        <button className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1 ${isDark ? 'bg-[#0c0c0e] border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-md'}`}>
                            <ArrowRightLeft className={`w-5 h-5 ${isDark ? 'text-blue-500' : 'text-blue-500'}`} />
                            <span className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Swap Shift</span>
                        </button>
                    </div>

                    {/* Open Shifts Banner */}
                    <div className={`flex-shrink-0 p-5 rounded-2xl border shadow-sm relative overflow-hidden ${isDark ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 ${isDark ? 'bg-emerald-500' : 'bg-emerald-400'}`} />

                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-1.5 rounded-md ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-200'}`}>
                                <Zap className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                            </div>
                            <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-emerald-500' : 'text-emerald-700'}`}>Open Shifts</h3>
                        </div>

                        <p className={`text-xs font-semibold mb-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            There are <b className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>2 shifts</b> available matching your skills.
                        </p>

                        <div className="space-y-2">
                            <div className={`p-3 rounded-lg border text-sm flex justify-between items-center ${isDark ? 'bg-black/20 border-emerald-900/50 hover:bg-black/40' : 'bg-white border-emerald-100 hover:shadow-sm'} cursor-pointer transition-all`}>
                                <div>
                                    <div className={`font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>Sat, Mar 1</div>
                                    <div className={`text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>15:00 - 23:30 • Service</div>
                                </div>
                                <button className={`text-xs font-bold px-3 py-1.5 rounded border ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}>Take Shift</button>
                            </div>
                        </div>
                    </div>

                    {/* Ongoing Tasks Context */}
                    <div className={`flex-1 p-5 rounded-2xl border flex flex-col min-h-0 ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                        <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>
                            <ListTodo className="w-4 h-4 text-purple-500" /> My Active Tasks
                        </h3>

                        <div className={`flex-1 flex items-center justify-center p-6 border-2 border-dashed rounded-xl overflow-hidden ${isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-zinc-200 bg-zinc-50'}`}>
                            <div className="text-center">
                                <CheckCircle2 className={`w-8 h-8 mx-auto mb-2 opacity-20 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
                                <p className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>No active task lists.<br />Punch in to get your tasks.</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
