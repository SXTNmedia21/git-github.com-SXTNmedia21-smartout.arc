"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, History, FileText, Fingerprint, Fingerprint as FingerprintIcon, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function TimeforingPage() {
    const router = useRouter();
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [currentTime, setCurrentTime] = useState("");
    const [elapsedTime, setElapsedTime] = useState("00:00:00");
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    useEffect(() => {
        const updateTime = () => {
            setCurrentTime(new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!isClockedIn) return;

        let seconds = 0;
        const interval = setInterval(() => {
            seconds++;
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            setElapsedTime([h, m, s].map(v => v.toString().padStart(2, '0')).join(':'));
        }, 1000);

        return () => clearInterval(interval);
    }, [isClockedIn]);

    const handlePunch = () => {
        setIsAuthenticating(true);
        setTimeout(() => {
            setIsAuthenticating(false);
            setIsClockedIn(!isClockedIn);
            if (isClockedIn) setElapsedTime("00:00:00");
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 sm:p-6 md:p-12 pt-24 md:pt-28 selection:bg-blue-500/30">
            <Navigation />

            <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12">
                <ArrowLeft className="w-5 h-5" />
                Tilbake til forside
            </button>

            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 p-[1px] shadow-[0_0_30px_-5px_rgba(59,130,246,0.4)]">
                        <div className="w-full h-full bg-[#111] rounded-2xl flex items-center justify-center">
                            <Clock className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-black text-white">Timeføring & Stemplingsur</h1>
                        <p className="text-zinc-400 text-lg">GPS-sikker innstempling via personlig enhet eller ansattpanel</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Punch Clock Widget Mockup */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-12 shadow-[0_0_50px_-15px_rgba(59,130,246,0.2)] flex flex-col items-center justify-center text-center overflow-hidden min-h-[500px]"
                    >
                        <div className={`absolute inset-0 transition-opacity duration-1000 blur-3xl ${isClockedIn ? 'bg-emerald-500/10' : 'bg-blue-500/5'}`}></div>

                        <div className="relative z-10 w-full flex flex-col items-center">
                            <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm mb-4">Lokal Tid Oslo</p>
                            <h2 className="text-6xl sm:text-7xl font-black text-white tracking-tight mb-12 tabular-nums">
                                {currentTime}
                            </h2>

                            {isClockedIn && (
                                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 flex flex-col items-center">
                                    <div className="px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-sm font-bold flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Aktivt skift
                                    </div>
                                    <p className="text-3xl font-bold font-mono text-emerald-100">{elapsedTime}</p>
                                </motion.div>
                            )}

                            <button
                                onClick={handlePunch}
                                disabled={isAuthenticating}
                                className={`group relative w-48 h-48 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl transition-all duration-300
                                ${isAuthenticating ? 'border-zinc-700 bg-zinc-800' :
                                        isClockedIn
                                            ? 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-500 disabled:opacity-50'
                                            : 'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 shadow-[0_0_50px_-10px_rgba(59,130,246,0.5)]'}
                                `}
                            >
                                {isAuthenticating ? (
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="absolute inset-0 rounded-full border-t-2 border-r-2 border-white/50"></motion.div>
                                ) : (
                                    <div className={`absolute inset-0 rounded-full blur-xl scale-75 opacity-50 group-hover:scale-95 transition-transform duration-500 ${isClockedIn ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                )}

                                <div className="z-10 flex flex-col items-center gap-3">
                                    {isAuthenticating ? (
                                        <FingerprintIcon className="w-12 h-12 text-white/50 animate-pulse" />
                                    ) : (
                                        <Fingerprint className={`w-12 h-12 ${isClockedIn ? 'text-red-400' : 'text-blue-400'}`} />
                                    )}
                                    <span className={`font-black uppercase tracking-widest text-sm ${isAuthenticating ? 'text-white/50' : 'text-white'}`}>
                                        {isAuthenticating ? 'Verifiserer...' : isClockedIn ? "Stemple ut" : "Stemple inn"}
                                    </span>
                                </div>
                            </button>

                            {!isClockedIn && !isAuthenticating && (
                                <p className="mt-8 text-sm text-zinc-500 font-medium flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> GPS Posisjon Verifisert (Restaurant)
                                </p>
                            )}
                        </div>
                    </motion.div>

                    {/* Report / History Widget Mockup */}
                    <div className="flex flex-col gap-6">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-8 flex-1 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-xl text-white flex items-center gap-2">
                                    <History className="w-5 h-5 text-blue-400" /> Tidslogg
                                </h3>
                                <button className="text-sm font-bold text-zinc-400 hover:text-white transition-colors">Se alle</button>
                            </div>

                            <div className="flex flex-col gap-4 flex-1">
                                {[
                                    { date: "I går", in: "15:58", out: "23:15", hours: "7t 17m", status: "Godkjent" },
                                    { date: "Mandag", in: "14:02", out: "22:00", hours: "7t 58m", status: "Godkjent" },
                                    { date: "Fredag", in: "16:05", out: "02:30", hours: "10t 25m", status: "Venter godkjenning" }
                                ].map((log, i) => (
                                    <div key={i} className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-zinc-300 mb-1">{log.date}</span>
                                            <div className="flex gap-2 text-xs font-bold text-zinc-500 bg-zinc-900 px-2 py-1 rounded w-fit">
                                                <span>Inn {log.in}</span>
                                                <span>•</span>
                                                <span>Ut {log.out}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end text-sm">
                                            <span className="font-bold text-white mb-1">{log.hours}</span>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${log.status === 'Godkjent' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                {log.status === 'Godkjent' ? <CheckCircle2 className="inline w-3 h-3 mr-1" /> : null}
                                                {log.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-indigo-900/20 border border-indigo-500/30 rounded-[2rem] p-8 hover:bg-indigo-900/30 transition-colors cursor-pointer group"
                        >
                            <div className="flex items-start justify-between">
                                <FileText className="w-8 h-8 text-indigo-400 group-hover:scale-110 transition-transform" />
                                <div className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full uppercase tracking-widest border border-indigo-500/50">Nyhet</div>
                            </div>
                            <h3 className="font-bold text-xl text-white mt-4 mb-2">Automatiske Tillegg</h3>
                            <p className="text-sm text-indigo-200 leading-relaxed font-medium">Systemet legger automatisk til kvelds- og nattillegg basert på din tariff og arbeidstid.</p>
                        </motion.div>
                    </div>
                </div>

                <NextPageBanner
                    href="/features/communications"
                    title="Kommunikasjon"
                    subtitle="Neste Funksjon"
                    color="from-violet-500/10"
                />
            </div>
        </div>
    );
}
