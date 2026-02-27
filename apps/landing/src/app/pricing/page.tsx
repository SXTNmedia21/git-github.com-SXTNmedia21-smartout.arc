"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, ArrowRight, CheckCircle2, Zap, Star } from "lucide-react";
import Navigation from "../../components/navigation";

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 overflow-x-hidden relative">
            {/* Dynamic Premium Background */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#050505]">
                {/* Subtle Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

                {/* Noise overlay */}
                <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')" }}></div>

                {/* Refined Glowing Orbs with Animations */}
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-orange-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-rose-600/10 rounded-full blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
                <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] bg-purple-600/10 rounded-full blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
            </div>

            {/* Navigation */}
            <Navigation />

            <main className="relative z-10 pt-40 pb-20 px-6 max-w-7xl mx-auto min-h-screen">
                <div className="text-center mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white text-sm font-semibold mb-8 backdrop-blur-md relative overflow-hidden group shadow-xl"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute -inset-[1px] bg-gradient-to-r from-orange-500 to-rose-500 rounded-full opacity-0 group-hover:opacity-30 blur-sm transition-opacity duration-500" />
                        <Star className="w-4 h-4 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)] relative z-10" />
                        <span className="relative z-10">Enkelt og forutsigbart</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.05] mb-6 drop-shadow-2xl"
                    >
                        Full kontroll til <br />
                        <span className="relative inline-block">
                            <span className="absolute -inset-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 blur opacity-20"></span>
                            <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                                en fast pris.
                            </span>
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-xl text-zinc-400 max-w-2xl mx-auto font-medium"
                    >
                        Ingen skjulte kostnader. Ingen overraskelser. Betal for det du trenger, og skaler når du er klar for det.
                    </motion.p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8"
                >
                    {/* Basic Plan */}
                    <div className="group relative rounded-[40px] bg-[#0a0a0c]/40 border border-white/5 hover:border-white/10 transition-all duration-500 overflow-hidden backdrop-blur-2xl shadow-2xl p-10 flex flex-col">
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute -inset-1 bg-gradient-to-b from-blue-500/5 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="relative z-10 flex-1">
                            <h3 className="text-2xl font-bold text-white mb-2">Essential</h3>
                            <p className="text-zinc-400 mb-8">For den mindre restauranten som trenger full kontroll på vaktplan og kommunikasjon.</p>

                            <div className="mb-8">
                                <span className="text-5xl font-black text-white">499,-</span>
                                <span className="text-zinc-500 ml-2">/ måned</span>
                            </div>

                            <ul className="space-y-4 mb-10">
                                {[
                                    "Vaktplan og Timeregistrering",
                                    "Stemplingsur med lokasjonskontroll",
                                    "Lise AI Botsson (Inntil 500 spørsmål/mnd)",
                                    "Kommunikasjon med auto-oversettelse",
                                    "Standard IK-mat og Rutiner"
                                ].map((feature, i) => (
                                    <li key={i} className="flex items-center gap-3 text-zinc-300">
                                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                        </div>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <Link href="http://localhost:3050/onboarding" className="relative z-10 w-full rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 text-center transition-colors">
                            Kom i gang
                        </Link>
                    </div>

                    {/* Pro Plan */}
                    <div className="group relative rounded-[40px] bg-[#0a0a0c]/60 border border-orange-500/20 hover:border-orange-500/40 transition-all duration-500 overflow-hidden backdrop-blur-2xl shadow-[0_20px_80px_-20px_rgba(249,115,22,0.3)] p-10 flex flex-col transform md:-translate-y-4">
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent opacity-100 transition-all duration-500" />
                        <div className="absolute -inset-4 bg-gradient-to-b from-orange-500/10 to-transparent blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="absolute top-6 right-6 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-black uppercase tracking-wider shadow-lg z-20">
                            Mest populær
                        </div>

                        <div className="relative z-10 flex-1">
                            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400 mb-2">SmartOut Pro</h3>
                            <p className="text-zinc-400 mb-8">Kraftpakken for voksende konsepter og de som setter Mattilsynet i høysetet.</p>

                            <div className="mb-8">
                                <span className="text-5xl font-black text-white">1299,-</span>
                                <span className="text-zinc-500 ml-2">/ måned</span>
                            </div>

                            <ul className="space-y-4 mb-10">
                                {[
                                    "Alt fra Essential",
                                    "Automatisert lønnskjøring og integrasjoner",
                                    "Ubegrenset bruk av Lise AI Botsson",
                                    "Avansert HACCP og Mattilsynsrapporter",
                                    "Automatisert Onboarding av ansatte",
                                    "Sensordata fra kjøleskap (krever hardware)"
                                ].map((feature, i) => (
                                    <li key={i} className="flex items-center gap-3 text-white font-medium">
                                        <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 border border-orange-500/30">
                                            <Zap className="w-3 h-3 text-orange-400" />
                                        </div>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <Link href="http://localhost:3050/onboarding" className="relative group w-full block">
                            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-rose-500 rounded-2xl blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
                            <div className="relative w-full rounded-2xl bg-white text-zinc-950 font-black py-4 text-center transition-all flex justify-center items-center gap-2 group-hover:-translate-y-0.5 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                Velg Pro <ArrowRight className="w-4 h-4" />
                            </div>
                        </Link>
                    </div>
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
