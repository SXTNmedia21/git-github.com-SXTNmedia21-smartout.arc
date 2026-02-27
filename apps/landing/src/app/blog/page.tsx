"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, ArrowRight, Quote, Heart } from "lucide-react";
import Navigation from "../../components/navigation";

export default function BlogPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 overflow-x-hidden relative">
            {/* Dynamic Premium Background */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#050505]">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
                <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')" }}></div>
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-orange-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-rose-600/10 rounded-full blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
                <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] bg-purple-600/10 rounded-full blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
            </div>

            {/* Navigation */}
            <Navigation />

            <main className="relative z-10 pt-40 pb-20 px-6 max-w-7xl mx-auto min-h-screen">
                <div className="text-center mb-20 max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white text-sm font-semibold mb-8 backdrop-blur-md relative overflow-hidden group shadow-xl"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute -inset-[1px] bg-gradient-to-r from-orange-500 to-rose-500 rounded-full opacity-0 group-hover:opacity-30 blur-sm transition-opacity duration-500" />
                        <Heart className="w-4 h-4 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)] relative z-10" />
                        <span className="relative z-10">Historiene fra bransjen</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.05] mb-6 drop-shadow-2xl"
                    >
                        Bygget for <br />
                        <span className="relative inline-block">
                            <span className="absolute -inset-2 bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 blur opacity-20"></span>
                            <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]">
                                virkelighetens helter.
                            </span>
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-xl text-zinc-400 font-medium"
                    >
                        Les om hvordan Norges beste restauranter har halvert administrativ tid og fått fornøyde ansatte.
                    </motion.p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    {[
                        { title: "Hvordan Torget kuttet lønnskjøringen fra dager til timer", author: "Peder Aas", role: "Daglig Leder", color: "from-blue-500 to-indigo-500" },
                        { title: "Bryggekanten overlevde Mattilsynet takket være Lise", author: "Lars Larsson", role: "Driftsjef", color: "from-emerald-500 to-teal-500" },
                        { title: "Språkbarrierer er et tilbakelagt kapittel for vår restaurant", author: "Sofia Sofia", role: "HR Ansvarlig", color: "from-fuchsia-500 to-pink-500" },
                        { title: "Fra papirkaos til digital ro i sjelen", author: "Geir Geirsen", role: "Eier", color: "from-orange-500 to-rose-500" },
                        { title: "Oppskriften på null turnover i teamet", author: "Nina Ninasen", role: "Restaurantsjef", color: "from-purple-500 to-indigo-500" },
                        { title: "Hvordan onboarding på 5 minutter endret alt", author: "Ole Olsen", role: "Kjøkkensjef", color: "from-cyan-500 to-blue-500" }
                    ].map((story, i) => (
                        <Link href={`/blog/story-${i}`} key={i} className="group relative rounded-[32px] bg-[#0a0a0c]/40 border border-white/5 hover:border-white/10 transition-all duration-500 overflow-hidden backdrop-blur-2xl shadow-2xl flex flex-col p-8 hover:-translate-y-2">
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className={`absolute -inset-1 bg-gradient-to-b ${story.color} blur-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>

                            <div className="relative z-10 flex-1 flex flex-col">
                                <Quote className="w-8 h-8 text-white/20 mb-6 group-hover:text-white/40 transition-colors" />
                                <h3 className="text-xl font-bold text-white mb-6 leading-relaxed group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-all flex-1">
                                    &ldquo;{story.title}&rdquo;
                                </h3>

                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${story.color} p-[2px]`}>
                                        <div className="w-full h-full bg-[#111] rounded-full border-2 border-[#111]"></div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{story.author}</p>
                                        <p className="text-xs text-zinc-500">{story.role}</p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </motion.div>
            </main>

            {/* FOOTER */}
            <footer className="border-t border-zinc-900 bg-zinc-950 py-12 relative z-10">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 opacity-50">
                        <Building2 className="w-5 h-5 text-zinc-400" />
                        <span className="text-lg font-black tracking-tighter text-zinc-400">SmartOut</span>
                    </div>
                    <p className="text-sm text-zinc-600 font-semibold">&copy; 2026 SmartOut AS. Helt bygget for fremtiden.</p>
                </div>
            </footer>
        </div>
    );
}
