"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Leaf, Snowflake, Sun, CalendarRange, ToggleRight, Info, Sparkles, Target } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function SesongerPage() {
    const router = useRouter();
    const [selected, setSelected] = useState(1);

    const seasons = [
        { id: 1, name: "Sommermeny", icon: Sun, color: "text-amber-400", bg: "bg-amber-500/10", border: 'border-amber-500/20', glow: 'shadow-[0_0_50px_-10px_rgba(251,191,36,0.3)]' },
        { id: 2, name: "Høstmeny", icon: Leaf, color: "text-orange-400", bg: "bg-orange-500/10", border: 'border-orange-500/20', glow: 'shadow-[0_0_50px_-10px_rgba(249,115,22,0.3)]' },
        { id: 3, name: "Julebordsesong", icon: Snowflake, color: "text-cyan-400", bg: "bg-cyan-500/10", border: 'border-cyan-500/20', glow: 'shadow-[0_0_50px_-10px_rgba(34,211,238,0.3)]' },
    ];

    const currentSeason = seasons.find(s => s.id === selected)!;

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 sm:p-6 md:p-12 pt-24 md:pt-28 selection:bg-amber-500/30">
            <Navigation />

            <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12">
                <ArrowLeft className="w-5 h-5" />
                Tilbake til forside
            </button>

            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-16">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-orange-500 p-[1px] shadow-[0_0_50px_-10px_rgba(251,191,36,0.4)] relative">
                            <div className="absolute -top-3 -right-3 bg-fuchsia-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1 shadow-[0_0_15px_rgba(217,70,239,0.5)] z-20">
                                <Sparkles className="w-3 h-3" /> 100% Unikt
                            </div>
                            <div className="w-full h-full bg-[#0a0a0c] rounded-[23px] flex items-center justify-center relative z-10">
                                <CalendarRange className="w-10 h-10 text-white drop-shadow-lg" />
                            </div>
                        </div>
                        <div className="max-w-xl">
                            <h1 className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tight">Sesonger</h1>
                            <p className="text-zinc-400 text-lg leading-relaxed">Et konsept <strong className="text-amber-400 font-bold">100% unikt for SmartOut</strong>. Endre hundrevis av menyer, policyer og rutiner på sekundet, basert på hvilken sesong restauranten din er i.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Visualizer */}
                    <div className="lg:col-span-2 relative bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 overflow-hidden flex flex-col min-h-[500px] shadow-[0_0_50px_-15px_rgba(251,191,36,0.15)]">
                        <div className={`absolute top-0 inset-x-0 h-1 transition-colors duration-1000 ${currentSeason.bg.replace('/10', '')}`}></div>

                        <div className="flex gap-4 mb-12 overflow-x-auto pb-4 custom-scrollbar z-10">
                            {seasons.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelected(s.id)}
                                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all duration-300 min-w-max ${selected === s.id ? `${s.bg} ${s.border} ${s.glow}` : 'bg-black/30 border-white/5 opacity-60 hover:opacity-100'}`}
                                >
                                    <s.icon className={`w-6 h-6 ${selected === s.id ? s.color : 'text-zinc-500'}`} />
                                    <span className={`font-bold text-lg ${selected === s.id ? 'text-white' : 'text-zinc-400'}`}>{s.name}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 flex flex-col justify-center relative z-10">
                            <motion.div
                                key={selected}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4 }}
                                className="flex flex-col items-center justify-center text-center p-12 border border-white/5 rounded-[2rem] bg-black/40 shadow-inner relative overflow-hidden"
                            >
                                <div className={`absolute inset-0 ${currentSeason.bg} opacity-20 blur-3xl`}></div>
                                <currentSeason.icon className={`w-24 h-24 mb-6 ${currentSeason.color} relative z-10 drop-shadow-[0_0_25px_rgba(251,191,36,0.5)]`} />
                                <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 relative z-10 uppercase tracking-tight">{currentSeason.name} Aktiv</h2>
                                <p className="text-zinc-300 max-w-md mx-auto mb-8 relative z-10 text-lg leading-relaxed">
                                    Akkurat nå har <strong>{currentSeason.name.toLowerCase()}</strong>-protokollene fortrengt alle standardoppgaver. Appen har automatisk byttet ut alt innhold for samtlige ansatte.
                                </p>
                                <div className="flex items-center gap-3 bg-emerald-500/20 border border-emerald-500/50 px-6 py-3 rounded-full text-emerald-400 font-bold relative z-10 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
                                    <ToggleRight className="w-5 h-5" /> 84 Rutiner Modifisert
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Features checklist */}
                    <div className="flex flex-col gap-6">
                        {[
                            { title: "SmartOut Eksklusiv", desc: "Ingen andre systemer tilbyr denne graden av fleksibilitet. Ett klikk endrer hele bedriftens maskineri for en ny årstid.", icon: Target, isPrimary: true },
                            { title: "Aktiver via knapp", desc: "Høstmeny? Sommertid? Bytt meny og rengjøringsrutiner synkront over hele organisasjonen umiddelbart.", icon: ToggleRight },
                            { title: "Gjenbruk og kopier", desc: "Var fjorårets sommerrutiner bra? Gjenbruk og kopier over til nytt år, så er du klar på sekunder.", icon: Info },
                        ].map((feat, i) => (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * (i + 1) }}
                                key={i}
                                className={`bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/5 border-l-4 ${feat.isPrimary ? 'border-l-fuchsia-500 bg-fuchsia-500/5' : 'border-l-amber-500'} rounded-2xl p-6 group transition-all shadow-lg`}
                            >
                                <div className="flex gap-4 items-start">
                                    <feat.icon className={`w-6 h-6 flex-shrink-0 ${feat.isPrimary ? 'text-fuchsia-400' : 'text-amber-500/50'}`} />
                                    <div>
                                        <h3 className={`text-lg font-bold mb-2 ${feat.isPrimary ? 'text-fuchsia-400' : 'text-white'}`}>{feat.title}</h3>
                                        <p className="text-sm font-medium text-zinc-400 leading-relaxed">{feat.desc}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <NextPageBanner
                    href="/concepts/daily-session"
                    title="Den Daglige Økten"
                    subtitle="Neste Konsept"
                    color="from-cyan-500/10"
                />
            </div>
        </div>
    );
}
