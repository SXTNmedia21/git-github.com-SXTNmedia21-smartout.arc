"use client";

import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Activity, CheckCircle2, Target, BarChart3, Database, ShieldCheck, Zap, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function LokasjonerPage() {
    const router = useRouter();
    const stats = [
        { label: "Active Locations", value: "142", icon: MapPin, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
        { label: "Registered Zones", value: "854", icon: Target, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
        { label: "Checkpoints", value: "12,450", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
        { label: "Total Tasks", value: "1.2M", icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
        { label: "Active Routines", value: "45,000", icon: BarChart3, color: "text-fuchsia-400", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20" },
        { label: "Procedures", value: "340", icon: Database, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
        { label: "Live Policies", value: "12", icon: ShieldCheck, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
        { label: "Automations", value: "2,840", icon: Zap, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 sm:p-6 md:p-12 pt-24 md:pt-28 selection:bg-orange-500/30">
            <Navigation />

            <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12">
                <ArrowLeft className="w-5 h-5" />
                Tilbake til forside
            </button>

            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col items-center text-center gap-6 mb-16">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-orange-500 to-rose-500 p-[1px] shadow-[0_0_50px_-10px_rgba(249,115,22,0.4)]">
                        <div className="w-full h-full bg-[#0a0a0c] rounded-[23px] flex items-center justify-center">
                            <Activity className="w-10 h-10 text-white drop-shadow-lg" />
                        </div>
                    </div>
                    <div className="max-w-3xl">
                        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight">Kapasitet & Datavolum</h1>
                        <p className="text-zinc-400 text-xl leading-relaxed">Et glimt av sanntidsdata for lokasjonene dine. Bygget for enorm skala og uendelig detaljstyring – uansett hvor stor du blir.</p>
                    </div>
                </div>

                {/* Score Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-8 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] pointer-events-none"></div>
                        <h2 className="text-zinc-400 font-bold uppercase tracking-widest text-sm mb-2">Daily Quality Score</h2>
                        <div className="flex items-end gap-4">
                            <span className="text-7xl font-black text-white tracking-tighter">98.4<span className="text-4xl text-emerald-400">%</span></span>
                            <div className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-full mb-2">
                                <TrendingUp className="w-4 h-4" /> +2.1%
                            </div>
                        </div>
                        <div className="mt-8 flex gap-2">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className={`h-2 flex-1 rounded-full ${i < 9 ? 'bg-emerald-500' : 'bg-zinc-800'}`}></div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-8 relative overflow-hidden flex flex-col justify-center"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] pointer-events-none"></div>
                        <h2 className="text-zinc-400 font-bold uppercase tracking-widest text-sm mb-2">Success Rate (All Locations)</h2>
                        <div className="flex items-center gap-6">
                            <div className="w-32 h-32 rounded-full border-[12px] border-zinc-800 relative flex items-center justify-center">
                                <svg className="absolute inset-0 w-full h-full -rotate-90">
                                    <circle cx="64" cy="64" r="52" fill="none" stroke="currentColor" strokeWidth="12" className="text-blue-500" strokeDasharray="326" strokeDashoffset="5" strokeLinecap="round" />
                                </svg>
                                <span className="text-3xl font-black text-white relative z-10">99<span className="text-xl text-zinc-400">%</span></span>
                            </div>
                            <div className="flex flex-col gap-4 flex-1">
                                <div>
                                    <span className="text-white font-bold block">1,198,000</span>
                                    <span className="text-xs text-zinc-500 font-medium uppercase">Tasks Completed</span>
                                </div>
                                <div>
                                    <span className="text-red-400 font-bold block">2,000</span>
                                    <span className="text-xs text-zinc-500 font-medium uppercase">Missed/Overdue</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Grid of stats */}
                <div className="grid grid-cols-2 md:grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.map((stat, i) => (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 + (i * 0.05) }}
                            key={i}
                            className={`p-6 rounded-3xl border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl flex flex-col items-center justify-center text-center hover:-translate-y-1 transition-transform`}
                        >
                            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.border} border flex items-center justify-center mb-4`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">{stat.label}</h3>
                            <span className="text-3xl font-black text-white">{stat.value}</span>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <p className="text-zinc-500 font-medium tracking-wide uppercase text-xs">All metrics represent cross-location aggregated data in real-time</p>
                </div>

                <NextPageBanner
                    href="/concepts/procedures"
                    title="Prosedyrer & Arbeidsflyt"
                    subtitle="Neste Konsept"
                    color="from-rose-500/10"
                />
            </div>
        </div>
    );
}
