// ============================================
// VariantVLanding.tsx
// Landing page variant V — "Riktig person, riktig tid" (Intelligent Scheduling).
// Persona: Henrik, 45, driftssjef for a restaurant group with 3 locations.
// He manages 40+ employees across shifts. The pain: manual scheduling,
// overtime chaos, wrong competence on wrong shift.
//
// Design energy: Clean operational dashboard feel. Shift grids, calendar
// views, competence badges. Not playful — purposeful and efficient.
// Accent color: Cyan (cyan-400/500).
//
// Sections (6):
//   1. Hero — "Riktig person, riktig tid." + scheduling pain subtitle + CTA
//   2. The Problem — 3 cards showing scheduling chaos
//   3. How It Works — 3-step: define → match → publish
//   4. Live Schedule Preview — weekly shift grid mockup with competence indicators
//   5. Results — 3 soft metrics
//   6. Final CTA — strong close
//
// NO VoiceDemoWidget / Lise speaker.
// NO SmartOut AI section.
//
// Connected to: ../navigation.tsx (shared nav), ../footer.tsx (shared footer)
// ============================================

"use client";

import Link from "next/link";
import { m } from "framer-motion";
import {
  ArrowRight,
  Clock,
  AlertTriangle,
  Users,
  Puzzle,
  Zap,
  Send,
  CheckCircle2,
  CalendarDays,
  ShieldCheck,
  Smile,
  TrendingDown,
} from "lucide-react";
import Navigation from "../navigation";
import Footer from "../footer";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { usePageTracking, useTrackCta } from "../../hooks/useTracking";
import { useScrollTracking } from "../../hooks/useScrollTracking";
import { useClickTracking } from "../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../hooks/useSessionLifecycle";

// UI Events:
// - nav: WEB_APP_LINKS.onboarding (hero CTA, final CTA)
// - action: trackCta("Start gratis") (hero primary)
// - action: trackCta("Se hvordan det fungerer") (hero secondary, scrolls to #how-it-works)
// - action: trackCta("Prøv intelligent vaktplanlegging") (final CTA)
// - color-regime: cyan accent throughout (cyan-400/500)

// -----------------------------------------------
// Shared animation variants
// -----------------------------------------------

/** Standard fade-up animation for section reveals. */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

/** Stagger container — children animate one after another. */
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

// -----------------------------------------------
// Data constants
// -----------------------------------------------

/** Problem cards — the three scheduling pains Henrik knows too well. */
const problemCards = [
  {
    icon: Clock,
    // CHANGED: "Overtidskaos" — the ops manager's #1 budget killer
    title: "Overtidskaos",
    description:
      "Du dekker hull med overtid fordi det haster. Lønnskostnadene eksploderer, og de ansatte brenner ut.",
  },
  {
    icon: AlertTriangle,
    // CHANGED: "Feil kompetanse, feil vakt" — the quality risk
    title: "Feil kompetanse, feil vakt",
    description:
      "Kokken med allergen-sertifisering har fri, men ingen sjekket det. Resultatet: risiko, stress og dårlig service.",
  },
  {
    icon: Puzzle,
    // CHANGED: "Manuell puslespill" — the time sink
    title: "Manuell puslespill",
    description:
      "Regneark, meldinger, post-it-lapper. Hver uke bruker du timer på å legge en plan som rakner etter to dager.",
  },
];

/** How-it-works steps — the three-step flow. */
const howItWorksSteps = [
  {
    icon: Users,
    step: "01",
    // CHANGED: "Definer kompetanse" — first you map who can do what
    title: "Definer kompetanse",
    description:
      "Kartlegg sertifiseringer, roller og ferdigheter for hver ansatt. Systemet vet hvem som kan hva.",
  },
  {
    icon: Zap,
    step: "02",
    // CHANGED: "AI matcher" — the intelligence layer
    title: "AI matcher",
    description:
      "Smartout analyserer kompetanse, tilgjengelighet og arbeidstidsregler — og foreslår optimale vakter.",
  },
  {
    icon: Send,
    step: "03",
    // CHANGED: "Publiser med ett klikk" — the payoff
    title: "Publiser med ett klikk",
    description:
      "Godkjenn planen og publiser. Alle ansatte får varsling. Bytter og justeringer håndteres automatisk.",
  },
];

/** Schedule grid data — mock shift data for the weekly preview. */
const weekDays = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;

const scheduleRows = [
  {
    name: "Erik H.",
    role: "Kjøkkensjef",
    shifts: [
      { time: "07–15", status: "filled" },
      { time: "07–15", status: "filled" },
      null,
      { time: "07–15", status: "filled" },
      { time: "07–15", status: "filled" },
      { time: "10–18", status: "filled" },
      null,
    ],
    badge: "HACCP",
    badgeColor: "emerald",
  },
  {
    name: "Marte S.",
    role: "Servitør",
    shifts: [
      { time: "15–23", status: "filled" },
      null,
      { time: "15–23", status: "filled" },
      { time: "15–23", status: "filled" },
      { time: "15–23", status: "filled" },
      null,
      { time: "12–20", status: "filled" },
    ],
    badge: "Allergen",
    badgeColor: "cyan",
  },
  {
    name: "Lars P.",
    role: "Bartender",
    shifts: [
      null,
      { time: "16–00", status: "filled" },
      { time: "16–00", status: "filled" },
      null,
      { time: "16–00", status: "filled" },
      { time: "16–02", status: "filled" },
      { time: "16–02", status: "filled" },
    ],
    badge: "Skjenke",
    badgeColor: "violet",
  },
  {
    name: "Ingrid B.",
    role: "Kokk",
    shifts: [
      { time: "07–15", status: "filled" },
      { time: "07–15", status: "filled" },
      { time: "07–15", status: "filled" },
      null,
      null,
      { time: "10–18", status: "warning" },
      { time: "10–18", status: "filled" },
    ],
    badge: "HACCP",
    badgeColor: "emerald",
  },
] as const;

/** Result metrics — soft, aspirational numbers. */
const resultMetrics = [
  {
    icon: TrendingDown,
    // CHANGED: "Færre overtidstimer" — direct cost saving
    value: "Færre overtidstimer",
    description: "Intelligent matching reduserer unødvendig overtid ved å fordele vakter jevnt.",
  },
  {
    icon: ShieldCheck,
    // CHANGED: "Bedre kompetansematch" — quality assurance
    value: "Bedre kompetansematch",
    description:
      "Riktig sertifisering på riktig vakt. Alltid. Ingen manuell sjekking mot regneark.",
  },
  {
    icon: Smile,
    // CHANGED: "Gladere ansatte" — the human outcome
    value: "Gladere ansatte",
    description: "Forutsigbare vakter, rettferdige fordelinger og færre siste-liten-endringer.",
  },
];

// -----------------------------------------------
// Helper: competence badge color mapping
// -----------------------------------------------

function badgeClasses(color: string): string {
  switch (color) {
    case "emerald":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "cyan":
      return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    case "violet":
      return "bg-violet-500/10 text-violet-400 border-violet-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

function shiftCellClasses(status: string | undefined): string {
  if (!status) return "";
  switch (status) {
    case "filled":
      return "bg-cyan-500/8 text-cyan-300 border-cyan-500/15";
    case "warning":
      return "bg-orange-500/8 text-orange-300 border-orange-500/15";
    default:
      return "bg-zinc-800/50 text-zinc-500 border-zinc-700/30";
  }
}

// ============================================
// Main component
// ============================================

/**
 * VariantVLanding — Intelligent scheduling landing page for persona "Henrik".
 *
 * This variant targets operations managers who struggle with manual scheduling,
 * overtime costs, and competence mismatches across shifts. The design is clean
 * and operational — dashboard aesthetic, not marketing fluff.
 *
 * Cyan accent color throughout. No voice widget, no AI section.
 *
 * @returns The complete landing page for the Henrik persona.
 */
export default function VariantVLanding() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const trackCta = useTrackCta();

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white selection:bg-cyan-500/30">
      <Navigation />

      <main>
        {/* ================================
            Section 1: Hero
            "Riktig person, riktig tid."
            Clean two-column: headline left, mini schedule card right.
            ================================ */}
        <section className="relative px-6 pt-32 pb-20 lg:pt-48 lg:pb-32">
          {/* Subtle cyan glow */}
          <div className="pointer-events-none absolute top-0 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-3xl" />

          <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
            {/* Left: Headline + CTAs */}
            <m.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ duration: 0.6 }}
              className="z-10"
            >
              {/* Category badge */}
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1">
                <CalendarDays className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-xs font-bold tracking-wider text-cyan-400 uppercase">
                  Intelligent vaktplanlegging
                </span>
              </div>

              <h1 className="mb-6 text-5xl leading-[1.08] font-black tracking-tight lg:text-7xl">
                {/* CHANGED: "Riktig person, riktig tid." — the core promise */}
                Riktig person,
                <span className="block bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
                  riktig tid.
                </span>
              </h1>

              <p className="mb-8 max-w-xl text-lg leading-relaxed text-zinc-400">
                {/* CHANGED: Pain-first subtitle targeting ops managers with 40+ employees */}
                Slutt med regneark og overtidskaos. Smartout matcher kompetanse, tilgjengelighet og
                arbeidstidsregler — og gir deg en vaktplan som faktisk holder.
              </p>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  href={WEB_APP_LINKS.onboarding}
                  onClick={() => trackCta("Start gratis")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-8 py-4 font-bold text-white shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_40px_rgba(6,182,212,0.5)]"
                >
                  {/* CHANGED: "Start gratis" — low friction for ops managers */}
                  Start gratis <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="#how-it-works"
                  onClick={() => trackCta("Se hvordan det fungerer")}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-8 py-4 text-center font-bold text-white transition-all hover:border-zinc-600 hover:bg-zinc-800"
                >
                  Se hvordan det fungerer
                </Link>
              </div>
            </m.div>

            {/* Right: Mini schedule card preview */}
            <m.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative z-10"
            >
              {/* Glow behind card */}
              <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-bl from-cyan-500/10 to-transparent blur-3xl" />

              <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0e] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                {/* Card header */}
                <div className="flex items-center justify-between border-b border-zinc-800 bg-[#121214] px-6 py-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-semibold text-zinc-300">
                      Uke 12 — Nordlys Brasserie
                    </span>
                  </div>
                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400">
                    Optimert
                  </span>
                </div>

                {/* Mini 3-row schedule preview */}
                <div className="p-4">
                  <div className="mb-3 grid grid-cols-4 gap-2 text-xs text-zinc-500">
                    <span />
                    <span className="text-center">Man</span>
                    <span className="text-center">Tir</span>
                    <span className="text-center">Ons</span>
                  </div>
                  {[
                    { name: "Erik H.", shifts: ["07–15", "07–15", "—"], color: "cyan" },
                    { name: "Marte S.", shifts: ["15–23", "—", "15–23"], color: "cyan" },
                    { name: "Lars P.", shifts: ["—", "16–00", "16–00"], color: "cyan" },
                  ].map((row, i) => (
                    <m.div
                      key={row.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                      className="mb-2 grid grid-cols-4 items-center gap-2"
                    >
                      <span className="truncate text-xs font-medium text-zinc-300">{row.name}</span>
                      {row.shifts.map((shift, j) => (
                        <div
                          key={`${row.name}-${j}`}
                          className={`rounded px-2 py-1.5 text-center text-xs ${
                            shift === "—"
                              ? "text-zinc-600"
                              : "border border-cyan-500/15 bg-cyan-500/8 text-cyan-300"
                          }`}
                        >
                          {shift}
                        </div>
                      ))}
                    </m.div>
                  ))}
                </div>

                {/* Status bar */}
                <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                    </span>
                    Alle kompetansekrav dekket
                  </div>
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>0 konflikter</span>
                  </div>
                </div>
              </div>
            </m.div>
          </div>
        </section>

        {/* ================================
            Section 2: The Problem
            3 cards showing scheduling chaos.
            ================================ */}
        <section className="relative px-6 py-24 lg:py-32">
          <div className="mx-auto max-w-7xl">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
                {/* CHANGED: "Kjenner du dette?" — direct address to the ops manager */}
                Kjenner du{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
                  dette?
                </span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                {/* CHANGED: Concrete scheduling pain, not abstract */}
                Tre problemer som koster deg tid, penger og gode ansatte — hver eneste uke.
              </p>
            </m.div>

            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid gap-8 md:grid-cols-3"
            >
              {problemCards.map((card) => (
                <m.div
                  key={card.title}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all hover:border-orange-500/30 hover:bg-zinc-900"
                >
                  {/* Problem cards use orange/rose tones — these are pain points */}
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10">
                    <card.icon className="h-6 w-6 text-orange-400" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-white">{card.title}</h3>
                  <p className="leading-relaxed text-zinc-400">{card.description}</p>
                </m.div>
              ))}
            </m.div>
          </div>
        </section>

        {/* ================================
            Section 3: How It Works
            3-step horizontal flow with numbered steps.
            ================================ */}
        <section id="how-it-works" className="relative px-6 py-24 lg:py-32">
          {/* Subtle cyan glow behind section */}
          <div className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-cyan-500/5 blur-3xl" />

          <div className="mx-auto max-w-7xl">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
                {/* CHANGED: "Tre steg. Ferdig plan." — efficient, no fluff */}
                Tre steg.{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
                  Ferdig plan.
                </span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                Fra kompetansekartlegging til publisert vaktplan — uten manuelt puslespill.
              </p>
            </m.div>

            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid gap-8 md:grid-cols-3"
            >
              {howItWorksSteps.map((step) => (
                <m.div
                  key={step.step}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className="relative rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all hover:border-cyan-500/30 hover:bg-zinc-900"
                >
                  {/* Step number */}
                  <span className="mb-5 block text-4xl font-black text-cyan-500/20">
                    {step.step}
                  </span>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
                    <step.icon className="h-6 w-6 text-cyan-400" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-white">{step.title}</h3>
                  <p className="leading-relaxed text-zinc-400">{step.description}</p>
                </m.div>
              ))}
            </m.div>
          </div>
        </section>

        {/* ================================
            Section 4: Live Schedule Preview
            Full weekly shift grid with competence badges.
            The centerpiece — this is what Henrik wants to see.
            ================================ */}
        <section className="relative px-6 py-24 lg:py-32">
          <div className="mx-auto max-w-7xl">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
                {/* CHANGED: "Full oversikt. Alltid." — the ops manager's dream */}
                Full oversikt.{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
                  Alltid.
                </span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                Se hvem som jobber når, med hvilken kompetanse — i sanntid, over alle lokasjoner.
              </p>
            </m.div>

            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0e] shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
            >
              {/* Grid header */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-[#121214] px-6 py-4">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-zinc-300">
                    Uke 12 — Nordlys Brasserie
                  </span>
                  <span className="hidden rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-400 sm:inline-flex">
                    3 lokasjoner
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                  </span>
                  Sanntid
                </div>
              </div>

              {/* Schedule table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase">
                      <th className="w-40 px-6 py-3 font-medium">Ansatt</th>
                      <th className="hidden px-2 py-3 font-medium sm:table-cell">Komp.</th>
                      {weekDays.map((day) => (
                        <th key={day} className="px-2 py-3 text-center font-medium">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((row, rowIdx) => (
                      <m.tr
                        key={row.name}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: rowIdx * 0.08 }}
                        className="border-b border-zinc-800/50"
                      >
                        <td className="px-6 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-200">{row.name}</span>
                            <span className="text-xs text-zinc-500">{row.role}</span>
                          </div>
                        </td>
                        <td className="hidden px-2 py-3 sm:table-cell">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClasses(row.badgeColor)}`}
                          >
                            {row.badge}
                          </span>
                        </td>
                        {row.shifts.map((shift, colIdx) => (
                          <td key={`${row.name}-${colIdx}`} className="px-1 py-3 text-center">
                            {shift ? (
                              <div
                                className={`rounded border px-1.5 py-1 text-xs font-medium ${shiftCellClasses(shift.status)}`}
                              >
                                {shift.time}
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-700">—</span>
                            )}
                          </td>
                        ))}
                      </m.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer stats */}
              <div className="flex flex-wrap items-center gap-6 border-t border-zinc-800 px-6 py-4 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-zinc-400">
                    <strong className="text-emerald-400">100%</strong> kompetansedekning
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-zinc-400">
                    <strong className="text-cyan-400">0</strong> overtidstimer denne uken
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-zinc-400">
                    <strong className="text-zinc-300">4</strong> av 12 ansatte vist
                  </span>
                </div>
              </div>
            </m.div>

            {/* Competence legend */}
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-zinc-500"
            >
              {[
                { label: "HACCP-sertifisert", color: "bg-emerald-400" },
                { label: "Allergen-opplæring", color: "bg-cyan-400" },
                { label: "Skjenkebevilling", color: "bg-violet-400" },
              ].map((legend) => (
                <div key={legend.label} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${legend.color}`} />
                  <span>{legend.label}</span>
                </div>
              ))}
            </m.div>
          </div>
        </section>

        {/* ================================
            Section 5: Results
            3 soft metric cards — benefits, not hard numbers.
            ================================ */}
        <section className="relative px-6 py-24 lg:py-32">
          <div className="pointer-events-none absolute top-1/2 right-0 -z-10 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-cyan-500/5 blur-3xl" />

          <div className="mx-auto max-w-7xl">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
                {/* CHANGED: "Resultatet?" — rhetorical, confident */}
                Resultatet?{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
                  Ro i driften.
                </span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                Når vaktplanen stemmer, faller alt annet på plass.
              </p>
            </m.div>

            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid gap-8 md:grid-cols-3"
            >
              {resultMetrics.map((metric) => (
                <m.div
                  key={metric.value}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center transition-all hover:border-cyan-500/30 hover:bg-zinc-900"
                >
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500/10 transition-colors group-hover:bg-cyan-500/20">
                    <metric.icon className="h-7 w-7 text-cyan-400" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-white">{metric.value}</h3>
                  <p className="leading-relaxed text-zinc-400">{metric.description}</p>
                </m.div>
              ))}
            </m.div>
          </div>
        </section>

        {/* ================================
            Section 6: Final CTA
            Strong close. Confident, not pushy.
            ================================ */}
        <section className="relative px-6 py-24 lg:py-32">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent" />

          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="mb-6 text-4xl font-bold tracking-tight lg:text-5xl">
              {/* CHANGED: "Klar for vaktplaner som holder?" — direct, operational */}
              Klar for vaktplaner som{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
                faktisk holder?
              </span>
            </h2>
            <p className="mb-10 text-lg leading-relaxed text-zinc-400">
              {/* CHANGED: Low-pressure, speaks to the ops manager's reality */}
              Prøv Smartout gratis. Ingen bindingstid, ingen implementeringsprosjekt. Legg inn
              ansatte, definer kompetanse — og la systemet gjøre jobben.
            </p>

            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Prøv intelligent vaktplanlegging")}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-10 py-5 text-lg font-bold text-white shadow-[0_0_40px_rgba(6,182,212,0.3)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_50px_rgba(6,182,212,0.5)]"
            >
              {/* CHANGED: "Prøv intelligent vaktplanlegging" — specific, not generic */}
              Prøv intelligent vaktplanlegging <ArrowRight className="h-5 w-5" />
            </Link>

            {/* Trust signals */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                <span>Gratis å prøve</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                <span>Ingen bindingstid</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                <span>Klar på 15 minutter</span>
              </div>
            </div>
          </m.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
