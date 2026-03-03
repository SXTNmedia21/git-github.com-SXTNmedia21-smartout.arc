"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Variants } from "framer-motion";
import { m } from "framer-motion";
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
  Sparkles,
  Bot,
  BellRing,
  CalendarCheck,
} from "lucide-react";
import Navigation from "../components/navigation";
import Footer from "../components/footer";
import WorkspaceAnalyzer from "../components/workspace-analyzer";
import { WEB_APP_LINKS } from "../lib/web-app-url";

const VariantELanding = dynamic(() => import("../components/landing/VariantELanding"));
const VariantTLanding = dynamic(() => import("../components/landing/VariantTLanding"));
const VariantKLanding = dynamic(() => import("../components/landing/VariantKLanding"));
const VariantALanding = dynamic(() => import("../components/landing/VariantALanding"));
const VariantFLanding = dynamic(() => import("../components/landing/VariantFLanding"));
const VariantSLanding = dynamic(() => import("../components/landing/VariantSLanding"));
const VoiceDemoWidget = dynamic(() => import("../components/landing/VoiceDemoWidget"));
import { useVariant } from "../lib/landing-variant";
import { usePageTracking, useTrackCta } from "../hooks/useTracking";
import { useScrollTracking } from "../hooks/useScrollTracking";
import { useClickTracking } from "../hooks/useClickTracking";
import { useSessionLifecycle } from "../hooks/useSessionLifecycle";
import { VARIANT_VOICE_CONFIG, VARIANT_AI_SECTION } from "../lib/variant-voice-config";

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
  return (
    <Suspense>
      <SmartoutLandingPageContent />
    </Suspense>
  );
}

function SmartoutLandingPageContent() {
  const { variant } = useVariant();
  // Track page view once per browser session (fire-and-forget, no blocking)
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const trackCta = useTrackCta();
  const [activeTab, setActiveTab] = useState("locations");
  const onboardingHref = WEB_APP_LINKS.onboarding;

  if (variant === "E") return <VariantELanding />;
  if (variant === "T") return <VariantTLanding />;
  if (variant === "K") return <VariantKLanding />;
  if (variant === "A") return <VariantALanding />;
  if (variant === "F") return <VariantFLanding />;
  if (variant === "S") return <VariantSLanding />;

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
        {/* Subtle Grid Pattern — masked to fade out at edges */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:24px_24px]" />

        {/* Ambient Glowing Orbs — slow float animation, GPU-composited */}
        <div
          className="motion-safe:animate-glow-shift absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-orange-600/8 mix-blend-screen blur-[100px]"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="motion-safe:animate-glow-shift absolute top-[20%] right-[-10%] h-[40vw] w-[40vw] rounded-full bg-rose-600/8 mix-blend-screen blur-[120px]"
          style={{ animationDelay: "-3s" }}
        />
        <div
          className="motion-safe:animate-glow-shift absolute bottom-[-20%] left-[20%] h-[60vw] w-[60vw] rounded-full bg-purple-600/6 mix-blend-screen blur-[120px]"
          style={{ animationDelay: "-5s" }}
        />
      </div>

      {/* Navigation */}
      <Navigation />

      <main className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-12 sm:pt-32 sm:pb-20">
        {/* MAIN HERO SECTION */}
        <div className="relative flex min-h-0 flex-col items-center justify-center gap-6 pt-10 pb-6 text-center sm:min-h-[calc(100dvh-120px)] sm:gap-8 sm:pt-20 sm:pb-10">
          <m.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="z-20 mx-auto flex max-w-5xl flex-col items-center"
          >
            <m.div
              variants={itemVariants}
              className="group relative mb-4 inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-md sm:mb-8"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-rose-500/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="absolute -inset-[1px] rounded-full bg-gradient-to-r from-orange-500 to-rose-500 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-30" />
              <Zap className="relative z-10 h-4 w-4 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]" />
              <span className="relative z-10">
                Den komplette plattformen for serveringsbransjen
              </span>
            </m.div>

            <m.h1
              variants={itemVariants}
              className="mb-4 text-3xl leading-[1.05] font-black tracking-tighter drop-shadow-2xl sm:mb-8 sm:text-5xl md:text-7xl lg:text-[7.5rem]"
            >
              Én plattform. <br />
              <span className="relative inline-block">
                <span className="absolute -inset-2 bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 opacity-20 blur"></span>
                <span className="relative bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]">
                  Full kontroll.
                </span>
              </span>
            </m.h1>

            <m.p
              variants={itemVariants}
              className="mb-8 max-w-3xl text-lg leading-relaxed font-medium text-zinc-400 sm:mb-12 sm:text-xl md:text-2xl"
            >
              Samle vaktplaner, HR, kommunikasjon, stemplingsur og internkontroll i ett og samme
              lynraske system. Reduser kaos og øk fortjenesten.
            </m.p>

            <m.div
              variants={itemVariants}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6"
            >
              <Link
                href={onboardingHref}
                onClick={() => trackCta("Opprett din SmartOut")}
                className="group relative flex w-full items-center justify-center gap-3 rounded-full bg-white px-8 py-4 text-base font-black text-zinc-950 shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] sm:w-auto sm:px-10 sm:py-5 sm:text-lg"
              >
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 opacity-20 blur transition duration-500 group-hover:opacity-40" />
                <span className="relative flex items-center gap-3">
                  Opprett din SmartOut{" "}
                  <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Link>

              <a
                href="#lise"
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full border border-white/10 bg-white/5 px-8 py-4 text-base font-bold text-white backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/10 sm:w-auto sm:px-10 sm:py-5 sm:text-lg"
              >
                Møt AI-assistenten Lise
              </a>
            </m.div>
          </m.div>

          {/* Abstract App Mockup Visual */}
          <m.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, type: "spring", stiffness: 50 }}
            className="relative z-10 hidden w-full max-w-6xl md:mt-12 md:block"
          >
            <m.div
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
            </m.div>
          </m.div>
        </div>

        {/* BRAND / INTEGRATION MARQUEE */}
        <div className="relative mt-12 mb-8 flex w-full items-center overflow-hidden py-6 sm:mt-32 sm:mb-12 sm:py-12">
          {/* Edge fade masks */}
          <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-32 bg-gradient-to-r from-[#050505] to-transparent sm:w-48" />
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-32 bg-gradient-to-l from-[#050505] to-transparent sm:w-48" />
          <m.div
            initial={{ x: 0 }}
            animate={{ x: "-50%" }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="flex w-max items-center gap-12 px-4 whitespace-nowrap opacity-40 sm:gap-24"
          >
            {/* Render integration brands twice for seamless loop */}
            {[0, 1].map((set) =>
              [
                { icon: Zap, name: "TRIPLETEX" },
                { icon: Building2, name: "VISMA" },
                { icon: Users, name: "ZETTLE" },
                { icon: Target, name: "LIGHTSPEED" },
                { icon: ShieldCheck, name: "POWEROFFICE" },
              ].map((brand) => (
                <div
                  key={`${set}-${brand.name}`}
                  className="flex items-center gap-2 text-lg font-black tracking-tighter text-zinc-400 sm:text-2xl"
                >
                  <brand.icon className="h-5 w-5" />
                  {brand.name}
                </div>
              )),
            )}
          </m.div>
        </div>

        {/* LISE HERO SECTION */}
        <div
          id="lise"
          className="relative flex min-h-0 flex-col items-center justify-between gap-10 py-16 sm:min-h-[calc(100dvh-120px)] sm:gap-16 sm:py-32 lg:flex-row"
        >
          {/* Soft background glow for Lise section */}
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/5 mix-blend-screen blur-[120px]" />

          <m.div
            className="max-w-2xl flex-1"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <m.div
              variants={itemVariants}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-bold tracking-wider text-orange-400 uppercase sm:mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
              </span>
              Møt fremtidens workforce management
            </m.div>

            <m.h1
              variants={itemVariants}
              className="mb-4 text-4xl leading-[1.1] font-extrabold tracking-tight sm:mb-6 sm:text-5xl md:text-7xl"
            >
              Møt{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Lise
              </span>
              ,<br />
              din digitale kollega.
            </m.h1>

            <m.p
              variants={itemVariants}
              className="mb-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:mb-10 sm:text-lg md:text-xl"
            >
              SmartOut er bygget for den norske serveringsbransjen. Reduser administrativt arbeid
              fra timer til minutter, integrer ansatte på tvers av språkbarrierer, og få full
              kontroll over lønnskostnader og compliance (Mattilsynet/Arbeidstilsynet) i sanntid.
            </m.p>

            <m.div variants={itemVariants} className="flex flex-wrap items-center gap-4">
              <a
                href="#smartout-ai"
                onClick={() => trackCta("Start Lise Botsson")}
                className="group relative flex items-center gap-3 rounded-full bg-white px-8 py-4 text-lg font-bold text-zinc-950 shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_60px_rgba(255,255,255,0.2)]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white transition-transform group-hover:scale-110">
                  <Mic className="h-4 w-4" />
                </div>
                Start Lise Botsson
              </a>

              <a
                href="#workspace"
                className="flex items-center gap-2 px-6 py-4 font-semibold text-zinc-400 transition-colors hover:text-white"
              >
                Utforsk konsepter <ArrowRight className="h-4 w-4" />
              </a>
            </m.div>

            <m.div
              variants={itemVariants}
              className="mt-10 grid grid-cols-3 gap-3 sm:mt-12 sm:flex sm:items-center sm:gap-6"
            >
              {[
                { icon: Clock, label: "Tidsbesparelse" },
                { icon: ShieldCheck, label: "100% Compliance" },
                { icon: Users, label: "Høy Retensjon" },
              ].map((stat, i) => (
                <m.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.15, duration: 0.4 }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-3 sm:flex-row sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0"
                >
                  <stat.icon className="h-4 w-4 text-zinc-400" />
                  <span className="text-center text-[11px] font-semibold text-zinc-500 sm:text-sm">
                    {stat.label}
                  </span>
                </m.div>
              ))}
            </m.div>
          </m.div>

          {/* Voice Assistant Floating Widget */}
          <div className="w-full lg:w-[450px]">
            <VoiceDemoWidget config={VARIANT_VOICE_CONFIG.B} height="600px" />
          </div>
        </div>

        {/* ─── Divider ─── */}
        <div className="section-divider relative z-10 my-8 sm:my-16" />

        {/* INTERACTIVE WORKSPACE SECTION */}
        <section
          id="workspace"
          className="relative z-10 flex min-h-0 flex-col justify-center py-16 sm:min-h-[100dvh] sm:py-32"
        >
          {/* Ambient Glow */}
          <div className="pointer-events-none absolute top-0 right-0 h-[600px] w-[600px] rounded-full bg-blue-500/5 mix-blend-screen blur-[150px]" />

          <m.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="mb-8 text-center sm:mb-16"
          >
            <h2 className="mb-3 text-2xl font-black tracking-tight text-white sm:mb-6 sm:text-4xl">
              Se for deg ditt fremtidige workspace
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-zinc-400 sm:text-lg">
              Restaurantdrift er komplekst. Derfor er Smartout bygget for å speile din virkelighet
              tvers av alle aspekter. Slik organiserer stjernene bedriften sin for å overholde
              Arbeidstilsynets og Mattilsynets krav:
            </p>
          </m.div>

          {/* Interactive Tabs */}
          <div className="mb-8 flex justify-center gap-1.5 px-2 sm:mb-12 sm:gap-3 sm:px-4">
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
                  className={`group relative flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-bold transition-all duration-300 sm:gap-2 sm:px-6 sm:py-4 sm:text-base sm:font-black ${
                    isActive
                      ? "border border-orange-500/30 bg-orange-500/10 text-white"
                      : "border border-white/5 bg-white/5 text-zinc-500 hover:border-white/10 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 sm:h-5 sm:w-5 ${isActive ? "text-orange-400" : ""}`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Panels */}
          <div className="relative min-h-[350px]">
            {/* Locations Panel */}
            {activeTab === "locations" && (
              <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mx-auto mb-6 max-w-2xl text-center sm:mb-10">
                  <h3 className="mb-2 text-lg font-black text-white sm:mb-3 sm:text-2xl">
                    Din arbeidsplass, delt opp og organisert
                  </h3>
                  <p className="mb-6 text-sm leading-relaxed text-zinc-400 sm:text-base">
                    Del opp virksomheten i lokasjoner, soner og utstyr — og knytt rutiner,
                    dokumentasjon og opplæring direkte til stedet der arbeidet skjer.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {["Flerlokasjon", "Soner & Utstyr", "Stedsbasert opplæring"].map((tag, i) => (
                      <m.span
                        key={tag}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.2 + i * 0.07 }}
                        className="rounded-full border border-orange-500/20 bg-orange-500/5 px-3 py-1 text-xs font-bold text-orange-300"
                      >
                        {tag}
                      </m.span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
                  {MOCK_LOCATIONS.map((loc, i) => (
                    <m.div
                      key={loc.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                    >
                      <Link
                        href={loc.href}
                        className="group relative block overflow-hidden rounded-3xl border border-white/5 bg-[#0a0a0c]/40 p-6 shadow-2xl backdrop-blur-3xl transition-all duration-500 hover:-translate-y-2 hover:border-white/10 sm:rounded-[40px] sm:p-10"
                      >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50 transition-all duration-500 group-hover:via-orange-500/50 group-hover:opacity-100" />
                        <div className="absolute -inset-1 bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
                        <div className="relative z-10 mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/10 bg-gradient-to-tr from-orange-600/20 to-orange-400/5 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:bg-orange-600/30 sm:mb-8 sm:h-16 sm:w-16 sm:rounded-[24px]">
                          <loc.icon className="h-6 w-6 text-orange-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.5)] sm:h-8 sm:w-8" />
                        </div>
                        <h3 className="mb-1 text-lg font-bold text-white sm:mb-2 sm:text-2xl">
                          {loc.name}
                        </h3>
                        <div className="flex items-center justify-between text-sm font-medium text-zinc-400">
                          <span>{loc.city}</span>
                          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm">
                            <Users className="h-3.5 w-3.5 text-orange-400 sm:h-4 sm:w-4" />{" "}
                            {loc.employees}
                          </span>
                        </div>
                      </Link>
                    </m.div>
                  ))}
                </div>
              </m.div>
            )}

            {/* Procedures Panel */}
            {activeTab === "procedures" && (
              <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mx-auto mb-6 max-w-2xl text-center sm:mb-10">
                  <h3 className="mb-2 text-lg font-black text-white sm:mb-3 sm:text-2xl">
                    Sjekklister, kontrollister og verifiseringsplaner
                  </h3>
                  <p className="mb-6 text-sm leading-relaxed text-zinc-400 sm:text-base">
                    Bygg prosedyrer som sikrer at alt blir gjort riktig, hver gang. Fra
                    morgenrutiner til IK-mat — med sporbar signering og automatisk oppfølging.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {["Sporbar signering", "Automatisk oppfølging", "HACCP-klar"].map((tag, i) => (
                      <m.span
                        key={tag}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.2 + i * 0.07 }}
                        className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-bold text-emerald-300"
                      >
                        {tag}
                      </m.span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-4">
                  {MOCK_PROCEDURES.map((proc, i) => (
                    <m.div
                      key={proc.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: i * 0.08 }}
                    >
                      <Link
                        href={proc.href}
                        className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0c]/40 p-5 text-center shadow-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-white/10 sm:rounded-[32px] sm:p-8"
                      >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div
                          className={`relative z-10 mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-black/50 ${proc.color} shadow-inner transition-transform duration-500 group-hover:scale-110 sm:mb-6 sm:h-20 sm:w-20 sm:rounded-2xl`}
                        >
                          <proc.icon className="h-7 w-7 sm:h-10 sm:w-10" />
                        </div>
                        <h3 className="mb-2 text-sm font-bold text-white sm:mb-3 sm:text-xl">
                          {proc.name}
                        </h3>
                        <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase sm:px-3 sm:py-1 sm:text-sm">
                          {proc.taskCount} Oppgaver
                        </span>
                      </Link>
                    </m.div>
                  ))}
                </div>
              </m.div>
            )}

            {/* Seasons Panel */}
            {activeTab === "seasons" && (
              <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mx-auto mb-6 max-w-2xl text-center sm:mb-10">
                  <h3 className="mb-2 text-lg font-black text-white sm:mb-3 sm:text-2xl">
                    Modulbasert drift, sesong for sesong
                  </h3>
                  <p className="mb-6 text-sm leading-relaxed text-zinc-400 sm:text-base">
                    Organiser hele virksomheten i sesonger. Lagre innstillinger, menyer, vaktplaner
                    og rutiner per sesong — og aktiver med ett klikk når tiden er inne.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {["Ett-klikk aktivering", "Lagrede oppsett", "Sesongbasert meny"].map(
                      (tag, i) => (
                        <m.span
                          key={tag}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.2 + i * 0.07 }}
                          className="rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-xs font-bold text-blue-300"
                        >
                          {tag}
                        </m.span>
                      ),
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
                  {MOCK_SEASONS.map((season, i) => (
                    <m.div
                      key={season.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                    >
                      <Link
                        href={season.href}
                        className={`block rounded-3xl border p-6 shadow-2xl backdrop-blur-xl sm:rounded-[32px] sm:p-10 ${season.active ? "border-orange-500/40 bg-orange-500/10 shadow-[0_0_40px_-10px_rgba(249,115,22,0.3)]" : "border-white/5 bg-[#0a0a0c]/40 hover:border-white/10 hover:bg-[#0a0a0c]/60"} group relative overflow-hidden transition-all duration-300 hover:-translate-y-2`}
                      >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        {season.active && (
                          <span className="absolute top-4 right-4 z-10 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2.5 py-1 text-[10px] font-black tracking-wider text-white uppercase shadow-lg sm:top-6 sm:right-6 sm:px-3 sm:py-1.5 sm:text-xs">
                            Aktiv nå
                          </span>
                        )}
                        <season.icon
                          className={`mb-5 h-8 w-8 sm:mb-8 sm:h-12 sm:w-12 ${season.active ? "text-orange-400" : "text-zinc-500"}`}
                        />
                        <h3 className="mb-1 text-xl font-black text-white sm:mb-2 sm:text-3xl">
                          {season.name}
                        </h3>
                        <p className="text-sm font-medium text-zinc-400 sm:text-lg">
                          {season.period}
                        </p>
                      </Link>
                    </m.div>
                  ))}
                </div>
              </m.div>
            )}
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="section-divider relative z-10 my-8 sm:my-16" />

        {/* COMPLIANCE SECTION */}
        <section className="relative z-10 py-16 sm:py-40">
          {/* Blended background for compliance */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-[150px]" />

          <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
            <m.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 sm:mb-8 sm:h-20 sm:w-20"
            >
              <m.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <ShieldCheck className="h-7 w-7 sm:h-10 sm:w-10" />
              </m.div>
            </m.div>
            <m.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-4 text-2xl font-black tracking-tight text-white sm:mb-6 sm:text-5xl"
            >
              Sov godt om natten.
            </m.h2>
            <m.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto mb-8 max-w-2xl text-sm text-zinc-400 sm:mb-16 sm:text-lg"
            >
              Når Mattilsynet eller Arbeidstilsynet banker på døren, er alt klart. Vi sikrer at du
              automatisk følger regelverket for arbeidstid, pauser, og IK-mat.
            </m.p>

            <div className="relative mx-auto grid max-w-5xl grid-cols-1 gap-2 text-left sm:gap-8 md:grid-cols-2">
              {/* Decorative divider */}
              <div className="absolute top-1/2 left-1/2 hidden h-3/4 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent md:block"></div>

              <m.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="group relative cursor-pointer p-5 sm:p-10"
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
              </m.div>
              <m.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="group relative cursor-pointer p-5 sm:p-10"
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
              </m.div>
            </div>
          </div>
        </section>

        {/* Features Showcase Section */}
        <section
          id="features"
          className="relative z-10 flex min-h-0 flex-col justify-center py-16 pt-8 sm:min-h-[100dvh] sm:py-40 sm:pt-20"
        >
          <m.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="mx-auto mb-10 max-w-3xl sm:mb-20 lg:text-center"
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
          </m.div>

          <div className="grid grid-cols-1 gap-4 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
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

        {/* ─── Divider ─── */}
        <div className="section-divider relative z-10 my-8 sm:my-16" />

        {/* ONBOARDING PROMISE SECTION */}
        <section className="relative z-10 py-16 sm:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 items-center gap-10 sm:gap-16 lg:grid-cols-2">
              <m.div
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
                <m.ul
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={{
                    visible: { transition: { staggerChildren: 0.2 } },
                    hidden: {},
                  }}
                  className="mb-6 space-y-4 sm:mb-10 sm:space-y-6"
                >
                  <m.li
                    variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                    className="flex items-center gap-4 text-lg font-medium text-zinc-300"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    Skriv inn din nåværende nettside
                  </m.li>
                  <m.li
                    variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                    className="flex items-center gap-4 text-lg font-medium text-zinc-300"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    AI analyserer og bygger arbeidsplassen
                  </m.li>
                  <m.li
                    variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                    className="flex items-center gap-4 text-lg font-medium text-zinc-300"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <Users className="h-6 w-6" />
                    </div>
                    Inviter ansatte og start opp med en gang
                  </m.li>
                </m.ul>
              </m.div>
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="relative"
              >
                <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/10 via-purple-500/5 to-emerald-500/10 blur-[120px]" />
                <div className="relative z-10">
                  <WorkspaceAnalyzer />
                </div>
              </m.div>
            </div>
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="section-divider relative z-10 my-8 sm:my-16" />

        {/* PRICING SECTION */}
        <section id="priser" className="relative z-10 py-16 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <m.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-bold tracking-widest text-purple-400 uppercase"
            >
              <Sparkles className="h-4 w-4" /> Enkel Prismodell
            </m.div>
            <m.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-6 text-4xl font-black tracking-tight text-white sm:text-5xl"
            >
              Mindre admin.
              <br />
              Mer på bunnlinjen.
            </m.h2>
            <m.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto mb-12 max-w-2xl text-lg text-zinc-400"
            >
              Vi gir deg alt du trenger for å drive restauranten din mer lønnsomt — til en pris som
              gir mening.
            </m.p>

            <m.div
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
            </m.div>
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="section-divider relative z-10 my-8 sm:my-16" />

        {/* SMARTOUT AI SECTION */}
        <section id="smartout-ai" className="relative z-10 py-16 sm:py-32">
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/5 mix-blend-screen blur-[120px]" />

          <div className="mx-auto max-w-7xl px-6">
            <m.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="mb-10 text-center sm:mb-16"
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-bold tracking-wider text-orange-400 uppercase sm:mb-6">
                <Bot className="h-3.5 w-3.5" />
                SmartOut AI
              </div>
              <h2 className="mb-3 text-3xl font-black tracking-tight text-white sm:mb-6 sm:text-5xl">
                {VARIANT_AI_SECTION.B.heading}
              </h2>
              <p className="mx-auto max-w-2xl text-sm text-zinc-400 sm:text-lg">
                {VARIANT_AI_SECTION.B.subheading}
              </p>
            </m.div>

            <div className="grid gap-10 lg:grid-cols-2">
              {/* AI capability cards */}
              <div className="space-y-6">
                {VARIANT_AI_SECTION.B.capabilities.map((cap, i) => (
                  <m.div
                    key={cap.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.12 }}
                    className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-colors hover:border-orange-500/20 hover:bg-orange-500/[0.03]"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                        {i === 0 && <Mic className="h-5 w-5 text-orange-400" />}
                        {i === 1 && <BellRing className="h-5 w-5 text-orange-400" />}
                        {i === 2 && <CalendarCheck className="h-5 w-5 text-orange-400" />}
                      </div>
                      <h3 className="text-lg font-bold text-white">{cap.title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400">{cap.description}</p>
                  </m.div>
                ))}
              </div>

              {/* Voice demo widget */}
              <VoiceDemoWidget config={VARIANT_VOICE_CONFIG.B} height="460px" />
            </div>
          </div>
        </section>

        {/* CTA Footer Section */}
        <section className="relative z-10 overflow-hidden py-16 sm:py-32 md:py-48">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0c]/80 to-[#0a0a0c]"></div>
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-orange-500/10 blur-[150px]"></div>

          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <m.h2
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-6 text-4xl font-black tracking-tight text-white sm:mb-8 sm:text-5xl"
            >
              Klar for fremtiden?
            </m.h2>
            <m.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex w-full justify-center"
            >
              <Link
                href={onboardingHref}
                onClick={() => trackCta("Kom i gang")}
                className="group relative block w-full sm:inline-block sm:w-auto"
              >
                <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 opacity-40 blur-xl transition duration-500 group-hover:opacity-80" />
                <span className="relative flex w-full items-center justify-center gap-3 rounded-full bg-white px-8 py-4 text-sm font-black text-zinc-950 shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300 group-hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] sm:w-auto sm:px-12 sm:py-5 sm:text-lg">
                  Kom i gang
                  <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Link>
            </m.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

// UI Events:
// - nav: href (feature card click — links to feature detail page)
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
    <m.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className={`group relative h-full overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0c]/40 shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:-translate-y-2 hover:border-white/10 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] sm:rounded-[32px] ${href ? "cursor-pointer" : ""}`}
    >
      {/* Top edge highlight on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {/* Color glow behind card on hover */}
      <div
        className={`absolute -inset-1 bg-gradient-to-b ${color} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-10`}
      />

      <div className="relative z-10 flex h-full flex-col p-5 sm:p-8">
        <div
          className={`h-11 w-11 rounded-xl bg-gradient-to-tr ${color} mb-4 p-[1px] shadow-2xl transition-transform duration-500 group-hover:scale-110 sm:mb-6 sm:h-14 sm:w-14 sm:rounded-2xl`}
        >
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#111]">
            <Icon className="h-6 w-6 text-white drop-shadow-md" />
          </div>
        </div>
        <h3 className="mb-2 flex items-center justify-between text-lg font-bold tracking-tight text-white transition-colors duration-300 sm:mb-4 sm:text-xl">
          {title}
          {href && (
            <ArrowRight className="h-5 w-5 -translate-x-4 transform text-zinc-400 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-white group-hover:opacity-100" />
          )}
        </h3>
        <p className="text-sm leading-relaxed font-medium text-zinc-400 sm:text-base">
          {description}
        </p>
      </div>
    </m.div>
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
