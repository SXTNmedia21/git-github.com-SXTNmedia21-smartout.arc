"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
    Mic, ArrowRight, MapPin, ClipboardList, Snowflake, Building2,
    ShieldCheck, Users, Clock, SunSnow, CheckCircle2, Zap, Target, CloudSun, Leaf,
    CalendarClock, GraduationCap, MessageSquare, ListTodo, Globe, Sparkles
} from "lucide-react";
import VoiceAssistant from "../components/voice-assistant";
import Navigation from "../components/navigation";

const MOCK_LOCATIONS = [
    { id: 1, name: "Sentralstasjonen", city: "Oslo", employees: 42, icon: MapPin, href: "/concepts/lokations" },
    { id: 2, name: "Bryggekanten", city: "Bergen", employees: 28, icon: Building2, href: "/concepts/lokations" },
    { id: 3, name: "Torget Restaurant", city: "Trondheim", employees: 35, icon: Building2, href: "/concepts/lokations" },
];

const MOCK_PROCEDURES = [
    { id: "proc-1", name: "Morgenrutiner", taskCount: 12, icon: CheckCircle2, color: "text-emerald-400", href: "/concepts/procedures" },
    { id: "proc-2", name: "IK-Mat Sjekk", taskCount: 8, icon: ShieldCheck, color: "text-blue-400", href: "/concepts/procedures" },
    { id: "proc-3", name: "Nedvask Kjøkken", taskCount: 24, icon: Zap, color: "text-rose-400", href: "/concepts/procedures" },
    { id: "proc-4", name: "Varemottak", taskCount: 5, icon: Target, color: "text-amber-400", href: "/concepts/procedures" },
];

const MOCK_SEASONS = [
    { id: "season-1", name: "Sommerdrift", period: "Jun - Aug", icon: CloudSun, active: true, href: "/concepts/seasons" },
    { id: "season-2", name: "Julebordsesong", period: "Nov - Des", icon: Snowflake, active: false, href: "/concepts/seasons" },
    { id: "season-3", name: "Høstmeny", period: "Sep - Okt", icon: Leaf, active: false, href: "/concepts/seasons" },
];

export default function SmartoutLandingPage() {
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("locations");

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.2 }
        }
    };

    const itemVariants: Variants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { stiffness: 100, damping: 15 }
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 overflow-x-hidden relative">

            {/* Dynamic Premium Background */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#050505]">
                {/* Subtle Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

                {/* Noise overlay - reduced complexity for performance */}
                <div className="absolute inset-0 opacity-[0.010]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"n\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"2\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23n)\"/%3E%3C/svg%3E')" }}></div>

                {/* Refined Glowing Orbs with Hardware Acceleration */}
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-orange-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse will-change-[opacity]" style={{ animationDuration: '8s' }} />
                <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-rose-600/10 rounded-full blur-[150px] mix-blend-screen animate-pulse will-change-[opacity]" style={{ animationDuration: '12s' }} />
                <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] bg-purple-600/10 rounded-full blur-[150px] mix-blend-screen animate-pulse will-change-[opacity]" style={{ animationDuration: '10s' }} />
            </div>

            {/* Navigation */}
            <Navigation />

            <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto">

                {/* MAIN HERO SECTION */}
                <div className="flex flex-col items-center text-center gap-8 min-h-[calc(100dvh-120px)] pt-20 pb-10 justify-center relative">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                        className="max-w-5xl mx-auto flex flex-col items-center z-20"
                    >
                        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white text-sm font-semibold mb-8 backdrop-blur-md relative overflow-hidden group shadow-xl">
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute -inset-[1px] bg-gradient-to-r from-orange-500 to-rose-500 rounded-full opacity-0 group-hover:opacity-30 blur-sm transition-opacity duration-500" />
                            <Zap className="w-4 h-4 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)] relative z-10" />
                            <span className="relative z-10">Den komplette plattformen for serveringsbransjen</span>
                        </motion.div>

                        <motion.h1 variants={itemVariants} className="text-6xl md:text-8xl lg:text-[7.5rem] font-black tracking-tighter leading-[1.05] mb-8 drop-shadow-2xl">
                            Én plattform. <br />
                            <span className="relative inline-block">
                                <span className="absolute -inset-2 bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 blur opacity-20"></span>
                                <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]">
                                    Full kontroll.
                                </span>
                            </span>
                        </motion.h1>

                        <motion.p variants={itemVariants} className="text-xl md:text-2xl text-zinc-400 mb-12 max-w-3xl leading-relaxed font-medium">
                            Samle vaktplaner, HR, kommunikasjon, stemplingsur og internkontroll i ett og samme lynraske system. Reduser kaos og øk fortjenesten.
                        </motion.p>

                        <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-6">
                            <Link href="http://localhost:3050/onboarding" className="group relative flex items-center justify-center gap-3 bg-white text-zinc-950 font-black px-10 py-5 rounded-full text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:-translate-y-1 transition-all duration-300">
                                <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-rose-500 rounded-full blur opacity-20 group-hover:opacity-50 transition duration-500"></div>
                                <span className="relative flex items-center gap-3">Opprett din SmartOut <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>
                            </Link>

                            <a href="#lise" className="relative group flex items-center justify-center gap-3 px-10 py-5 rounded-full text-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                                <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-full group-hover:bg-white/10 transition-colors backdrop-blur-md" />
                                <div className="absolute inset-0 bg-gradient-to-r from-zinc-800/50 to-zinc-700/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute -inset-[1px] bg-gradient-to-r from-white/20 to-white/0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-[1px]" />
                                <span className="relative font-bold text-white group-hover:drop-shadow-md">Møt AI-assistenten Lise</span>
                            </a>
                        </motion.div>
                    </motion.div>

                    {/* Abstract App Mockup Visual */}
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.4, type: "spring", stiffness: 50 }}
                        className="mt-12 w-full max-w-6xl relative z-10 hidden md:block"
                    >
                        <motion.div
                            animate={{ y: [0, -12, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#050505] to-transparent z-20" />
                            <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/10 via-rose-500/10 to-purple-500/10 rounded-t-[40px] blur-2xl opacity-50" />
                            <div className="rounded-t-[40px] border border-white/10 bg-[#0a0a0c]/60 backdrop-blur-3xl overflow-hidden shadow-[0_-20px_80px_-20px_rgba(0,0,0,0.5)] relative">
                                {/* Window controls */}
                                <div className="h-12 bg-white/5 border-b border-white/5 flex items-center px-6 gap-2">
                                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500/80" />
                                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500/80" />
                                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/80" />
                                    <div className="ml-4 w-64 h-6 bg-white/5 rounded-full" />
                                </div>
                                {/* Dashboard mockup content */}
                                <div className="p-8 grid grid-cols-12 gap-8 h-[500px]">
                                    {/* Sidebar */}
                                    <div className="col-span-3 flex flex-col gap-4">
                                        <div className="w-full h-12 bg-white/5 rounded-2xl mb-8" />
                                        {[...Array(6)].map((_, i) => (
                                            <div key={i} className="w-full h-10 bg-white/5 rounded-xl border border-white/5" />
                                        ))}
                                    </div>
                                    {/* Main Content */}
                                    <div className="col-span-9 flex flex-col gap-8">
                                        <div className="w-full h-40 bg-gradient-to-br from-orange-500/20 to-rose-500/5 rounded-3xl border border-orange-500/20 flex p-8 flex-col justify-end">
                                            <div className="w-1/3 h-8 bg-white/10 rounded-lg mb-4" />
                                            <div className="w-1/4 h-4 bg-white/5 rounded-lg" />
                                        </div>
                                        <div className="flex-1 grid grid-cols-3 gap-6">
                                            <div className="col-span-2 bg-white/5 rounded-3xl border border-white/5 p-6" />
                                            <div className="col-span-1 bg-white/5 rounded-3xl border border-white/5 p-6 flex flex-col gap-4">
                                                {[...Array(4)].map((_, i) => (
                                                    <div key={i} className="w-full flex-1 bg-white/5 rounded-xl border border-white/5" />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>

                {/* BRAND / INTEGRATION MARQUEE */}
                <div className="w-full relative py-12 overflow-hidden flex items-center mt-32 mb-12">
                    <div className="absolute left-0 top-0 bottom-0 w-48 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none"></div>
                    <div className="absolute right-0 top-0 bottom-0 w-48 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none"></div>
                    <motion.div
                        initial={{ x: 0 }}
                        animate={{ x: "-50%" }}
                        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                        className="flex gap-24 items-center whitespace-nowrap opacity-50 px-4 w-max"
                    >
                        <div className="text-2xl font-black tracking-tighter text-zinc-400 flex items-center gap-2"><Zap className="w-5 h-5" />TRIPLETEX</div>
                        <div className="text-2xl font-black tracking-tighter text-zinc-400 flex items-center gap-2"><Building2 className="w-5 h-5" />VISMA</div>
                        <div className="text-2xl font-black tracking-tighter text-zinc-400 flex items-center gap-2"><Users className="w-5 h-5" />ZETTLE</div>
                        <div className="text-2xl font-black tracking-tighter text-zinc-400 flex items-center gap-2"><Target className="w-5 h-5" />LIGHTSPEED</div>
                        <div className="text-2xl font-black tracking-tighter text-zinc-400 flex items-center gap-2"><ShieldCheck className="w-5 h-5" />POWEROFFICE</div>
                        <div className="text-2xl font-black tracking-tighter text-zinc-400 flex items-center gap-2"><Zap className="w-5 h-5" />TRIPLETEX</div>
                        <div className="text-2xl font-black tracking-tighter text-zinc-400 flex items-center gap-2"><Building2 className="w-5 h-5" />VISMA</div>
                        <div className="text-2xl font-black tracking-tighter text-zinc-400 flex items-center gap-2"><Users className="w-5 h-5" />ZETTLE</div>
                        <div className="text-2xl font-black tracking-tighter text-zinc-400 flex items-center gap-2"><Target className="w-5 h-5" />LIGHTSPEED</div>
                        <div className="text-2xl font-black tracking-tighter text-zinc-400 flex items-center gap-2"><ShieldCheck className="w-5 h-5" />POWEROFFICE</div>
                    </motion.div>
                </div>

                {/* LISE HERO SECTION */}
                <div id="lise" className="flex flex-col lg:flex-row items-center justify-between gap-16 min-h-[calc(100dvh-120px)] py-32 relative">
                    {/* Soft background glow for Lise section */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

                    <motion.div
                        className="flex-1 max-w-2xl"
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                    >
                        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider mb-6">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </span>
                            Møt fremtidens workforce management
                        </motion.div>

                        <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
                            Møt <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Lise</span>,<br />din digitale kollega.
                        </motion.h1>

                        <motion.p variants={itemVariants} className="text-lg md:text-xl text-zinc-400 mb-10 max-w-xl leading-relaxed">
                            SmartOut er bygget for den norske serveringsbransjen. Reduser administrativt arbeid fra timer til minutter, integrer ansatte på tvers av språkbarrierer, og få full kontroll over lønnskostnader og compliance (Mattilsynet/Arbeidstilsynet) i sanntid.
                        </motion.p>

                        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4">
                            <button
                                onClick={() => setIsAssistantOpen(true)}
                                className="group relative flex items-center gap-3 bg-white text-zinc-950 font-bold px-8 py-4 rounded-full text-lg shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] hover:scale-105 transition-all duration-300"
                            >
                                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                    <Mic className="w-4 h-4" />
                                </div>
                                Start Lise Botsson
                            </button>

                            <a href="#workspace" className="text-zinc-400 font-semibold px-6 py-4 hover:text-white transition-colors flex items-center gap-2">
                                Utforsk konsepter <ArrowRight className="w-4 h-4" />
                            </a>
                        </motion.div>

                        <motion.div variants={itemVariants} className="mt-12 flex items-center gap-6 text-zinc-500">
                            <div className="flex items-center gap-2 text-sm font-semibold"><Clock className="w-4 h-4 text-zinc-400" /> Tidsbesparelse</div>
                            <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="w-4 h-4 text-zinc-400" /> 100% Compliance</div>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Users className="w-4 h-4 text-zinc-400" /> Høy Retensjon</div>
                        </motion.div>
                    </motion.div>

                    {/* Voice Assistant Floating Widget */}
                    <div className="w-full lg:w-[450px]">
                        <AnimatePresence mode="wait">
                            {isAssistantOpen ? (
                                <motion.div
                                    key="assistant"
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="h-[600px] w-full relative z-50"
                                >
                                    <VoiceAssistant autoStart onClose={() => setIsAssistantOpen(false)} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="placeholder"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="h-[600px] w-full rounded-[40px] border border-white/10 bg-[#0a0a0c]/50 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center relative overflow-hidden cursor-pointer group hover:border-orange-500/30 transition-colors shadow-2xl"
                                    onClick={() => setIsAssistantOpen(true)}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/90 to-transparent z-10" />
                                    <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/0 via-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-2xl z-0" />
                                    <motion.div
                                        animate={{ scale: [1, 1.05, 1], boxShadow: ["0 0 0px rgba(249,115,22,0)", "0 0 20px rgba(249,115,22,0.1)", "0 0 0px rgba(249,115,22,0)"] }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                        className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 relative z-20 group-hover:bg-orange-500/10 transition-colors border border-white/5 group-hover:border-orange-500/20"
                                    >
                                        <div className="absolute inset-0 rounded-full border border-orange-500/20 group-hover:animate-ping opacity-0 group-hover:opacity-100" />
                                        <Mic className="w-10 h-10 text-zinc-500 group-hover:text-orange-500 transition-colors" />
                                    </motion.div>
                                    <h3 className="text-2xl font-bold text-white mb-2 relative z-20">Lise venter...</h3>
                                    <p className="text-zinc-500 relative z-20 mb-8 max-w-xs">Klikk her for å vekke röstassistenten og still spørsmål om vaktplan, onboarding eller rutiner.</p>

                                    <div className="px-4 py-2 rounded-full bg-zinc-800/80 text-xs font-bold text-zinc-400 relative z-20 shadow-xl border border-zinc-700/50 flex items-center gap-2 group-hover:bg-zinc-800 group-hover:text-zinc-300 transition-colors">
                                        Trykk for å koble til <ArrowRight className="w-3 h-3" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* INTERACTIVE WORKSPACE SECTION */}
                <section id="workspace" className="relative z-10 min-h-[100dvh] flex flex-col justify-center py-32 mt-20">
                    {/* Ambient Glow */}
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none mix-blend-screen" />

                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-4 sm:mb-6">Se for deg ditt fremtidige workspace</h2>
                        <p className="text-zinc-400 max-w-2xl mx-auto text-base sm:text-lg">
                            Restaurantdrift er komplekst. Derfor er Smartout bygget for å speile din virkelighet tvers av alle aspekter. Slik organiserer stjernene bedriften sin for å overholde Arbeidstilsynets og Mattilsynets krav:
                        </p>
                    </motion.div>

                    {/* Interactive Tabs */}
                    <div className="flex justify-center gap-4 mb-12 overflow-x-auto pb-4 hide-scrollbar">
                        {[
                            { id: 'locations', label: 'Lokasjoner', icon: MapPin },
                            { id: 'procedures', label: 'Prosedyrer', icon: ClipboardList },
                            { id: 'seasons', label: 'Sesonger', icon: SunSnow },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`relative flex items-center gap-2 px-8 py-4 text-base rounded-[32px] font-black transition-all duration-500 overflow-hidden group ${isActive
                                        ? 'text-white'
                                        : 'text-zinc-500 hover:text-white'
                                        }`}
                                >
                                    {isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-rose-600/20 rounded-[32px]" />
                                    )}
                                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[32px]" />
                                    <Icon className={`relative z-10 w-5 h-5 ${isActive ? 'text-orange-500' : ''}`} />
                                    <span className="relative z-10">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content Panels */}
                    <div className="relative min-h-[350px]">
                        {/* Locations Panel */}
                        {activeTab === 'locations' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                                className="grid grid-cols-1 md:grid-cols-3 gap-8"
                            >
                                {MOCK_LOCATIONS.map((loc) => (
                                    <Link href={loc.href} key={loc.id} className="block relative group p-10 rounded-[40px] bg-[#0a0a0c]/40 border border-white/5 hover:border-white/10 transition-all backdrop-blur-3xl overflow-hidden hover:-translate-y-2 duration-500 shadow-2xl">
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50 group-hover:via-orange-500/50 group-hover:opacity-100 transition-all duration-500" />
                                        <div className="absolute -inset-1 bg-gradient-to-b from-orange-500/5 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <div className="relative h-16 w-16 rounded-[24px] bg-gradient-to-tr from-orange-600/20 to-orange-400/5 flex items-center justify-center mb-8 border border-orange-500/10 shadow-inner group-hover:scale-110 group-hover:bg-orange-600/30 transition-all duration-500 z-10">
                                            <loc.icon className="h-8 w-8 text-orange-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.5)]" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-2">{loc.name}</h3>
                                        <div className="flex justify-between items-center text-zinc-400 font-medium">
                                            <span>{loc.city}</span>
                                            <span className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-lg border border-white/10">
                                                <Users className="w-4 h-4 text-orange-400" /> {loc.employees} ansatte
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </motion.div>
                        )}

                        {/* Procedures Panel */}
                        {activeTab === 'procedures' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                                className="grid grid-cols-1 md:grid-cols-4 gap-6"
                            >
                                {MOCK_PROCEDURES.map((proc) => (
                                    <Link href={proc.href} key={proc.id} className="block p-8 rounded-[32px] bg-[#0a0a0c]/40 border border-white/5 hover:border-white/10 transition-all flex flex-col items-center text-center group hover:-translate-y-2 duration-300 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        <div className={`relative z-10 h-20 w-20 mb-6 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center ${proc.color} shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                                            <proc.icon className="h-10 w-10" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-3">{proc.name}</h3>
                                        <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest bg-black/30 px-3 py-1 rounded-full">{proc.taskCount} Oppgaver</span>
                                    </Link>
                                ))}
                            </motion.div>
                        )}

                        {/* Seasons Panel */}
                        {activeTab === 'seasons' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                                className="grid grid-cols-1 md:grid-cols-3 gap-8"
                            >
                                {MOCK_SEASONS.map((season) => (
                                    <Link href={season.href} key={season.id} className={`block p-10 rounded-[32px] border backdrop-blur-xl shadow-2xl ${season.active ? 'bg-orange-500/10 border-orange-500/40 shadow-[0_0_40px_-10px_rgba(249,115,22,0.3)]' : 'bg-[#0a0a0c]/40 border-white/5 hover:border-white/10 hover:bg-[#0a0a0c]/60'} relative overflow-hidden transition-all hover:-translate-y-2 duration-300 group`}>
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        {season.active && (
                                            <span className="absolute top-6 right-6 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg z-10">Aktiv nå</span>
                                        )}
                                        <season.icon className={`h-12 w-12 mb-8 ${season.active ? 'text-orange-400' : 'text-zinc-500'}`} />
                                        <h3 className="text-3xl font-black text-white mb-2">{season.name}</h3>
                                        <p className="text-lg text-zinc-400 font-medium">{season.period}</p>
                                    </Link>
                                ))}
                            </motion.div>
                        )}
                    </div>
                </section>

                {/* COMPLIANCE SECTION */}
                <section className="relative z-10 py-40 mt-20">
                    {/* Blended background for compliance */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent pointer-events-none" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none" />

                    <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-8"
                        >
                            <ShieldCheck className="w-10 h-10" />
                        </motion.div>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-6"
                        >
                            Sov godt om natten.
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="text-lg text-zinc-400 max-w-2xl mx-auto mb-16"
                        >
                            Når Mattilsynet eller Arbeidstilsynet banker på døren, er alt klart. Vi sikrer at du automatisk følger regelverket for arbeidstid, pauser, og IK-mat.
                        </motion.p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto text-left relative">
                            {/* Decorative divider */}
                            <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-3/4 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent"></div>

                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                                className="relative p-10 group cursor-pointer"
                            >
                                <Link href="/features/haccp-complience" className="absolute inset-0 z-20 rounded-[40px]"></Link>
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[40px] blur-xl" />
                                <div className="relative z-10 pointer-events-none">
                                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-4 group-hover:text-emerald-300 transition-colors">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/20">
                                            <div className="w-full h-full bg-[#111] rounded-2xl flex items-center justify-center">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            </div>
                                        </div>
                                        Mattilsynet
                                        <ArrowRight className="w-5 h-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 transform text-emerald-400 ml-auto" />
                                    </h3>
                                    <p className="text-zinc-400 text-lg leading-relaxed group-hover:text-zinc-300 transition-colors">Automatisk temperaturlogging, komplett renholdsprogram, og avviksrapportering bygget rett inn i rutinemodulen.</p>
                                </div>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: 0.4 }}
                                className="relative p-10 group cursor-pointer"
                            >
                                <Link href="/features/shiftplanner" className="absolute inset-0 z-20 rounded-[40px]"></Link>
                                <div className="absolute inset-0 bg-gradient-to-bl from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[40px] blur-xl" />
                                <div className="relative z-10 pointer-events-none">
                                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-4 group-hover:text-emerald-300 transition-colors">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/20">
                                            <div className="w-full h-full bg-[#111] rounded-2xl flex items-center justify-center">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            </div>
                                        </div>
                                        Arbeidstilsynet
                                        <ArrowRight className="w-5 h-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 transform text-emerald-400 ml-auto" />
                                    </h3>
                                    <p className="text-zinc-400 text-lg leading-relaxed group-hover:text-zinc-300 transition-colors">Automatisk hviletidsvarsling, signerte arbeidskontrakter digitalt, og timeføring som sperrer for ulovlig overtid.</p>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* Features Showcase Section */}
                <section id="features" className="relative z-10 min-h-[100dvh] flex flex-col justify-center py-40 pt-20">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                        className="mx-auto max-w-3xl lg:text-center mb-20"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs sm:text-sm font-bold uppercase tracking-widest mb-4 sm:mb-6">
                            <Zap className="w-4 h-4" /> Neste generasjons plattform
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-4 sm:mb-6 leading-tight">
                            Ikke bare programvare.<br />En ny måte å jobbe på.
                        </h2>
                        <p className="text-base sm:text-lg text-zinc-400 px-2 sm:px-0">
                            Vi har byttet ut de gamle, trege systemene med et lynraskt, AI-drevet grensesnitt som de ansatte faktisk elsker å bruke. Tidsbesparende for ledere, motiverende for teamet.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard
                            href="/features/punchclock-timetracking"
                            icon={Clock}
                            title="Timeføring & Stemplingsur"
                            description="Enkel timeføring for alle – uansett arbeidstidsordning. Stemplingsur for nøyaktig tidsregistrering og full kontroll over arbeidstid."
                            delay={0.1}
                            color="from-blue-500 to-indigo-500"
                        />
                        <FeatureCard
                            href="/features/shiftplanner"
                            icon={CalendarClock}
                            title="Vaktliste & Lønnskjøring"
                            description="Med vår skiftplanlegger får du lett kontroll, og integrert lønssystem gir deg sanntidsoversikt over bemanningskostnadene."
                            delay={0.2}
                            color="from-emerald-500 to-teal-400"
                        />
                        <FeatureCard
                            href="/features/staff-training"
                            icon={GraduationCap}
                            title="HR & Opplæring"
                            description="Bruk integrert AI for å lage skreddersydde opplæringsrutiner og automatisk onboarding for nye og eksisterende ansatte."
                            delay={0.3}
                            color="from-fuchsia-500 to-pink-500"
                        />
                        <FeatureCard
                            href="/features/communications"
                            icon={MessageSquare}
                            title="Sømløs Kommunikasjon"
                            description="Hold alle dine ansatte oppdatert. Kommuniser enkelt på tvers av team, avdelinger og ansatte på over 50 språk."
                            delay={0.4}
                            color="from-cyan-400 to-sky-400"
                        />
                        <FeatureCard
                            href="/features/task-rutines"
                            icon={ListTodo}
                            title="Oppgaver & Rutiner"
                            description="Få oversikt over alt som skal gjøres. Individuelle oppgavelister og oppfølging av sesongbaserte rutiner for stjerneteamet ditt."
                            delay={0.5}
                            color="from-amber-400 to-yellow-500"
                        />
                        <FeatureCard
                            href="/features/haccp-complience"
                            icon={ShieldCheck}
                            title="IK-mat & Mattilsynet"
                            description="Internkontroll i samme system. Effektiv avviksrapportering, temperaturmålinger og vernerunder med mal i appen."
                            delay={0.6}
                            color="from-orange-500 to-rose-500"
                        />
                    </div>
                </section>

                {/* ONBOARDING PROMISE SECTION */}
                <section className="relative z-10 py-40">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <motion.div
                                initial={{ opacity: 0, x: -40 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="relative z-10"
                            >
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-6">
                                    <Sparkles className="w-4 h-4" /> AI-drevet Onboarding
                                </div>
                                <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white mb-6">
                                    I gang på minutter,<br />ikke måneder.
                                </h2>
                                <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
                                    Glem eviglange implementeringsprosjekter. Du oppgir URL-en til restauranten din, og vår AI skraper menyer, åpningstider, lokasjoner og bygger systemet for deg helt automatisk.
                                </p>
                                <motion.ul
                                    initial="hidden"
                                    whileInView="visible"
                                    viewport={{ once: true }}
                                    variants={{
                                        visible: { transition: { staggerChildren: 0.2 } },
                                        hidden: {}
                                    }}
                                    className="space-y-6 mb-10"
                                >
                                    <motion.li variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }} className="flex items-center gap-4 text-zinc-300 font-medium text-lg">
                                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0"><CheckCircle2 className="w-6 h-6" /></div>
                                        Skriv inn din nåværende nettside
                                    </motion.li>
                                    <motion.li variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }} className="flex items-center gap-4 text-zinc-300 font-medium text-lg">
                                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0"><Sparkles className="w-6 h-6" /></div>
                                        AI analyserer og bygger arbeidsplassen
                                    </motion.li>
                                    <motion.li variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }} className="flex items-center gap-4 text-zinc-300 font-medium text-lg">
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0"><Users className="w-6 h-6" /></div>
                                        Inviter ansatte og start opp med en gang
                                    </motion.li>
                                </motion.ul>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/5 to-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

                                {/* URL Entry visually blended */}
                                <div className="relative z-10 flex flex-col gap-6">
                                    <div className="group relative">
                                        <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-[32px] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                                        <div className="relative flex items-center gap-4 bg-[#0a0a0c]/60 backdrop-blur-3xl p-3 rounded-[32px] border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
                                            <div className="flex-1 h-14 bg-white/5 rounded-2xl flex items-center px-6 font-mono text-sm sm:text-base text-zinc-300">
                                                https://din-restaurant.no
                                            </div>
                                            <div className="h-14 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center rounded-2xl cursor-pointer hover:shadow-[0_0_30px_-5px_rgba(79,70,229,0.5)] transition-all">
                                                Generer
                                            </div>
                                        </div>
                                    </div>

                                    {/* Console visually blended */}
                                    <div className="relative bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[40px] p-10 shadow-2xl overflow-hidden border border-white/5">
                                        {/* Subtle internal glow */}
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />

                                        <div className="relative z-10">
                                            <div className="flex items-center gap-3 mb-10">
                                                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                                                <span className="text-sm font-bold text-blue-400 tracking-wider uppercase">Analyserer...</span>
                                            </div>
                                            <div className="space-y-8">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600/20 to-teal-400/20 flex items-center justify-center shrink-0 border border-emerald-500/20"><CheckCircle2 className="w-5 h-5 text-emerald-400" /></div>
                                                    <div className="h-2 w-1/3 bg-emerald-500/40 rounded-full" />
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600/20 to-teal-400/20 flex items-center justify-center shrink-0 border border-emerald-500/20"><CheckCircle2 className="w-5 h-5 text-emerald-400" /></div>
                                                    <div className="h-2 w-1/2 bg-emerald-500/40 rounded-full" />
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="w-10 h-10 rounded-2xl border border-white/10 flex items-center justify-center shrink-0 relative overflow-hidden">
                                                        <div className="absolute inset-0 border-[3px] border-transparent border-t-emerald-500 rounded-2xl animate-spin" />
                                                    </div>
                                                    <div className="h-2 w-3/4 bg-white/10 rounded-full" />
                                                </div>
                                                <div className="flex items-center gap-6 opacity-30">
                                                    <div className="w-10 h-10 rounded-2xl border border-white/10 shrink-0" />
                                                    <div className="h-2 w-2/3 bg-white/10 rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* PRICING SECTION */}
                <section id="priser" className="relative z-10 py-32 mt-10">
                    <div className="max-w-7xl mx-auto px-6 text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest mb-6"
                        >
                            <Sparkles className="w-4 h-4" /> Enkel Prismodell
                        </motion.div>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-6"
                        >
                            Mindre admin.<br />Mer på bunnlinjen.
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="text-lg text-zinc-400 max-w-2xl mx-auto mb-12"
                        >
                            Vi gir deg alt du trenger for å drive restauranten din mer lønnsomt — til en pris som gir mening.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                        >
                            <Link href="/pricing" className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/10 text-white font-bold text-lg hover:bg-white/5 hover:border-white/20 transition-all duration-300 group shadow-2xl">
                                Se våre priser og pakker
                                <ArrowRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </motion.div>
                    </div>
                </section>

                {/* CTA Footer Section */}
                <section className="relative z-10 py-32 sm:py-48 mt-10 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0c]/80 to-[#0a0a0c]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[800px] bg-orange-500/10 blur-[150px] rounded-[50%] pointer-events-none"></div>

                    <div className="relative mx-auto max-w-4xl px-6 text-center">
                        <motion.h2
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-6 sm:mb-8"
                        >
                            Klar for fremtiden?
                        </motion.h2>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="w-full flex justify-center"
                        >
                            <Link href="http://localhost:3050/onboarding" className="w-full sm:w-auto relative group">
                                <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 to-rose-500 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition duration-500"></div>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    className="relative mx-auto flex items-center justify-center gap-3 rounded-full bg-white text-zinc-950 px-8 py-4 sm:px-12 sm:py-5 text-sm sm:text-lg font-black transition-all w-full sm:w-auto group-hover:-translate-y-1 shadow-[0_0_40px_rgba(255,255,255,0.2)] group-hover:shadow-[0_0_60px_rgba(255,255,255,0.4)]"
                                >
                                    <Globe className="w-5 h-5 text-orange-600 drop-shadow-sm" />
                                    Opprett Workspace nå
                                </motion.button>
                            </Link>
                        </motion.div>
                    </div>
                </section>
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
        </div >
    );
}

function FeatureCard({ icon: Icon, title, description, delay, color, href }: { icon: React.ElementType, title: string, description: string, delay: number, color: string, href?: string }) {
    const cardContent = (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay }}
            whileHover={{ y: -10 }}
            className={`group relative rounded-[32px] bg-[#0a0a0c]/40 border border-white/5 hover:border-white/10 transition-all duration-500 overflow-hidden h-full backdrop-blur-2xl shadow-2xl ${href ? 'cursor-pointer' : ''}`}
        >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className={`absolute -inset-1 bg-gradient-to-b ${color} blur-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>

            <div className="relative h-full p-8 flex flex-col z-10">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${color} p-[1px] mb-6 shadow-2xl`}>
                    <div className="w-full h-full bg-[#111] rounded-2xl flex items-center justify-center">
                        <Icon className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-4 tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-all flex justify-between items-center">
                    {title}
                    {href && <ArrowRight className="w-5 h-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 transform group-hover:text-zinc-300" />}
                </h3>
                <p className="text-zinc-400 leading-relaxed font-medium">
                    {description}
                </p>
            </div>
        </motion.div>
    );

    if (href) {
        return (
            <Link href={href} className="block h-full">
                {cardContent}
            </Link>
        );
    }

    return cardContent;
}
