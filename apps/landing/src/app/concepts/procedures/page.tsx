"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Key, ClipboardList, CheckCircle2, Clock, AlertTriangle, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function ProsedyrerPage() {
    const router = useRouter();
    const tasks = [
        { id: 1, title: "Slå på ventilasjon & lys", time: "06:00", count: 1, completed: 1, status: "done" },
        { id: 2, title: "Temperaturkontroll kjølerom", time: "06:15", count: 2, completed: 2, status: "done" },
        { id: 3, title: "Fylle på kaffemaskiner", time: "06:30", count: 1, completed: 0, status: "active" },
        { id: 4, title: "Mottak av ferske brødvarer", time: "07:00", count: 1, completed: 0, status: "pending" },
        { id: 5, title: "Oppdatere dagens meny-tavle", time: "07:30", count: 1, completed: 0, status: "pending" }
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 sm:p-6 md:p-12 pt-24 md:pt-28 selection:bg-rose-500/30">
            <Navigation />

            <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12">
                <ArrowLeft className="w-5 h-5" />
                Tilbake til forside
            </button>

            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col items-center text-center gap-6 mb-16">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-500 to-pink-500 p-[1px] shadow-[0_0_50px_-10px_rgba(244,63,94,0.4)]">
                        <div className="w-full h-full bg-[#0a0a0c] rounded-[23px] flex items-center justify-center">
                            <ClipboardList className="w-10 h-10 text-white drop-shadow-lg" />
                        </div>
                    </div>
                    <div className="max-w-3xl">
                        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight">Prosedyrer & Arbeidsflyt</h1>
                        <p className="text-zinc-400 text-xl leading-relaxed">Byggeklossene i SmartOut. Alt som må gjøres kan samles i en prosedyre og kobles til riktig sesong, lokasjon eller rolle for en idiotsikker operasjon.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Workflow Mockup */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="lg:col-span-2 relative bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-[0_0_50px_-15px_rgba(244,63,94,0.15)] overflow-hidden flex flex-col min-h-[600px]"
                    >
                        <div className="absolute top-0 right-0 w-[80%] h-[50%] bg-gradient-to-bl from-rose-500/10 to-transparent blur-[100px] pointer-events-none"></div>

                        <div className="flex items-center justify-between mb-8 z-10 border-b border-white/5 pb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-zinc-800 border-2 border-rose-500 flex items-center justify-center shadow-lg relative">
                                    <ClipboardList className="w-8 h-8 text-rose-400" />
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-2xl font-black text-white">Morgenrutine Kjøkken</h2>
                                    <span className="text-sm font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1">
                                        <Key className="w-3.5 h-3.5" /> Aktiv Prosedyre
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end hidden sm:flex">
                                <span className="text-sm font-medium text-zinc-500 mb-1">Fremdrift</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-32 h-2 rounded-full bg-zinc-800 overflow-hidden">
                                        <div className="h-full bg-rose-500 w-[60%]"></div>
                                    </div>
                                    <span className="font-bold text-white text-lg">60%</span>
                                </div>
                            </div>
                        </div>

                        {/* Tasks List */}
                        <div className="flex-1 flex flex-col z-10 relative">
                            <h3 className="font-bold text-zinc-400 mb-6 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-rose-400" /> Oppgaver i Prosedyren
                            </h3>

                            <div className="space-y-4">
                                {tasks.map((task) => (
                                    <div key={task.id} className="p-5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-zinc-900 border border-white/5">
                                                {task.status === 'done' ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> :
                                                    task.status === 'active' ? <Clock className="w-6 h-6 text-amber-500" /> :
                                                        <AlertTriangle className="w-6 h-6 text-zinc-600" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`font-bold text-lg mb-1 group-hover:text-rose-400 transition-colors ${task.status === 'done' ? 'text-zinc-500 line-through' : 'text-white'}`}>{task.title}</span>
                                                <div className="flex items-center gap-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                                    <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-sm">{task.time}</span>
                                                    <span>{task.completed} / {task.count} Fullført</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button className="px-4 py-2 rounded-lg bg-zinc-800 text-white font-bold text-sm tracking-wide hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">
                                            Åpne
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Features checklist */}
                    <div className="flex flex-col gap-6">
                        {[
                            { title: "Standardiser SOP", desc: "Digitaliser dine Standard Operating Procedures. Alle vet nøyaktig hva de skal gjøre, til enhver tid.", icon: ClipboardList, color: "text-rose-400", bg: "bg-rose-500/10", border: 'border-rose-500/20' },
                            { title: "Fleksibel Tildeling", desc: "Koble en prosedyre til en sesong, en spesifikk rolle, eller la den være en sjekkliste du krever inn via QR-kode.", icon: Key, color: "text-rose-400", bg: "bg-rose-500/10", border: 'border-rose-500/20' },
                            { title: "Total Kontroll", desc: "Spor hvem som gjorde hva, når. Full revisjonsspor for temperaturer og matsikkerhet på kjøkkenet.", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", border: 'border-emerald-500/20' }
                        ].map((feat, i) => (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * (i + 1) }}
                                key={i}
                                className="bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 group hover:border-white/20 transition-all shadow-lg hover:shadow-xl"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feat.bg} border ${feat.border}`}>
                                    <feat.icon className={`w-6 h-6 ${feat.color}`} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{feat.title}</h3>
                                <p className="text-sm font-medium text-zinc-400 leading-relaxed">{feat.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <NextPageBanner
                    href="/concepts/seasons"
                    title="Sesonger & Bølger"
                    subtitle="Neste Konsept"
                    color="from-fuchsia-500/10"
                />
            </div>
        </div>
    );
}
