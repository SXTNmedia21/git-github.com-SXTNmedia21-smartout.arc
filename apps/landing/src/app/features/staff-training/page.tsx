"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, GraduationCap, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function HROpplaeringPage() {
    const router = useRouter();
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);

    const quizData = [
        {
            question: "Hvor lenge må man vaske hendene for at de skal regnes som rene iht. våre retningslinjer?",
            options: ["10 sekunder", "30 sekunder (og såpe)", "1 minutt", "Bare skylle med vann"],
            correct: 1
        }
    ];

    const handleSelect = (idx: number) => {
        if (isAnswered) return;
        setSelectedAnswer(idx);
        setIsAnswered(true);
    };

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 sm:p-6 md:p-12 pt-24 md:pt-28 selection:bg-fuchsia-500/30">
            <Navigation />

            <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12">
                <ArrowLeft className="w-5 h-5" />
                Tilbake til forside
            </button>

            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-fuchsia-500 to-pink-500 p-[1px] shadow-2xl">
                        <div className="w-full h-full bg-[#111] rounded-2xl flex items-center justify-center">
                            <GraduationCap className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-black text-white">HR & Opplæring</h1>
                        <p className="text-zinc-400 text-lg">AI-drevne quiz og mikrolæring for opplæring</p>
                    </div>
                </div>

                {/* The Mock App Area */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="relative bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 sm:p-8 md:p-12 shadow-[0_0_50px_-15px_rgba(217,70,239,0.3)] overflow-hidden"
                >
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-fuchsia-500 to-pink-500"></div>
                    <div className="absolute -inset-20 bg-fuchsia-500/5 blur-[100px] pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row gap-12">
                        {/* Sidebar */}
                        <div className="md:w-1/3 flex flex-col gap-4 border-r border-white/5 pr-8">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-sm font-bold w-fit mb-4">
                                <BookOpen className="w-4 h-4" /> Modul 3: Hygiene
                            </div>
                            <div className="space-y-4">
                                {[
                                    { title: "Velkommen", time: "2 min", status: "done" },
                                    { title: "Personlig hygiene", time: "4 min", status: "current" },
                                    { title: "Kjøkkenrutiner", time: "5 min", status: "locked" }
                                ].map((step, i) => (
                                    <div key={i} className={`p-4 rounded-xl border flex justify-between items-center ${step.status === 'current' ? 'bg-fuchsia-500/10 border-fuchsia-500/30' : 'bg-black/20 border-white/5 opacity-60'}`}>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-white">{step.title}</span>
                                            <span className="text-xs text-zinc-500">{step.time}</span>
                                        </div>
                                        {step.status === 'done' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                        {step.status === 'locked' && <div className="w-5 h-5 rounded-full border-2 border-zinc-700"></div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quiz View */}
                        <div className="md:w-2/3 flex flex-col">
                            <h2 className="text-2xl font-bold mb-8 leading-relaxed">
                                {quizData[0].question}
                            </h2>

                            <div className="flex flex-col gap-3">
                                {quizData[0].options.map((option, idx) => {
                                    let stateClasses = "bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300";
                                    let icon = null;

                                    if (isAnswered) {
                                        if (idx === quizData[0].correct) {
                                            stateClasses = "bg-emerald-500/10 border-emerald-500 text-emerald-400";
                                            icon = <CheckCircle2 className="w-5 h-5" />;
                                        } else if (idx === selectedAnswer) {
                                            stateClasses = "bg-red-500/10 border-red-500 text-red-500";
                                            icon = <XCircle className="w-5 h-5" />;
                                        } else {
                                            stateClasses = "bg-black/50 border-white/5 text-zinc-600 opacity-50";
                                        }
                                    }

                                    return (
                                        <button
                                            key={idx}
                                            disabled={isAnswered}
                                            onClick={() => handleSelect(idx)}
                                            className={`p-5 rounded-xl border text-left font-medium transition-all flex items-center justify-between ${stateClasses} ${!isAnswered && 'hover:-translate-y-1'}`}
                                        >
                                            {option}
                                            {icon}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    disabled={!isAnswered}
                                    className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${isAnswered ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-500' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                                >
                                    Neste spørsmål
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <NextPageBanner
                    href="/features/haccp-complience"
                    title="IK-Mat & Avvik"
                    subtitle="Neste Funksjon"
                    color="from-rose-500/10"
                />
            </div>
        </div>
    );
}