"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ListTodo, MoreVertical, Search, CheckSquare2, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function OppgaverRutinerPage() {
    const router = useRouter();
    const [tasks, setTasks] = useState([
        { id: 1, title: "Sjekke kassa og opptelling", assigned: "Åpningsvakt", time: "09:00", done: false },
        { id: 2, title: "Vaske kaffemaskinen", assigned: "Barista", time: "11:00", done: true },
        { id: 3, title: "Kontrollere nødutganger", assigned: "Manager", time: "14:00", done: false },
        { id: 4, title: "Sette ut stoler på uteservering", assigned: "Servering", time: "15:00", done: false },
    ]);

    const toggleTask = (id: number) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
    };

    const progress = (tasks.filter(t => t.done).length / tasks.length) * 100;

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 sm:p-6 md:p-12 pt-24 md:pt-28 selection:bg-amber-500/30">
            <Navigation />

            <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12">
                <ArrowLeft className="w-5 h-5" />
                Tilbake til forside
            </button>

            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 p-[1px] shadow-[0_0_30px_-5px_rgba(251,191,36,0.4)]">
                        <div className="w-full h-full bg-[#111] rounded-2xl flex items-center justify-center">
                            <ListTodo className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-black text-white">Oppgaver & Rutiner</h1>
                        <p className="text-zinc-400 text-lg">Individuelt ansvar og daglige gjøremål</p>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="relative bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_-15px_rgba(251,191,36,0.2)]"
                >
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500"></div>
                    <div className="absolute -inset-20 bg-amber-500/5 blur-[100px] pointer-events-none"></div>

                    {/* App Header */}
                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center p-8 border-b border-white/5 gap-4 bg-white/[0.02]">
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-bold">Dagens rutiner</h2>
                            <p className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span> Aktiv nå: Åpningsvakt
                            </p>
                        </div>

                        <div className="flex gap-4 w-full sm:w-auto">
                            <div className="flex-1 sm:flex-none relative text-zinc-400 focus-within:text-white transition-colors">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input type="text" placeholder="Søk i oppgaver..." className="w-full sm:w-64 bg-black/40 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
                            </div>
                        </div>
                    </div>

                    {/* App Content */}
                    <div className="relative z-10 flex flex-col md:flex-row min-h-[500px]">
                        {/* Task List */}
                        <div className="md:w-2/3 flex flex-col p-8 border-r border-white/5">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-lg font-bold text-zinc-300">Mine oppgaver</h3>
                                <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">{tasks.filter(t => t.done).length} av {tasks.length} fullført</span>
                            </div>

                            <div className="h-2 w-full bg-zinc-800 rounded-full mb-8 overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                            </div>

                            <div className="flex flex-col gap-3">
                                {tasks.map((task) => (
                                    <div
                                        key={task.id}
                                        onClick={() => toggleTask(task.id)}
                                        className={`p-4 border rounded-2xl flex items-center justify-between cursor-pointer transition-all hover:-translate-y-0.5
                                            ${task.done ? 'bg-white/5 border-white/5 opacity-50' : 'bg-black/40 border-white/10 hover:border-amber-500/30'}
                                        `}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex-shrink-0">
                                                {task.done ? (
                                                    <CheckSquare2 className="w-6 h-6 text-emerald-500" />
                                                ) : (
                                                    <Square className="w-6 h-6 text-zinc-600" />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`font-bold transition-all ${task.done ? 'text-zinc-500 line-through' : 'text-white'}`}>{task.title}</span>
                                                <div className="flex gap-2 text-xs font-medium text-zinc-500 mt-1">
                                                    <span className="bg-white/5 px-2 py-0.5 rounded-md">{task.assigned}</span>
                                                    <span className="flex items-center gap-1">{task.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="text-zinc-600 hover:text-white p-2">
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Side Panel: Focus task */}
                        <div className="md:w-1/3 p-8 bg-black/20 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-300 mb-6 border-b border-white/5 pb-4">Neste prioritet</h3>
                                {tasks.filter(t => !t.done).length > 0 ? (
                                    <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 p-6 rounded-2xl">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="bg-amber-500/20 text-amber-500 text-xs font-bold px-2 py-1 rounded truncate">
                                                {tasks.filter(t => !t.done)[0].assigned}
                                            </span>
                                            <span className="text-zinc-400 text-sm font-bold">{tasks.filter(t => !t.done)[0].time}</span>
                                        </div>
                                        <h4 className="text-xl font-bold text-amber-50 mb-4">{tasks.filter(t => !t.done)[0].title}</h4>
                                        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                                            Husk å notere ned eventuelle avvik i kommentarfeltet dersom oppgaven ikke lar seg fullføre på vanlig måte.
                                        </p>
                                        <button className="w-full py-3 bg-amber-500 text-black font-black rounded-xl hover:bg-amber-400 transition-colors">
                                            Begynn nå
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 flex flex-col items-center">
                                        <CheckCircle2 className="w-16 h-16 text-emerald-500/50 mb-4" />
                                        <p className="text-zinc-400 font-bold">Ingen flere oppgaver igjen!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                <NextPageBanner
                    href="/features/staff-training"
                    title="HR & Opplæring"
                    subtitle="Neste Funksjon"
                    color="from-fuchsia-500/10"
                />
            </div>
        </div>
    );
}
