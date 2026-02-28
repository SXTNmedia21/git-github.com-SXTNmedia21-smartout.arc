"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Variants } from "framer-motion";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  ArrowRight,
  MapPin,
  ClipboardList,
  Snowflake,
  Building2,
  ShieldCheck,
  Users,
  Clock,
  SunSnow,
  CheckCircle2,
  Zap,
  Target,
  CloudSun,
  Leaf,
  CalendarClock,
  GraduationCap,
  MessageSquare,
  ListTodo,
  Globe,
  Sparkles,
} from "lucide-react";
import Navigation from "../components/navigation";
import Footer from "../components/footer";
import { WEB_APP_LINKS } from "../lib/web-app-url";

const VoiceAssistant = dynamic(() => import("../components/voice-assistant"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] w-full rounded-[40px] border border-white/10 bg-[#0a0a0c]/50 backdrop-blur-xl" />
  ),
});

const MOCK_LOCATIONS = [
  {
    id: 1,
    name: "Sentralstasjonen",
    city: "Oslo",
    employees: 42,
    icon: MapPin,
    href: "/concepts/lokations",
  },
  {
    id: 2,
    name: "Bryggekanten",
    city: "Bergen",
    employees: 28,
    icon: Building2,
    href: "/concepts/lokations",
  },
  {
    id: 3,
    name: "Torget Restaurant",
    city: "Trondheim",
    employees: 35,
    icon: Building2,
    href: "/concepts/lokations",
  },
];

const MOCK_PROCEDURES = [
  {
    id: "proc-1",
    name: "Morgenrutiner",
    taskCount: 12,
    icon: CheckCircle2,
    color: "text-emerald-400",
    href: "/concepts/procedures",
  },
  {
    id: "proc-2",
    name: "IK-Mat Sjekk",
    taskCount: 8,
    icon: ShieldCheck,
    color: "text-blue-400",
    href: "/concepts/procedures",
  },
  {
    id: "proc-3",
    name: "Nedvask Kjøkken",
    taskCount: 24,
    icon: Zap,
    color: "text-rose-400",
    href: "/concepts/procedures",
  },
  {
    id: "proc-4",
    name: "Varemottak",
    taskCount: 5,
    icon: Target,
    color: "text-amber-400",
    href: "/concepts/procedures",
  },
];

const MOCK_SEASONS = [
  {
    id: "season-1",
    name: "Sommerdrift",
    period: "Jun - Aug",
    icon: CloudSun,
    active: true,
    href: "/concepts/seasons",
  },
  {
    id: "season-2",
    name: "Julebordsesong",
    period: "Nov - Des",
    icon: Snowflake,
    active: false,
    href: "/concepts/seasons",
  },
  {
    id: "season-3",
    name: "Høstmeny",
    period: "Sep - Okt",
    icon: Leaf,
    active: false,
    href: "/concepts/seasons",
  },
];

export default function SmartoutLandingPage() {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("locations");
  const onboardingHref = WEB_APP_LINKS.onboarding;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { stiffness: 100, damping: 15 },
    },
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] font-sans text-white selection:bg-orange-500/30">
      {/* Dynamic Premium Background */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]">
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:24px_24px]"></div>

        {/* Noise overlay - reduced complexity for performance */}
        <div
          className="absolute inset-0 opacity-[0.010]"
          style={{
            backgroundImage:
              'url(\'data:image/svg+xml,%3Csvg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="n"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23n)"/%3E%3C/svg%3E\')',
          }}
        ></div>

        {/* Refined Glowing Orbs with Hardware Acceleration */}
        <div
          className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-orange-600/10 mix-blend-screen blur-[100px] will-change-[opacity] motion-safe:animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute top-[20%] right-[-10%] h-[40vw] w-[40vw] rounded-full bg-rose-600/10 mix-blend-screen blur-[120px] will-change-[opacity] motion-safe:animate-pulse"
          style={{ animationDuration: "12s" }}
        />
        <div
          className="absolute bottom-[-20%] left-[20%] h-[60vw] w-[60vw] rounded-full bg-purple-600/10 mix-blend-screen blur-[120px] will-change-[opacity] motion-safe:animate-pulse"
          style={{ animationDuration: "10s" }}
        />
      </div>

      {/* Navigation */}
      <Navigation />

      <main className="relative z-10 mx-auto max-w-7xl px-6 pt-32 pb-20">
        {/* MAIN HERO SECTION */}
        <div className="relative flex min-h-[calc(100dvh-120px)] flex-col items-center justify-center gap-8 pt-20 pb-10 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="z-20 mx-auto flex max-w-5xl flex-col items-center"
          >
            <motion.div
              variants={itemVariants}
              className="group relative mb-8 inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-md"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-rose-500/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="absolute -inset-[1px] rounded-full bg-gradient-to-r from-orange-500 to-rose-500 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-30" />
              <Zap className="relative z-10 h-4 w-4 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]" />
              <span className="relative z-10">
                Den komplette plattformen for serveringsbransjen
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="mb-8 text-4xl leading-[1.05] font-black tracking-tighter drop-shadow-2xl sm:text-6xl md:text-8xl lg:text-[7.5rem]"
            >
              Én plattform. <br />
              <span className="relative inline-block">
                <span className="absolute -inset-2 bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 opacity-20 blur"></span>
                <span className="relative bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]">
                  Full kontroll.
                </span>
              </span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mb-12 max-w-3xl text-xl leading-relaxed font-medium text-zinc-400 md:text-2xl"
            >
              Samle vaktplaner, HR, kommunikasjon, stemplingsur og internkontroll i ett og samme
              lynraske system. Reduser kaos og øk fortjenesten.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center justify-center gap-6"
            >
              <Link
                href={onboardingHref}
                className="group relative flex items-center justify-center gap-3 rounded-full bg-white px-10 py-5 text-lg font-black text-zinc-950 shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(255,255,255,0.4)]"
              >
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 opacity-20 blur transition duration-500 group-hover:opacity-50"></div>
                <span className="relative flex items-center gap-3">
                  Opprett din SmartOut{" "}
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>

              <a
                href="#lise"
                className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-full px-10 py-5 text-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="absolute inset-0 rounded-full border border-white/10 bg-white/5 backdrop-blur-md transition-colors group-hover:bg-white/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-800/50 to-zinc-700/50 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute -inset-[1px] rounded-full bg-gradient-to-r from-white/20 to-white/0 opacity-0 blur-[1px] transition-opacity group-hover:opacity-100" />
                <span className="relative font-bold text-white group-hover:drop-shadow-md">
                  Møt AI-assistenten Lise
                </span>
              </a>
            </motion.div>
          </motion.div>

          {/* Abstract App Mockup Visual */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, type: "spring", stiffness: 50 }}
            className="relative z-10 mt-12 hidden w-full max-w-6xl md:block"
          >
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-x-0 bottom-0 z-20 h-1/2 bg-gradient-to-t from-[#050505] to-transparent" />
              <div className="absolute -inset-4 rounded-t-[40px] bg-gradient-to-r from-orange-500/10 via-rose-500/10 to-purple-500/10 opacity-50 blur-2xl" />
              <div className="relative overflow-hidden rounded-t-[40px] border border-white/10 bg-[#0a0a0c]/60 shadow-[0_-20px_80px_-20px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
                {/* Window controls */}
                <div className="flex h-12 items-center gap-2 border-b border-white/5 bg-white/5 px-6">
                  <div className="h-3.5 w-3.5 rounded-full bg-rose-500/80" />
                  <div className="h-3.5 w-3.5 rounded-full bg-amber-500/80" />
                  <div className="h-3.5 w-3.5 rounded-full bg-emerald-500/80" />
                  <div className="ml-4 h-6 w-64 rounded-full bg-white/5" />
                </div>
                {/* Dashboard mockup content */}
                <div className="grid h-[500px] grid-cols-12 gap-8 p-8">
                  {/* Sidebar */}
                  <div className="col-span-3 flex flex-col gap-4">
                    <div className="mb-8 h-12 w-full rounded-2xl bg-white/5" />
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="h-10 w-full rounded-xl border border-white/5 bg-white/5"
                      />
                    ))}
                  </div>
                  {/* Main Content */}
                  <div className="col-span-9 flex flex-col gap-8">
                    <div className="flex h-40 w-full flex-col justify-end rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/20 to-rose-500/5 p-8">
                      <div className="mb-4 h-8 w-1/3 rounded-lg bg-white/10" />
                      <div className="h-4 w-1/4 rounded-lg bg-white/5" />
                    </div>
                    <div className="grid flex-1 grid-cols-3 gap-6">
                      <div className="col-span-2 rounded-3xl border border-white/5 bg-white/5 p-6" />
                      <div className="col-span-1 flex flex-col gap-4 rounded-3xl border border-white/5 bg-white/5 p-6">
                        {[...Array(4)].map((_, i) => (
                          <div
                            key={i}
                            className="w-full flex-1 rounded-xl border border-white/5 bg-white/5"
                          />
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
        <div className="relative mt-32 mb-12 flex w-full items-center overflow-hidden py-12">
          <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-48 bg-gradient-to-r from-zinc-950 to-transparent"></div>
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-48 bg-gradient-to-l from-zinc-950 to-transparent"></div>
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: "-50%" }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="flex w-max items-center gap-24 px-4 whitespace-nowrap opacity-50"
          >
            <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-zinc-400">
              <Zap className="h-5 w-5" />
              TRIPLETEX
            </div>
            <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-zinc-400">
              <Building2 className="h-5 w-5" />
              VISMA
            </div>
            <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-zinc-400">
              <Users className="h-5 w-5" />
              ZETTLE
            </div>
            <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-zinc-400">
              <Target className="h-5 w-5" />
              LIGHTSPEED
            </div>
            <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-zinc-400">
              <ShieldCheck className="h-5 w-5" />
              POWEROFFICE
            </div>
            <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-zinc-400">
              <Zap className="h-5 w-5" />
              TRIPLETEX
            </div>
            <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-zinc-400">
              <Building2 className="h-5 w-5" />
              VISMA
            </div>
            <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-zinc-400">
              <Users className="h-5 w-5" />
              ZETTLE
            </div>
            <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-zinc-400">
              <Target className="h-5 w-5" />
              LIGHTSPEED
            </div>
            <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-zinc-400">
              <ShieldCheck className="h-5 w-5" />
              POWEROFFICE
            </div>
          </motion.div>
        </div>

        {/* LISE HERO SECTION */}
        <div
          id="lise"
          className="relative flex min-h-[calc(100dvh-120px)] flex-col items-center justify-between gap-16 py-32 lg:flex-row"
        >
          {/* Soft background glow for Lise section */}
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/5 mix-blend-screen blur-[120px]" />

          <motion.div
            className="max-w-2xl flex-1"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <motion.div
              variants={itemVariants}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-bold tracking-wider text-orange-400 uppercase"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
              </span>
              Møt fremtidens workforce management
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="mb-6 text-5xl leading-[1.1] font-extrabold tracking-tight md:text-7xl"
            >
              Møt{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Lise
              </span>
              ,<br />
              din digitale kollega.
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mb-10 max-w-xl text-lg leading-relaxed text-zinc-400 md:text-xl"
            >
              SmartOut er bygget for den norske serveringsbransjen. Reduser administrativt arbeid
              fra timer til minutter, integrer ansatte på tvers av språkbarrierer, og få full
              kontroll over lønnskostnader og compliance (Mattilsynet/Arbeidstilsynet) i sanntid.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => setIsAssistantOpen(true)}
                className="group relative flex items-center gap-3 rounded-full bg-white px-8 py-4 text-lg font-bold text-zinc-950 shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_60px_rgba(255,255,255,0.2)]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white transition-transform group-hover:scale-110">
                  <Mic className="h-4 w-4" />
                </div>
                Start Lise Botsson
              </button>

              <a
                href="#workspace"
                className="flex items-center gap-2 px-6 py-4 font-semibold text-zinc-400 transition-colors hover:text-white"
              >
                Utforsk konsepter <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="mt-12 flex items-center gap-6 text-zinc-500"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-zinc-400" /> Tidsbesparelse
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-zinc-400" /> 100% Compliance
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-zinc-400" /> Høy Retensjon
              </div>
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
                  className="relative z-50 h-[600px] w-full"
                >
                  <VoiceAssistant
                    autoStart
                    missionId="landing-demo"
                    onClose={() => setIsAssistantOpen(false)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="group relative flex h-[600px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[40px] border border-white/10 bg-[#0a0a0c]/50 p-10 text-center shadow-2xl backdrop-blur-xl transition-colors hover:border-orange-500/30"
                  onClick={() => setIsAssistantOpen(true)}
                >
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#050505]/90 to-transparent" />
                  <div className="absolute -inset-2 z-0 bg-gradient-to-r from-orange-500/0 via-orange-500/10 to-transparent opacity-0 blur-2xl transition-opacity duration-1000 group-hover:opacity-100" />
                  <motion.div
                    animate={{
                      scale: [1, 1.05, 1],
                      boxShadow: [
                        "0 0 0px rgba(249,115,22,0)",
                        "0 0 20px rgba(249,115,22,0.1)",
                        "0 0 0px rgba(249,115,22,0)",
                      ],
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="relative z-20 mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-white/5 bg-white/5 transition-colors group-hover:border-orange-500/20 group-hover:bg-orange-500/10"
                  >
                    <div className="absolute inset-0 rounded-full border border-orange-500/20 opacity-0 group-hover:animate-ping group-hover:opacity-100" />
                    <Mic className="h-10 w-10 text-zinc-500 transition-colors group-hover:text-orange-500" />
                  </motion.div>
                  <h3 className="relative z-20 mb-2 text-2xl font-bold text-white">
                    Lise venter...
                  </h3>
                  <p className="relative z-20 mb-8 max-w-xs text-zinc-500">
                    Klikk her for å vekke röstassistenten og still spørsmål om vaktplan, onboarding
                    eller rutiner.
                  </p>

                  <div className="relative z-20 flex items-center gap-2 rounded-full border border-zinc-700/50 bg-zinc-800/80 px-4 py-2 text-xs font-bold text-zinc-400 shadow-xl transition-colors group-hover:bg-zinc-800 group-hover:text-zinc-300">
                    Trykk for å koble til <ArrowRight className="h-3 w-3" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* INTERACTIVE WORKSPACE SECTION */}
        <section
          id="workspace"
          className="relative z-10 mt-20 flex min-h-[100dvh] flex-col justify-center py-32"
        >
          {/* Ambient Glow */}
          <div className="pointer-events-none absolute top-0 right-0 h-[600px] w-[600px] rounded-full bg-blue-500/5 mix-blend-screen blur-[150px]" />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-black tracking-tight text-white sm:mb-6 sm:text-4xl">
              Se for deg ditt fremtidige workspace
            </h2>
            <p className="mx-auto max-w-2xl text-base text-zinc-400 sm:text-lg">
              Restaurantdrift er komplekst. Derfor er Smartout bygget for å speile din virkelighet
              tvers av alle aspekter. Slik organiserer stjernene bedriften sin for å overholde
              Arbeidstilsynets og Mattilsynets krav:
            </p>
          </motion.div>

          {/* Interactive Tabs */}
          <div className="hide-scrollbar mb-12 flex justify-center gap-4 overflow-x-auto pb-4">
            {[
              { id: "locations", label: "Lokasjoner", icon: MapPin },
              { id: "procedures", label: "Prosedyrer", icon: ClipboardList },
              { id: "seasons", label: "Sesonger", icon: SunSnow },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center gap-2 overflow-hidden rounded-[32px] px-8 py-4 text-base font-black transition-all duration-500 ${
                    isActive ? "text-white" : "text-zinc-500 hover:text-white"
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 rounded-[32px] bg-gradient-to-r from-orange-600/20 to-rose-600/20" />
                  )}
                  <div className="absolute inset-0 rounded-[32px] bg-white/5 opacity-0 transition-opacity group-hover:opacity-100" />
                  <Icon className={`relative z-10 h-5 w-5 ${isActive ? "text-orange-500" : ""}`} />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Panels */}
          <div className="relative min-h-[350px]">
            {/* Locations Panel */}
            {activeTab === "locations" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 gap-8 md:grid-cols-3"
              >
                {MOCK_LOCATIONS.map((loc) => (
                  <Link
                    href={loc.href}
                    key={loc.id}
                    className="group relative block overflow-hidden rounded-[40px] border border-white/5 bg-[#0a0a0c]/40 p-10 shadow-2xl backdrop-blur-3xl transition-all duration-500 hover:-translate-y-2 hover:border-white/10"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50 transition-all duration-500 group-hover:via-orange-500/50 group-hover:opacity-100" />
                    <div className="absolute -inset-1 bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
                    <div className="relative z-10 mb-8 flex h-16 w-16 items-center justify-center rounded-[24px] border border-orange-500/10 bg-gradient-to-tr from-orange-600/20 to-orange-400/5 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:bg-orange-600/30">
                      <loc.icon className="h-8 w-8 text-orange-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.5)]" />
                    </div>
                    <h3 className="mb-2 text-2xl font-bold text-white">{loc.name}</h3>
                    <div className="flex items-center justify-between font-medium text-zinc-400">
                      <span>{loc.city}</span>
                      <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 px-3 py-1.5">
                        <Users className="h-4 w-4 text-orange-400" /> {loc.employees} ansatte
                      </span>
                    </div>
                  </Link>
                ))}
              </motion.div>
            )}

            {/* Procedures Panel */}
            {activeTab === "procedures" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 gap-6 md:grid-cols-4"
              >
                {MOCK_PROCEDURES.map((proc) => (
                  <Link
                    href={proc.href}
                    key={proc.id}
                    className="group relative block flex flex-col items-center overflow-hidden rounded-[32px] border border-white/5 bg-[#0a0a0c]/40 p-8 text-center shadow-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-white/10"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div
                      className={`relative z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-black/50 ${proc.color} shadow-inner transition-transform duration-500 group-hover:scale-110`}
                    >
                      <proc.icon className="h-10 w-10" />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-white">{proc.name}</h3>
                    <span className="rounded-full bg-black/30 px-3 py-1 text-sm font-bold tracking-widest text-zinc-500 uppercase">
                      {proc.taskCount} Oppgaver
                    </span>
                  </Link>
                ))}
              </motion.div>
            )}

            {/* Seasons Panel */}
            {activeTab === "seasons" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 gap-8 md:grid-cols-3"
              >
                {MOCK_SEASONS.map((season) => (
                  <Link
                    href={season.href}
                    key={season.id}
                    className={`block rounded-[32px] border p-10 shadow-2xl backdrop-blur-xl ${season.active ? "border-orange-500/40 bg-orange-500/10 shadow-[0_0_40px_-10px_rgba(249,115,22,0.3)]" : "border-white/5 bg-[#0a0a0c]/40 hover:border-white/10 hover:bg-[#0a0a0c]/60"} group relative overflow-hidden transition-all duration-300 hover:-translate-y-2`}
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    {season.active && (
                      <span className="absolute top-6 right-6 z-10 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1.5 text-xs font-black tracking-wider text-white uppercase shadow-lg">
                        Aktiv nå
                      </span>
                    )}
                    <season.icon
                      className={`mb-8 h-12 w-12 ${season.active ? "text-orange-400" : "text-zinc-500"}`}
                    />
                    <h3 className="mb-2 text-3xl font-black text-white">{season.name}</h3>
                    <p className="text-lg font-medium text-zinc-400">{season.period}</p>
                  </Link>
                ))}
              </motion.div>
            )}
          </div>
        </section>

        {/* COMPLIANCE SECTION */}
        <section className="relative z-10 mt-20 py-40">
          {/* Blended background for compliance */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-[150px]" />

          <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            >
              <ShieldCheck className="h-10 w-10" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-6 text-4xl font-black tracking-tight text-white sm:text-5xl"
            >
              Sov godt om natten.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto mb-16 max-w-2xl text-lg text-zinc-400"
            >
              Når Mattilsynet eller Arbeidstilsynet banker på døren, er alt klart. Vi sikrer at du
              automatisk følger regelverket for arbeidstid, pauser, og IK-mat.
            </motion.p>

            <div className="relative mx-auto grid max-w-5xl grid-cols-1 gap-8 text-left md:grid-cols-2">
              {/* Decorative divider */}
              <div className="absolute top-1/2 left-1/2 hidden h-3/4 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent md:block"></div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="group relative cursor-pointer p-10"
              >
                <Link
                  href="/features/haccp-complience"
                  className="absolute inset-0 z-20 rounded-[40px]"
                ></Link>
                <div className="absolute inset-0 rounded-[40px] bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100" />
                <div className="pointer-events-none relative z-10">
                  <h3 className="mb-6 flex items-center gap-4 text-2xl font-bold text-white transition-colors group-hover:text-emerald-300">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/20">
                      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#111]">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      </div>
                    </div>
                    Mattilsynet
                    <ArrowRight className="ml-auto h-5 w-5 -translate-x-4 transform text-emerald-400 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                  </h3>
                  <p className="text-lg leading-relaxed text-zinc-400 transition-colors group-hover:text-zinc-300">
                    Automatisk temperaturlogging, komplett renholdsprogram, og avviksrapportering
                    bygget rett inn i rutinemodulen.
                  </p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="group relative cursor-pointer p-10"
              >
                <Link
                  href="/features/shiftplanner"
                  className="absolute inset-0 z-20 rounded-[40px]"
                ></Link>
                <div className="absolute inset-0 rounded-[40px] bg-gradient-to-bl from-emerald-500/5 to-transparent opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100" />
                <div className="pointer-events-none relative z-10">
                  <h3 className="mb-6 flex items-center gap-4 text-2xl font-bold text-white transition-colors group-hover:text-emerald-300">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/20">
                      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#111]">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      </div>
                    </div>
                    Arbeidstilsynet
                    <ArrowRight className="ml-auto h-5 w-5 -translate-x-4 transform text-emerald-400 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                  </h3>
                  <p className="text-lg leading-relaxed text-zinc-400 transition-colors group-hover:text-zinc-300">
                    Automatisk hviletidsvarsling, signerte arbeidskontrakter digitalt, og timeføring
                    som sperrer for ulovlig overtid.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Showcase Section */}
        <section
          id="features"
          className="relative z-10 flex min-h-[100dvh] flex-col justify-center py-40 pt-20"
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="mx-auto mb-20 max-w-3xl lg:text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-bold tracking-widest text-orange-400 uppercase sm:mb-6 sm:text-sm">
              <Zap className="h-4 w-4" /> Neste generasjons plattform
            </div>
            <h2 className="mb-4 text-3xl leading-tight font-black tracking-tight text-white sm:mb-6 sm:text-4xl">
              Ikke bare programvare.
              <br />
              En ny måte å jobbe på.
            </h2>
            <p className="px-2 text-base text-zinc-400 sm:px-0 sm:text-lg">
              Vi har byttet ut de gamle, trege systemene med et lynraskt, AI-drevet grensesnitt som
              de ansatte faktisk elsker å bruke. Tidsbesparende for ledere, motiverende for teamet.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
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
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="relative z-10"
              >
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold tracking-widest text-blue-400 uppercase">
                  <Sparkles className="h-4 w-4" /> AI-drevet Onboarding
                </div>
                <h2 className="mb-6 text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl">
                  I gang på minutter,
                  <br />
                  ikke måneder.
                </h2>
                <p className="mb-8 text-lg leading-relaxed text-zinc-400">
                  Glem eviglange implementeringsprosjekter. Du oppgir URL-en til restauranten din,
                  og vår AI skraper menyer, åpningstider, lokasjoner og bygger systemet for deg helt
                  automatisk.
                </p>
                <motion.ul
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={{
                    visible: { transition: { staggerChildren: 0.2 } },
                    hidden: {},
                  }}
                  className="mb-10 space-y-6"
                >
                  <motion.li
                    variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                    className="flex items-center gap-4 text-lg font-medium text-zinc-300"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    Skriv inn din nåværende nettside
                  </motion.li>
                  <motion.li
                    variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                    className="flex items-center gap-4 text-lg font-medium text-zinc-300"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    AI analyserer og bygger arbeidsplassen
                  </motion.li>
                  <motion.li
                    variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                    className="flex items-center gap-4 text-lg font-medium text-zinc-300"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <Users className="h-6 w-6" />
                    </div>
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
                <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/10 via-purple-500/5 to-emerald-500/10 blur-[120px]" />

                {/* URL Entry visually blended */}
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="group relative">
                    <div className="absolute -inset-2 rounded-[32px] bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-50 blur-xl transition duration-1000 group-hover:opacity-100 group-hover:duration-200"></div>
                    <div className="relative flex items-center gap-4 rounded-[32px] border border-white/10 bg-[#0a0a0c]/60 p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
                      <div className="flex h-14 flex-1 items-center rounded-2xl bg-white/5 px-6 font-mono text-sm text-zinc-300 sm:text-base">
                        https://din-restaurant.no
                      </div>
                      <div className="flex h-14 cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 font-black text-white transition-all hover:shadow-[0_0_30px_-5px_rgba(79,70,229,0.5)]">
                        Generer
                      </div>
                    </div>
                  </div>

                  {/* Console visually blended */}
                  <div className="relative overflow-hidden rounded-[40px] border border-white/5 bg-[#0a0a0c]/80 p-10 shadow-2xl backdrop-blur-xl">
                    {/* Subtle internal glow */}
                    <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px]" />

                    <div className="relative z-10">
                      <div className="mb-10 flex items-center gap-3">
                        <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                        <span className="text-sm font-bold tracking-wider text-blue-400 uppercase">
                          Analyserer...
                        </span>
                      </div>
                      <div className="space-y-8">
                        <div className="flex items-center gap-6">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-gradient-to-tr from-emerald-600/20 to-teal-400/20">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div className="h-2 w-1/3 rounded-full bg-emerald-500/40" />
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-gradient-to-tr from-emerald-600/20 to-teal-400/20">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div className="h-2 w-1/2 rounded-full bg-emerald-500/40" />
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10">
                            <div className="absolute inset-0 animate-spin rounded-2xl border-[3px] border-transparent border-t-emerald-500" />
                          </div>
                          <div className="h-2 w-3/4 rounded-full bg-white/10" />
                        </div>
                        <div className="flex items-center gap-6 opacity-30">
                          <div className="h-10 w-10 shrink-0 rounded-2xl border border-white/10" />
                          <div className="h-2 w-2/3 rounded-full bg-white/10" />
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
        <section id="priser" className="relative z-10 mt-10 py-32">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-bold tracking-widest text-purple-400 uppercase"
            >
              <Sparkles className="h-4 w-4" /> Enkel Prismodell
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-6 text-4xl font-black tracking-tight text-white sm:text-5xl"
            >
              Mindre admin.
              <br />
              Mer på bunnlinjen.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto mb-12 max-w-2xl text-lg text-zinc-400"
            >
              Vi gir deg alt du trenger for å drive restauranten din mer lønnsomt — til en pris som
              gir mening.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Link
                href="/pricing"
                className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#0a0a0c]/80 px-8 py-4 text-lg font-bold text-white shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/5"
              >
                Se våre priser og pakker
                <ArrowRight className="h-5 w-5 text-purple-400 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* CTA Footer Section */}
        <section className="relative z-10 mt-10 overflow-hidden py-32 sm:py-48">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0c]/80 to-[#0a0a0c]"></div>
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-orange-500/10 blur-[150px]"></div>

          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <motion.h2
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-6 text-4xl font-black tracking-tight text-white sm:mb-8 sm:text-5xl"
            >
              Klar for fremtiden?
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex w-full justify-center"
            >
              <Link href={onboardingHref} className="group relative w-full sm:w-auto">
                <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 opacity-50 blur-xl transition duration-500 group-hover:opacity-100"></div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="relative mx-auto flex w-full items-center justify-center gap-3 rounded-full bg-white px-8 py-4 text-sm font-black text-zinc-950 shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all group-hover:-translate-y-1 group-hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] sm:w-auto sm:px-12 sm:py-5 sm:text-lg"
                >
                  <Globe className="h-5 w-5 text-orange-600 drop-shadow-sm" />
                  Opprett Workspace nå
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
  color,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
  color: string;
  href?: string;
}) {
  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -10 }}
      className={`group relative h-full overflow-hidden rounded-[32px] border border-white/5 bg-[#0a0a0c]/40 shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:border-white/10 ${href ? "cursor-pointer" : ""}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div
        className={`absolute -inset-1 bg-gradient-to-b ${color} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-10`}
      ></div>

      <div className="relative z-10 flex h-full flex-col p-8">
        <div className={`h-14 w-14 rounded-2xl bg-gradient-to-tr ${color} mb-6 p-[1px] shadow-2xl`}>
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#111]">
            <Icon className="h-6 w-6 text-white drop-shadow-md" />
          </div>
        </div>
        <h3 className="mb-4 flex items-center justify-between text-xl font-bold tracking-tight text-white transition-all group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 group-hover:bg-clip-text group-hover:text-transparent">
          {title}
          {href && (
            <ArrowRight className="h-5 w-5 -translate-x-4 transform opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-zinc-300 group-hover:opacity-100" />
          )}
        </h3>
        <p className="leading-relaxed font-medium text-zinc-400">{description}</p>
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
