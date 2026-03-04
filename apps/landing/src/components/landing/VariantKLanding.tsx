// ============================================
// VariantKLanding.tsx
// Landing page variant K — "Katrine" (Consultant / Industry Authority).
// Persona: 60-year-old hospitality consultant with 30+ Norwegian clients.
// Wants proof, ROI, case studies, and benchmarks before recommending.
// Design energy: Editorial authority — emerald/teal accent palette.
// Connected to: app/page.tsx (variant switcher)
// ============================================

"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { usePageTracking, useTrackCta } from "../../hooks/useTracking";
import { useScrollTracking } from "../../hooks/useScrollTracking";
import { useClickTracking } from "../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../hooks/useSessionLifecycle";
import {
  ArrowRight,
  CheckCircle2,
  X,
  Scale,
  ShieldCheck,
  Wine,
  Quote,
  FileText,
  BarChart3,
  Handshake,
  TrendingUp,
  Users,
  Building,
  Award,
} from "lucide-react";
import Navigation from "../navigation";
import Footer from "../footer";
import VoiceDemoWidget from "./VoiceDemoWidget";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { VARIANT_VOICE_CONFIG, VARIANT_AI_SECTION } from "../../lib/variant-voice-config";

// -----------------------------------------------
// Shared animation variants for scroll-reveal.
// Each section fades in and slides up when it
// enters the viewport for the first time.
// -----------------------------------------------

/** Standard fade-up animation used by most section wrappers. */
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
// Data arrays — kept outside the component to
// avoid re-creating on every render.
// -----------------------------------------------

/** Case study cards for the "Client Results Grid" section. */
const caseStudies = [
  {
    city: "Bergen",
    name: "Fjordhotellet",
    category: "Hotel",
    metric: "67%",
    metricLabel: "reduksjon i opplæringstid",
    quote: "SmartOut halverte onboarding-tiden vår. Nye ansatte er produktive fra dag én.",
    author: "Marte Solberg",
    role: "HR-sjef",
  },
  {
    city: "Oslo",
    name: "Brasserie Nordlys",
    category: "Restaurant",
    metric: "89%",
    metricLabel: "compliance-score første kvartal",
    quote: "Vi gikk fra papirbaserte sjekklister til full digital compliance på under tre måneder.",
    author: "Erik Hansen",
    role: "Driftssjef",
  },
  {
    city: "Trondheim",
    name: "Kaffe & Kompani",
    category: "Kafé",
    metric: "43%",
    metricLabel: "lavere turnover",
    quote: "Ansatte føler seg trygge raskere. Det merkes direkte på stabiliteten.",
    author: "Lise Bakken",
    role: "Daglig leder",
  },
];

/** Before/After comparison items. */
const beforeItems = [
  "Manuelle sjekklister",
  "Inkonsekvent kvalitet",
  "Compliance-hull",
  "Papirbasert opplæring",
  "Ingen sporbarhet",
];

const afterItems = [
  "Digitale protokoller",
  "Konsistent standard",
  "Automatisk compliance",
  "Interaktiv opplæring",
  "Full sporbarhet",
];

/** Norwegian regulatory compliance cards. */
const regulatoryCards = [
  {
    icon: Scale,
    title: "Arbeidsmiljøloven",
    description: "Automatisk sporing av obligatorisk opplæring og HMS-krav.",
  },
  {
    icon: ShieldCheck,
    title: "Mattilsynet HACCP",
    description: "Digitale HACCP-sjekklister med automatisk loggføring.",
  },
  {
    icon: Wine,
    title: "Alkoholloven",
    description: "Sertifiseringssporing for skjenkebevilling og alderskontroll.",
  },
];

/** Industry endorsement quotes. */
const endorsements = [
  {
    quote:
      "Etter å ha evaluert flere plattformer for mine klienter, er SmartOut den eneste som faktisk leverer målbar ROI innen tre måneder.",
    author: "Bjørn Eriksen",
    role: "Partner, Hospitality Advisors",
  },
  {
    quote:
      "Compliance er ikke valgfritt i norsk hospitality. SmartOut gjør det til en automatisk del av hverdagen, ikke en byrde.",
    author: "Ingrid Vestby",
    role: "Seniorrådgiver, NHO Reiseliv",
  },
  {
    quote:
      "Jeg anbefaler SmartOut til alle mine F&B-klienter. Operasjonell forbedring på tvers av lokasjon og størrelse.",
    author: "Knut Olsen",
    role: "Konsulent, Nordic F&B Group",
  },
];

/** Consultant toolkit cards. */
const toolkitCards = [
  {
    icon: FileText,
    title: "White paper",
    description: "Komplett analyse av SmartOuts effekt på norsk hospitality.",
  },
  {
    icon: BarChart3,
    title: "ROI-dokumentasjon",
    description: "Detaljerte beregninger tilpasset kundens størrelse.",
  },
  {
    icon: Handshake,
    title: "Partnerprogram",
    description: "Bli sertifisert SmartOut-rådgiver med eksklusiv tilgang.",
  },
];

/**
 * VariantKLanding — Consultant / Industry Authority variant.
 *
 * Targets experienced hospitality consultants who evaluate tools
 * on behalf of their clients. Heavy emphasis on documented results,
 * Norwegian regulatory compliance, and ROI proof points.
 *
 * Eight sections: Hero, Client Results Grid, Before/After,
 * Norwegian Focus, Industry Endorsements, Consultant Toolkit, SmartOut AI, CTA.
 *
 * @returns The full Variant K landing page component.
 */
export default function VariantKLanding() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const trackCta = useTrackCta();

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white selection:bg-emerald-500/30">
      {/* Shared Navigation */}
      <Navigation />

      {/* ============================================
          Section 1 — Hero
          Asymmetric two-column layout. Left side has
          the headline, metric pull-quote, and CTAs.
          Right side features a case study card with
          real metrics and progress bars.
          ============================================ */}
      <section className="relative px-6 pt-32 pb-20 lg:pt-48 lg:pb-32">
        {/* Subtle emerald glow behind the hero */}
        <div className="pointer-events-none absolute top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          {/* Left Column — Headline + CTAs */}
          <m.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="z-10"
          >
            {/* Category badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">
              <Award className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
                Dokumentert effekt
              </span>
            </div>

            <h1 className="mb-6 text-5xl leading-[1.08] font-black tracking-tight lg:text-7xl">
              Vi leverer{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                resultater.
              </span>
              <br />
              Ikke løfter.
            </h1>

            {/* Metric pull-quote — editorial authority element */}
            <div className="mb-8 border-l-4 border-emerald-500 pl-5">
              <p className="text-3xl font-black text-white lg:text-4xl">67% reduksjon</p>
              <p className="text-lg text-zinc-400">
                i opplæringstid hos norske hospitality-bedrifter
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href={WEB_APP_LINKS.onboarding}
                onClick={() => trackCta("Se bevisene")}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 font-bold text-white shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)]"
              >
                Se bevisene <ArrowRight className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={() => trackCta("Last ned ROI-kalkulator")}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-8 py-4 text-center font-bold text-white transition-all hover:border-zinc-700 hover:bg-zinc-800"
              >
                Last ned ROI-kalkulator
              </button>
            </div>

            {/* Social proof counters */}
            <div className="mt-10 flex flex-wrap items-center gap-8 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-emerald-500" />
                <span>
                  <strong className="text-zinc-300">30+</strong> norske klienter
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span>
                  <strong className="text-zinc-300">3x</strong> raskere onboarding
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                <span>
                  <strong className="text-zinc-300">10,000+</strong> ansatte
                </span>
              </div>
            </div>
          </m.div>

          {/* Right Column — Featured Case Study Card */}
          <m.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative z-10"
          >
            {/* Card glow */}
            <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-bl from-emerald-500/15 to-transparent blur-3xl" />

            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0e] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-[#121214] px-6 py-4">
                <div>
                  <p className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
                    Casestudie
                  </p>
                  <h3 className="text-lg font-bold text-white">Fjordhotellet, Bergen</h3>
                </div>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                  Hotel
                </span>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-px bg-zinc-800">
                {[
                  { value: "67%", label: "Raskere opplæring" },
                  { value: "94%", label: "Compliance-score" },
                  { value: "3 mnd", label: "Tilbakebetalingstid" },
                ].map((metric) => (
                  <div key={metric.label} className="bg-[#0c0c0e] p-4 text-center">
                    <p className="text-2xl font-black text-emerald-400">{metric.value}</p>
                    <p className="text-xs text-zinc-500">{metric.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress bars — onboarding improvement areas */}
              <div className="space-y-4 p-6">
                <p className="mb-2 text-xs font-bold tracking-wider text-zinc-500 uppercase">
                  Forbedringsområder
                </p>
                {[
                  { label: "Onboarding-tid", before: 35, after: 88, color: "bg-emerald-500" },
                  { label: "Compliance", before: 42, after: 94, color: "bg-emerald-400" },
                  { label: "Ansatte-tilfredshet", before: 55, after: 82, color: "bg-teal-400" },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-zinc-400">{bar.label}</span>
                      <span className="font-bold text-emerald-400">{bar.after}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <m.div
                        initial={{ width: 0 }}
                        animate={{ width: `${bar.after}%` }}
                        transition={{ duration: 1.2, delay: 0.5 }}
                        className={`h-full rounded-full ${bar.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Manager quote */}
              <div className="border-t border-zinc-800 px-6 py-4">
                <div className="flex items-start gap-3">
                  <Quote className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500/50" />
                  <div>
                    <p className="text-sm leading-relaxed text-zinc-300 italic">
                      &ldquo;SmartOut halverte onboarding-tiden vår. Nye ansatte er produktive fra
                      dag én.&rdquo;
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">— Marte Solberg, HR-sjef</p>
                  </div>
                </div>
              </div>
            </div>
          </m.div>
        </div>
      </section>

      {/* ============================================
          Section 2 — Client Results Grid
          Three case study cards with metrics, quotes,
          and category badges. Staggered reveal.
          ============================================ */}
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
              Dokumenterte{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                resultater.
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              Hver implementering måles. Hver forbedring dokumenteres. Her er tallene fra tre norske
              bedrifter.
            </p>
          </m.div>

          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-8 md:grid-cols-3"
          >
            {caseStudies.map((study) => (
              <m.div
                key={study.name}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all hover:border-emerald-500/30 hover:bg-zinc-900"
              >
                {/* Location + category */}
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-sm text-zinc-500">{study.city}</p>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                    {study.category}
                  </span>
                </div>

                {/* Name */}
                <h3 className="mb-4 text-xl font-bold text-white">{study.name}</h3>

                {/* Key metric */}
                <div className="mb-6 border-l-4 border-emerald-500 pl-4">
                  <p className="text-3xl font-black text-emerald-400">{study.metric}</p>
                  <p className="text-sm text-zinc-400">{study.metricLabel}</p>
                </div>

                {/* Quote */}
                <div className="flex items-start gap-2">
                  <Quote className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500/40" />
                  <div>
                    <p className="text-sm leading-relaxed text-zinc-300 italic">
                      &ldquo;{study.quote}&rdquo;
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      — {study.author}, {study.role}
                    </p>
                  </div>
                </div>
              </m.div>
            ))}
          </m.div>
        </div>
      </section>

      {/* ============================================
          Section 3 — Before / After
          Side-by-side comparison panels showing the
          transformation SmartOut enables. Left panel
          uses rose/red tones, right uses emerald.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        {/* Section background accent */}
        <div className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="mx-auto max-w-5xl">
          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
              Forskjellen er{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                målbar.
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              Fra manuelle prosesser til digitalisert drift. Se hva som endres.
            </p>
          </m.div>

          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-8 md:grid-cols-2"
          >
            {/* Before panel */}
            <m.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8"
            >
              <h3 className="mb-6 text-lg font-bold text-rose-400">Før SmartOut</h3>
              <ul className="space-y-4">
                {beforeItems.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
                      <X className="h-4 w-4 text-rose-400" />
                    </div>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            </m.div>

            {/* After panel */}
            <m.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8"
            >
              <h3 className="mb-6 text-lg font-bold text-emerald-400">Med SmartOut</h3>
              <ul className="space-y-4">
                {afterItems.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            </m.div>
          </m.div>
        </div>
      </section>

      {/* ============================================
          Section 4 — Norwegian Focus
          Three cards covering key Norwegian regulatory
          frameworks: Arbeidsmiljøloven, Mattilsynet
          HACCP, and Alkoholloven.
          ============================================ */}
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
              Bygget for{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                norske regler.
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              Compliance er ikke valgfritt. SmartOut håndterer de norske kravene dine klienter
              sliter med.
            </p>
          </m.div>

          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-8 md:grid-cols-3"
          >
            {regulatoryCards.map((card) => (
              <m.div
                key={card.title}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all hover:border-emerald-500/30 hover:bg-zinc-900"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                  <card.icon className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-white">{card.title}</h3>
                <p className="leading-relaxed text-zinc-400">{card.description}</p>
              </m.div>
            ))}
          </m.div>
        </div>
      </section>

      {/* ============================================
          Section 5 — Industry Endorsements
          Three blockquotes from industry consultants
          and advisors, each with an emerald left-border
          for the editorial authority aesthetic.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        <div className="pointer-events-none absolute top-1/2 left-0 -z-10 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="mx-auto max-w-5xl">
          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
              Hva bransjen{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                sier.
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              Rådgivere og bransjeledere som har evaluert SmartOut for sine klienter.
            </p>
          </m.div>

          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-8"
          >
            {endorsements.map((endorsement) => (
              <m.blockquote
                key={endorsement.author}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all hover:border-emerald-500/20"
              >
                <div className="flex items-start gap-5">
                  {/* Emerald left-border stripe */}
                  <div className="hidden w-1 shrink-0 self-stretch rounded-full bg-emerald-500 sm:block" />

                  <div className="flex-1">
                    <Quote className="mb-3 h-6 w-6 text-emerald-500/40" />
                    <p className="mb-4 text-lg leading-relaxed text-zinc-200 italic">
                      &ldquo;{endorsement.quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                        <span className="text-sm font-bold text-emerald-400">
                          {endorsement.author.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-white">{endorsement.author}</p>
                        <p className="text-sm text-zinc-500">{endorsement.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </m.blockquote>
            ))}
          </m.div>
        </div>
      </section>

      {/* ============================================
          Section 6 — Consultant Toolkit
          Three resource cards targeting consultants
          who want materials to recommend SmartOut
          to their clients. Includes a CTA to join
          the partner program.
          ============================================ */}
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
              Anbefal SmartOut til{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                dine klienter.
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              Alt du trenger for å evaluere, dokumentere og anbefale SmartOut.
            </p>
          </m.div>

          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-8 md:grid-cols-3"
          >
            {toolkitCards.map((card) => (
              <m.div
                key={card.title}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all hover:border-emerald-500/30 hover:bg-zinc-900"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
                  <card.icon className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-white">{card.title}</h3>
                <p className="leading-relaxed text-zinc-400">{card.description}</p>
              </m.div>
            ))}
          </m.div>

          {/* Partner CTA */}
          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 text-center"
          >
            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Bli partnerrådgiver")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 font-bold text-white shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)]"
            >
              Bli partnerrådgiver <ArrowRight className="h-5 w-5" />
            </Link>
          </m.div>
        </div>
      </section>

      {/* ============================================
          Section 7 — SmartOut AI
          Metric-driven AI capability cards paired with
          the voice demo widget. Emerald accent, evidence
          style matching Katrine's consultant persona.
          ============================================ */}
      <section id="smartout-ai" className="relative px-6 py-24 lg:py-32">
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
              Dokumentert{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                AI-effekt
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              {VARIANT_AI_SECTION.K.subheading}
            </p>
          </m.div>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Left: Metric-style capability cards */}
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-6"
            >
              {VARIANT_AI_SECTION.K.capabilities.map((cap) => (
                <m.div
                  key={cap.title}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-emerald-500/30"
                >
                  <div className="mb-2 border-l-4 border-emerald-500 pl-4">
                    <p className="text-2xl font-black text-emerald-400">{cap.title}</p>
                  </div>
                  <p className="text-sm text-zinc-400">{cap.description}</p>
                </m.div>
              ))}
            </m.div>

            {/* Right: Voice widget */}
            <VoiceDemoWidget config={VARIANT_VOICE_CONFIG.K} height="460px" />
          </div>
        </div>
      </section>

      {/* ============================================
          Section 8 — Final CTA
          Data-driven closing with a clear call to
          action for booking a consultant briefing.
          Trust signals reinforced below the button.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        {/* Background accent */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" />

        <m.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="mb-6 text-4xl font-bold tracking-tight lg:text-5xl">
            Ta en strategisk avgjørelse{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
              basert på data.
            </span>
          </h2>
          <p className="mb-10 text-lg leading-relaxed text-zinc-400">
            30 minutter. Ingen forpliktelse. Vi viser deg tallene som er relevante for din klients
            bransje og størrelse.
          </p>

          <Link
            href={WEB_APP_LINKS.onboarding}
            onClick={() => trackCta("Book en konsulent-briefing")}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-10 py-5 text-lg font-bold text-white shadow-[0_0_40px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_50px_rgba(16,185,129,0.5)]"
          >
            Book en konsulent-briefing <ArrowRight className="h-5 w-5" />
          </Link>

          {/* Trust signals */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Dokumentert ROI</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>30 min briefing</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>30+ norske klienter</span>
            </div>
          </div>
        </m.div>
      </section>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
