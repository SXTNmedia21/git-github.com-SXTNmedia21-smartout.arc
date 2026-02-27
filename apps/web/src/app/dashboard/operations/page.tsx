"use client";

import { useContext } from "react";
import { DashboardContext } from "@/app/dashboard/layout";
import { Percent, Gauge, Clock, Users, Activity, AlertCircle } from "lucide-react";

export default function OperationsPage() {
    const { isDark } = useContext(DashboardContext);

    return (
        <div className="flex-1 overflow-y-auto px-10 pt-8 pb-20 custom-scrollbar z-10">
            <div className="mb-6">
                <h1 className={`text-3xl font-extrabold tracking-tight mb-2 flex items-center gap-3 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    Active Pipeline
                    <span className="text-xs font-bold bg-orange-500/10 text-orange-600 px-2 py-1 rounded uppercase tracking-wider border border-orange-500/20">LIVE</span>
                </h1>
                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Real-time status of today&apos;s operational department sessions.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                {/* Task Percentage */}
                <MetricCard isDark={isDark} title="Completion" value="68%" sub="15 / 22 tasks done" icon={Percent} color="text-emerald-500" bg={isDark ? "bg-emerald-500/10" : "bg-emerald-50"} border={isDark ? "border-emerald-500/20" : "border-emerald-200"} />
                {/* Stress Level */}
                <MetricCard isDark={isDark} title="Stress Level" value="High" sub="85% capacity. 1 short." icon={Gauge} color="text-red-500" bg={isDark ? "bg-red-500/10" : "bg-red-50"} border={isDark ? "border-red-500/20" : "border-red-200"} pulse />
                {/* Overdue Tasks */}
                <MetricCard isDark={isDark} title="Overdue Tasks" value="2" sub="Requires attention" icon={AlertCircle} color="text-orange-500" bg={isDark ? "bg-orange-500/10" : "bg-orange-50"} border={isDark ? "border-orange-500/20" : "border-orange-200"} />
                {/* Upcoming Tasks */}
                <MetricCard isDark={isDark} title="Upcoming Tasks" value="5" sub="Next 2 hours" icon={Clock} color="text-blue-500" bg={isDark ? "bg-blue-500/10" : "bg-blue-50"} border={isDark ? "border-blue-500/20" : "border-blue-200"} />
                {/* Staff Checked In */}
                <MetricCard isDark={isDark} title="Staff Present" value="4 / 5" sub="Anna, Erik, Lise, Ole" icon={Users} color="text-purple-500" bg={isDark ? "bg-purple-500/10" : "bg-purple-50"} border={isDark ? "border-purple-500/20" : "border-purple-200"} />
                {/* Active Tasks */}
                <MetricCard isDark={isDark} title="Tasks Out" value="8" sub="Currently pending" icon={Activity} color="text-zinc-500" bg={isDark ? "bg-zinc-800" : "bg-zinc-100"} border={isDark ? "border-zinc-700" : "border-zinc-200"} />
            </div>

            <div className={`p-6 rounded-2xl border shadow-sm flex flex-col ${isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className={`text-xl font-extrabold ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>Register vs Staff Cost (Hour by Hour)</h2>
                        <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Live comparison of revenue generated against active payroll costs.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                            <span className={`text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Revenue</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-red-400" />
                            <span className={`text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Staff Cost</span>
                        </div>
                    </div>
                </div>

                {/* Mock Bar Chart */}
                <div className="flex items-end gap-2 h-64 mt-4 relative">
                    <div className={`absolute top-0 w-full border-t border-dashed ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`} />
                    <div className={`absolute top-1/4 w-full border-t border-dashed ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`} />
                    <div className={`absolute top-2/4 w-full border-t border-dashed ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`} />
                    <div className={`absolute top-3/4 w-full border-t border-dashed ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`} />

                    {[
                        { time: "10:00", rev: "30%", cost: "40%" },
                        { time: "11:00", rev: "45%", cost: "40%" },
                        { time: "12:00", rev: "85%", cost: "50%" },
                        { time: "13:00", rev: "95%", cost: "60%" },
                        { time: "14:00", rev: "60%", cost: "50%" },
                        { time: "15:00", rev: "35%", cost: "40%" },
                        { time: "16:00", rev: "10%", cost: "20%", future: true },
                        { time: "17:00", rev: "0%", cost: "0%", future: true },
                        { time: "18:00", rev: "0%", cost: "0%", future: true },
                    ].map((col, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group z-10 hover:bg-zinc-500/5 transition-colors rounded-xl pt-2 pb-1 relative">
                            <div className="flex items-end gap-1.5 w-full h-48 justify-center hover:opacity-100 opacity-90 transition-opacity">
                                <div
                                    className={`w-1/3 rounded-t-md transition-all shadow-sm ${col.future ? (isDark ? 'bg-emerald-900/20 border border-emerald-900/30' : 'bg-emerald-100/50 border border-emerald-200/50') : 'bg-emerald-500 group-hover:bg-emerald-400'}`}
                                    style={{ height: col.rev }}
                                />
                                <div
                                    className={`w-1/3 rounded-t-md transition-all shadow-sm ${col.future ? (isDark ? 'bg-red-900/20 border border-red-900/30' : 'bg-red-100/50 border border-red-200/50') : 'bg-red-400 group-hover:bg-red-300'}`}
                                    style={{ height: col.cost }}
                                />
                            </div>
                            <span className={`text-xs font-bold ${isDark ? 'text-zinc-500 group-hover:text-zinc-300' : 'text-zinc-400 group-hover:text-zinc-700'}`}>{col.time}</span>

                            {/* Hover tooltip conceptual */}
                            <div className="absolute -top-10 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl">
                                Rev: {col.rev} | Cost: {col.cost}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

interface MetricCardProps {
    title: string;
    value: React.ReactNode;
    sub: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    pulse?: boolean;
    isDark?: boolean;
}

function MetricCard({ title, value, sub, icon: Icon, color, bg, border, pulse, isDark }: MetricCardProps) {
    return (
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between transition-all ${isDark ? 'bg-[#121216] border-zinc-800/80 hover:bg-[#18181b]' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-md'}`}>
            <div className="flex justify-between items-start mb-3">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{title}</h3>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${bg} ${border}`}>
                    <Icon className={`w-4 h-4 ${color} ${pulse ? 'animate-pulse' : ''}`} />
                </div>
            </div>
            <div>
                <div className={`text-2xl font-black tracking-tight leading-none mb-1.5 ${isDark ? 'text-white' : 'text-zinc-900'}`}>{value}</div>
                <div className={`text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{sub}</div>
            </div>
        </div>
    );
}
